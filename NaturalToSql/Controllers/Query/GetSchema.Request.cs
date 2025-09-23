namespace NaturalToQuery.Api.Controllers.Query
{
    public class GetSchemaRequest
    {
        public Guid ProfileId { get; set; }
        public bool ForceRefresh { get; set; } = false;
    }
}
