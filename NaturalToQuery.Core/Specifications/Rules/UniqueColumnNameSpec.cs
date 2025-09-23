using NaturalToQuery.Core.Contributers.Aggregates.Tables;
using NaturalToQuery.SharedKernal.Interfaces;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace NaturalToQuery.Core.Specifications.Rules
{
    internal class UniqueColumnNameSpec : ISpecificationRule<Table>
    {
        private readonly string _newColumnName;
        private readonly bool _isPrimaryKey;

        public UniqueColumnNameSpec(string newColumnName, bool isPrimaryKey)
        {
            _newColumnName = newColumnName;
            _isPrimaryKey = isPrimaryKey;
        }

        public IEnumerable<string> GetViolations(Table table)
        {
            if (table.Columns.Any(c =>
                c.Name.Equals(_newColumnName, StringComparison.OrdinalIgnoreCase)))            
                yield return $"A column with the name '{_newColumnName}' already exists in table '{table.Name}'.";
            
            if (_isPrimaryKey && table.Columns.Any(c => c.IsPrimaryKey))
                yield return $"Table '{table.Name}' already has a primary key.";     
        }
    }
}
