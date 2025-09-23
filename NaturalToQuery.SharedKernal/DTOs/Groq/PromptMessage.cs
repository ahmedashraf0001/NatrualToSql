using System.Text.Json.Serialization;

namespace NaturalToQuery.Application.DTOs.Groq
{
    public record PromptMessage([property: JsonPropertyName("role")] string Role, [property: JsonPropertyName("content")] string Content);
}
