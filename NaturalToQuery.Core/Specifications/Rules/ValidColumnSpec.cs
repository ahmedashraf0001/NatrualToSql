using NaturalToQuery.Core.Contributers.Entities.Column;
using NaturalToQuery.Core.Exceptions;
using NaturalToQuery.SharedKernal.Interfaces;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Data.SqlTypes;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace NaturalToQuery.Core.Specifications.Rules
{
    internal class ValidColumnSpec : ISpecificationRule<Column>
    {
        private static readonly HashSet<string> AllowedTypes = new(StringComparer.OrdinalIgnoreCase)
        {
            "int", "varchar", "nvarchar", "datetime", "bit", "decimal", "float", "text", "uniqueidentifier"
        };

        public IEnumerable<string> GetViolations(Column candidate)
        {
            if (!AllowedTypes.Contains(candidate.DataType))
                yield return $"Unsupported data type: {candidate.DataType}";

            if (candidate.IsPrimaryKey && candidate.IsForeignKey)
                yield return "A column cannot be both primary key and foreign key.";

            if (candidate.IsPrimaryKey && candidate.IsNullable)
                yield return "Primary key columns cannot be nullable.";

            if (candidate.OrdinalPosition < 1)
                yield return "Ordinal position must be greater than or equal to 1.";

            if (candidate.MaxLength.HasValue && candidate.MaxLength.Value <= 0)
                yield return "Max length must be greater than 0 when specified.";

            if (candidate.MaxLength.HasValue && !IsVariableLengthType(candidate.DataType))
                yield return $"Data type '{candidate.DataType}' does not support max length.";
        }
        private bool IsVariableLengthType(string dataType)
        {
            var variableLengthTypes = new[] { "varchar", "nvarchar", "char", "nchar", "text" };
            return variableLengthTypes.Contains(dataType.ToLowerInvariant());
        }
    }
}
