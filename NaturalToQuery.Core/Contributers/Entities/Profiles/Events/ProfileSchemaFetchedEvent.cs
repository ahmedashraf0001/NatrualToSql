using NaturalToQuery.Core.Base;

namespace NaturalToQuery.Core.Contributers.Entities.Profiles.Events
{
    public record ProfileSchemaFetchedEvent : DomainEventBase
    {
        private Profile profile;

        public ProfileSchemaFetchedEvent(Profile profile)
        {
            this.profile = profile;
        }
    }
}