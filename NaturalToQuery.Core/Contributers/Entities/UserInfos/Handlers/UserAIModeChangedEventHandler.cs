using MediatR;
using Microsoft.Extensions.Logging;
using NaturalToQuery.Core.Contributers.Entities.UserInfos.Events;

namespace NaturalToQuery.Core.Contributers.Entities.UserInfos.Handlers
{
    public class UserAIModeChangedEventHandler : INotificationHandler<UserAIModeChangedEvent>
    {
        private readonly ILogger<UserAIModeChangedEventHandler> _logger;

        public UserAIModeChangedEventHandler(ILogger<UserAIModeChangedEventHandler> logger)
        {
            _logger = logger;
        }

        public Task Handle(UserAIModeChangedEvent notification, CancellationToken cancellationToken)
        {
            _logger.LogInformation("AI mode changed to {AIMode} for user {UserId} at {Timestamp}", 
                notification.UserInfo.Mode, 
                notification.UserInfo.Id, 
                notification.DateOccurred);

            return Task.CompletedTask;
        }
    }
}
