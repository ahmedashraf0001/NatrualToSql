using Microsoft.Extensions.DependencyInjection;
using NaturalToQuery.Application.Interfaces;
using NaturalToQuery.Core.Interfaces;
using NaturalToQuery.Infrastructure.Interfaces;
using NaturalToQuery.Infrastructure.LLM;
using NaturalToQuery.SharedKernal.DTOs.Groq;
using NaturalToQuery.SharedKernal.DTOs.Providers;
using NaturalToQuery.SharedKernal.Interfaces;
using Newtonsoft.Json;
using System;

namespace NaturalToQuery.Application.Services
{
    public class QueryOrchestrationService : IQueryOrchestrationService
    {
        private readonly IUserInfoRepository userInfoRepository;
        private readonly IProfileDbService dbService;
        private readonly IAppLogger<QueryOrchestrationService> _logger;
        private readonly ILLMServiceFactory llmFactory;
        public QueryOrchestrationService(ILLMServiceFactory llmFactory, IUserInfoRepository userInfoRepository, IProfileDbService dbService, IAppLogger<QueryOrchestrationService> logger)
        {
            this.userInfoRepository = userInfoRepository;
            this.dbService = dbService;
            this.llmFactory = llmFactory;
            _logger = logger;
        }
        public async Task<QueryConversionResult> ConvertNaturalLanguageAsync(Guid UserId, Guid profileId, string naturalLanguage,ExecutionMode Mode, CancellationToken ct = default)
        {
            _logger.LogInformation("Converting NL to SQL for profile {ProfileId}", profileId);

            if (profileId == Guid.Empty)
                throw new ArgumentException("Profile Id cannot be empty.", nameof(profileId));

            if(UserId == Guid.Empty)
                throw new ArgumentException("User Id cannot be empty.", nameof(UserId));

            var user = await userInfoRepository.GetByIdAsync(UserId, ct);
            
            if(user == null)
            {
                _logger.LogError("No user found for UserId {UserId}", UserId);
                throw new InvalidOperationException($"User with ID {UserId} was not found.");
            }

            var schema = await dbService.GetSchemaAsync(profileId);
            if (schema == null)
            {
                _logger.LogError("No schema returned for profile {ProfileId}", profileId);
                throw new InvalidOperationException($"Schema for profile {profileId} was not found.");
            }

            var json = JsonConvert.SerializeObject(schema);
            if (json == null)
            {
                _logger.LogError("failed to serialize schema", schema);
                throw new ApplicationException($"failed to serialize schema: {schema}");
            }

            var llmService = llmFactory.Create(user);

            var result = await llmService.ConvertToSqlAsync(json, naturalLanguage, Mode, ct);

            return result;
        }
        public async Task<ExecutionResult> ExecuteQueryAsync(Guid profileId, string sql, string userQuery,
            IDictionary<string, string?> parameters = null, ExecutionMode mode = ExecutionMode.ReadOnly, CancellationToken ct = default)
        {
            if (profileId == Guid.Empty)
                throw new ArgumentException("Profile Id cannot be empty.", nameof(profileId));

            if (string.IsNullOrWhiteSpace(sql))
                throw new ArgumentException("SQL query cannot be null or empty.", nameof(sql));

            if (string.IsNullOrWhiteSpace(userQuery))
                throw new ArgumentException("User query cannot be null or empty.", nameof(userQuery));
         
            var result = await dbService.ExecuteAsync(profileId, sql, userQuery, parameters, mode, ct);
            return result;
        }
    }
}
