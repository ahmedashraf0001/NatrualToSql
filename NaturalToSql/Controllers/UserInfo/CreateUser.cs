using FastEndpoints;
using NaturalToQuery.Application.Interfaces;
using NaturalToQuery.SharedKernal.DTOs.UI;

namespace NaturalToQuery.Api.Controllers.UserInfo
{
    // Create User endpoint
    public class CreateUser : Endpoint<CreateUserInfoRequest, UserInfoResponse>
    {
        private readonly IUserInfoService _userInfoService;

        public CreateUser(IUserInfoService userInfoService)
        {
            _userInfoService = userInfoService;
        }

        public override void Configure()
        {
            Post("api/userinfo");
            AllowAnonymous();
        }

        public override async Task HandleAsync(CreateUserInfoRequest req, CancellationToken ct)
        {
            var response = await _userInfoService.CreateAsync(req, ct);
            await Send.OkAsync(response, ct);
        }
    }

}