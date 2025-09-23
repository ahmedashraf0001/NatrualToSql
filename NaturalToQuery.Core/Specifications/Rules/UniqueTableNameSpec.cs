using NaturalToQuery.Core.Contributers.Aggregates.Schemas;
using NaturalToQuery.Core.Contributers.Aggregates.Tables;
using NaturalToQuery.SharedKernal.Interfaces;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace NaturalToQuery.Core.Specifications.Rules
{
    internal class UniqueTableNameSpec : ISpecificationRule<Schema>
    {
        private readonly string _newTableName;

        public UniqueTableNameSpec(string newTableName)
        {
            _newTableName = newTableName;
        }

        public IEnumerable<string> GetViolations(Schema schema)
        {
            if (schema.Tables.Any(t =>
                t.Name.Equals(_newTableName, StringComparison.OrdinalIgnoreCase)))
            {
                yield return $"A table with the name '{_newTableName}' already exists in schema '{schema.Name}'.";
            }
        }
    }
}
