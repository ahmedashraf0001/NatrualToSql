using MediatR;
using NaturalToQuery.Core.Contributers.Entities.Profiles.Events;
using NaturalToQuery.SharedKernal.Interfaces;

namespace NaturalToQuery.Core.Contributers.Entities.Profiles.Handlers
{
    public class ProfileEmbeddingsReadyEventHandler
        : INotificationHandler<ProfileEmbeddingsReadyEvent>
    {
        private readonly IAppLogger<ProfileEmbeddingsReadyEvent> _logger;

        public ProfileEmbeddingsReadyEventHandler(IAppLogger<ProfileEmbeddingsReadyEvent> logger)
        {
            _logger = logger;
        }

        public Task Handle(ProfileEmbeddingsReadyEvent notification, CancellationToken cancellationToken)
        {
            _logger.LogInformation("ProfileEmbeddingsReadyEvent triggered: {@Event}", notification);
            return Task.CompletedTask;
        }
    }

}
