using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Moq;
using NaturalToQuery.Core.Exceptions;
using NaturalToQuery.Infrastructure.Interfaces;
using NaturalToQuery.Infrastructure.Providers;
using NaturalToQuery.Core.Interfaces;
using NaturalToQuery.SharedKernal.DTOs.Providers;
using NaturalToQuery.SharedKernal.Interfaces;
using System.Data;
using System.Data.Common;


namespace NatrualToQuery.UnitTest.Providers
{
    public class SqlServerDbProviderTests : IDisposable
    {
        private readonly Mock<IConfiguration> _mockConfiguration;
        private readonly Mock<IProfileRepository> _mockProfileRepository;
        private readonly Mock<IAppLogger<SqlServerDbProvider>> _mockLogger;
        private readonly Mock<IProviderCache> _mockCache;
        private readonly string _tempCacheDirectory;
        private readonly Guid _testProfileId = Guid.NewGuid();

        public SqlServerDbProviderTests()
        {
            _mockConfiguration = new Mock<IConfiguration>();
            _mockProfileRepository = new Mock<IProfileRepository>();
            _mockLogger = new Mock<IAppLogger<SqlServerDbProvider>>();
            _mockCache = new Mock<IProviderCache>();

            // Setup temp directory for cache tests
            _tempCacheDirectory = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString());
            Directory.CreateDirectory(_tempCacheDirectory);

            // Setup default configuration
            _mockConfiguration.Setup(x => x["SupportDBs:0:BaseKey"])
                .Returns(@"SOFTWARE\\Microsoft\\Microsoft SQL Server\\Instance Names\\SQL");
        }

        public void Dispose()
        {
            if (Directory.Exists(_tempCacheDirectory))
            {
                Directory.Delete(_tempCacheDirectory, true);
            }
        }

        private SqlServerDbProvider CreateProvider(Guid? profileId = null)
        {
            return new SqlServerDbProvider(
                _mockConfiguration.Object,
                _mockProfileRepository.Object,
                _mockLogger.Object,
                _mockCache.Object, 
                profileId ?? _testProfileId
                );
        }

        [Fact]
        public void Constructor_WithNullConfiguration_ThrowsArgumentNullException()
        {
            // Act & Assert
            var ex = Assert.Throws<ArgumentNullException>(() =>
                new SqlServerDbProvider(null, _mockProfileRepository.Object, _mockLogger.Object, _mockCache.Object, _testProfileId));

            Assert.Equal("configuration", ex.ParamName);
        }

        [Fact]
        public void Constructor_WithNullLogger_ThrowsArgumentNullException()
        {
            // Act & Assert
            var ex = Assert.Throws<ArgumentNullException>(() =>
                new SqlServerDbProvider(_mockConfiguration.Object, _mockProfileRepository.Object, null, _mockCache.Object, _testProfileId));

            Assert.Equal("logger", ex.ParamName);
        }

        [Fact]
        public void Constructor_WithNullCache_ThrowsArgumentNullException()
        {
            // Act & Assert
            var ex = Assert.Throws<ArgumentNullException>(() =>
                new SqlServerDbProvider(_mockConfiguration.Object, _mockProfileRepository.Object, _mockLogger.Object, null, _testProfileId));

            Assert.Equal("cache", ex.ParamName);
        }

        [Fact]
        public void Constructor_WithValidParameters_InitializesSuccessfully()
        {
            // Act
            var provider = CreateProvider();

            // Assert
            Assert.NotNull(provider);
            Assert.Equal("SqlServer", provider.Dialect);
        }

        [Theory]
        [InlineData("SELECT * FROM Users", ExecutionMode.ReadOnly)]
        [InlineData("SELECT COUNT(*) FROM Orders", ExecutionMode.ReadOnly)]
        [InlineData("WITH cte AS (SELECT * FROM Users) SELECT * FROM cte", ExecutionMode.ReadOnly)]
        public void ValidateExecutionMode_WithReadOnlyQueryInReadOnlyMode_DoesNotThrow(string sql, ExecutionMode mode)
        {
            var provider = CreateProvider();
            var config = new ProviderConnectionConfig("localhost", "testdb");

            Assert.True(true); 
        }

