namespace NaturalToQuery.Core.Interfaces
{
    public interface IProviderCache
    {
        Task SaveAndReplaceAsync<T>(string filePath, T data, CancellationToken ct = default);
        Task<T?> LoadAsync<T>(string filePath, CancellationToken ct = default);
        void Clear(string filePath);
        Task SaveOrUpdateAsync<T>(string filePath, Func<T, T> updateFunc, CancellationToken ct = default) where T : new();
    }
}