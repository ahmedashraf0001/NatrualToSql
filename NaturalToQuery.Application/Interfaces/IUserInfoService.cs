using NaturalToQuery.Core.Contributers.Entities.UserInfos;
using NaturalToQuery.Core.Contributers.Entities;
using NaturalToQuery.SharedKernal.DTOs.UI;
using NaturalToQuery.SharedKernal.DTOs.Domain;

namespace NaturalToQuery.Application.Interfaces
{
    public interface IUserInfoService
    {
        Task<UserInfoResponse> CreateAsync(CreateUserInfoRequest request, CancellationToken ct = default);
        Task<UserInfoResponse> UpdateAsync(UpdateUserInfoRequest request, CancellationToken ct = default);
        Task<UserInfoDto?> GetByIdAsync(Guid id, CancellationToken ct = default);
        Task<UserInfoDto?> GetByApiKeyAsync(string apiKey, CancellationToken ct = default);
        Task<IReadOnlyList<UserInfoDto>> ListAllAsync(CancellationToken ct = default);
        Task<UserInfoResponse> DeleteAsync(Guid id, CancellationToken ct = default);
        Task<bool> ExistsAsync(Guid id, CancellationToken ct = default);
        Task<bool> ExistsByApiKeyAsync(string apiKey, CancellationToken ct = default);
        Task<UserInfoDto?> UpdateAiModeAsync(Guid UserId, string ApiKey, AIMode newAiMode, CancellationToken ct = default);
    }
}