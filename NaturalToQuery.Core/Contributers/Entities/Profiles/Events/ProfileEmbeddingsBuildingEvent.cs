using NaturalToQuery.Core.Base;
namespace NaturalToQuery.Core.Contributers.Entities.Profiles.Events
{
    public record ProfileEmbeddingsBuildingEvent : DomainEventBase
    {
        private Profile profile;

        public ProfileEmbeddingsBuildingEvent(Profile profile)
        {
            this.profile = profile;
        }
    }
}