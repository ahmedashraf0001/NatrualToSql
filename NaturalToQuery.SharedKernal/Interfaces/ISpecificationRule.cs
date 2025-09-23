namespace NaturalToQuery.SharedKernal.Interfaces
{
    public interface ISpecificationRule<T>
    {
        IEnumerable<string> GetViolations(T candidate);
    }
}
