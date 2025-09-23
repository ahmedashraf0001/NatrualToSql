using MediatR;
using NaturalToQuery.Core.Contributers.Entities.Profiles.Events;
using NaturalToQuery.SharedKernal.Interfaces;

namespace NaturalToQuery.Core.Contributers.Entities.Profiles.Handlers
{
    public class ProfileEmbeddingsFailedEventHandler
        : INotificationHandler<ProfileEmbeddingsFailedEvent>
    {
        private readonly IAppLogger<ProfileEmbeddingsFailedEvent> _logger;

        public ProfileEmbeddingsFailedEventHandler(IAppLogger<ProfileEmbeddingsFailedEvent> logger)
        {
            _logger = logger;
        }

        public Task Handle(ProfileEmbeddingsFailedEvent notification, CancellationToken cancellationToken)
        {
            _logger.LogInformation("ProfileEmbeddingsFailedEvent triggered: {@Event}", notification);
            return Task.CompletedTask;
        }
    }

}
