using System.Text.Json.Serialization;

namespace NaturalToQuery.SharedKernal.DTOs.Domain
{
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum AIMode
    {
        Groq,
        Local,
        Basic
    }
}
