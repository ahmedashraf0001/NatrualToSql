using System.Text.Json.Serialization;

namespace NaturalToQuery.SharedKernal.DTOs.Groq
{
    public class QueryConversionResult
    {
        [JsonPropertyName("sql")] public string? Sql { get; set; }
        [JsonPropertyName("intent")] public string Intent { get; set; } = "";
        [JsonPropertyName("intent_components")] public List<string> IntentComponents { get; set; } = new();
        [JsonPropertyName("tables")] public List<string> Tables { get; set; } = new();
        [JsonPropertyName("columns")] public List<string> Columns { get; set; } = new();
        [JsonPropertyName("parameters")] public List<Parameter> Parameters { get; set; } = new();
        [JsonPropertyName("confidence")] public int Confidence { get; set; }
        [JsonPropertyName("safe")] public bool Safe { get; set; }
        [JsonPropertyName("issues")] public List<string> Issues { get; set; } = new();
        [JsonPropertyName("explanation")] public string Explanation { get; set; } = "";
    }
}
