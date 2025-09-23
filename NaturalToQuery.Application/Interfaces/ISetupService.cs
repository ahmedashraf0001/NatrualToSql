using NaturalToQuery.Application.DTOs.UI;
using NaturalToQuery.Core.Contributers.Entities;
using NaturalToQuery.Infrastructure.Providers;
using NaturalToQuery.SharedKernal.DTOs.Providers;
using NaturalToQuery.SharedKernal.DTOs.UI;

namespace NaturalToQuery.Application.Interfaces
{
    public interface ISetupService
    {
        Task<IEnumerable<SupportedDB>> GetSupportedProvidersAsync(CancellationToken ct = default);
        Task<IEnumerable<DatabaseInfo>> GetAvailableDatabasesAsync(ProviderType type, string serverName, CancellationToken ct = default);
        Task<IEnumerable<ServerInfo>> GetAvailableServersAsync(ProviderType type, CancellationToken ct = default);
        Task<Guid> CreateProfileAsync(SetupRequest request, CancellationToken ct = default);
        Task RemoveProfileAsync(Guid ProfileId, CancellationToken ct = default);
        Task<bool> TestConnectionAsync(ProviderType type, ProviderConnectionConfig config, CancellationToken ct = default);
    }
}
