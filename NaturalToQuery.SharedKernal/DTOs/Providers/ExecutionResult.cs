namespace NaturalToQuery.SharedKernal.DTOs.Providers
{
    public class ExecutionResult
    {
        public string[] Columns { get; set; } = Array.Empty<string>();
        public object[][] Rows { get; set; } = Array.Empty<object[]>();
        public long ExecutionMs { get; set; }
        public string? ErrorMessage { get; set; } = "None";
        public bool Success => ErrorMessage.Equals("None");
        public IDictionary<string, string?> Parameters { get; set; } = new Dictionary<string, string?>();
        public int? AffectedRows { get; set; }
    }
}
