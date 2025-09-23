using NaturalToQuery.SharedKernal.DTOs.Providers;
using System.Text.Json;

namespace NaturalToQuery.Api.Controllers.Query
{
    public class ExecuteQueryRequest
    {
        public Guid ProfileId { get; set; }
        public string Sql { get; set; } = string.Empty;
        public string UserQuery { get; set; } = string.Empty;
        public Dictionary<string, string>? Parameters { get; set; }
        public ExecutionMode Mode { get; set; }
    }
}
