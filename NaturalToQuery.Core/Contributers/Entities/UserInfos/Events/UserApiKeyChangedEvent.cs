using NaturalToQuery.Core.Base;

namespace NaturalToQuery.Core.Contributers.Entities.UserInfos.Events
{
    public record UserApiKeyChangedEvent : DomainEventBase
    {
        public UserInfo UserInfo { get; }
        public DateTime DateOccurred { get; } = DateTime.UtcNow;

        public UserApiKeyChangedEvent(UserInfo userInfo)
        {
            UserInfo = userInfo;
        }
    }
}
