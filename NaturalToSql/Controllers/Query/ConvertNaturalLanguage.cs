using FastEndpoints;
using Microsoft.Extensions.Caching.Memory;
using NaturalToQuery.Application.Interfaces;
using NaturalToQuery.SharedKernal.DTOs.Groq;
using NaturalToQuery.SharedKernal.DTOs.Providers;
using NaturalToQuery.SharedKernal.Interfaces;
using System.Text;

namespace NaturalToQuery.Api.Controllers.Query
{
    public class ConvertNaturalLanguage : Endpoint<ConvertNaturalLanguageRequest, QueryConversionResult>
    {
        private readonly IQueryOrchestrationService _queryService;
        private readonly IMemoryCache _cache;
        public ConvertNaturalLanguage(
            IQueryOrchestrationService queryService,
            IMemoryCache cache)
        {
            _queryService = queryService;
            _cache = cache;
        }

        public override void Configure()
        {
            Post("api/query/{profileId}/convert");
            AllowAnonymous(); // Adjust security as needed
        }

        public override async Task HandleAsync(ConvertNaturalLanguageRequest req, CancellationToken ct)
        {
            ExecutionMode executionMode = req.AllowWriteOperations switch
            {
                true => ExecutionMode.Write,
                _ => ExecutionMode.ReadOnly
            };

            var cacheKey = GenerateConversionCacheKey(req, executionMode);

            if (_cache.TryGetValue(cacheKey, out QueryConversionResult? cachedResult))
            {
                await Send.OkAsync(cachedResult, ct);
                return;
            }

            var result = await _queryService.ConvertNaturalLanguageAsync(req.UserId, req.ProfileId, req.Query, executionMode, ct);

            var cacheOptions = new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5),
                SlidingExpiration = TimeSpan.FromMinutes(1),
                Priority = CacheItemPriority.Normal,
                Size = 1
            };
            _cache.Set(cacheKey, result, cacheOptions);

            await Send.OkAsync(result, ct);
        }
        private string GenerateConversionCacheKey(ConvertNaturalLanguageRequest req, ExecutionMode mode)
        {
            var queryBytes = Encoding.UTF8.GetBytes(req.Query ?? "");
            using var sha256 = System.Security.Cryptography.SHA256.Create();
            var queryHash = Convert.ToHexString(sha256.ComputeHash(queryBytes));

            return $"convert:{req.ProfileId}:{queryHash}:{mode}";
        }
    }

}
