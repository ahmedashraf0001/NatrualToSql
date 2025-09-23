using NaturalToQuery.Core.Base;

namespace NaturalToQuery.Core.Contributers.Entities.Profiles.Events
{
    public record ProfileRenamedEvent : DomainEventBase
    {
        private Profile profile;

        public ProfileRenamedEvent(Profile profile)
        {
            this.profile = profile;
        }
    }
}