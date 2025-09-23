using FastEndpoints;
using NaturalToQuery.Application.Interfaces;
using NaturalToQuery.SharedKernal.DTOs.UI;

namespace NaturalToQuery.Api.Controllers.UserInfo
{
    // Get User by ID endpoint
    public class GetUserById : Endpoint<GetUserByIdRequest, UserInfoDto>
    {
        private readonly IUserInfoService _userInfoService;

        public GetUserById(IUserInfoService userInfoService)
        {
            _userInfoService = userInfoService;
        }

        public override void Configure()
        {
            Get("api/userinfo/{id}");
            AllowAnonymous();
        }

        public override async Task HandleAsync(GetUserByIdRequest req, CancellationToken ct)
        {
            var user = await _userInfoService.GetByIdAsync(req.Id, ct);
            await Send.OkAsync(user, ct);
        }
    }

}