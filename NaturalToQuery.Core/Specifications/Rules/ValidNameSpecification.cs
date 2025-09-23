using NaturalToQuery.SharedKernal.Interfaces;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Xml.Linq;

namespace NaturalToQuery.Core.Specifications.Rules
{
    internal class ValidNameSpecification : ISpecificationRule<string>
    {
        public IEnumerable<string> GetViolations(string candidate)
        {
            if (string.IsNullOrWhiteSpace(candidate))
                yield return "Name cannot be null or empty.";
            if (candidate.Length > 128)
                yield return "Name cannot exceed 128 characters.";
        }
    }
}
