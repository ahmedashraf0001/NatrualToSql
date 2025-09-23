using FastEndpoints;
using Microsoft.Extensions.Caching.Memory;
using NaturalToQuery.Application.Interfaces;
using NaturalToQuery.SharedKernal.DTOs.Providers;
using NaturalToQuery.SharedKernal.DTOs.UI;
using NaturalToQuery.SharedKernal.Interfaces;
using System;
using System.Text;
using System.Text.Json;

namespace NaturalToQuery.Api.Controllers.Query
{
    public class ExecuteQuery : Endpoint<ExecuteQueryRequest, ExecutionResult>
    {
        private readonly IMemoryCache _cache;
        private readonly IQueryOrchestrationService _queryService;
        public ExecuteQuery(
            IMemoryCache cache,
            IQueryOrchestrationService queryService)
        {
            _queryService = queryService;
            _cache = cache;
        }

        public override void Configure()
        {
            Post("api/query/{profileId}/execute");
            AllowAnonymous(); 
        }

        public override async Task HandleAsync(ExecuteQueryRequest req, CancellationToken ct)
        {
            if (req.Mode == ExecutionMode.Write)
            {
                var writeResult = await _queryService.ExecuteQueryAsync(req.ProfileId, req.Sql, req.UserQuery, req.Parameters, req.Mode, ct);
                await Send.OkAsync(writeResult, ct);
                return;
            }

            var cacheKey = GenerateCacheKey(req);

            if (_cache.TryGetValue(cacheKey, out ExecutionResult? cachedResult))
            {
                await Send.OkAsync(cachedResult, ct);
                return;
            }

            var result = await _queryService.ExecuteQueryAsync(req.ProfileId, req.Sql, req.UserQuery, req.Parameters, req.Mode, ct);

            var cacheOptions = new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10),
                SlidingExpiration = TimeSpan.FromMinutes(2),
                Priority = CacheItemPriority.Normal,
                Size = 1 
            };
            _cache.Set(cacheKey, result, cacheOptions);

            await Send.OkAsync(result, ct);
        }

        private string GenerateCacheKey(ExecuteQueryRequest req)
        {
            var parametersJson = req.Parameters != null ? JsonSerializer.Serialize(req.Parameters) : "";

            var sqlBytes = Encoding.UTF8.GetBytes(req.Sql ?? "");
            var paramsBytes = Encoding.UTF8.GetBytes(parametersJson);

            using var sha256 = System.Security.Cryptography.SHA256.Create();
            var sqlHash = Convert.ToHexString(sha256.ComputeHash(sqlBytes));
            var paramsHash = Convert.ToHexString(sha256.ComputeHash(paramsBytes));

            return $"query:{req.ProfileId}:{sqlHash}:{paramsHash}:{req.Mode}";
        }
    }
}
