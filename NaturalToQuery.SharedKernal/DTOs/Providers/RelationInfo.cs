namespace NaturalToQuery.SharedKernal.DTOs.Providers
{
    public class RelationInfo
    {
        public string FromSchema { get; set; } = "dbo";
        public string FromTable { get; set; } = default!;
        public string FromColumn { get; set; } = default!;
        public string ToSchema { get; set; } = "dbo";
        public string ToTable { get; set; } = default!;
        public string ToColumn { get; set; } = default!;
    }
}
