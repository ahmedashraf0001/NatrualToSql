using System.Text.Json.Serialization;

namespace NaturalToQuery.SharedKernal.DTOs.Providers
{
    public class SchemaModel
    {
        public string Database { get; set; } = default!;
        [JsonInclude]
        public List<TableInfo> Tables { get; } = new();
        [JsonInclude]
        public List<RelationInfo> Relations { get; } = new();
    }
}
