using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace NaturalToQuery.Core.Exceptions
{
    public class WindowsCredentialStoreException : Exception
    {
        public string? Key { get; }

        public WindowsCredentialStoreException(string message, string? key = null, Exception? innerException = null)
            : base(message, innerException)
        {
            Key = key;
        }
    }

}
