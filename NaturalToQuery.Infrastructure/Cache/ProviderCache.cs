using NaturalToQuery.Core.Interfaces;
using NaturalToQuery.SharedKernal.Interfaces;
using Newtonsoft.Json;
using static System.Runtime.InteropServices.JavaScript.JSType;

namespace NaturalToQuery.Infrastructure.Cache
{
    public class ProviderCache : IProviderCache
    {
        private readonly IAppLogger<ProviderCache> _logger;
        public ProviderCache(IAppLogger<ProviderCache> logger)
        {
            _logger = logger;
        }
        public void Clear(string filePath)
        {
            try
            {
                if (File.Exists(filePath))
                {
                    File.Delete(filePath);
                    _logger.LogDebug("Deleted cache file {CacheFile}", filePath);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning("Failed to delete cache file {CacheFile}", filePath, ex);
            }
        }

        public async Task<T?> LoadAsync<T>(string filePath, CancellationToken ct = default)
        {
            try
            {
                if (!File.Exists(filePath))
                    return default;

                var json = await File.ReadAllTextAsync(filePath, ct);

                return JsonConvert.DeserializeObject<T>(json);
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogWarning("Failed to load/deserialize cache file {CacheFile} - treating as invalid", filePath, ex);
                return default;
            }
        }

        public async Task SaveAndReplaceAsync<T>(string filePath, T data, CancellationToken ct = default)
        {
            string? tmpFile = null;
            try
            {
                if (string.IsNullOrWhiteSpace(filePath))
                    throw new ArgumentNullException("", "No file path provided");
                if (data == null)
                    throw new ArgumentNullException("", "No Data provided");

                var dir = Path.GetDirectoryName(filePath);

                if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
                    Directory.CreateDirectory(dir);

                tmpFile = Path.Combine(dir ?? ".", $"{Path.GetFileName(filePath)}.{Guid.NewGuid():N}.tmp");

                var json = JsonConvert.SerializeObject(data, Formatting.Indented);

                await File.WriteAllTextAsync(tmpFile, json, ct).ConfigureAwait(false);

                if (File.Exists(filePath))
                {
                    try
                    {
                        File.Replace(tmpFile, filePath, null);
                    }
                    catch (PlatformNotSupportedException)
                    {
                        File.Delete(filePath);
                        File.Move(tmpFile, filePath);
                    }
                }
                else
                {
                    File.Move(tmpFile, filePath);
                }

                _logger.LogDebug("Saved cache file {CacheFile}", filePath);
                tmpFile = null; // moved, nothing to delete
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError("Failed to save cache file {CacheFile}", filePath, ex.Message);
                throw;
            }
            finally
            {
                // best-effort cleanup of temp file if it still exists
                try
                {
                    if (!string.IsNullOrEmpty(tmpFile) && File.Exists(tmpFile))
                        File.Delete(tmpFile);
                }
                catch { /* swallow — we don't want cleanup failures to crash app */ }
            }
        }
        public async Task SaveOrUpdateAsync<T>(string filePath, Func<T, T> updateFunc, CancellationToken ct = default) where T : new()
        {
            try
            {
                if (string.IsNullOrWhiteSpace(filePath))
                    throw new ArgumentNullException("", "No file path provided");
                if (updateFunc == null)
                    throw new ArgumentNullException("", "No update Func provided");

                T existing = new T();

                if (File.Exists(filePath))
                {
                    try
                    {
                        var json = await File.ReadAllTextAsync(filePath, ct).ConfigureAwait(false);
                        existing = JsonConvert.DeserializeObject<T>(json) ?? new T();
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning("Failed to read existing cache file {CacheFile}. Starting fresh.", filePath, ex);
                    }
                }
                var updated = updateFunc(existing);
                await SaveAndReplaceAsync(filePath, updated, ct).ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                _logger.LogError("Failed to save or update cache file {CacheFile}", filePath, ex.Message);
                throw;
            }
        }

    }

}
