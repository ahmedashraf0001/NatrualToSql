using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace NaturalToQuery.Core.Exceptions
{
    public class SqlServerProviderException : Exception
    {
        public string? Server { get; }
        public string? Database { get; }

        public SqlServerProviderException(string message, string? server = null, string? database = null, Exception? innerException = null)
            : base(message, innerException)
        {
            Server = server;
            Database = database;
        }
    }
}
