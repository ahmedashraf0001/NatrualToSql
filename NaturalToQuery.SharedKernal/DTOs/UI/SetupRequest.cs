using NaturalToQuery.Core.Contributers.Entities;
using System.Text.Json.Serialization;

namespace NaturalToQuery.SharedKernal.DTOs.UI
{
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum ConnectionType
    {
        AutoConnect,
        ConnectionString
    }
    public class SetupRequest
    {
        public Guid UserId { get; set; }
        public ConnectionType ConnectionType { get; set; }
        public ProviderType ProviderType { get; set; }
        public string ServerName { get; set; } = string.Empty;
        public string DatabaseName { get; set; } = string.Empty;
        public string ConnectionString { get; set; } = string.Empty;
    }
}
