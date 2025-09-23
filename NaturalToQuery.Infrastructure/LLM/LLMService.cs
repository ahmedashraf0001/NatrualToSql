using Microsoft.Extensions.Options;
using NaturalToQuery.Application.DTOs.Groq;
using NaturalToQuery.SharedKernal.DTOs.Groq;
using NaturalToQuery.SharedKernal.DTOs.Providers;
using NaturalToQuery.SharedKernal.Interfaces;
using System.Net.Http.Headers;
using System.Net;
using System.Text;
using System.Text.Json;
using NaturalToQuery.Core.Exceptions;
using NaturalToQuery.SharedKernal.DTOs.Domain;
using NaturalToQuery.Core.Contributers.Entities.UserInfos;

namespace NaturalToQuery.Infrastructure.LLM
{
    public class LLMService : ILLMService, IDisposable
    {
        private readonly HttpClient _httpClient;
        private readonly LLMOptions _opts;
        private readonly IAppLogger<LLMService> _logger;
        private readonly JsonSerializerOptions _jsonOptions;

        private readonly UserInfo _user;
        public LLMService(UserInfo user, IOptions<LLMOptions> opts, IAppLogger<LLMService> logger, HttpClient httpClient = null)
        {
            ArgumentNullException.ThrowIfNull(logger);
            ArgumentNullException.ThrowIfNull(opts?.Value);
            ArgumentNullException.ThrowIfNull(user);

            _logger = logger;
            _opts = opts.Value;
            _user = user;

            if (string.IsNullOrWhiteSpace(_opts.SystemPrompt))
            {
                _logger.LogWarning("No System Prompts Provided");
                throw new LLMServiceException("No System Prompts Provided", isTransient: false);
            }

            _jsonOptions = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };

            string baseurl;
            if(_user.Mode == AIMode.Groq)
            {
                baseurl = _opts.BaseGroqUrl ?? "https://api.groq.com";
            }
            else
            {
                baseurl = _opts.BaseLocalLLMUrl ?? "http://localhost:11434";
            }
            _httpClient = httpClient ?? new HttpClient
            {
                BaseAddress = new Uri(baseurl ?? throw new LLMServiceException("No Base URL Provided for LLM Service", isTransient: false))
            };

            ConfigureProvider(user);
        }

        public async Task<QueryConversionResult> ConvertToSqlAsync(string schema, string userQuery, ExecutionMode mode, CancellationToken ct = default)
        {
            if (_user.Mode == AIMode.Basic)
                throw new ArgumentException("Convertion is not allowed in basic mode, you can only execute queries");
            ArgumentException.ThrowIfNullOrWhiteSpace(schema);
            ArgumentException.ThrowIfNullOrWhiteSpace(userQuery);

            _logger.LogInformation("Converting natural language to SQL. User query: {Query}", userQuery);
            var writeOperation = mode switch { ExecutionMode.ReadOnly => false, ExecutionMode.Write => true, _ => false };
            var messages = GeneratePrompt(schema, userQuery, writeOperation);
            _logger.LogDebug("Generated prompt with {MessageCount} messages", messages.Length);

            var apiResponse = await CallLlmApiAsync(messages, ct);
            var content = ExtractContentFromResponse(apiResponse);

            return DeserializeQueryResult(content);
        }

        #region helpers
            private void ConfigureProvider(UserInfo user)
            {
                switch (user.Mode)
                {
                    case AIMode.Groq:
                        ConfigureGroq(user);
                        break;
                    case AIMode.Local:
                        _logger.LogInformation("Local LLM is configured");
                        break;
                    default:
                        _logger.LogInformation("No provider-specific configuration needed");
                        break;
                }
            }

            private void ConfigureGroq(UserInfo user)
            {
                if (string.IsNullOrWhiteSpace(user.ApiKey))
                {
                    _logger.LogWarning("No Groq API key provided");
                    throw new LLMServiceException("No Groq API key provided", isTransient: false);
                }

                _httpClient.DefaultRequestHeaders.Authorization =
                    new AuthenticationHeaderValue("Bearer", user.ApiKey);
                _logger.LogInformation("Groq API key configured for HttpClient");
            }

