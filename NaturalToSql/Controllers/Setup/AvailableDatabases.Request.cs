using NaturalToQuery.Core.Contributers.Entities;

namespace NaturalToQuery.Api.Controllers.Setup
{
    public class GetAvailableDatabasesRequest
    {
        public ProviderType Type { get; set; }
        public string ServerName { get; set; } = string.Empty;
    }
}
