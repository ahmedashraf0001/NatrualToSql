namespace NaturalToQuery.Api.Controllers.Query
{
    public class ConvertNaturalLanguageRequest
    {
        public Guid UserId { get; set; }
        public Guid ProfileId { get; set; }
        public string Query { get; set; }
        public bool AllowWriteOperations { get; set; }
    }
}
