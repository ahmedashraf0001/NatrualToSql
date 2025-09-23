using FastEndpoints;
using NaturalToQuery.Application.Interfaces;
using NaturalToQuery.SharedKernal.DTOs.Providers;
using NaturalToQuery.SharedKernal.Interfaces;

namespace NaturalToQuery.Api.Controllers.Setup
{
    public class GetAvailableDatabases : Endpoint<GetAvailableDatabasesRequest, IEnumerable<DatabaseInfo>>
    {
        private readonly ISetupService _setupService;

        public GetAvailableDatabases(ISetupService setupService)
        {
            _setupService = setupService;
        }

        public override void Configure()
        {
            Get("api/setup/databases/{type}/{serverName}");
            AllowAnonymous();
        }

        public override async Task HandleAsync(GetAvailableDatabasesRequest req, CancellationToken ct)
        {
            var databases = await _setupService.GetAvailableDatabasesAsync(req.Type, req.ServerName, ct);
            await Send.OkAsync(databases, ct);
        }
    }
}
