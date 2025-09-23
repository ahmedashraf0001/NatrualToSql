using NaturalToQuery.SharedKernal.DTOs.Providers;

namespace NaturalToQuery.Application.Interfaces
{
    public interface IProfileDbService
    {
        Task<SchemaModel> GetSchemaAsync(Guid profileId, bool forceRefresh = false, CancellationToken ct = default);
        Task<IEnumerable<DatabaseInfo>> GetDatabasesAsync(Guid profileId, CancellationToken ct = default);
        Task<IEnumerable<ServerInfo>> GetServersAsync(Guid profileId, bool forceRefresh = false, CancellationToken ct = default);
        Task<ExecutionResult> ExecuteAsync(Guid profileId, string sql, string userQuery, IDictionary<string, string?> parameters = null, ExecutionMode mode = ExecutionMode.ReadOnly, CancellationToken ct = default);
    }
}
