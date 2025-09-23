using NaturalToQuery.SharedKernal.DTOs.Groq;
using NaturalToQuery.SharedKernal.DTOs.Providers;

namespace NaturalToQuery.Infrastructure.LLM
{
    public interface ILLMService
    {
        Task<QueryConversionResult> ConvertToSqlAsync(string schema, string userQuery, ExecutionMode mode, CancellationToken ct = default);
    }
}
