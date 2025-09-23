using Microsoft.Extensions.Logging;
using NaturalToQuery.SharedKernal.Interfaces;

namespace NaturalToQuery.SharedKernal.Logging
{
    public class AppLogger<T> : IAppLogger<T>
    {
        private readonly ILogger<T> _logger;

        public AppLogger(ILogger<T> logger)
        {
            _logger = logger;
        }

        public void LogInformation(string message, params object[] args)
            => _logger.LogInformation(message, args);

        public void LogWarning(string message, params object[] args)
            => _logger.LogWarning(message, args);

        public void LogError(string message, params object[] args)
            => _logger.LogError(message, args);

        public void LogDebug(string message, params object[] args)
            => _logger.LogDebug(message, args);
    }
}
