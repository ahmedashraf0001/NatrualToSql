using System.Text.Json.Serialization;

namespace NaturalToQuery.Core.Contributers.Entities
{
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum ProviderType { SqlServer } //, Postgres, MySql, Sqlite, Other 

}
