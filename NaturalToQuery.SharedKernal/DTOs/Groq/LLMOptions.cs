using NaturalToQuery.SharedKernal.DTOs.Domain;

namespace NaturalToQuery.Application.DTOs.Groq
{
    public class LLMOptions
    {
        public string TestKey { get; set; } = "https://api.groq.com/openai/v1/models";
        public string GroqModel { get; set; } = "llama-3.3-70b-versatile";
        public string LocalModel { get; set; } = "qwen3:8b";
        public string BaseGroqUrl { get; set; } = "https://api.groq.com/";
        public string BaseLocalLLMUrl { get; set; } = "http://localhost:11434";
        public string Model { get; set; } = string.Empty;
        public string SystemPrompt { get; set; } = "";
        public List<PromptExample> Examples { get; set; } = new();
        public string FinalUserTemplate { get; set; } = "SCHEMA:\\n{schema}\\n\\nUSER_QUERY:\\n{userQuery}";
    }
}
