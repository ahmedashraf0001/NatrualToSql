using FastEndpoints;
using Microsoft.Extensions.Caching.Memory;
using NaturalToQuery.Application.Interfaces;
using NaturalToQuery.SharedKernal.DTOs.Providers;
using NaturalToQuery.SharedKernal.Interfaces;

namespace NaturalToQuery.Api.Controllers.Query
{
    public class GetSchema : Endpoint<GetSchemaRequest, SchemaModel>
    {
        private readonly IProfileDbService _profileDbService;
        private readonly IMemoryCache _memoryCache;

        public GetSchema(
            IProfileDbService profileDbService,
            IMemoryCache memoryCache)
        {
            _profileDbService = profileDbService;
            _memoryCache = memoryCache;
        }

        public override void Configure()
        {
            Get("api/query/{profileId}/schema");
            AllowAnonymous();
        }

        public override async Task HandleAsync(GetSchemaRequest req, CancellationToken ct)
        {
            var cacheKey = $"schema_{req.ProfileId}";

            if (req.ForceRefresh)
            {
                _memoryCache.Remove(cacheKey);
            }

            if (!_memoryCache.TryGetValue(cacheKey, out SchemaModel? cachedSchema))
            {
                cachedSchema = await _profileDbService.GetSchemaAsync(req.ProfileId, req.ForceRefresh, ct);

                var cacheOptions = new MemoryCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(30),
                    SlidingExpiration = TimeSpan.FromMinutes(5),
                    Priority = CacheItemPriority.High, 
                    Size = 10 
                };

                _memoryCache.Set(cacheKey, cachedSchema, cacheOptions);
            }

            await Send.OkAsync(cachedSchema, ct);
        }
    }
}