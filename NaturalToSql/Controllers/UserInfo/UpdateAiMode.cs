using FastEndpoints;
using NaturalToQuery.Application.Interfaces;
using NaturalToQuery.SharedKernal.DTOs.UI;
using NaturalToQuery.SharedKernal.DTOs.Domain;

namespace NaturalToQuery.Api.Controllers.UserInfo
{
    public class UpdateAiModeRequest
    {
        public Guid UserId { get; set; }
        public string? ApiKey { get; set; } = string.Empty;
        public AIMode NewAiMode { get; set; }
    }

    public class UpdateAiMode : Endpoint<UpdateAiModeRequest, UserInfoDto>
    {
        private readonly IUserInfoService _userInfoService;

        public UpdateAiMode(IUserInfoService userInfoService)
        {
            _userInfoService = userInfoService;
        }

        public override void Configure()
        {
            Put("api/userinfo/{userId}/aimode");
            AllowAnonymous();
        }

        public override async Task HandleAsync(UpdateAiModeRequest req, CancellationToken ct)
        {
            var result = await _userInfoService.UpdateAiModeAsync(req.UserId, req.ApiKey, req.NewAiMode, ct);
            await Send.OkAsync(result, ct);
        }
    }
}
