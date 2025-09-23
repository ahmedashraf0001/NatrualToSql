namespace NaturalToQuery.Api.Middlewares
{
    public class ErrorMessageDTO
    {    
        public string Source { get; set; }
        public object? Errors { get; init; }
        public int StatusCode { get; set; }
        public override string ToString() => System.Text.Json.JsonSerializer.Serialize(this);
    }
}