            private async Task<LLMApiResponse> CallLlmApiAsync(PromptMessage[] messages, CancellationToken ct)
                {
                    var requestBody = new
                    {
                        model = _user.Mode == AIMode.Groq ? _opts.GroqModel : _opts.LocalModel,
                        messages = messages,
                        temperature = 0.0,
                        max_tokens = 8192,
                        stream = false
                    };

                    var requestJson = JsonSerializer.Serialize(requestBody, _jsonOptions);
                    _logger.LogDebug("Request payload prepared for LLM API");

                    using var request = new StringContent(requestJson, Encoding.UTF8, "application/json");

                    try
                    {
                        HttpResponseMessage response;
                        if (_user.Mode == AIMode.Groq) 
                        {
                            response = await _httpClient.PostAsync("/openai/v1/chat/completions", request, ct);
                        }
                        else
                        {
                            response = await _httpClient.PostAsync("/api/chat", request, ct);
                        }
                        _logger.LogInformation("LLM API responded with status: {StatusCode}", response.StatusCode);

                        var responseBody = await response.Content.ReadAsStringAsync(ct);

                        if (!response.IsSuccessStatusCode)
                        {
                            _logger.LogError("LLM API error: {StatusCode} - {ResponseBody}", response.StatusCode, responseBody);

                            var isTransient = IsTransientError(response.StatusCode);
                            throw new LLMServiceException(
                                $"LLM API request failed with status {response.StatusCode}",
                                response.StatusCode,
                                responseBody,
                                isTransient);
                        }

                        var result = JsonSerializer.Deserialize<LLMApiResponse>(responseBody, _jsonOptions)
                               ?? throw new LLMServiceException("Failed to deserialize LLM API response - received null result");
                        return result;
                    }
                    catch (HttpRequestException ex)
                    {
                        _logger.LogError("Network error while calling LLM API: {Message}", ex.Message);
                        throw new LLMServiceException("Network error occurred while communicating with LLM API", ex, isTransient: true);
                    }
                    catch (TaskCanceledException ex) when (ex.InnerException is TimeoutException)
                    {
                        _logger.LogError("LLM API request timed out: {Message}", ex.Message);
                        throw new LLMServiceException("LLM API request timed out", ex, isTransient: true);
                    }
                    catch (TaskCanceledException ex) when (ct.IsCancellationRequested)
                    {
                        _logger.LogInformation("LLM API request was cancelled");
                        throw new OperationCanceledException("GLLMroq API request was cancelled", ex, ct);
                    }
                    catch(JsonException ex)
                    {
                        _logger.LogInformation("Failed to deserialize LLM API response");
                        throw new LLMServiceException("Failed to deserialize LLM API response", ex);
                    }
                    catch (LLMServiceException)
                    {
                    throw;
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError("Unexpected error while calling LLM API: {Message}", ex.Message);
                        throw new LLMServiceException("An unexpected error occurred while calling LLM API", ex);
                    }
                }

            private string ExtractContentFromResponse(LLMApiResponse apiResponse)
            {
                if (apiResponse == null)
                    throw new LLMServiceException("LLM response was null");

                var content = apiResponse.Choices?.FirstOrDefault()?.Message?.Content;
                if (!string.IsNullOrWhiteSpace(content))
                    return StripCodeFences(content).Trim();

                content = apiResponse.Choices?.FirstOrDefault()?.Text;
                if (!string.IsNullOrWhiteSpace(content))
                    return StripCodeFences(content).Trim();

                content = apiResponse.Message?.Content;
                if (!string.IsNullOrWhiteSpace(content))
                    return TryNormalizeMessageContent(content);

                content = apiResponse.Response ?? apiResponse.Text;
                if (!string.IsNullOrWhiteSpace(content))
                    return TryNormalizeMessageContent(content);

                throw new LLMServiceException("Received empty or null content from LLM provider");
            }

            private string TryNormalizeMessageContent(string raw)
            {
                raw = StripCodeFences(raw).Trim();

                try
                {
                    JsonSerializer.Deserialize<QueryConversionResult>(raw, _jsonOptions);
                    return raw;
                }
                catch (JsonException) {}

                if (TryExtractJsonObjectMatchingSchema(raw, out var matched))
                    return matched.Trim();

                return raw;
            }

