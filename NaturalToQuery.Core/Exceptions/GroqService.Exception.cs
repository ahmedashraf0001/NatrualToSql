using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Text;
using System.Threading.Tasks;

namespace NaturalToQuery.Core.Exceptions
{
    public sealed class LLMServiceException : Exception
    {
        public HttpStatusCode? StatusCode { get; }
        public string? ResponseBody { get; }
        public bool IsTransient { get; }
        public LLMServiceException(string message, bool isTransient = false)
            : base(message)
        {
            IsTransient = isTransient;
        }
        public LLMServiceException(string message, Exception inner, bool isTransient = false)
            : base(message, inner)
        {
            IsTransient = isTransient;
        }
        public LLMServiceException(string message, HttpStatusCode statusCode, string? responseBody = null, bool isTransient = false)
            : base(message)
        {
            StatusCode = statusCode;
            ResponseBody = responseBody;
            IsTransient = isTransient;
        }
    }
}
