using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.Win32;
using NaturalToQuery.Core.Contributers.Entities;
using NaturalToQuery.Core.Contributers.Entities.Queries;
using NaturalToQuery.Core.Exceptions;
using NaturalToQuery.Core.Interfaces;
using NaturalToQuery.Infrastructure.Cache;
using NaturalToQuery.Infrastructure.Interfaces;
using NaturalToQuery.SharedKernal.DTOs.Providers;
using NaturalToQuery.SharedKernal.Interfaces;
using System.Collections.Concurrent;
using System.Data;
using System.Data.Common;
using System.Text.RegularExpressions;

namespace NaturalToQuery.Infrastructure.Providers
{
    public class SqlServerDbProvider : IDbProvider
    {
        private static readonly Regex _writeVerbRegex = new Regex(
            @"\b(INSERT|UPDATE|DELETE|MERGE|CREATE|ALTER|DROP|TRUNCATE)\b",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

        private readonly Guid? _profileId;
        private readonly string _cacheDirectory;
        private readonly string _serverCacheFile;
        private readonly string _schemaCacheFile;
        private readonly TimeSpan _cacheTtl = TimeSpan.FromDays(7);

        private readonly ConcurrentDictionary<string, (DateTime fetchedAt, List<DatabaseInfo> dbs)> _dbCache = new();

        private readonly IConfiguration _configuration;
        private readonly IAppLogger<SqlServerDbProvider> _logger;
        private readonly IProviderCache _cache;
        private readonly IProfileRepository? _profileRepository;
        private readonly SemaphoreSlim _schemaRefreshLock = new(1, 1);

        public SqlServerDbProvider(
            IConfiguration configuration,
            IProfileRepository? profileRepository,
            IAppLogger<SqlServerDbProvider> logger,
            IProviderCache cache,
            Guid? profileId
            )
        {
            _configuration = configuration ?? throw new ArgumentNullException(nameof(configuration));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _cache = cache ?? throw new ArgumentNullException(nameof(cache));
            _profileRepository = profileRepository;
            _profileId = profileId;

            _cacheDirectory = CachePathHelper.DefaultCacheDirectory(ProviderType.SqlServer);

            Directory.CreateDirectory(_cacheDirectory);

            _serverCacheFile = CachePathHelper.GetServerCacheFile(_cacheDirectory, Dialect);
            _schemaCacheFile = CachePathHelper.GetSchemaCacheFile(_cacheDirectory, Dialect);
        }

        public async Task<bool> CheckConnection(ProviderConnectionConfig config, CancellationToken ct = default)
        {
            try
            {
                if (config == null || string.IsNullOrWhiteSpace(config.ConnectionString))
                {
                    throw new SqlServerProviderException("No Connection Info provided");
                }
                using var conn = CreateConnection(config);
                await conn.OpenAsync(ct);
                _logger.LogDebug("Connected to database for schema extraction (Server={Server}, Database={Database})",
                    config.Server, config.Database);
                return true;
            }
            catch (SqlServerProviderException)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogDebug("Failed to connect ConnectionString: {ConnectionString}", config.ConnectionString);
                return false;
            }
        }

        public DbConnection CreateConnection(ProviderConnectionConfig config)
        {
            try
            {
                if (config == null )
                {
                    throw new SqlServerProviderException("No Connection Config provided");
                }
                if (string.IsNullOrWhiteSpace(config.ConnectionString))
                {
                    throw new SqlServerProviderException("Failed to create connection, Connection string is not provided");
                }

                _logger.LogInformation("Creating connection (Server={Server}, Database={Database})",
                    config.Server, config.Database);

                return new SqlConnection(config.ConnectionString);
            }
            catch (SqlServerProviderException)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError("Failed to create connection (Server={Server}, Database={Database}): {Error}",
                    config.Server, config.Database, ex.Message);

                throw new SqlServerProviderException(
                    $"Failed to create connection to server '{config.Server}', database '{config.Database}'.",
                    config.Server, config.Database, ex);
            }
        }

