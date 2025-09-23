using MediatR;

namespace NaturalToQuery.Core.Base
{
    public record DomainEventBase : INotification
    {
        public DateTime DateOccurred { get; protected set; } = DateTime.UtcNow;
    }
}
