using FastEndpoints;
using NaturalToQuery.Application.Interfaces;
using NaturalToQuery.SharedKernal.DTOs.UI;

namespace NaturalToQuery.Api.Controllers.Setup
{
    public class CreateProfile : Endpoint<SetupRequest, ProfileCreationResponse>
    {
        private readonly ISetupService _setupService;
        public CreateProfile(ISetupService setupService)
        {
            _setupService = setupService;
        }

        public override void Configure()
        {
            Post("api/setup/profile");
            AllowAnonymous(); 
        }

        public override async Task HandleAsync(SetupRequest req, CancellationToken ct)
        {
            var profileId = await _setupService.CreateProfileAsync(req, ct);

            var response = new ProfileCreationResponse
            {
                ProfileId = profileId,
                Success = true
            };

            await Send.OkAsync(response, ct);
        }
    }
}
