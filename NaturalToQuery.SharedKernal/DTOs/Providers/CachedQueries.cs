namespace NaturalToQuery.SharedKernal.DTOs.Providers
{
    public class CachedQueries
    {
        public Dictionary<string, CachedQueryEntry> Queries { get; set; }
            = new Dictionary<string, CachedQueryEntry>();
    }
    public class CachedQueryEntry
    {
        public string UserQuery { get; set; } = string.Empty;

        public string SqlQuery { get; set; } = string.Empty;
        public ExecutionResult Result { get; set; }

        public DateTime TimestampUtc { get; set; } = DateTime.UtcNow;
    }
}
