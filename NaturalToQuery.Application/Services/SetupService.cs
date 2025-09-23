using Microsoft.Extensions.Configuration;
using NaturalToQuery.Application.DTOs.UI;
using NaturalToQuery.Application.Interfaces;
using NaturalToQuery.Core.Contributers.Entities;
using NaturalToQuery.Core.Interfaces;
using NaturalToQuery.Infrastructure.Providers;
using NaturalToQuery.SharedKernal.DTOs.Providers;
using NaturalToQuery.SharedKernal.DTOs.UI;

namespace NaturalToQuery.Application.Services
{
    public class SetupService : ISetupService
    {
        private readonly IProfileService profileService;
        private readonly IConfiguration configuration;
        private readonly IDbProviderFactory DbFactory;

        public SetupService(IProfileService profileService, IConfiguration configuration, IDbProviderFactory DbFactory)
        {
            this.profileService = profileService;
            this.configuration = configuration;
            this.DbFactory = DbFactory;
        }
        public async Task<bool> TestConnectionAsync(ProviderType type, ProviderConnectionConfig config, CancellationToken ct = default)
        {
            var provider = DbFactory.CreateStandalone(type);
            return await provider.CheckConnection(config, ct);
        }
        public async Task<Guid> CreateProfileAsync(SetupRequest request, CancellationToken ct = default)
        {
            ProviderConnectionConfig config = request.ConnectionType switch
            {
                ConnectionType.AutoConnect => new ProviderConnectionConfig(server: request.ServerName, database: request.DatabaseName),
                ConnectionType.ConnectionString => new ProviderConnectionConfig(connectionString: request.ConnectionString),
                _ => throw new NotSupportedException($"ConnectionType '{request.ConnectionType}' is not supported.")
            };

            var profile = await profileService.CreateAsync(request.UserId, request.ProviderType, config, ct);
            return profile.Id;
        }

        public async Task RemoveProfileAsync(Guid ProfileId, CancellationToken ct = default)
        {
            await profileService.RemoveAsync(ProfileId, ct);
        }
        public Task<IEnumerable<DatabaseInfo>> GetAvailableDatabasesAsync(ProviderType type, string serverName, CancellationToken ct = default)
        {
            var provider = DbFactory.CreateStandalone(type);
            return provider.GetDatabasesAsync(serverName, ct);
        }

        public Task<IEnumerable<ServerInfo>> GetAvailableServersAsync(ProviderType type, CancellationToken ct = default)
        {
            var provider = DbFactory.CreateStandalone(type);
            return provider.GetServersAsync(forceRefresh: true, ct);
        }

        public Task<IEnumerable<SupportedDB>> GetSupportedProvidersAsync(CancellationToken ct = default)
        {
            var supportedProviders = configuration
                .GetSection("SupportDBs")
                .Get<IEnumerable<SupportedDB>>() ?? Enumerable.Empty<SupportedDB>();
            return Task.FromResult(supportedProviders);
        }
    }
}