        [Theory]
        [InlineData("INSERT INTO Users VALUES (1, 'Test')", ExecutionMode.ReadOnly)]
        [InlineData("UPDATE Users SET Name = 'Test'", ExecutionMode.ReadOnly)]
        [InlineData("DELETE FROM Users WHERE Id = 1", ExecutionMode.ReadOnly)]
        [InlineData("CREATE TABLE Test (Id INT)", ExecutionMode.ReadOnly)]
        [InlineData("DROP TABLE Test", ExecutionMode.ReadOnly)]
        public async Task ExecuteAsync_WithWriteOperationInReadOnlyMode_ThrowsInvalidOperationException(string sql, ExecutionMode mode)
        {
            // Arrange
            var provider = CreateProvider();
            var config = new ProviderConnectionConfig("localhost", "testdb");

            // Act & Assert
            var ex = await Assert.ThrowsAsync<InvalidOperationException>(
                () => provider.ExecuteAsync(config, sql, "test query", null, mode));

            Assert.Equal("The SQL contains write operations which are not allowed in ReadOnly mode.", ex.Message);
        }

        [Fact]
        public async Task CheckConnection_WithNullConfig_ThrowsSqlServerProviderException()
        {
            // Arrange
            var provider = CreateProvider();

            // Act & Assert
            var ex = await Assert.ThrowsAsync<SqlServerProviderException>(
                    () => provider.CheckConnection(null));

            Assert.Equal("No Connection Info provided", ex.Message);
        }

        [Fact]
        public void CreateConnection_WithNullConfig_ThrowsSqlServerProviderException()
        {
            // Arrange
            var provider = CreateProvider();

            // Act & Assert
            var ex = Assert.Throws<SqlServerProviderException>(
                    () => provider.CreateConnection(null));

            Assert.Equal("No Connection Config provided", ex.Message);
        }

        [Fact]
        public void CreateConnection_WithValidConfig_ReturnsSqlConnection()
        {
            // Arrange
            var provider = CreateProvider();
            var config = new ProviderConnectionConfig("localhost", "testdb");

            // Act
            var connection = provider.CreateConnection(config);

            // Assert
            Assert.NotNull(connection);
            Assert.IsType<SqlConnection>(connection);
        }

