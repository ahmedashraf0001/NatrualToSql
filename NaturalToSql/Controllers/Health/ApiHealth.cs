using FastEndpoints;
using NaturalToQuery.Api.Controllers.Health.Health;
using NaturalToQuery.SharedKernal.Interfaces;

namespace NaturalToQuery.Api.Controllers.Health
{
    public class ApiHealth:EndpointWithoutRequest<ApiHealthDto>
    {
        private readonly IAppLogger<ApiHealth> _logger;
        private readonly IConfiguration _configuration;
        public ApiHealth(IAppLogger<ApiHealth> logger, IConfiguration configuration)
        {
            _logger = logger;
            _configuration = configuration;
        }
        public override void Configure()
        {
            Get("api/health");
            AllowAnonymous();
        }
        public override async Task HandleAsync(CancellationToken ct)
        {
            await Send.OkAsync(
                new ApiHealthDto
                {
                    Status = "healthy",
                    TimeStamp = DateTime.UtcNow,
                    Version = _configuration["Version"]
                } 
            ,ct);
            _logger.LogInformation("Api health check sent.");
        }
    }
}
