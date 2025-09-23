namespace NaturalToQuery.Core.Interfaces
{
    public interface ISecretStore<T> where T : class
    {
        Task<string> SaveSecretAsync(string key, string secret, CancellationToken ct = default);
        Task<string?> GetSecretAsync(string key, CancellationToken ct = default);
        Task DeleteSecretAsync(string key, CancellationToken ct = default);
    }
}
