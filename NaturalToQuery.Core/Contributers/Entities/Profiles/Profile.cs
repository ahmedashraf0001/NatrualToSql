using Ardalis.GuardClauses;
using NaturalToQuery.Core.Base;
using NaturalToQuery.Core.Contributers.Entities.Profiles.Events;
using NaturalToQuery.Core.Contributers.Entities.Queries;
using NaturalToQuery.Core.Contributers.Entities.UserInfos;
namespace NaturalToQuery.Core.Contributers.Entities.Profiles
{
    public class Profile : EntityBase
    {
        public string Name { get; private set; } = string.Empty;
        public string DatabaseName { get; private set; }
        public ProviderType Provider { get; private set; }
        public string? SecretRef { get; private set; }
        public string? CacheFile { get; private set; }
        public DateTimeOffset CreatedUtc { get; private set; }
        public List<Query>? Queries { get; set; } = new();
        public Guid? UserInfoId { get; set; }
        public UserInfo? UserInfo { get; set; }

        private Profile() { }

        public static Profile Create(Guid UserId, string name, string databaseName, ProviderType provider, string secretRef, string cacheFile)
        {
            Guard.Against.NullOrWhiteSpace(name, nameof(name));
            Guard.Against.NullOrWhiteSpace(secretRef, nameof(secretRef));
            Guard.Against.NullOrWhiteSpace(databaseName, nameof(databaseName));

            return new Profile
            {
                UserInfoId = UserId,
                DatabaseName= databaseName.Trim(),
                Name = name.Trim(),
                Provider = provider,
                SecretRef = secretRef,
                CreatedUtc = DateTimeOffset.UtcNow,
                CacheFile = cacheFile
            };
        }
        public void SetDatabaseName(string newName)
        {
            Guard.Against.NullOrWhiteSpace(newName, nameof(newName));
            DatabaseName = newName.Trim();
            AddDomainEvent(new ProfileRenamedEvent(this));
        }
        public void Rename(string newName)
        {
            Guard.Against.NullOrWhiteSpace(newName, nameof(newName));
            Name = newName.Trim();
            AddDomainEvent(new ProfileRenamedEvent(this));
        }
        public void SetSecretRef(string secretRef)
        {
            Guard.Against.NullOrWhiteSpace(secretRef, nameof(secretRef));
            SecretRef = secretRef;
            AddDomainEvent(new ProfileSecretRefChangedEvent(this));
        }
        public void UpdateCacheFile(string path)
        {
            CacheFile = path ?? "";
            AddDomainEvent(new ProfileSchemaCacheFileChangedEvent(this));
        }
        public bool AddQuery(Query _Query)
        {
            Guard.Against.Null(_Query, nameof(_Query));
            if (!Queries.Any(e => e.Equals(_Query)))
            {
                Queries.Add(_Query);
                AddDomainEvent(new QueryAddedEvent(this));
                return true;
            }
            return false;
        }
    }
}
