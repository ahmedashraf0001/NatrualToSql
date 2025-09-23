using FastEndpoints;
using Microsoft.Extensions.Caching.Memory;
using NaturalToQuery.Application.Interfaces;
using NaturalToQuery.SharedKernal.DTOs.Providers;
using NaturalToQuery.SharedKernal.Interfaces;

namespace NaturalToQuery.Api.Controllers.Query
{
    public class GetDatabases : Endpoint<GetDatabasesRequest, IEnumerable<DatabaseInfo>>
    {
        private readonly IProfileDbService _profileDbService;
        private readonly IMemoryCache _cache;
        public GetDatabases(
            IProfileDbService profileDbService,
            IMemoryCache cache)
        {
            _profileDbService = profileDbService;
            _cache = cache;
        }

        public override void Configure()
        {
            Get("api/query/{profileId}/databases");
            AllowAnonymous();
        }

        public override async Task HandleAsync(GetDatabasesRequest req, CancellationToken ct)
        {
            var cacheKey = $"databases:{req.ProfileId}";

            if (_cache.TryGetValue(cacheKey, out IEnumerable<DatabaseInfo>? cachedDatabases))
            {
                await Send.OkAsync(cachedDatabases, ct);
                return;
            }

            var databases = await _profileDbService.GetDatabasesAsync(req.ProfileId, ct);

            var cacheOptions = new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(2),
                SlidingExpiration = TimeSpan.FromMinutes(30),
                Priority = CacheItemPriority.Normal
            };
            _cache.Set(cacheKey, databases, cacheOptions);

            await Send.OkAsync(databases, ct);
        }
    }
}
