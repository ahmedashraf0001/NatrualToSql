using NaturalToQuery.Core.Contributers.Entities;
using NaturalToQuery.Core.Contributers.Entities.Profiles;
using NaturalToQuery.Infrastructure.Providers;
using NaturalToQuery.SharedKernal.DTOs.UI;

namespace NaturalToQuery.Core.Interfaces
{
    public interface IProfileService
    {
        Task<Profile> CreateAsync(Guid UserId, ProviderType provider, ProviderConnectionConfig config, CancellationToken ct = default);
        Task SetConnectionStringAsync(Guid profileId, string connectionString, CancellationToken ct = default);
        Task<string?> GetConnectionStringAsync(Guid profileId, CancellationToken ct = default);
        Task<Profile> GetProviderProfileAsync(ProviderType type, CancellationToken ct = default);
        Task<ProviderType> GetProviderTypeAsync(Guid profileId, CancellationToken ct = default);
        Task RemoveAsync(Guid profileId, CancellationToken ct = default);
        Task<ProfileDto> GetProfileDtoAsync(Guid profileId, CancellationToken ct = default);
        Task<List<ProfileDto>> ListAllAsync(CancellationToken ct = default);
    }
}
