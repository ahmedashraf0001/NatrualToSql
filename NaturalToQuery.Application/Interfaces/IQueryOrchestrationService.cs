using NaturalToQuery.SharedKernal.DTOs.Groq;
using NaturalToQuery.SharedKernal.DTOs.Providers;

namespace NaturalToQuery.Application.Interfaces
{
    public interface IQueryOrchestrationService
    {
        Task<QueryConversionResult> ConvertNaturalLanguageAsync(Guid UserId, Guid profileId, string naturalLanguage, ExecutionMode Mode, CancellationToken ct = default);
        Task<ExecutionResult> ExecuteQueryAsync(Guid profileId, string sql, string userQuery,
                    IDictionary<string, string?> parameters = null, ExecutionMode mode = ExecutionMode.ReadOnly, CancellationToken ct = default);
    }

}
