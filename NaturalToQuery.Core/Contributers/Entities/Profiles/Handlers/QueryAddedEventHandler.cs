using MediatR;
using NaturalToQuery.Core.Contributers.Entities.Profiles.Events;
using NaturalToQuery.SharedKernal.Interfaces;

namespace NaturalToQuery.Core.Contributers.Entities.Profiles.Handlers
{
    public class QueryAddedEventHandler
        : INotificationHandler<QueryAddedEvent>
    {
        private readonly IAppLogger<QueryAddedEvent> _logger;

        public QueryAddedEventHandler(IAppLogger<QueryAddedEvent> logger)
        {
            _logger = logger;
        }

        public Task Handle(QueryAddedEvent notification, CancellationToken cancellationToken)
        {
            _logger.LogInformation("ProfileSettingsChangedEvent triggered: {@Event}", notification);
            return Task.CompletedTask;
        }
    }

}
