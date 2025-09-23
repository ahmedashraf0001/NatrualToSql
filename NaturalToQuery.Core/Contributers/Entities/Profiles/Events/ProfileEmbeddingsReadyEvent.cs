using NaturalToQuery.Core.Base;

namespace NaturalToQuery.Core.Contributers.Entities.Profiles.Events
{
    public record ProfileEmbeddingsReadyEvent : DomainEventBase
    {
        private Profile profile;

        public ProfileEmbeddingsReadyEvent(Profile profile)
        {
            this.profile = profile;
        }
    }
}