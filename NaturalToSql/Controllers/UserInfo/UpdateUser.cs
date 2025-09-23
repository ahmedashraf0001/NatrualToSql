using FastEndpoints;
using NaturalToQuery.Application.Interfaces;
using NaturalToQuery.SharedKernal.DTOs.UI;

namespace NaturalToQuery.Api.Controllers.UserInfo
{
    // Update User endpoint
    public class UpdateUser : Endpoint<UpdateUserInfoRequest, UserInfoResponse>
    {
        private readonly IUserInfoService _userInfoService;

        public UpdateUser(IUserInfoService userInfoService)
        {
            _userInfoService = userInfoService;
        }

        public override void Configure()
        {
            Put("api/userinfo/{id}");
            AllowAnonymous();
        }

        public override async Task HandleAsync(UpdateUserInfoRequest req, CancellationToken ct)
        {
            var response = await _userInfoService.UpdateAsync(req, ct);
            await Send.OkAsync(response, ct);
        }
    }

}