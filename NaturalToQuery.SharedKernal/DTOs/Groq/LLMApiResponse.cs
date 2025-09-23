using NaturalToQuery.Application.DTOs.Groq;
using System.Text.Json.Serialization;

namespace NaturalToQuery.SharedKernal.DTOs.Groq
{

    public class LLMApiResponse
    {
        [JsonPropertyName("choices")]
        public Choice[] Choices { get; set; }

        [JsonPropertyName("message")]
        public PromptMessage Message { get; set; }

        [JsonPropertyName("response")]
        public string Response { get; set; }

        [JsonPropertyName("text")]
        public string Text { get; set; }
    }

    public class Choice
    {
        [JsonPropertyName("message")]
        public LLMMessage Message { get; set; }

        [JsonPropertyName("text")]
        public string Text { get; set; }
    }

    public class LLMMessage
    {
        [JsonPropertyName("content")]
        public string Content { get; set; }
    }

}
