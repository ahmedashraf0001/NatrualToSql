using MediatR;
using NaturalToQuery.Core.Contributers.Entities.Profiles.Events;
using NaturalToQuery.SharedKernal.Interfaces;

namespace NaturalToQuery.Core.Contributers.Entities.Profiles.Handlers
{
    public class ProfileRenamedEventHandler
        : INotificationHandler<ProfileRenamedEvent>
    {
        private readonly IAppLogger<ProfileRenamedEvent> _logger;

        public ProfileRenamedEventHandler(IAppLogger<ProfileRenamedEvent> logger)
        {
            _logger = logger;
        }

        public Task Handle(ProfileRenamedEvent notification, CancellationToken cancellationToken)
        {
            _logger.LogInformation("ProfileRenamedEvent triggered: {@Event}", notification);
            return Task.CompletedTask;
        }
    }

}
