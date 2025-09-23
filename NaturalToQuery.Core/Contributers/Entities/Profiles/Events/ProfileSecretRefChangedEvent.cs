using NaturalToQuery.Core.Base;

namespace NaturalToQuery.Core.Contributers.Entities.Profiles.Events
{
    public record ProfileSecretRefChangedEvent : DomainEventBase
    {
        private Profile profile;

        public ProfileSecretRefChangedEvent(Profile profile)
        {
            this.profile = profile;
        }
    }
}