            private bool TryExtractJsonObjectMatchingSchema(string text, out string json)
            {
                json = null;
                if (string.IsNullOrEmpty(text)) return false;

                for (int i = 0; i < text.Length; i++)
                {
                    if (text[i] != '{') continue;

                    int depth = 0;
                    for (int j = i; j < text.Length; j++)
                    {
                        if (text[j] == '{') depth++;
                        else if (text[j] == '}') depth--;

                        if (depth == 0)
                        {
                            var candidate = text.Substring(i, j - i + 1);
                            try
                            {
                                using var doc = JsonDocument.Parse(candidate);
                                var root = doc.RootElement;
                                if (root.ValueKind != JsonValueKind.Object) break;

                                // Check presence of required top-level keys
                                bool hasAll =
                                    root.TryGetProperty("sql", out _) &&
                                    root.TryGetProperty("intent", out _) &&
                                    root.TryGetProperty("intent_components", out _) &&
                                    root.TryGetProperty("tables", out _) &&
                                    root.TryGetProperty("columns", out _) &&
                                    root.TryGetProperty("parameters", out _) &&
                                    root.TryGetProperty("confidence", out _) &&
                                    root.TryGetProperty("safe", out _) &&
                                    root.TryGetProperty("issues", out _) &&
                                    root.TryGetProperty("explanation", out _);

                                if (hasAll)
                                {
                                    // validate it deserializes into your DTO as an extra check
                                    try
                                    {
                                        JsonSerializer.Deserialize<QueryConversionResult>(candidate, _jsonOptions);
                                        json = candidate;
                                        return true;
                                    }
                                    catch (JsonException) { /* not valid JSON for schema -> continue */ }
                                }
                            }
                            catch (JsonException)
                            {
                                // candidate not valid JSON, continue scanning
                            }

                            // move i forward past this object and continue
                            i = j;
                            break;
                        }
                    }
                }

                return false;
            }

            private QueryConversionResult DeserializeQueryResult(string content)
                {
                    try
                    {
                        var result = JsonSerializer.Deserialize<QueryConversionResult>(content, _jsonOptions)
                                     ?? throw new LLMServiceException("Query result deserialization returned null");

                        _logger.LogInformation("Successfully converted natural language to SQL query");
                        return result;
                    }
                    catch (JsonException ex)
                    {
                        _logger.LogError("Failed to deserialize query result. Content: {Content}", content);
                        throw new LLMServiceException("Failed to parse Groq API response as valid JSON - the model may have returned malformed output", ex);
                    }
                }

            private PromptMessage[] GeneratePrompt(string schemaJson, string userQuery, bool allowWriteOperations)
            {
                if(string.IsNullOrWhiteSpace(schemaJson))
                {
                    _logger.LogWarning("No Schema provided");
                    throw new LLMServiceException("No Schema provided", isTransient: true);
                }
                if (string.IsNullOrWhiteSpace(userQuery))
                {
                    _logger.LogWarning("No user query provided");
                    throw new LLMServiceException("No user query provided", isTransient: true);
                }
                var messages = new List<PromptMessage>();

                // Add system prompt
                if (!string.IsNullOrWhiteSpace(_opts.SystemPrompt))
                {
                    messages.Add(new PromptMessage("system", _opts.SystemPrompt));
                }

                // Add examples
                foreach (var example in _opts.Examples ?? Enumerable.Empty<PromptExample>())
                {
                    if (!string.IsNullOrWhiteSpace(example.User))
                        messages.Add(new PromptMessage("user", example.User));
                    if (!string.IsNullOrWhiteSpace(example.Assistant))
                        messages.Add(new PromptMessage("assistant", example.Assistant));
                }

                // Add final user message with schema and query
                var allowText = allowWriteOperations ? "true" : "false";
                var template = _opts.FinalUserTemplate ?? "SCHEMA:\\n{schema}\\n\\nUSER_QUERY:\\n{userQuery}";
                var finalUserMessage = template
                    .Replace("{schema}", schemaJson)
                    .Replace("{allow}", allowText)
                    .Replace("{userQuery}", userQuery);

                messages.Add(new PromptMessage("user", finalUserMessage));

                _logger.LogDebug("Generated prompt with system message, {ExampleCount} examples, and user query",
                    _opts.Examples?.Count() ?? 0);

                return messages.ToArray();
            }

            private static string StripCodeFences(string content)
            {
                if (!content.StartsWith("```"))
                    return content;

                var firstNewline = content.IndexOf('\n');
                if (firstNewline >= 0)
                    content = content[(firstNewline + 1)..];

                if (content.EndsWith("```"))
                    content = content[..^3];

                return content;
            }

            private static bool IsTransientError(HttpStatusCode statusCode)
            {
                return statusCode switch
                {
                    HttpStatusCode.RequestTimeout => true,
                    HttpStatusCode.TooManyRequests => true,
                    HttpStatusCode.InternalServerError => true,
                    HttpStatusCode.BadGateway => true,
                    HttpStatusCode.ServiceUnavailable => true,
                    HttpStatusCode.GatewayTimeout => true,
                    _ => false
                };
            }

        #endregion

        public void Dispose()
        {
            _httpClient?.Dispose();
            GC.SuppressFinalize(this);
        }
    }
}