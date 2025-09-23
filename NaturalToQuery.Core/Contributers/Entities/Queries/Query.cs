using NaturalToQuery.Core.Contributers.Entities.Profiles;
using NaturalToQuery.Core.Contributers.Entities.UserInfos;
using NaturalToQuery.SharedKernal.DTOs.Providers;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json;

namespace NaturalToQuery.Core.Contributers.Entities.Queries
{
    public class Query
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string UserQuery { get; set; } = string.Empty;
        public string SqlQuery { get; set; } = string.Empty;
        [NotMapped]
        public ExecutionResult Result { get; set; } = new ExecutionResult();

        public string ResultJson { get; set; } = string.Empty;

        public DateTime TimestampUtc { get; set; } = DateTime.UtcNow;

        public Guid ProfileId { get; set; }
        public Profile Profile { get; set; } = default!;

        public override bool Equals(object? obj)
        {
            if (obj is not Query other) return false;

            return UserQuery.Equals(other.UserQuery, StringComparison.OrdinalIgnoreCase)
                && SqlQuery.Equals(other.SqlQuery, StringComparison.OrdinalIgnoreCase)
                && Result.Success == other.Result.Success
                && ParametersEqual(Result.Parameters, other.Result.Parameters);
        }

        private static bool ParametersEqual(
            IDictionary<string, string?>? a,
            IDictionary<string, string?>? b)
        {
            if (ReferenceEquals(a, b)) return true;
            if (a is null || b is null) return false;
            if (a.Count != b.Count) return false;

            foreach (var kvp in a)
            {
                if (!b.TryGetValue(kvp.Key, out var value)) return false;

                if (!string.Equals(kvp.Value, value, StringComparison.OrdinalIgnoreCase))
                    return false;
            }

            return true;
        }

        public override int GetHashCode()
        {
            var hash = new HashCode();
            hash.Add(UserQuery, StringComparer.OrdinalIgnoreCase);
            hash.Add(SqlQuery, StringComparer.OrdinalIgnoreCase);

            if (Result.Parameters != null)
            {
                foreach (var kvp in Result.Parameters.OrderBy(k => k.Key))
                {
                    hash.Add(kvp.Key, StringComparer.OrdinalIgnoreCase);
                    if (kvp.Value != null)
                        hash.Add(kvp.Value, StringComparer.OrdinalIgnoreCase);
                }
            }

            return hash.ToHashCode();
        }


        public void SetResult(ExecutionResult result)
        {
            Result = result ?? new ExecutionResult();
            ResultJson = JsonSerializer.Serialize(Result, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                WriteIndented = false
            });
        }

        public ExecutionResult GetResult()
        {
            if (Result != null && Result.Columns != null) return Result;
            if (string.IsNullOrWhiteSpace(ResultJson)) return new ExecutionResult();
            Result = JsonSerializer.Deserialize<ExecutionResult>(ResultJson) ?? new ExecutionResult();
            return Result;
        }
    }
}
