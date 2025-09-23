namespace NaturalToQuery.SharedKernal.DTOs.UI
{
    public class NaturalLanguageRequest
    {
        public string Query { get; set; } = string.Empty;
        public bool AllowWriteOperations { get; set; }
    }
}
