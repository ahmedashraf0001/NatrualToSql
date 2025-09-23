using NaturalToQuery.Application.Interfaces;
using NaturalToQuery.Core.Interfaces;
using NaturalToQuery.Infrastructure.Interfaces;
using NaturalToQuery.Infrastructure.Providers;
using NaturalToQuery.SharedKernal.DTOs.Providers;
using NaturalToQuery.SharedKernal.Interfaces;

namespace NaturalToQuery.Application.Services
{
    public class ProfileDbService : IProfileDbService
    {
        private readonly IProfileService _profileService;
        private readonly IDbProviderFactory _dbProviderFactory;
        private readonly IAppLogger<ProfileDbService> _logger;

        public ProfileDbService(
            IAppLogger<ProfileDbService> logger,
            IProfileService service,
            IDbProviderFactory dbProviderFactory)
        {
            _profileService = service;
            _dbProviderFactory = dbProviderFactory;
            _logger = logger;
        }

        public async Task<ExecutionResult> ExecuteAsync(Guid profileId, string sql, string userQuery,
            IDictionary<string, string?> parameters = null, ExecutionMode mode = ExecutionMode.ReadOnly, CancellationToken ct = default)
        {
            var ctx = await CreateContext(profileId, ct);
            _logger.LogInformation("Executing SQL for Profile {ProfileId}, Mode={Mode}", profileId, mode);

            return await ctx.Provider.ExecuteAsync(ctx.Config, sql, userQuery, parameters, mode, ct);
        }

        public async Task<IEnumerable<DatabaseInfo>> GetDatabasesAsync(Guid profileId, CancellationToken ct = default)
        {
            var ctx = await CreateContext(profileId, ct);
            _logger.LogDebug("Fetching databases for Profile {ProfileId}", profileId);

            return await ctx.Provider.GetDatabasesAsync(ctx.Config);
        }

        public async Task<SchemaModel> GetSchemaAsync(Guid profileId, bool forceRefresh = false, CancellationToken ct = default)
        {
            var ctx = await CreateContext(profileId, ct);
            _logger.LogDebug("Fetching schema for Profile {ProfileId}, ForceRefresh={ForceRefresh}", profileId, forceRefresh);

            return await ctx.Provider.GetSchemaAsync(ctx.Config, forceRefresh);
        }

        public async Task<IEnumerable<ServerInfo>> GetServersAsync(Guid profileId, bool forceRefresh = false, CancellationToken ct = default)
        {
            var ctx = await CreateContext(profileId, ct);
            _logger.LogDebug("Fetching servers for Profile {ProfileId}, ForceRefresh={ForceRefresh}", profileId, forceRefresh);

            return await ctx.Provider.GetServersAsync(forceRefresh, ct);
        }

        private async Task<ProfileDbContext> CreateContext(Guid profileId, CancellationToken ct)
        {
            var type = await _profileService.GetProviderTypeAsync(profileId);
            var provider = _dbProviderFactory.CreateWithProfile(profileId, type);
            var connStr = await _profileService.GetConnectionStringAsync(profileId, ct)
                          ?? throw new InvalidOperationException($"No connection string for Profile {profileId}");

            return new ProfileDbContext(provider, new ProviderConnectionConfig(connStr));
        }
    }

    public record ProfileDbContext(IDbProvider Provider, ProviderConnectionConfig Config);

}
