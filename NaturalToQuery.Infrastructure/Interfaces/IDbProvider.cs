using NaturalToQuery.Infrastructure.Providers;
using NaturalToQuery.SharedKernal.DTOs.Providers;
using System.Data.Common;

namespace NaturalToQuery.Infrastructure.Interfaces
{
    public interface IDbProvider : IAsyncDisposable
    {
        Task<bool> CheckConnection(ProviderConnectionConfig config, CancellationToken ct = default);
        DbConnection CreateConnection(ProviderConnectionConfig config);
        Task<IEnumerable<ServerInfo>> GetServersAsync(bool forceRefresh = false, CancellationToken ct = default);
        Task<IEnumerable<DatabaseInfo>> GetDatabasesAsync(ProviderConnectionConfig config, CancellationToken ct = default);
        Task<IEnumerable<DatabaseInfo>> GetDatabasesAsync(string serverName, CancellationToken ct = default);
        Task<SchemaModel> GetSchemaAsync(ProviderConnectionConfig config, bool forceRefresh = false, CancellationToken ct = default);
        Task<ExecutionResult> ExecuteAsync(
            ProviderConnectionConfig config,
            string sql,
            string userQuery,
            IDictionary<string, string?> parameters = null,
            ExecutionMode mode = ExecutionMode.ReadOnly,
            CancellationToken ct = default);
        string Dialect { get; }
    }
}
