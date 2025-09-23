using MediatR;
using Microsoft.Extensions.Logging;
using NaturalToQuery.Core.Contributers.Entities.UserInfos.Events;

namespace NaturalToQuery.Core.Contributers.Entities.UserInfos.Handlers
{
    public class UserApiKeyChangedEventHandler : INotificationHandler<UserApiKeyChangedEvent>
    {
        private readonly ILogger<UserApiKeyChangedEventHandler> _logger;

        public UserApiKeyChangedEventHandler(ILogger<UserApiKeyChangedEventHandler> logger)
        {
            _logger = logger;
        }

        public Task Handle(UserApiKeyChangedEvent notification, CancellationToken cancellationToken)
        {
            _logger.LogInformation("API key changed for user {UserId} at {Timestamp}", 
                notification.UserInfo.Id, 
                notification.DateOccurred);

            return Task.CompletedTask;
        }
    }
}
