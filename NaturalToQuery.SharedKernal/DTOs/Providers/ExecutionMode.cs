using System.Text.Json.Serialization;

namespace NaturalToQuery.SharedKernal.DTOs.Providers
{
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum ExecutionMode { ReadOnly, Write }
}
