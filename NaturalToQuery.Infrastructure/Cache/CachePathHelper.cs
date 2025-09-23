
using NaturalToQuery.Core.Contributers.Entities;

namespace NaturalToQuery.Infrastructure.Cache
{
    public static class CachePathHelper
    {
        public static string DefaultCacheDirectory(ProviderType Type) =>
            Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "MicroSqlRag",
                Type.ToString());
        public static string GetServerCacheFile(string cacheDirectory, string dialect) =>
            Path.Combine(cacheDirectory, $"{dialect}.json");

        public static string GetSchemaCacheFile(string cacheDirectory, string dialect) =>
            Path.Combine(cacheDirectory, $"{dialect}_schemas.json");
    }

}
