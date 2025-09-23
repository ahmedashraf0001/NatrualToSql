using FastEndpoints;
using NaturalToQuery.Application.Interfaces;
using NaturalToQuery.SharedKernal.DTOs.Providers;
using NaturalToQuery.SharedKernal.Interfaces;

namespace NaturalToQuery.Api.Controllers.Setup
{
    public class GetAvailableServers : Endpoint<GetAvailableServersRequest, IEnumerable<ServerInfo>>
    {
        private readonly ISetupService _setupService;

        public GetAvailableServers(ISetupService setupService)
        {
            _setupService = setupService;
        }

        public override void Configure()
        {
            Get("api/setup/servers/{type}");
            AllowAnonymous(); 
        }

        public override async Task HandleAsync(GetAvailableServersRequest req, CancellationToken ct)
        {
            var servers = await _setupService.GetAvailableServersAsync(req.Type, ct);
            await Send.OkAsync(servers, ct);
        }
    }
}
