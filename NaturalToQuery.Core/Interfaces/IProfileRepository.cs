using NaturalToQuery.Core.Contributers.Entities;
using NaturalToQuery.Core.Contributers.Entities.Profiles;
using NaturalToQuery.Core.Contributers.Entities.Queries;

namespace NaturalToQuery.Infrastructure.Interfaces
{
    public interface IProfileRepository
    {
        Task<Profile?> GetByIdAsync(Guid id, CancellationToken ct = default);
        Task<IReadOnlyList<Profile>> ListAllAsync(CancellationToken ct = default);
        Task<Profile?> GetByNameAsync(string name, CancellationToken ct = default);
        Task AddAsync(Profile profile, CancellationToken ct = default);
        Task AddQueryAsync(Profile profile, Query query, CancellationToken ct = default);
        Task UpdateAsync(Profile profile, CancellationToken ct = default);
        Task DeleteAsync(Profile profile, CancellationToken ct = default);
        Task<Profile?> GetByTypeAsync(ProviderType type, CancellationToken ct = default);

        Task<bool> ExistsAsync(Guid id, CancellationToken ct = default);
        Task<bool> ExistsByNameAsync(string name, CancellationToken ct = default);

        Task<int> SaveChangesAsync(CancellationToken ct = default);
    }
}
