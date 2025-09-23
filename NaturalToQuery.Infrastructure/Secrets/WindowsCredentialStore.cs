using Meziantou.Framework.Win32;
using NaturalToQuery.Core.Exceptions;
using NaturalToQuery.Core.Interfaces;

namespace NaturalToQuery.Infrastructure.Secrets{
    public class WindowsCredentialStore : ISecretStore<WindowsCredentialStore>
    {
        public Task<string> SaveSecretAsync(string key, string secret, CancellationToken ct = default)
        {
            try
            {
                CredentialManager.WriteCredential(
                    applicationName: key,
                    userName: Environment.UserName,
                    secret: secret,
                    persistence: CredentialPersistence.LocalMachine);

                return Task.FromResult(key);
            }
            catch (Exception ex)
            {
                throw new WindowsCredentialStoreException(
                    $"Failed to save secret for key '{key}'.", key, ex);
            }
        }

        public Task<string?> GetSecretAsync(string key, CancellationToken ct = default)
        {
            try
            {
                var cred = CredentialManager.ReadCredential(key);
                return Task.FromResult(cred?.Password);
            }
            catch (Exception ex)
            {
                throw new WindowsCredentialStoreException(
                    $"Failed to retrieve secret for key '{key}'.", key, ex);
            }
        }

        public Task DeleteSecretAsync(string key, CancellationToken ct = default)
        {
            try
            {
                CredentialManager.DeleteCredential(key);
                return Task.CompletedTask;
            }
            catch (Exception ex)
            {
                throw new WindowsCredentialStoreException(
                    $"Failed to delete secret for key '{key}'.", key, ex);
            }
        }
    }
}
