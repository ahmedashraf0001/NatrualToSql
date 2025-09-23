
using NaturalToQuery.SharedKernal.Interfaces;

namespace NaturalToQuery.Core.Specifications.Rules
{
    internal class ValidateServerTypeSpec : ISpecificationRule<string>
    {
        private static readonly string[] Allowed = { "sqlserver" };

        public IEnumerable<string> GetViolations(string candidate)
        {
            if (string.IsNullOrWhiteSpace(candidate))
            {
                yield return "Edition cannot be null or empty.";
                yield break;
            }

            if (!IsValidEdition(candidate))
                yield return $"Invalid server type '{candidate}'. Allowed values: {string.Join(", ", Allowed)}.";
        }

        private bool IsValidEdition(string edition) =>
            Allowed.Contains(edition.ToLowerInvariant());
    }

}
