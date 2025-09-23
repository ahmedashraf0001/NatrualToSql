using MediatR;
using NaturalToQuery.Core.Contributers.Entities.Profiles.Events;
using NaturalToQuery.SharedKernal.Interfaces;

namespace NaturalToQuery.Core.Contributers.Entities.Profiles.Handlers
{
    public class ProfileSchemaFetchedEventHandler
        : INotificationHandler<ProfileSchemaFetchedEvent>
    {
        private readonly IAppLogger<ProfileSchemaFetchedEvent> _logger;

        public ProfileSchemaFetchedEventHandler(IAppLogger<ProfileSchemaFetchedEvent> logger)
        {
            _logger = logger;
        }

        public Task Handle(ProfileSchemaFetchedEvent notification, CancellationToken cancellationToken)
        {
            _logger.LogInformation("ProfileSchemaFetchedEvent triggered: {@Event}", notification);
            return Task.CompletedTask;
        }
    }

}
