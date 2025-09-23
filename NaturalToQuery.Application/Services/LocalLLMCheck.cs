using Microsoft.Extensions.Configuration;
using NaturalToQuery.Application.Interfaces;

namespace NaturalToQuery.Application.Services
{
    public class LocalLLMCheck: ILocalLLMCheck
    {
        private readonly IConfiguration _configuration;
        private readonly IHttpClientFactory _httpClient;
        public LocalLLMCheck(IHttpClientFactory httpClient, IConfiguration configuration)
        {
            _configuration = configuration;
            _httpClient = httpClient;   
        }
        public async Task<bool> IsLocalLLMOperational(CancellationToken ct)
        {
            try
            {
                var client = _httpClient.CreateClient();
                client.Timeout = TimeSpan.FromSeconds(5);
                var response = await client.GetAsync(GetLocalLLMUrl(), ct);
                return response.IsSuccessStatusCode;
            }
            catch
            {
                return false;
            }
        }
        public string GetLocalLLMUrl()
        {
            return _configuration["Groq:BaseLocalLLMUrl"];
        }
    }
}
