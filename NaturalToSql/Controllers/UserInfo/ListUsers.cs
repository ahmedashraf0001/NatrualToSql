using FastEndpoints;
using NaturalToQuery.Application.Interfaces;
using NaturalToQuery.SharedKernal.DTOs.UI;

namespace NaturalToQuery.Api.Controllers.UserInfo
{
    public class ListUsers : EndpointWithoutRequest<IReadOnlyList<UserInfoDto>>
    {
        private readonly IUserInfoService _userInfoService;

        public ListUsers(IUserInfoService userInfoService)
        {
            _userInfoService = userInfoService;
        }

        public override void Configure()
        {
            Get("api/userinfo");
            AllowAnonymous();
        }

        public override async Task HandleAsync(CancellationToken ct)
        {
            var users = await _userInfoService.ListAllAsync(ct);
            await Send.OkAsync(users, ct);
        }
    }
}