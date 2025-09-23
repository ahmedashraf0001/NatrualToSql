using FastEndpoints;
using NaturalToQuery.Application.Interfaces;
using NaturalToQuery.SharedKernal.DTOs.UI;
using NaturalToQuery.SharedKernal.Interfaces;

namespace NaturalToQuery.Api.Controllers.Setup
{
    public class RemoveProfile : Endpoint<RemoveProfileDto>
    {
        private readonly ISetupService _setupService;

        public RemoveProfile(ISetupService setupService)
        {
            _setupService = setupService;
        }

        public override void Configure()
        {
            Delete("api/setup/profile/{id}");
            AllowAnonymous(); 
        }

        public override async Task HandleAsync(RemoveProfileDto req, CancellationToken ct)
        {
            await _setupService.RemoveProfileAsync(req.Id, ct);

            await Send.OkAsync(new {Message = $"Profile '{req.Id}' was deleted successfully." }, ct);
        }
    }
}
