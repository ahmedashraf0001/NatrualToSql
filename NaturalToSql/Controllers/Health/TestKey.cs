using FastEndpoints;
using NaturalToQuery.Infrastructure.LLM;

namespace NaturalToQuery.Api.Controllers.Health
{
    public class TestKey : Endpoint<TestKeyRequest, TestKeyResponse>
    {
        private readonly IConfiguration _configuration;
        public TestKey(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public override void Configure()
        {
            Post("api/setup/test-groq-key");
            AllowAnonymous();
        }

        public override async Task HandleAsync(TestKeyRequest request, CancellationToken ct)
        {
            var response = new TestKeyResponse
            {
                Success = await LLMServiceHelper.TestApiKey(
                    "https://api.groq.com/openai/v1/models",
                    request.ApiKey ?? string.Empty,
                    ct)
            };
            await Send.OkAsync(response, ct);
        }
    }

    public class TestKeyResponse
    {
        public bool Success { get; set; }
    }

    public class TestKeyRequest
    {
        public string ApiKey { get; set; } = string.Empty;
    }
}
