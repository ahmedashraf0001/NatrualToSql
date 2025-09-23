using NaturalToQuery.Core.Base;

namespace NaturalToQuery.Core.Contributers.Entities.Profiles.Events
{
    public record QueryAddedEvent : DomainEventBase
    {
        private Profile profile;

        public QueryAddedEvent(Profile profile)
        {
            this.profile = profile;
        }
    }
}