        public async Task<IEnumerable<ServerInfo>> GetServersAsync(bool forceRefresh = false, CancellationToken ct = default)
        {
            _logger.LogInformation("Fetching servers (forceRefresh={ForceRefresh})", forceRefresh);

            try
            {
                // Try cache first
                if (!forceRefresh && await TryLoadServersFromCache(ct) is var cachedServers && cachedServers != null)
                {
                    return cachedServers;
                }

                // Discover servers
                var servers = await DiscoverServersFromRegistry(ct);

                if (servers.Count == 0)
                {
                    servers = await TryFallbackServers(ct);
                }

                // Cache results
                await CacheServers(servers, ct);
                return servers;
            }
            catch (Exception ex) when (!(ex is SqlServerProviderException))
            {
                throw new SqlServerProviderException(
                    "Failed to retrieve SQL Server instances.",
                    null, null, ex);
            }
        }

        public async Task<IEnumerable<DatabaseInfo>> GetDatabasesAsync(ProviderConnectionConfig config, CancellationToken ct = default)
        {
            if (config == null || string.IsNullOrWhiteSpace(config.ConnectionString))
            {
                throw new SqlServerProviderException("No Connection Info provided");
            }
            var cacheKey = config.Server;
            _logger.LogInformation("Fetching databases for server {Server}", cacheKey);

            try
            {
                // Check cache
                if (TryGetCachedDatabases(cacheKey, out var cachedDbs))
                {
                    return cachedDbs;
                }

                // Fetch from database
                var dbs = await FetchDatabasesFromServer(config, ct);

                // Update cache
                _dbCache[cacheKey] = (DateTime.UtcNow, dbs);
                return dbs;
            }
            catch (SqlServerProviderException)
            {
                throw;
            }
            catch (Exception ex)
            {
                throw new SqlServerProviderException(
                    $"Failed to retrieve databases from server '{config.Server}'.",
                    config.Server, null, ex);
            }
        }

