using NaturalToQuery.Core.Contributers.Entities;
using NaturalToQuery.SharedKernal.DTOs.Domain;

namespace NaturalToQuery.SharedKernal.DTOs.UI
{
    public class UserInfoDto
    {
        public Guid Id { get; set; }
        public string ApiKey { get; set; } = string.Empty;
        public AIMode Mode { get; set; }
        public DateTime CreatedUtc { get; set; }
        public DateTime LastUpdatedUtc { get; set; }
        public List<ProfileDto> Profiles { get; set; } = new();
    }

    public class CreateUserInfoRequest
    {
        public string ApiKey { get; set; } = string.Empty;
        public AIMode Mode { get; set; } = AIMode.Groq;
    }

    public class UpdateUserInfoRequest
    {
        public Guid Id { get; set; }
        public string? ApiKey { get; set; }
        public AIMode? Mode { get; set; }
    }

    public class UserInfoResponse
    {
        public Guid Id { get; set; }
        public bool Success { get; set; }
        public string? Message { get; set; }
    }
    public class GetUserByIdRequest
    {
        public Guid Id { get; set; }
    }

    public class DeleteUserRequest
    {
        public Guid Id { get; set; }
    }
}