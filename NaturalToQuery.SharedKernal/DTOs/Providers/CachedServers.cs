namespace NaturalToQuery.SharedKernal.DTOs.Providers
{
    public class CachedServers
    {
        public DateTime TimestampUtc { get; set; }
        public List<ServerInfo> Servers { get; set; } = new();
    }
}
