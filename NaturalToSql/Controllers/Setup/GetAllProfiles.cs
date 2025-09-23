using FastEndpoints;
using NaturalToQuery.Core.Interfaces;
using NaturalToQuery.SharedKernal.DTOs.UI;

namespace NaturalToQuery.Api.Controllers.Setup
{
    public class GetAllProfiles:EndpointWithoutRequest<List<ProfileDto>>
    {
        private readonly IProfileService _profileService;
        public GetAllProfiles(IProfileService profileService)
        {
            _profileService = profileService;
        }
        public override void Configure()
        {
            Get("api/setup/profiles");
            AllowAnonymous(); 
        }
        public override async Task HandleAsync(CancellationToken ct)
        {
            var profiles = await _profileService.ListAllAsync(ct);
            await Send.OkAsync(profiles, ct);
        }
    }
}
