namespace NaturalToQuery.Core.Base
{
    public abstract class EntityBase
    {
        public Guid Id { get; set; }
        protected EntityBase() { }

        private List<DomainEventBase> _domainEvents = new List<DomainEventBase>();
        public IReadOnlyCollection<DomainEventBase> DomainEvents => _domainEvents.AsReadOnly();
        public void AddDomainEvent(DomainEventBase domainEvent) => _domainEvents.Add(domainEvent);
        public void ClearDomainEvents() => _domainEvents.Clear();
        public override bool Equals(object? obj)
        {
            if (obj is not EntityBase entity)
                return false;
            if (ReferenceEquals(this, entity))
                return true;
            return Id.Equals(entity.Id);
        }
        public override int GetHashCode() => Id.GetHashCode();
    }
}
