namespace NaturalToQuery.SharedKernal.DTOs.Providers
{
    public class TableInfo
    {
        public string Schema { get; set; } = "dbo";
        public string Name { get; set; } = default!;
        public List<ColumnInfo> Columns { get; } = new();
    }
}
