using Ardalis.GuardClauses;

namespace NaturalToQuery.Core.Contributers.Entities
{
    public class ProfileSettings
    {
        public int DefaultRowLimit { get; set; } = 1000;
        public bool AllowWriteByDefault { get; set; } = false;
        public void Update(int defaultRowLimit, bool allowWriteByDefault)
        {
            Guard.Against.NegativeOrZero(defaultRowLimit, nameof(defaultRowLimit));
            DefaultRowLimit = defaultRowLimit;
            AllowWriteByDefault = allowWriteByDefault;
        }
    }

}
