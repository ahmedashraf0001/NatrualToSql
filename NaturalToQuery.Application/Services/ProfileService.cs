using NaturalToQuery.Core.Contributers.Entities;
using NaturalToQuery.Core.Contributers.Entities.Profiles;
using NaturalToQuery.Core.Interfaces;
using NaturalToQuery.Infrastructure.Cache;
using NaturalToQuery.Infrastructure.Interfaces;
using NaturalToQuery.Infrastructure.Providers;
using NaturalToQuery.Infrastructure.Secrets;
using NaturalToQuery.SharedKernal.DTOs.UI;
using NaturalToQuery.SharedKernal.Interfaces;

namespace NaturalToQuery.Application.Services
{
    public class ProfileService : IProfileService
    {
        private readonly IProfileRepository _repo;
        private readonly ISecretStore<WindowsCredentialStore> _secrets;
        private readonly IAppLogger<ProfileService> _logger;
        private readonly IDbProviderFactory _dbProvider;
        public ProfileService(
            IProfileRepository repo,
            ISecretStore<WindowsCredentialStore> secret,
            IAppLogger<ProfileService> logger,
            IDbProviderFactory dbProvider)
        {
            _repo = repo;
            _secrets = secret;
            _logger = logger;
            _dbProvider = dbProvider;
        }
        public async Task<Profile> CreateAsync(Guid UserId, ProviderType Type, ProviderConnectionConfig config, CancellationToken ct = default)
        {
            _logger.LogInformation("Creating profile for provider {Provider}", Type);

            var provider = _dbProvider.CreateStandalone(Type);
            var TestConnection = await provider.CheckConnection(config, ct);

            if(TestConnection == false)
            {
                _logger.LogDebug("failed to connect to the configured connection string {config}", config);
                throw new InvalidOperationException($"failed to connect to the configured connection string {config.ConnectionString}");
            }

            // 1) store secret
            var secretKey = $"profile-{Guid.NewGuid()}";
            var secretRef = await _secrets.SaveSecretAsync(secretKey, config.ConnectionString, ct);
            _logger.LogDebug("Saved secret {SecretRef} for provider {Provider}", secretRef, Type);

            // 2) create entity
            var dir = CachePathHelper.DefaultCacheDirectory(Type);
            var name = $"{Type.ToString()} - {config.Database}";
            _logger.LogDebug("Generated profile name {ProfileName} with cache dir {CacheDir}", name, dir);

            var profile = Profile.Create(UserId, name, config.Database, Type, secretRef, dir);

            await _repo.AddAsync(profile, ct);
            await _repo.SaveChangesAsync(ct);

            _logger.LogInformation("Profile created successfully with Id {ProfileId}", profile.Id);
            return profile;
        }
        public async Task RemoveAsync(Guid profileId, CancellationToken ct = default)
        {
            _logger.LogInformation("Deleting profile {ProfileId}", profileId);

            if (profileId == Guid.Empty)
                throw new ArgumentException("Profile Id cannot be empty.", nameof(profileId));

            var profile = await _repo.GetByIdAsync(profileId);
            if (profile == null)
            {
                _logger.LogWarning("Profile {ProfileId} not found while attempting delete", profileId);
                throw new ArgumentException("Profile not found");
            }

            await DeleteSecretsAsync(profileId, profile, ct);

            DeleteCache(profileId, profile);

            await DeleteFromDatabaseAsync(profileId, profile, ct);
        }
        #region Remove Profile helpers
            private async Task DeleteFromDatabaseAsync(Guid profileId, Profile profile, CancellationToken ct)
            {
                try
                {
                    await _repo.DeleteAsync(profile, ct);
                    await _repo.SaveChangesAsync(ct);

                    _logger.LogInformation("Profile {ProfileId} deleted successfully", profileId);
                }
                catch (Exception ex)
                {
                    _logger.LogError("Failed to remove profile {ProfileId} from repository", profileId, ex.Message);
                    throw;
                }
            }
            private void DeleteCache(Guid profileId, Profile profile)
            {
                try
                {
                    var cacheDir = profile.CacheFile;
                    if (!string.IsNullOrWhiteSpace(cacheDir) && Directory.Exists(cacheDir))
                    {
                        Directory.Delete(cacheDir, recursive: true);
                        _logger.LogDebug("Deleted cache directory {CacheDir} for profile {ProfileId}", cacheDir, profileId);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning("Failed to delete cache directory for profile {ProfileId}", profileId, ex.Message);
                }
            }
            private async Task DeleteSecretsAsync(Guid profileId, Profile profile, CancellationToken ct)
            {
                if (!string.IsNullOrWhiteSpace(profile.SecretRef))
                {
                    try
                    {
                        await _secrets.DeleteSecretAsync(profile.SecretRef, ct);
                        _logger.LogDebug("Deleted secret {SecretRef} for profile {ProfileId}", profile.SecretRef, profileId);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning("Failed to delete secret {SecretRef} for profile {ProfileId}", profile.SecretRef, profileId, ex.Message);
                    }
                }
            }
        #endregion
        public async Task SetConnectionStringAsync(Guid profileId, string connectionString, CancellationToken ct = default)
        {
            _logger.LogInformation("Updating connection string for profile {ProfileId}", profileId);

            if (profileId == Guid.Empty)
                throw new ArgumentException("Profile Id cannot be empty.", nameof(profileId));

            var profile = await _repo.GetByIdAsync(profileId, ct);
            if (profile == null)
            {
                _logger.LogWarning("Profile {ProfileId} not found while updating connection string", profileId);
                throw new ArgumentException("Profile not found");
            }

            var secretKey = profile.SecretRef ?? $"profile-{profileId}";
            var secretRef = await _secrets.SaveSecretAsync(secretKey, connectionString, ct);
            _logger.LogDebug("Updated secret {SecretRef} for profile {ProfileId}", secretRef, profileId);

            profile.SetSecretRef(secretRef);
            await _repo.UpdateAsync(profile, ct);
            await _repo.SaveChangesAsync(ct);

            _logger.LogInformation("Connection string updated for profile {ProfileId}", profile.Id);
        }

        public async Task<string?> GetConnectionStringAsync(Guid profileId, CancellationToken ct = default)
        {
            _logger.LogInformation("Fetching connection string for profile {ProfileId}", profileId);

            if (profileId == Guid.Empty)
                throw new ArgumentException("Profile Id cannot be empty.", nameof(profileId));

            var profile = await _repo.GetByIdAsync(profileId, ct);
            if (profile == null)
            {
                _logger.LogWarning("Profile {ProfileId} not found when fetching connection string", profileId);
                throw new ArgumentException("Profile not found");
            }

            if (string.IsNullOrWhiteSpace(profile.SecretRef))
            {
                _logger.LogDebug("Profile {ProfileId} has no secret reference", profileId);
                return null;
            }

            var secret = await _secrets.GetSecretAsync(profile.SecretRef, ct);
            _logger.LogDebug("Fetched secret for profile {ProfileId}", profileId);
            return secret;
        }

        public async Task<Profile> GetProviderProfileAsync(ProviderType type, CancellationToken ct = default)
        {
            _logger.LogInformation("Fetching provider profile for type {Type}", type);
            var profile = await _repo.GetByTypeAsync(type, ct);
            if (profile == null)
            {
                _logger.LogWarning("No profile found for provider type {Type}", type);
                throw new ArgumentException($"No profile found for provider type {type}");
            }
            _logger.LogInformation("Fetched provider profile {ProfileId} for type {Type}", profile.Id, type);
            return profile;
        }

        public async Task<ProviderType> GetProviderTypeAsync(Guid profileId, CancellationToken ct = default)
        {
            if (profileId == Guid.Empty)
                throw new ArgumentException("Profile Id cannot be empty.", nameof(profileId));

            var profile = await _repo.GetByIdAsync(profileId);
            if (profile == null)
                throw new ArgumentException($"No profile found with id: {profileId}");
            return profile.Provider;
        }
        public async Task<ProfileDto> GetProfileDtoAsync(Guid profileId, CancellationToken ct = default)
        {
            if (profileId == Guid.Empty)
                throw new ArgumentException("Profile Id cannot be empty.", nameof(profileId));
            var profile = await _repo.GetByIdAsync(profileId);
            if (profile == null)
                throw new ArgumentException($"No profile found with id: {profileId}");
            return new ProfileDto
            {
                Id = profile.Id,
                Name = profile.Name,
                DatabaseName = profile.DatabaseName,
                ConnectionString = await GetConnectionStringAsync(profile.Id, ct) ?? "No Connection String",
                Queries = profile.Queries?.Select(x => new QueryDto {
                    Id = x.Id,
                    UserQuery = x.UserQuery,
                    SqlQuery = x.SqlQuery,
                    TimestampUtc = x.TimestampUtc,
                    ResultJson = x.ResultJson
                }).ToList() ?? new List<QueryDto>(),
                CreatedUtc = profile.CreatedUtc
            };
        }
        public async Task<List<ProfileDto>> ListAllAsync(CancellationToken ct = default)
        {
            _logger.LogInformation("Listing all profiles");
            var result = await _repo.ListAllAsync(ct);
            var dtos = new List<ProfileDto>();
            foreach (var profile in result)
            {
                var dto = new ProfileDto
                {
                    Id = profile.Id,
                    Name = profile.Name,
                    DatabaseName= profile.DatabaseName,
                    ConnectionString = await GetConnectionStringAsync(profile.Id, ct) ?? "No Connection String",
                    Queries = profile.Queries?.Select(x => new QueryDto
                    {
                        Id = x.Id,
                        UserQuery = x.UserQuery,
                        SqlQuery = x.SqlQuery,
                        TimestampUtc = x.TimestampUtc,
                        ResultJson = x.ResultJson
                    }).ToList() ?? new List<QueryDto>(),
                    CreatedUtc = profile.CreatedUtc
                };
                dtos.Add(dto);
            }
            return dtos;
        }
    }

}
