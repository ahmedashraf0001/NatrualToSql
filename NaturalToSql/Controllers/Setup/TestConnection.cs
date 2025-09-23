using FastEndpoints;
using NaturalToQuery.Application.Interfaces;
using NaturalToQuery.Core.Contributers.Entities;
using NaturalToQuery.Infrastructure.Providers;

namespace NaturalToQuery.Api.Controllers.Setup
{
    public class TestConnection: Endpoint<TestConnectionRequest, TestConnectionResponse>
    {
        private readonly ISetupService _setupService;
        public TestConnection(ISetupService setupService)
        {
            _setupService = setupService;
        }

        public override void Configure()
        {
            Post("api/setup/test/{ProviderType}");
            AllowAnonymous(); 
        }

        public override async Task HandleAsync(TestConnectionRequest request, CancellationToken ct)
        {
            var response = new TestConnectionResponse
            {
                Success = await _setupService.TestConnectionAsync(
                    request.ProviderType,
                    new ProviderConnectionConfig(request.ConnectionString ?? string.Empty),
                    ct)
            };
            await Send.OkAsync(response, ct);
        }
    }

    public class TestConnectionResponse
    {
        public bool Success { get; set; }
    }

    public class TestConnectionRequest
    {
        public ProviderType ProviderType { get; set; }
        public string? ConnectionString { get; set; }
    }
}
