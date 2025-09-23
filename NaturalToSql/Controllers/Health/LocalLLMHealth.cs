using FastEndpoints;
using NaturalToQuery.Application.Interfaces;

namespace NaturalToQuery.Api.Controllers.Health
{
    public class LocalLLMHealth:EndpointWithoutRequest<LocalLLMHealthResponse>
    {
        private readonly ILocalLLMCheck _localLLMCheck;
        public LocalLLMHealth(ILocalLLMCheck localLLMCheck)
        {
            _localLLMCheck = localLLMCheck;
        }
        public override void Configure()
        {
            Get("api/health/localllm");
            AllowAnonymous();
        }
        public override async Task HandleAsync(CancellationToken ct = default)
        {
            var isOperational = await _localLLMCheck.IsLocalLLMOperational(ct);

            if (!isOperational)
            {
                await Send.ResponseAsync(new LocalLLMHealthResponse
                {
                    Status = "Unhealthy",
                    Message = "Local LLM is not operational.",
                    CheckedAt = DateTime.UtcNow,
                    Url = _localLLMCheck.GetLocalLLMUrl()
                }, StatusCodes.Status503ServiceUnavailable, ct);
                return;
            }

            await Send.ResponseAsync(new LocalLLMHealthResponse
            {
                Status = "Healthy",
                Message = "Local LLM is running and reachable.",
                CheckedAt = DateTime.UtcNow,
                Url = _localLLMCheck.GetLocalLLMUrl()
            }, StatusCodes.Status200OK, ct);
        }
    }
    public class LocalLLMHealthResponse
    {
        public string Status { get; set; } 
        public string Message { get; set; } 
        public DateTime CheckedAt { get; set; } = DateTime.UtcNow;
        public string Url { get; set; } 
    }
}
