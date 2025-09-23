using MediatR;
using NaturalToQuery.Core.Contributers.Entities.Profiles.Events;
using NaturalToQuery.SharedKernal.Interfaces;

namespace NaturalToQuery.Core.Contributers.Entities.Profiles.Handlers
{
    public class ProfileSecretRefChangedEventHandler
        : INotificationHandler<ProfileSecretRefChangedEvent>
    {
        private readonly IAppLogger<ProfileSecretRefChangedEvent> _logger;

        public ProfileSecretRefChangedEventHandler(IAppLogger<ProfileSecretRefChangedEvent> logger)
        {
            _logger = logger;
        }

        public Task Handle(ProfileSecretRefChangedEvent notification, CancellationToken cancellationToken)
        {
            _logger.LogInformation("ProfileSecretRefChangedEvent triggered: {@Event}", notification);
            return Task.CompletedTask;
        }
    }
}
