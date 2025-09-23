namespace NaturalToQuery.SharedKernal.DTOs.Providers
{
    public class ColumnInfo
    {
        public string Name { get; set; } = default!;
        public string DataType { get; set; } = default!;
        public bool IsNullable { get; set; }
        public bool IsPrimaryKey { get; set; }
        public bool IsForeignKey { get; set; }
        public string? ReferencesTable { get; set; }
        public string? ReferencesColumn { get; set; }
    }
}
