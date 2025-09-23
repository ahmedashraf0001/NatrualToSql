using Microsoft.Extensions.Configuration;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http.Headers;
using System.Text;
using System.Threading.Tasks;

namespace NaturalToQuery.Infrastructure.LLM
{
    public static class LLMServiceHelper
    {
        public static async Task<bool> TestApiKey(string testUrl, string apiKey, CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(apiKey) || string.IsNullOrWhiteSpace(testUrl))
            {
                return false;
            }

            using var httpClient = new HttpClient();
            httpClient.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", apiKey);

            var response = await httpClient.GetAsync(testUrl, ct);
            return response.IsSuccessStatusCode;
        }
    }

}
