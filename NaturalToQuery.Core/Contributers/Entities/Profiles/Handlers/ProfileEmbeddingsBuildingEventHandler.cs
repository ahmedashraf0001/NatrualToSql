using MediatR;
using NaturalToQuery.Core.Contributers.Entities.Profiles.Events;
using NaturalToQuery.SharedKernal.Interfaces;

namespace NaturalToQuery.Core.Contributers.Entities.Profiles.Handlers
{
    public class ProfileEmbeddingsBuildingEventHandler
        : INotificationHandler<ProfileEmbeddingsBuildingEvent>
    {
        private readonly IAppLogger<ProfileEmbeddingsBuildingEvent> _logger;

        public ProfileEmbeddingsBuildingEventHandler(IAppLogger<ProfileEmbeddingsBuildingEvent> logger)
        {
            _logger = logger;
        }

        public Task Handle(ProfileEmbeddingsBuildingEvent notification, CancellationToken cancellationToken)
        {
            _logger.LogInformation("ProfileEmbeddingsBuildingEvent triggered: {@Event}", notification);
            return Task.CompletedTask;
        }
    }

}
