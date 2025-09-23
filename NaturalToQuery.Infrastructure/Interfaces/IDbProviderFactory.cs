using NaturalToQuery.Core.Contributers.Entities;
using NaturalToQuery.Infrastructure.Interfaces;

namespace NaturalToQuery.Core.Interfaces
{
    public interface IDbProviderFactory
    {
        IDbProvider CreateWithProfile(Guid profileId, ProviderType Type);
        IDbProvider CreateStandalone(ProviderType Type);
    }
}
