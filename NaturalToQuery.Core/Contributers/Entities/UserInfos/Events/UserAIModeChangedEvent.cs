using NaturalToQuery.Core.Base;

namespace NaturalToQuery.Core.Contributers.Entities.UserInfos.Events
{
    public record UserAIModeChangedEvent : DomainEventBase
    {
        public UserInfo UserInfo { get; }
        public DateTime DateOccurred { get; } = DateTime.UtcNow;

        public UserAIModeChangedEvent(UserInfo userInfo)
        {
            UserInfo = userInfo;
        }
    }
}
