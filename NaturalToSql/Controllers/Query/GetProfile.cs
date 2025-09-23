using FastEndpoints;
using NaturalToQuery.Application.Interfaces;
using NaturalToQuery.Core.Contributers.Entities;
using NaturalToQuery.Core.Contributers.Entities.Profiles;
using NaturalToQuery.Core.Interfaces;
using NaturalToQuery.SharedKernal.DTOs.UI;

namespace NaturalToQuery.Api.Controllers.Query
{
    public class GetProfile:Endpoint<GetProfileRequest, ProfileDto>
    {
        private readonly IProfileService _Service;

        public GetProfile(IProfileService Service)
        {
            _Service = Service;
        }

        public override void Configure()
        {
            Get("api/query/profile/{Id}");
            AllowAnonymous();
        }
        public override async Task HandleAsync(GetProfileRequest req, CancellationToken ct)
        {
            var profile = await _Service.GetProfileDtoAsync(req.Id, ct);
            if (profile == null)
            {
                await Send.NotFoundAsync(ct);
                return;
            }

            await Send.OkAsync(profile, ct);
        }
    }


}
