using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using NaturalToQuery.Core.Contributers.Entities;
using NaturalToQuery.Core.Interfaces;
using NaturalToQuery.Infrastructure.Interfaces;
using NaturalToQuery.Infrastructure.Providers;
using NaturalToQuery.SharedKernal.Interfaces;

namespace NaturalToQuery.Infrastructure.Factory
{
    public class DbProviderFactory : IDbProviderFactory
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly IAppLogger<DbProviderFactory> _logger;
        public DbProviderFactory(IServiceProvider serviceProvider, IAppLogger<DbProviderFactory> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }
        public IDbProvider CreateWithProfile(Guid profileId, ProviderType Type)
        {
            return Type switch
            {
                ProviderType.SqlServer => new SqlServerDbProvider(
                        _serviceProvider.GetRequiredService<IConfiguration>(),
                        _serviceProvider.GetRequiredService<IProfileRepository>(),
                        _serviceProvider.GetRequiredService<IAppLogger<SqlServerDbProvider>>(),
                        _serviceProvider.GetRequiredService<IProviderCache>(),
                        profileId
                    ),

                _ => HandleUnsupportedProvider(Type, nameof(CreateStandalone))
            };
        }
        public IDbProvider CreateStandalone(ProviderType Type)
        {
            return Type switch
            {
                ProviderType.SqlServer => new SqlServerDbProvider(
                        _serviceProvider.GetRequiredService<IConfiguration>(),
                        null, // no profile repository
                        _serviceProvider.GetRequiredService<IAppLogger<SqlServerDbProvider>>(),
                        _serviceProvider.GetRequiredService<IProviderCache>(),
                        null // no profile ID
                    ),

                _ => HandleUnsupportedProvider(Type, nameof(CreateStandalone))
            };
        }

        private IDbProvider HandleUnsupportedProvider(ProviderType type, string method)
        {
            _logger.LogError("Unsupported provider type '{ProviderType}' requested in {Method}", type, method);
            throw new NotImplementedException(
                $"Unsupported provider type"
            );
        }
    }
}
