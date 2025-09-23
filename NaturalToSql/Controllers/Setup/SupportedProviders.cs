using FastEndpoints;
using NaturalToQuery.Application.DTOs.UI;
using NaturalToQuery.Application.Interfaces;
using NaturalToQuery.SharedKernal.Interfaces;

namespace NaturalToQuery.Api.Controllers.Setup
{
    public class GetSupportedProviders : EndpointWithoutRequest<IEnumerable<SupportedDB>>
    {
        private readonly ISetupService _setupService;

        public GetSupportedProviders(ISetupService setupService)
        {
            _setupService = setupService;
        }

        public override void Configure()
        {
            Get("api/setup/providers");
            AllowAnonymous(); // Adjust security as needed
        }

        public override async Task HandleAsync(CancellationToken ct)
        {
            var providers = await _setupService.GetSupportedProvidersAsync(ct);
            await Send.OkAsync(providers, ct);
        }
    }

}
