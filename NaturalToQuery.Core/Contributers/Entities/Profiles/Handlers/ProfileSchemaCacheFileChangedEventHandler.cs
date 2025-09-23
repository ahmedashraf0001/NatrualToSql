using MediatR;
using NaturalToQuery.Core.Contributers.Entities.Profiles.Events;
using NaturalToQuery.SharedKernal.Interfaces;

namespace NaturalToQuery.Core.Contributers.Entities.Profiles.Handlers
{
    public class ProfileSchemaCacheFileChangedEventHandler
        : INotificationHandler<ProfileSchemaCacheFileChangedEvent>
    {
        private readonly IAppLogger<ProfileSchemaCacheFileChangedEvent> _logger;

        public ProfileSchemaCacheFileChangedEventHandler(IAppLogger<ProfileSchemaCacheFileChangedEvent> logger)
        {
            _logger = logger;
        }

        public Task Handle(ProfileSchemaCacheFileChangedEvent notification, CancellationToken cancellationToken)
        {
            _logger.LogInformation("ProfileSchemaCacheFileChangedEvent triggered: {@Event}", notification);
            return Task.CompletedTask;
        }
    }

}
