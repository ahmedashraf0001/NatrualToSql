using System.Text.Json.Serialization;

namespace NaturalToQuery.SharedKernal.DTOs.Groq
{

    public class Parameter
    {
        [JsonPropertyName("name")] public string Name { get; set; } = "";
        [JsonPropertyName("value")] public object Value { get; set; } = "";
        [JsonPropertyName("source_text")] public string SourceText { get; set; } = "";
    }
}
