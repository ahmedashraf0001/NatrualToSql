using NaturalToQuery.Application.Interfaces;
using NaturalToQuery.Core.Contributers.Entities.UserInfos;
using NaturalToQuery.Core.Interfaces;
using NaturalToQuery.SharedKernal.DTOs.UI;
using NaturalToQuery.SharedKernal.Interfaces;
using NaturalToQuery.SharedKernal.DTOs.Domain;

namespace NaturalToQuery.Application.Services
{
    public class UserInfoService : IUserInfoService
    {
        private readonly IUserInfoRepository _repository;
        private readonly IAppLogger<UserInfoService> _logger;

        public UserInfoService(IUserInfoRepository repository, IAppLogger<UserInfoService> logger)
        {
            _repository = repository ?? throw new ArgumentNullException(nameof(repository));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<UserInfoResponse> CreateAsync(CreateUserInfoRequest request, CancellationToken ct = default)
        {
            _logger.LogInformation("Creating new user with API key: {ApiKey}", request.ApiKey);

            try
            {
                if(request.Mode == AIMode.Groq)
                {
                    var existingUser = await _repository.ExistsByApiKeyAsync(request.ApiKey, ct);
                    if (existingUser)
                    {
                        _logger.LogWarning("User with API key {ApiKey} already exists", request.ApiKey);
                        return new UserInfoResponse
                        {
                            Success = false,
                            Message = "A user with this API key already exists."
                        };
                    }
                }

                var userInfo = UserInfo.Create(request.ApiKey, request.Mode);
                await _repository.AddAsync(userInfo, ct);
                await _repository.SaveChangesAsync(ct);

                _logger.LogInformation("User created successfully with ID: {UserId}", userInfo.Id);

                return new UserInfoResponse
                {
                    Id = userInfo.Id,
                    Success = true,
                    Message = "User created successfully."
                };
            }
            catch (Exception ex)
            {
                _logger.LogError("Error creating user with API key: {ApiKey}", request.ApiKey, ex.Message);
                throw new ArgumentException($"Error creating user with API key: {request.ApiKey}");
            }
        }

        public async Task<UserInfoResponse> UpdateAsync(UpdateUserInfoRequest request, CancellationToken ct = default)
        {
            _logger.LogInformation("Updating user with ID: {UserId}", request.Id);

            try
            {
                var userInfo = await _repository.GetByIdAsync(request.Id, ct);
                if (userInfo == null)
                {
                    _logger.LogWarning("User with ID {UserId} not found", request.Id);
                    throw new ArgumentException($"User with ID {request.Id} not found");
                }

                // Update API key if provided
                if (!string.IsNullOrWhiteSpace(request.ApiKey))
                {
                    // Check if another user has this API key
                    var existingUser = await _repository.ExistsByApiKeyAsync(request.ApiKey, ct);
                    if (existingUser)
                    {
                        _logger.LogWarning("API key {ApiKey} is already in use by another user", request.ApiKey);
                        throw new ArgumentException($"This API key is already in use by another user.");
                    }

                    userInfo.UpdateApiKey(request.ApiKey);
                }

                // Update AI mode if provided
                if (request.Mode.HasValue)
                {
                    userInfo.UpdateAIMode(request.Mode.Value);
                }

                await _repository.UpdateAsync(userInfo, ct);
                await _repository.SaveChangesAsync(ct);

                _logger.LogInformation("User with ID {UserId} updated successfully", request.Id);

                return new UserInfoResponse
                {
                    Id = request.Id,
                    Success = true,
                    Message = "User updated successfully."
                };
            }
            catch (Exception ex)
            {
                _logger.LogError("Error updating user with ID: {UserId}", request.Id, ex.Message);
                throw new ArgumentException($"Error updating user with ID: {request.Id}, {ex.Message}");
            }
        }

        public async Task<UserInfoDto?> GetByIdAsync(Guid id, CancellationToken ct = default)
        {
            _logger.LogInformation("Getting user by ID: {UserId}", id);

            var userInfo = await _repository.GetByIdAsync(id, ct);
            if (userInfo == null)
            {
                _logger.LogWarning("User with ID {UserId} not found", id);
                throw new ArgumentException($"User with ID {id} not found");
            }

            return MapToDto(userInfo);
        }

        public async Task<UserInfoDto?> GetByApiKeyAsync(string apiKey, CancellationToken ct = default)
        {
            _logger.LogInformation("Getting user by API key: {ApiKey}", apiKey);

            var users = await _repository.ListAllAsync(ct);
            var userInfo = users.FirstOrDefault(u => u.ApiKey.Equals(apiKey, StringComparison.Ordinal));
                
            if (userInfo == null)
            {
                _logger.LogWarning("User with API key {ApiKey} not found", apiKey);
                throw new ArgumentException($"User with API key {apiKey} not found");
            }

            return MapToDto(userInfo);
        }

        public async Task<IReadOnlyList<UserInfoDto>> ListAllAsync(CancellationToken ct = default)
        {
            _logger.LogInformation("Getting all users");

            try
            {
                var users = await _repository.ListAllAsync(ct);
                return users.Select(MapToDto).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError("Error getting all users", ex.Message);
                return new List<UserInfoDto>();
            }
        }

        public async Task<UserInfoResponse> DeleteAsync(Guid id, CancellationToken ct = default)
        {
            _logger.LogInformation("Deleting user with ID: {UserId}", id);

            try
            {
                var userInfo = await _repository.GetByIdAsync(id, ct);
                if (userInfo == null)
                {
                    _logger.LogWarning("User with ID {UserId} not found for deletion", id);
                    throw new ArgumentException($"User with ID {id} not found for deletion");
                }

                await _repository.DeleteAsync(userInfo, ct);
                await _repository.SaveChangesAsync(ct);

                _logger.LogInformation("User with ID {UserId} deleted successfully", id);

                return new UserInfoResponse
                {
                    Id = id,
                    Success = true,
                    Message = "User deleted successfully."
                };
            }
            catch (Exception ex)
            {
                _logger.LogError("Error deleting user with ID: {UserId}", id, ex.Message);
                throw new ArgumentException($"Error Occured: {ex.Message}");
            }
        }

        public async Task<bool> ExistsAsync(Guid id, CancellationToken ct = default)
        {
            try
            {
                return await _repository.ExistsAsync(id, ct);
            }
            catch (Exception ex)
            {
                _logger.LogError("Error checking if user exists with ID: {UserId}", id, ex.Message);
                return false;
            }
        }

        public async Task<bool> ExistsByApiKeyAsync(string apiKey, CancellationToken ct = default)
        {
            try
            {
                return await _repository.ExistsByApiKeyAsync(apiKey, ct);
            }
            catch (Exception ex)
            {
                _logger.LogError("Error checking if user exists with API key: {ApiKey}", apiKey, ex.Message);
                return false;
            }
        }

        private static UserInfoDto MapToDto(UserInfo userInfo)
        {
            return new UserInfoDto
            {
                Id = userInfo.Id,
                ApiKey = userInfo.ApiKey,
                Mode = userInfo.Mode,
                CreatedUtc = userInfo.CreatedUtc,
                LastUpdatedUtc = userInfo.LastUpdatedUtc,
                Profiles = userInfo.Profiles?.Select(p => new ProfileDto
                {
                    Id = p.Id,
                    Name = p.Name,
                    DatabaseName = p.DatabaseName,
                    ConnectionString = "", // This should be retrieved separately for security
                    CreatedUtc = p.CreatedUtc,
                    Queries = p.Queries?.Select(q => new QueryDto
                    {
                        Id = q.Id,
                        UserQuery = q.UserQuery,
                        SqlQuery = q.SqlQuery,
                        TimestampUtc = q.TimestampUtc,
                        ResultJson = q.ResultJson
                    }).ToList() ?? new List<QueryDto>()
                }).ToList() ?? new List<ProfileDto>()
            };
        }

        public async Task<UserInfoDto?> UpdateApiKeyAsync(Guid UserId, string newApiKey, CancellationToken ct = default)
        {
            var user = await _repository.GetByIdAsync(UserId, ct);
            if (user == null)
            {
                throw new InvalidOperationException("User not found.");
            }
            user.UpdateApiKey(newApiKey);
            await _repository.UpdateAsync(user, ct);
            await _repository.SaveChangesAsync(ct);

            return MapToDto(user);
        }

        public async Task<UserInfoDto?> UpdateAiModeAsync(Guid UserId, string ApiKey, AIMode newAiMode, CancellationToken ct = default)
        {
            var user = await _repository.GetByIdAsync(UserId, ct);
            if (user == null)
            {
                throw new InvalidOperationException("User not found.");
            }
            user.UpdateAIMode(newAiMode);
            if(AIMode.Groq == newAiMode)
            {
                if (string.IsNullOrWhiteSpace(ApiKey))
                {
                    throw new ArgumentException("Cannot switch to groq mode without providing api key");
                }
                user.UpdateApiKey(ApiKey);
            }
            await _repository.UpdateAsync(user, ct);
            await _repository.SaveChangesAsync(ct);

            return MapToDto(user);
        }
    }
}