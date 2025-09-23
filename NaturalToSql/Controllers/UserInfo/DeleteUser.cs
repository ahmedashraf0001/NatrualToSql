using FastEndpoints;
using NaturalToQuery.Application.Interfaces;
using NaturalToQuery.SharedKernal.DTOs.UI;

namespace NaturalToQuery.Api.Controllers.UserInfo
{
    // Delete User endpoint
    public class DeleteUser : Endpoint<DeleteUserRequest, UserInfoResponse>
    {
        private readonly IUserInfoService _userInfoService;

        public DeleteUser(IUserInfoService userInfoService)
        {
            _userInfoService = userInfoService;
        }

        public override void Configure()
        {
            Delete("api/userinfo/{id}");
            AllowAnonymous();
        }

        public override async Task HandleAsync(DeleteUserRequest req, CancellationToken ct)
        {
            var response = await _userInfoService.DeleteAsync(req.Id, ct);
            await Send.OkAsync(response, ct);
        }
    }

}