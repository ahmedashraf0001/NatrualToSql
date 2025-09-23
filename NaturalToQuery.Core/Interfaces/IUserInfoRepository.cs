using NaturalToQuery.Core.Contributers.Entities.UserInfos;

namespace NaturalToQuery.Core.Interfaces
{
    public interface IUserInfoRepository
    {
        Task AddAsync(UserInfo User, CancellationToken ct = default);
        Task UpdateAsync (UserInfo User, CancellationToken ct = default);
        Task<UserInfo?> GetByIdAsync(Guid id, CancellationToken ct = default);
        Task<IReadOnlyList<UserInfo>> ListAllAsync(CancellationToken ct = default);
        Task DeleteAsync (Guid id, CancellationToken ct = default);
        Task DeleteAsync (UserInfo User, CancellationToken ct = default);

        Task<bool> ExistsAsync(Guid id, CancellationToken ct = default);
        Task<bool> ExistsByApiKeyAsync(string ApiKey, CancellationToken ct = default);
        Task<int> SaveChangesAsync(CancellationToken ct = default);
    }
}
