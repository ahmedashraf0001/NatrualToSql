using NaturalToQuery.Core.Exceptions;
using NaturalToQuery.Infrastructure.LLM;
using NaturalToQuery.Infrastructure.Providers;
using NaturalToQuery.Infrastructure.Secrets;
using System.Text.Json;

namespace NaturalToQuery.Api.Middlewares
{
    public class ExceptionMiddlewareHelper
    {
        public static readonly Dictionary<Type, Func<Exception, ErrorMessageDTO>> ExceptionHandlers =
        new()
        {
            [typeof(RuleViolationException)] = ex =>
            {
                var violation = (RuleViolationException)ex;
                return new ErrorMessageDTO
                {
                    Errors = violation.Violations,
                    StatusCode = StatusCodes.Status400BadRequest,
                    Source = "Invalid Operation"
                };
            },
            [typeof(DbExecutionException)] = ex =>
            {
                var violation = (DbExecutionException)ex;
                return new ErrorMessageDTO
                {
                    Errors = violation.Error,
                    StatusCode = StatusCodes.Status500InternalServerError,
                    Source = "Invalid Query"
                };
            },
            [typeof(WindowsCredentialStoreException)] = ex =>
            {
                var credEx = (WindowsCredentialStoreException)ex;
                return new ErrorMessageDTO
                {
                    Errors = new[] { ex.Message }.Where(m => m != null)!,
                    StatusCode = StatusCodes.Status500InternalServerError,
                    Source = $"Credential Store"
                };
            },
            [typeof(SqlServerProviderException)] = ex =>
            {
                var sqlEx = (SqlServerProviderException)ex;
                return new ErrorMessageDTO
                {
                    Errors = new[] { ex.Message, ex.InnerException?.Message }.Where(m => m != null)!,
                    StatusCode = StatusCodes.Status500InternalServerError,
                    Source = $"Sql Server Provider (Server={sqlEx.Server ?? "Unknown"}, Database={sqlEx.Database ?? "Unknown"})"
                };
            },
            [typeof(LLMServiceException)] = ex =>
            {
                var groq = (LLMServiceException)ex;

                var errors = new[] { groq.Message, ParseGroqApiError(groq.ResponseBody), groq.InnerException?.Message }
                             .Where(m => !string.IsNullOrWhiteSpace(m))!;

                var statusCode = groq.StatusCode.HasValue
                    ? (int)groq.StatusCode.Value
                    : (groq.IsTransient ? StatusCodes.Status503ServiceUnavailable : StatusCodes.Status500InternalServerError);

                return new ErrorMessageDTO
                {
                    Errors = errors,
                    StatusCode = statusCode,
                    Source = $"Groq Service{(groq.IsTransient ? " (transient)" : string.Empty)}"
                };
            },
            [typeof(NotImplementedException)] = ex =>
            {
                var error = (NotImplementedException)ex;
                return new ErrorMessageDTO
                {
                    Errors = new[] {error.Message}.Where(m => !string.IsNullOrWhiteSpace(m)),
                    StatusCode = StatusCodes.Status501NotImplemented,
                    Source = "Db Provider Factory"
                };
            }
        };
        private static string? ParseGroqApiError(string responseBody)
        {
            try
            {
                using var doc = JsonDocument.Parse(responseBody);
                if (doc.RootElement.TryGetProperty("error", out var errorElement))
                {
                    var message = errorElement.TryGetProperty("message", out var msgElement)
                        ? msgElement.GetString()
                        : null;
                    var code = errorElement.TryGetProperty("code", out var codeElement)
                        ? codeElement.GetString()
                        : null;

                    return code != null ? $"{message} (Code: {code})" : message;
                }
            }
            catch (JsonException)
            {
                // If we can't parse it, just return the first 200 characters
                return responseBody.Length > 200
                    ? responseBody[..200] + "..."
                    : responseBody;
            }

            return null;
        }

    }
}
