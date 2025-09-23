using NaturalToQuery.Core.Base;
using NaturalToQuery.Core.Contributers.Entities.Profiles;
using NaturalToQuery.Core.Contributers.Entities.UserInfos.Events;
using NaturalToQuery.SharedKernal.DTOs.Domain;

namespace NaturalToQuery.Core.Contributers.Entities.UserInfos
{
    public class UserInfo : EntityBase
    {
        public string ApiKey { get; private set; } = string.Empty;
        public AIMode Mode { get; private set; } = AIMode.Basic;
        public DateTime CreatedUtc { get; private set; } = DateTime.UtcNow;
        public DateTime LastUpdatedUtc { get; private set;} = DateTime.UtcNow;
        public List<Profile> Profiles { get; set; } = new();
        private UserInfo() { }
        public static UserInfo Create(string apiKey, AIMode mode)
        {
            return new UserInfo
            {
                ApiKey = apiKey,
                Mode = mode,
                CreatedUtc = DateTime.UtcNow,
                LastUpdatedUtc = DateTime.UtcNow
            };
        }
        public void UpdateApiKey(string newKey)
        {
            ApiKey = newKey;
            LastUpdatedUtc = DateTime.UtcNow;
            AddDomainEvent(new UserApiKeyChangedEvent(this));
        }
        public void UpdateAIMode(AIMode newMode)
        {
            Mode = newMode;
            LastUpdatedUtc = DateTime.UtcNow;
            AddDomainEvent(new UserAIModeChangedEvent(this));
        }
    }
}
