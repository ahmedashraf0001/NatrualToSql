namespace NaturalToQuery.Core.Exceptions
{
    public class RuleViolationException : Exception
    {
        public IReadOnlyCollection<string> Violations { get; }

        public RuleViolationException(IEnumerable<string> violations)
            : base(CreateMessage(violations))
        {
            Violations = violations.ToList().AsReadOnly();
        }

        private static string CreateMessage(IEnumerable<string> violations)
        {
            return "One or more violations occurred: "
                   + string.Join("; ", violations);
        }
    }
}
