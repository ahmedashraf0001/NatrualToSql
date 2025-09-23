using NaturalToQuery.SharedKernal.DTOs.Providers;

namespace NaturalToQuery.SharedKernal.DTOs.UI
{
    public class ExecuteQueryRequest
    {
        public ExecutionMode Mode { get; set; } = ExecutionMode.ReadOnly;
        public string UserQuery { get; set; } = string.Empty; // Original natural language query for tracking
    }
}
