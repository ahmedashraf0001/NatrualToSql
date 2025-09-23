using NaturalToQuery.Core.Base;

namespace NaturalToQuery.Core.Contributers.Entities.Profiles.Events
{
    public record ProfileEmbeddingsFailedEvent : DomainEventBase
    {
        private Profile profile;

        public ProfileEmbeddingsFailedEvent(Profile profile)
        {
            this.profile = profile;
        }
    }
}