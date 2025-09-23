using NaturalToQuery.SharedKernal.DTOs.Providers;

namespace NaturalToQuery.Core.Exceptions
{
    [Serializable]
    public class DbExecutionException : Exception
    {
        public ExecutionResult Error { get; }

        public DbExecutionException(string message, ExecutionResult error)
            : base(message)
        {
            Error = error;
        }

        public DbExecutionException(string message, Exception innerException, ExecutionResult error)
            : base(message, innerException)
        {
            Error = error;
        }
    }

}