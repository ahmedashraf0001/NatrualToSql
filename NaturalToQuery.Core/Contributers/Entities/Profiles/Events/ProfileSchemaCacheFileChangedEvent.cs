using NaturalToQuery.Core.Base;

namespace NaturalToQuery.Core.Contributers.Entities.Profiles.Events
{
    public record ProfileSchemaCacheFileChangedEvent : DomainEventBase
    {
        private Profile profile;

        public ProfileSchemaCacheFileChangedEvent(Profile profile)
        {
            this.profile = profile;
        }
    }
}