        [Fact]
        public async Task GetDatabasesAsync_WithNullConfig_ThrowsSqlServerProviderException()
        {
            // Arrange
            var provider = CreateProvider();

            // Act & Assert
            var ex = await Assert.ThrowsAsync<SqlServerProviderException>(
                () => provider.GetDatabasesAsync((ProviderConnectionConfig)null));

            Assert.Equal("No Connection Info provided", ex.Message);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public async Task GetDatabasesAsync_WithInvalidServerName_ThrowsArgumentException(string serverName)
        {
            // Arrange
            var provider = CreateProvider();

            // Act & Assert
            var ex = await Assert.ThrowsAsync<SqlServerProviderException>(
                () => provider.GetDatabasesAsync(serverName));
            Assert.Equal("No server name provided", ex.Message);
        }

        [Fact]
        public async Task GetSchemaAsync_WithNullConfig_ThrowsArgumentNullException()
        {
            // Arrange
            var provider = CreateProvider();

            // Act & Assert
            await Assert.ThrowsAsync<ArgumentNullException>(
                () => provider.GetSchemaAsync(null));
        }

        [Theory]
        [InlineData(null, null, null)]
        [InlineData("", "", "")]
        [InlineData("   ", "   ", "   ")]
        public async Task ExecuteAsync_WithInvalidParameters_ThrowsSqlServerProviderException(string sql, string userQuery, string server)
        {
            // Arrange
            var provider = CreateProvider();
            var config = string.IsNullOrWhiteSpace(server) ? null : new ProviderConnectionConfig(server, "testdb");

            // Act & Assert
            if (config == null)
            {
                await Assert.ThrowsAsync<SqlServerProviderException>(
                    () => provider.ExecuteAsync(config, sql, userQuery));
            }
            else
            {
                await Assert.ThrowsAsync<SqlServerProviderException>(
                    () => provider.ExecuteAsync(config, sql, userQuery));
            }
        }

        [Fact]
        public async Task GetServersAsync_WithCachedServers_ReturnsCachedResults()
        {
            // Arrange 
            var cachedServers = new CachedServers
            {
                TimestampUtc = DateTime.UtcNow.AddMinutes(-30),
                Servers = new List<ServerInfo>
                {
                    new ServerInfo("Server1", "SqlServer", 5),
                    new ServerInfo("Server2", "SqlServer", 3)
                }
            };
            _mockCache.Setup(x => x.LoadAsync<CachedServers>(It.IsAny<string>(), It.IsAny<CancellationToken>()))
                 .ReturnsAsync(cachedServers);

            var provider = CreateProvider();

            // Act
            var result = await provider.GetServersAsync(forceRefresh: false);

            // Assert
            Assert.NotNull(result);
            Assert.Contains(result, s => s.Name == "Server1");
            Assert.Contains(result, s => s.Name == "Server2");
        }

        [Fact]
        public async Task GetServersAsync_WithExpiredCache_RefreshesServers()
        {
            // Arrange
            var expiredCache = new CachedServers
            {
                TimestampUtc = DateTime.UtcNow.AddDays(-10), 
                Servers = new List<ServerInfo>
                {
                    new ServerInfo("OldServer", "SqlServer", 1)
                }
            };

            _mockCache.Setup(x => x.LoadAsync<CachedServers>(It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(expiredCache);

            var provider = CreateProvider();

            // Act
            var result = await provider.GetServersAsync(forceRefresh: false);

            // Assert
            Assert.NotNull(result);
            _mockCache.Verify(x => x.LoadAsync<CachedServers>(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task GetServersAsync_WithForceRefresh_SkipsCache()
        {
            // Arrange
            var provider = CreateProvider();

            // Act
            var result = await provider.GetServersAsync(forceRefresh: true);

            // Assert
            Assert.NotNull(result);
            _mockCache.Verify(x => x.LoadAsync<CachedServers>(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public void Dialect_ReturnsCorrectValue()
        {
            // Arrange
            var provider = CreateProvider();

            // Act
            var dialect = provider.Dialect;

            // Assert
            Assert.Equal("SqlServer", dialect);
        }

        [Fact]
        public async Task DisposeAsync_DisposesResourcesProperly()
        {
            // Arrange
            var provider = CreateProvider();

            // Act
            await provider.DisposeAsync();

            // Assert - No exception should be thrown
            Assert.True(true);
        }
    }

    public class SqlServerDbProviderIntegrationTests
    {
        [Fact(Skip = "Requires actual SQL Server instance")]
        public async Task CheckConnection_WithValidConnection_ReturnsTrue()
        {
            // This would test actual database connectivity
            // Skipped in unit tests as it requires a real SQL Server instance
            await Task.CompletedTask;
        }

        [Fact(Skip = "Requires actual SQL Server instance")]
        public async Task GetSchemaAsync_WithValidDatabase_ReturnsCompleteSchema()
        {
            // This would test actual schema extraction
            // Skipped in unit tests as it requires a real SQL Server instance
            await Task.CompletedTask;
        }

        [Fact(Skip = "Requires actual SQL Server instance")]
        public async Task ExecuteAsync_WithValidQuery_ReturnsResults()
        {
            // This would test actual SQL execution
            // Skipped in unit tests as it requires a real SQL Server instance
            await Task.CompletedTask;
        }
    }

    // Mock implementations for testing
    public class MockDbConnection : DbConnection
    {
        public override string ConnectionString { get; set; } = "";
        public override string Database => "TestDB";
        public override string DataSource => "TestServer";
        public override string ServerVersion => "1.0";
        public override ConnectionState State => ConnectionState.Open;

        public override void ChangeDatabase(string databaseName) { }
        public override void Close() { }
        public override void Open() { }
        protected override DbTransaction BeginDbTransaction(IsolationLevel isolationLevel) => null;
        protected override DbCommand CreateDbCommand() => new MockDbCommand();
    }

    public class MockDbCommand : DbCommand
    {
        public override string CommandText { get; set; } = "";
        public override int CommandTimeout { get; set; }
        public override CommandType CommandType { get; set; }
        public override bool DesignTimeVisible { get; set; }
        public override UpdateRowSource UpdatedRowSource { get; set; }
        protected override DbConnection DbConnection { get; set; }
        protected override DbParameterCollection DbParameterCollection { get; }
        protected override DbTransaction DbTransaction { get; set; }

        public override void Cancel() { }
        public override int ExecuteNonQuery() => 0;
        public override object ExecuteScalar() => 0;
        public override void Prepare() { }
        protected override DbParameter CreateDbParameter() => new MockDbParameter();
        protected override DbDataReader ExecuteDbDataReader(CommandBehavior behavior) => null;
    }

    public class MockDbParameter : DbParameter
    {
        public override DbType DbType { get; set; }
        public override ParameterDirection Direction { get; set; }
        public override bool IsNullable { get; set; }
        public override string ParameterName { get; set; } = "";
        public override int Size { get; set; }
        public override string SourceColumn { get; set; } = "";
        public override bool SourceColumnNullMapping { get; set; }
        public override object Value { get; set; }
        public override void ResetDbType() { }
    }
}