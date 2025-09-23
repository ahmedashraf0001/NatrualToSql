namespace NaturalToQuery.Api.Controllers.Health.Health
{
    public class ApiHealthDto
    {
        public string Status { get; set; } = string.Empty;
        public DateTime TimeStamp { get; set; }
        public string Version { get; set; } = string.Empty;
    }
}