        public async Task<IEnumerable<DatabaseInfo>> GetDatabasesAsync(string serverName, CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(serverName))
            {
                throw new SqlServerProviderException("No server name provided");
            }
            var config = new ProviderConnectionConfig(serverName, "master");
            return await GetDatabasesAsync(config, ct);
        }

        public async Task<SchemaModel> GetSchemaAsync(ProviderConnectionConfig config, bool forceRefresh = false, CancellationToken ct = default)
        {
            ArgumentNullException.ThrowIfNull(config);

            var cacheKey = string.IsNullOrWhiteSpace(config.Database)
                ? config.Server
                : $"{config.Server}|{config.Database}";

            _logger.LogInformation("Fetching schema for {CacheKey} (ForceRefresh={ForceRefresh})",
                cacheKey, forceRefresh);

            try
            {
                // Try cache first
                if (!forceRefresh && await TryLoadSchemaFromCache(cacheKey, ct) is var cachedSchema && cachedSchema != null)
                {
                    return cachedSchema;
                }

                // Load schema from database
                var schema = await LoadSchemaFromDatabase(config, ct);

                // Cache the result
                await CacheSchema(cacheKey, schema, ct);

                return schema;
            }
            catch (SqlServerProviderException)
            {
                throw;
            }
            catch (Exception ex)
            {
                throw new SqlServerProviderException(
                    $"Failed to load schema from server '{config.Server}', database '{config.Database}'.",
                    config.Server, config.Database, ex);
            }
        }

        public async Task<ExecutionResult> ExecuteAsync(
            ProviderConnectionConfig config,
            string sql,
            string userQuery,
            IDictionary<string, string?> parameters = null,
            ExecutionMode mode = ExecutionMode.ReadOnly,
            CancellationToken ct = default)
        {
            if (config == null || string.IsNullOrWhiteSpace(config.ConnectionString))
            {
                throw new SqlServerProviderException("No Connection Info provided");
            }
            if (string.IsNullOrWhiteSpace(sql))
            {
                throw new SqlServerProviderException("No sql query provided");
            }
            if (string.IsNullOrWhiteSpace(userQuery))
            {
                throw new SqlServerProviderException("No user query provided");
            }

            ValidateExecutionMode(sql, mode);

            _logger.LogInformation("Executing SQL on {Server}/{Database} (Mode={Mode})", config.Server, config.Database, mode);
            _logger.LogDebug("SQL: {Sql}", sql);

            ExecutionResult? result = null;

            try
            {
                result = await ExecuteSqlCommand(config, sql, ct, parameters);
            }
            catch (DbExecutionException ex)
            {
                result = await TrySaveFailedQuery(sql, userQuery, ex, ct);
                throw;
            }
            catch (SqlServerProviderException ex)
            {
                result = await TrySaveFailedQuery(sql, userQuery, ex, ct);
                throw;
            }
            catch (Exception ex)
            {
                result = await TrySaveFailedQuery(sql, userQuery, ex, ct);

                throw new SqlServerProviderException(
                    $"Failed to execute SQL on server '{config.Server}', database '{config.Database}'.",
                    config.Server, config.Database, ex);
            }
            if (_profileId.HasValue && _profileRepository != null)
            {
                try { await SaveQueryToProfile(userQuery, sql, result!, ct); }
                catch (Exception saveEx) { _logger.LogWarning(saveEx.Message, "Failed to save successful query to profile"); }
            }

            return result!;
        }

        private async Task<ExecutionResult> TrySaveFailedQuery(string sql, string userQuery, Exception ex, CancellationToken ct)
        {
            if (ex is DbExecutionException dbEx && dbEx.Error is ExecutionResult dbResult)
            {
                if (_profileId.HasValue && _profileRepository != null)
                {
                    try
                    {
                        await SaveQueryToProfile(userQuery, sql, dbResult, ct);
                    }
                    catch (Exception saveEx)
                    {
                        _logger.LogWarning(saveEx.Message, "Failed to save failed query to profile {ProfileId}", _profileId);
                    }
                }
                return dbResult;
            }

            var result = new ExecutionResult { ErrorMessage = ex.Message ?? ex.GetType().Name };

            if (_profileId.HasValue && _profileRepository != null)
            {
                try
                {
                    await SaveQueryToProfile(userQuery, sql, result, ct);
                }
                catch (Exception saveEx)
                {
                    _logger.LogWarning(saveEx.Message, "Failed to save failed query to profile {ProfileId}", _profileId);
                }
            }

            return result;
        }

        #region server helpers
        private async Task<int> GetRunningDatabaseCountAsync(ProviderConnectionConfig config, CancellationToken ct = default)
            {
                try
                {
                    var canConnect = await CheckConnection(config, ct);
                    if (!canConnect)
                    {
                        _logger.LogWarning("Unable to connect to server {Server} when counting DBs", config.Server);
                        return -1;
                    }

                    await using var conn = CreateConnection(config);
                    await conn.OpenAsync(ct);

                    await using var cmd = conn.CreateCommand();
                    cmd.CommandText = "SELECT COUNT(*) FROM sys.databases WHERE state = 0 AND database_id > 4";

                    var scalar = await cmd.ExecuteScalarAsync(ct);
                    return Convert.ToInt32(scalar);
                }
                catch (OperationCanceledException) when (ct.IsCancellationRequested)
                {
                    throw;
                }
                catch (SqlServerProviderException)
                {
                    _logger.LogWarning("Failed to count databases on server {Server} due to provider error", config.Server);
                    return -1;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning("Failed to count databases on server {Server}: {Error}", config.Server, ex.Message);
                    return -1;
                }
            }

            private async Task<List<ServerInfo>?> TryLoadServersFromCache(CancellationToken ct)
            {
                try
                {
                    var cached = await _cache.LoadAsync<CachedServers>(_serverCacheFile, ct);
                    if (cached != null && DateTime.UtcNow - cached.TimestampUtc < _cacheTtl)
                    {
                        _logger.LogInformation("Loaded {Count} servers from cache file", cached.Servers.Count);
                        return cached.Servers;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError("Failed to read/parse server cache file {CacheFile}: {Error}", _serverCacheFile, ex.Message);
                }

                return null;
            }

            private async Task<List<ServerInfo>> DiscoverServersFromRegistry(CancellationToken ct)
            {
                var servers = new List<ServerInfo>();

                try
                {
                    var basekey = _configuration["SupportDBs:0:BaseKey"];
                    _logger.LogDebug("Looking up servers from registry key {Key}", basekey);

                    foreach (var view in new[] { RegistryView.Registry32, RegistryView.Registry64 })
                    {
                        using var reg = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, view);
                        using var sub = reg.OpenSubKey(basekey);

                        if (sub == null) continue;

                        foreach (var instance in sub.GetValueNames())
                        {
                            string serverName = instance == "MSSQLSERVER"
                                ? Environment.MachineName
                                : $"{Environment.MachineName}\\{instance}";
                            if (servers.Any(s => s.Name.Equals(serverName, StringComparison.OrdinalIgnoreCase)))
                                continue;
                            var cfg = new ProviderConnectionConfig(server: serverName, database: "master");

                            int runningDbs = await GetRunningDatabaseCountAsync(cfg, ct);
                            servers.Add(new ServerInfo(serverName, Dialect, runningDbs));
                            _logger.LogInformation("Discovered server {ServerName} with {Count} running DBs", serverName, runningDbs);
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError("Failed to read SQL Server instances from registry: {Error}", ex.Message);
                }

                return servers;
            }

            private async Task<List<ServerInfo>> TryFallbackServers(CancellationToken ct)
            {
                var servers = new List<ServerInfo>();
                _logger.LogWarning("No servers found, trying fallback names...");

                var fallbackNames = new[] { "(localdb)\\MSSQLLocalDB", "localhost", ".", "127.0.0.1", Environment.MachineName };
                foreach (var candidate in fallbackNames)
                {
                    try
                    {
                        ct.ThrowIfCancellationRequested();

                        var config = new ProviderConnectionConfig(candidate, "master", connectTimeout: 2);

                        var runningDbs = await GetRunningDatabaseCountAsync(config, ct);

                        servers.Add(new ServerInfo(candidate, Dialect, runningDbs));
                        _logger.LogInformation("Connected successfully to fallback server {Server} (runningDbs={Count})", candidate, runningDbs);

                        break;
                    }
                    catch (OperationCanceledException)
                    {
                        throw;
                    }
                    catch (Exception ex)
                    {
                        _logger.LogDebug("Failed to connect to fallback {Candidate}: {Error}", candidate, ex.Message);
                    }
                }
                return servers;
            }

            private async Task CacheServers(List<ServerInfo> servers, CancellationToken ct)
            {
                await _schemaRefreshLock.WaitAsync(ct);
                try
                {
                    var tocache = new CachedServers
                    {
                        TimestampUtc = DateTime.UtcNow,
                        Servers = servers
                    };
                    await _cache.SaveAndReplaceAsync(_serverCacheFile, tocache, ct);
                    _logger.LogInformation("Cached {Count} servers to {CacheFile}", servers.Count, _serverCacheFile);
                }
                catch (Exception ex)
                {
                    _logger.LogError("Failed to write server cache file {CacheFile}: {Error}", _serverCacheFile, ex.Message);
                }
                finally
                {
                    _schemaRefreshLock.Release();
                }
            }

        #endregion

        #region database helpers
            private static string QuoteIdentifier(string name)
            {
                return "[" + name.Replace("]", "]]") + "]";
            }

            private bool TryGetCachedDatabases(string cacheKey, out IEnumerable<DatabaseInfo> databases)
            {
                databases = null;

                if (_dbCache.TryGetValue(cacheKey, out var cached) &&
                    DateTime.UtcNow - cached.fetchedAt < _cacheTtl)
                {
                    _logger.LogInformation("Using cached databases for {Server}, count={Count}", cacheKey, cached.dbs.Count);
                    databases = cached.dbs;
                    return true;
                }
                return false;
            }

            private async Task<List<DatabaseInfo>> FetchDatabasesFromServer(ProviderConnectionConfig config, CancellationToken ct)
            {
                var dbs = new List<DatabaseInfo>();

                try
                {
                    using var conn = CreateConnection(config);
                    await conn.OpenAsync(ct);
                    _logger.LogDebug("Connected to server {Server}", config.Server);

                    var sql = @"SELECT name FROM sys.databases WHERE state = 0 ORDER BY name";
                    var list = await conn.QueryAsync<string>(sql);

                    foreach (var name in list)
                    {
                        if (string.IsNullOrWhiteSpace(name))
                            continue;
                        try
                        {
                            var quotedDb = QuoteIdentifier(name);
                            var tableSql = $"SELECT COUNT(*) FROM {quotedDb}.sys.tables";

                            await using var countCmd = conn.CreateCommand();
                            countCmd.CommandText = tableSql;

                            var scalar = await countCmd.ExecuteScalarAsync(ct);
                            var tableCount = Convert.ToInt32(scalar);

                            dbs.Add(new DatabaseInfo(name, tableCount));
                        }
                        catch (OperationCanceledException) when (ct.IsCancellationRequested)
                        {
                            throw;
                        }
                        catch (Exception exDb)
                        {
                            _logger.LogWarning("Failed to count tables for database {Database} on server {Server}: {Error}",
                                name, config.Server, exDb.Message);
                            dbs.Add(new DatabaseInfo(name, -1));
                        }
                    }

                    _logger.LogInformation("Found {Count} databases on {Server}", dbs.Count, config.Server);
                }
                catch (SqlServerProviderException)
                {
                    throw;
                }
                catch (Exception ex)
                {
                    _logger.LogError("Failed to fetch databases for {Server}: {Error}", config.Server, ex.Message);
                    throw new SqlServerProviderException(
                        $"Failed to fetch databases from server '{config.Server}'.",
                        config.Server, null, ex);
                }

                return dbs;
            }

        #endregion

        #region schema helpers
            private async Task<SchemaModel?> TryLoadSchemaFromCache(string cacheKey, CancellationToken ct)
            {
                if (!File.Exists(_schemaCacheFile)) return null;

                try
                {
                    var cachedAll = await _cache.LoadAsync<Dictionary<string, SchemaModel>>(_schemaCacheFile, ct);
                    if (cachedAll != null && cachedAll.TryGetValue(cacheKey, out var cachedSchema))
                    {
                        _logger.LogInformation("Loaded schema for {CacheKey} from cache file", cacheKey);
                        return cachedSchema;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError("Failed to read/parse schema cache file {CacheFile}: {Error}", _schemaCacheFile, ex.Message);
                }

                return null;
            }

            private async Task<SchemaModel> LoadSchemaFromDatabase(ProviderConnectionConfig config, CancellationToken ct)
            {
                try
                {
                    using var conn = CreateConnection(config);
                    await conn.OpenAsync(ct);
                    _logger.LogDebug("Connected to database for schema extraction (Server={Server}, Database={Database})",
                        config.Server, config.Database);

                    var schema = new SchemaModel { Database = config.Database };

                    // Load tables
                    var tables = await conn.QueryAsync<(string TABLE_SCHEMA, string TABLE_NAME)>(@"
                            SELECT TABLE_SCHEMA, TABLE_NAME
                            FROM INFORMATION_SCHEMA.TABLES
                            WHERE TABLE_TYPE = 'BASE TABLE'
                            ORDER BY TABLE_SCHEMA, TABLE_NAME");

                    foreach (var t in tables)
                    {
                        schema.Tables.Add(new TableInfo { Schema = t.TABLE_SCHEMA, Name = t.TABLE_NAME });
                    }

                    var tableMap = schema.Tables.ToDictionary(t => (t.Schema, t.Name), t => t);
                    _logger.LogInformation("Loaded {Count} tables", schema.Tables.Count);

                    // Load columns
                    var columns = await conn.QueryAsync<(string TABLE_SCHEMA, string TABLE_NAME, string COLUMN_NAME, string DATA_TYPE, string IS_NULLABLE, int ORDINAL_POSITION)>(@"
                            SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE, ORDINAL_POSITION
                            FROM INFORMATION_SCHEMA.COLUMNS
                            WHERE TABLE_CATALOG = @db
                            ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION",
                        new { db = config.Database });

                    foreach (var c in columns)
                    {
                        if (tableMap.TryGetValue((c.TABLE_SCHEMA, c.TABLE_NAME), out var table))
                        {
                            table.Columns.Add(new ColumnInfo
                            {
                                Name = c.COLUMN_NAME,
                                DataType = c.DATA_TYPE,
                                IsNullable = string.Equals(c.IS_NULLABLE, "YES", StringComparison.OrdinalIgnoreCase)
                            });
                        }
                    }

                    // Load primary keys
                    var pks = await conn.QueryAsync<(string sch, string tbl, string col)>(@"
                            SELECT s.name AS SchemaName, t.name AS TableName, c.name AS ColumnName
                            FROM sys.schemas s
                            JOIN sys.tables t ON t.schema_id = s.schema_id
                            JOIN sys.indexes i ON i.object_id = t.object_id AND i.is_primary_key = 1
                            JOIN sys.index_columns ic ON ic.object_id = t.object_id AND ic.index_id = i.index_id
                            JOIN sys.columns c ON c.object_id = t.object_id AND c.column_id = ic.column_id
                            WHERE t.is_ms_shipped = 0");

                    foreach (var pk in pks)
                    {
                        if (tableMap.TryGetValue((pk.sch, pk.tbl), out var table))
                        {
                            var col = table.Columns.FirstOrDefault(x => string.Equals(x.Name, pk.col, StringComparison.OrdinalIgnoreCase));
                            if (col != null) col.IsPrimaryKey = true;
                        }
                    }

                    // Load foreign keys
                    var fks = await conn.QueryAsync<(string fromSch, string fromTbl, string fromCol, string toSch, string toTbl, string toCol)>(@"
                            SELECT 
                                schFrom.name AS FromSchema, tabFrom.name AS FromTable, colFrom.name AS FromColumn,
                                schTo.name AS ToSchema, tabTo.name AS ToTable, colTo.name AS ToColumn
                            FROM sys.foreign_keys fk
                            JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
                            JOIN sys.schemas schFrom ON schFrom.schema_id = fk.schema_id
                            JOIN sys.tables tabFrom ON tabFrom.object_id = fkc.parent_object_id
                            JOIN sys.columns colFrom ON colFrom.object_id = fkc.parent_object_id AND colFrom.column_id = fkc.parent_column_id
                            JOIN sys.tables tabTo ON tabTo.object_id = fkc.referenced_object_id
                            JOIN sys.columns colTo ON colTo.object_id = fkc.referenced_object_id AND colTo.column_id = fkc.referenced_column_id
                            JOIN sys.schemas schTo ON schTo.schema_id = tabTo.schema_id");

                    foreach (var fk in fks)
                    {
                        schema.Relations.Add(new RelationInfo
                        {
                            FromSchema = fk.fromSch,
                            FromTable = fk.fromTbl,
                            FromColumn = fk.fromCol,
                            ToSchema = fk.toSch,
                            ToTable = fk.toTbl,
                            ToColumn = fk.toCol
                        });

                        if (tableMap.TryGetValue((fk.fromSch, fk.fromTbl), out var table))
                        {
                            var col = table.Columns.FirstOrDefault(x => string.Equals(x.Name, fk.fromCol, StringComparison.OrdinalIgnoreCase));
                            if (col != null)
                            {
                                col.IsForeignKey = true;
                                col.ReferencesTable = fk.toTbl;
                                col.ReferencesColumn = fk.toCol;
                            }
                        }
                    }

                    _logger.LogInformation("Schema loaded: {Tables} tables, {Columns} columns, {Relations} relations",
                        schema.Tables.Count, columns.Count(), schema.Relations.Count);

                    return schema;
                }
                catch (SqlServerProviderException)
                {
                    throw;
                }
                catch (Exception ex)
                {
                    throw new SqlServerProviderException(
                        $"Failed to load schema from server '{config.Server}', database '{config.Database}'.",
                        config.Server, config.Database, ex);
                }
            }

            private async Task CacheSchema(string cacheKey, SchemaModel schema, CancellationToken ct)
            {
                await _schemaRefreshLock.WaitAsync(ct);
                try
                {
                    var tocache = await _cache.LoadAsync<Dictionary<string, SchemaModel>>(_schemaCacheFile, ct)
                        ?? new Dictionary<string, SchemaModel>();
                    tocache[cacheKey] = schema;

                    await _cache.SaveAndReplaceAsync(_schemaCacheFile, tocache, ct);
                    _logger.LogInformation("Cached schema for {CacheKey} to {CacheFile}", cacheKey, _schemaCacheFile);
                }
                catch (Exception ex)
                {
                    _logger.LogError("Failed to write schema cache file {CacheFile}: {Error}", _schemaCacheFile, ex.Message);
                }
                finally
                {
                    _schemaRefreshLock.Release();
                }
            }

        #endregion

        #region exec helpers
            private static void ValidateExecutionMode(string sql, ExecutionMode mode)
            {
                if (mode.Equals(ExecutionMode.ReadOnly) && _writeVerbRegex.IsMatch(sql))
                {
                    throw new InvalidOperationException("The SQL contains write operations which are not allowed in ReadOnly mode.");
                }
            }

            private async Task<ExecutionResult> ExecuteSqlCommand(ProviderConnectionConfig config, string sql, CancellationToken ct, IDictionary<string, string?> parameters)
            {
                var sw = System.Diagnostics.Stopwatch.StartNew();

                try
                {
                    using var conn = CreateConnection(config);
                    await conn.OpenAsync(ct);
                    _logger.LogDebug("Connection opened to {Server}", config.Server);

                    var trimmed = sql.TrimStart();
                    var firstWord = trimmed.Split(' ', '\r', '\n', '\t').FirstOrDefault()?.ToUpperInvariant();

                    if (IsQueryCommand(firstWord))
                    {
                        return await ExecuteQuery(conn, sql, parameters, ct, sw);
                    }
                    else
                    {
                        return await ExecuteNonQuery(conn, config, sql, parameters, ct, sw);
                    }
                }
                catch (SqlServerProviderException ex)
                {
                    sw.Stop();
                    throw;
                }
                catch (Exception ex)
                {
                    sw.Stop();
                    var error = new ExecutionResult
                    {
                        ErrorMessage = ex.Message,
                        ExecutionMs = sw.ElapsedMilliseconds
                    };
                    _logger.LogError("SQL execution failed after {Elapsed} ms: {Error}", sw.ElapsedMilliseconds, ex.Message);
                    throw new DbExecutionException("Error executing SQL command.", ex, error);
                }
            }

            private static bool IsQueryCommand(string? firstWord)
            {
                return firstWord is "SELECT" or "WITH" or "EXEC" or "VALUES";
            }

            private async Task<ExecutionResult> ExecuteQuery(DbConnection conn, string sql, IDictionary<string, string?> parameters, CancellationToken ct, System.Diagnostics.Stopwatch sw)
            {
                using var cmd = conn.CreateCommand();
                cmd.CommandText = sql;
                cmd.CommandType = CommandType.Text;
                DbCommandJsonParameterHelper.AddParametersFromJson(cmd, parameters);

                using var reader = await cmd.ExecuteReaderAsync(ct);
                var cols = Enumerable.Range(0, reader.FieldCount).Select(i => reader.GetName(i)).ToArray();
                var rows = new List<object[]>();

                while (await reader.ReadAsync(ct))
                {
                    var row = new object[reader.FieldCount];
                    reader.GetValues(row);
                    row = row.Select(v => v == DBNull.Value ? null : v).ToArray();
                    rows.Add(row);
                }

                sw.Stop();

                var result = new ExecutionResult
                {
                    Columns = cols,
                    Rows = rows.ToArray(),
                    ExecutionMs = sw.ElapsedMilliseconds,
                    AffectedRows = rows.Count
                };

                _logger.LogInformation("Query execution finished in {Elapsed} ms, returned {Rows} rows",
                    sw.ElapsedMilliseconds, result.AffectedRows);

                return result;
            }

            private async Task<ExecutionResult> ExecuteNonQuery(DbConnection conn, ProviderConnectionConfig config, string sql, IDictionary<string,string?> parameters, CancellationToken ct, System.Diagnostics.Stopwatch sw)
            {
                using var cmd = conn.CreateCommand();
                cmd.CommandText = sql;
                cmd.CommandType = CommandType.Text;
                DbCommandJsonParameterHelper.AddParametersFromJson(cmd, parameters);

                var affected = await cmd.ExecuteNonQueryAsync(ct);
                sw.Stop();

                var result = new ExecutionResult
                {
                    Columns = Array.Empty<string>(),
                    Rows = Array.Empty<object[]>(),
                    ExecutionMs = sw.ElapsedMilliseconds,
                    AffectedRows = affected,
                    Parameters = parameters ?? new Dictionary<string, string?>()
                };
                await GetSchemaAsync(config, true, ct);
                _logger.LogInformation("Non-query execution finished in {Elapsed} ms, affected {Rows} rows",
                    sw.ElapsedMilliseconds, result.AffectedRows);

                return result;
            }

            private async Task SaveQueryToProfile(string userQuery, string sql, ExecutionResult result, CancellationToken ct)
            {
                if (_profileRepository == null || !_profileId.HasValue)
                    return;

                await _schemaRefreshLock.WaitAsync(ct);
                try
                {
                    var profile = await _profileRepository.GetByIdAsync(_profileId.Value, ct)
                        ?? throw new InvalidOperationException($"Profile {_profileId} not found.");

                    var newQuery = new Query
                    {
                        Id = Guid.NewGuid(),
                        UserQuery = userQuery,
                        SqlQuery = sql,
                        TimestampUtc = DateTime.UtcNow,
                        ProfileId = profile.Id
                    };
                    newQuery.SetResult(result);

                    var RulePermitted = profile.AddQuery(newQuery);
                    if (RulePermitted == true)
                    {
                        await _profileRepository.AddQueryAsync(profile, newQuery, ct);
                        await _profileRepository.SaveChangesAsync(ct);
                        _logger.LogInformation("Saved query to DB for profile {ProfileId}", profile.Id);
                    }
                    else
                    {
                        _logger.LogInformation("Query not saved due to profile rules for profile {ProfileId}, Query already existed", profile.Id);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError("Failed to persist query to DB for userQuery={UserQuery}: {Error}", userQuery, ex.Message);
                }
                finally
                {
                    _schemaRefreshLock.Release();
                }
            }

        #endregion

        public string Dialect => ProviderType.SqlServer.ToString();

        public ValueTask DisposeAsync()
        {
            _schemaRefreshLock?.Dispose();
            return ValueTask.CompletedTask;
        }
    }
}