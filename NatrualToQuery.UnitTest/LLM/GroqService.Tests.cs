using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using Moq;
using Moq.Protected;
using NaturalToQuery.Application.DTOs.Groq;
using NaturalToQuery.Core.Contributers.Entities.UserInfos;
using NaturalToQuery.Core.Exceptions;
using NaturalToQuery.Infrastructure.LLM;
using NaturalToQuery.SharedKernal.DTOs.Groq;
using NaturalToQuery.SharedKernal.DTOs.Providers;
using NaturalToQuery.SharedKernal.Interfaces;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Reflection;
using System.Reflection.Metadata.Ecma335;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading.Tasks;

namespace NatrualToQuery.UnitTest.LLM
{
    public class GroqServiceTests
    {
        private readonly Mock<IAppLogger<LLMService>> _loggerMock = new();

        private LLMService CreateService(HttpResponseMessage responseMessage, LLMOptions _options = null)
        {
            var handlerMock = new Mock<HttpMessageHandler>(MockBehavior.Strict);
            var user = new Mock<UserInfo>();
            handlerMock.Protected()
                .Setup<Task<HttpResponseMessage>>(
                    "SendAsync",
                    ItExpr.IsAny<HttpRequestMessage>(),
                    ItExpr.IsAny<CancellationToken>())
                .ReturnsAsync(responseMessage);

            LLMOptions _opts = _options ?? new()
            {
                Model = "llama3-70b-8192",
                SystemPrompt = "test",
                FinalUserTemplate = "SCHEMA:{schema}\nQUERY:{userQuery}"
            };

            var httpClient = new HttpClient(handlerMock.Object)
            {
                BaseAddress = new Uri(_opts.BaseGroqUrl!)
            };

            var opts = Options.Create(_opts);
            return new LLMService(user.Object, opts, _loggerMock.Object, httpClient);
        }
        [Fact]
        public void GroqService_ThrowsGroqServiceException_OnNullApi()
        {
            //arrange
            var apiResponse = "test";
            var response = new HttpResponseMessage
            {
                Content = new StringContent(JsonSerializer.Serialize(apiResponse), Encoding.UTF8, "application/json")
            };
            LLMOptions options = new LLMOptions();
            //act
            //assert
            var ex = Assert.Throws<LLMServiceException>(() => CreateService(response, options));

            Assert.Equal("No Groq API key provided", ex.Message);
        }
        [Fact]
        public void GroqService_ThrowsGroqServiceException_OnNullSystemPrompt()
        {
            //arrange
            var apiResponse = "test";
            var response = new HttpResponseMessage
            {
                Content = new StringContent(JsonSerializer.Serialize(apiResponse), Encoding.UTF8, "application/json")
            };
            LLMOptions options = new LLMOptions();
            //act
            //assert
            var ex = Assert.Throws<LLMServiceException>(() => CreateService(response, options));

            Assert.Equal("No System Prompts Provided", ex.Message);
        }
        [Fact]
        public async Task GroqService_ReturnResult_OnValidResponse()
        {
            //arrange
            var apiResponse = new LLMApiResponse
            {
                Choices = new[]
                {
                    new Choice
                    {
                        Message = new LLMMessage
                        {
                            Content = JsonSerializer.Serialize(new QueryConversionResult { Sql = "SELECT 1" })
                        }
                    }
                }
            };

            var response = new HttpResponseMessage
            {
                Content = new StringContent(JsonSerializer.Serialize(apiResponse), Encoding.UTF8, "application/json")
            };
            var service = CreateService(response);

            //act

            var result = await service.ConvertToSqlAsync("{}", "test query", ExecutionMode.ReadOnly);

            //assert
            Assert.Equal("SELECT 1", result.Sql);
        }
        [Fact]
        public async Task GroqService_ThrowsGroqServiceException_InvalidJson()
        {
            //arrange
            var apiResponse = "test";
            var response = new HttpResponseMessage
            {
                Content = new StringContent(JsonSerializer.Serialize(apiResponse), Encoding.UTF8, "application/json")
            };
            var service = CreateService(response);
            //act
            //assert
            var ex = await Assert.ThrowsAsync<LLMServiceException>(() =>
                service.ConvertToSqlAsync("{}", "query", ExecutionMode.ReadOnly));

            Assert.Equal("Failed to deserialize Groq API response", ex.Message);
        }
        [Fact]
        public async Task GroqService_ThrowsGroqServiceException_NoResponse()
        {
            //arrange
            string apiResponse = "";
            var response = new HttpResponseMessage
            {
                Content = new StringContent(JsonSerializer.Serialize(apiResponse), Encoding.UTF8, "application/json")
            };
            var service = CreateService(response);
            //act
            //assert
            var ex = await Assert.ThrowsAsync<LLMServiceException>(() =>
                service.ConvertToSqlAsync("{}", "query", ExecutionMode.ReadOnly));

            Assert.Equal("Failed to deserialize Groq API response", ex.Message);
        }
        [Fact]
        public async Task GroqService_ThrowsGroqServiceException_NonSuccessfulResponse()
        {
            //arrange
            var response = new HttpResponseMessage()
            {
                StatusCode = HttpStatusCode.BadRequest,
                Content = new StringContent("bad request")
            };
            var service = CreateService(response);
            //act
            //assert
            var ex = await Assert.ThrowsAsync<LLMServiceException>(() => service.ConvertToSqlAsync("{}", "bad  query", ExecutionMode.ReadOnly));

            Assert.Equal(HttpStatusCode.BadRequest, ex.StatusCode);
            Assert.Contains("bad request", ex.ResponseBody);
        }
        [Fact]
        public void GroqService_StripCodeFences_RemovesTripleBackticks()
        {
            var method = typeof(LLMService)
                .GetMethod("StripCodeFences", BindingFlags.NonPublic | BindingFlags.Static);

            var input = "```json\n{\"SqlQuery\":\"SELECT 1\"}\n```";
            var result = (string)method!.Invoke(null, new object[] { input })!;

            Assert.DoesNotContain("```", result);
            Assert.Contains("SELECT 1", result);
        }
        [Fact]
        public void GroqService_StripCodeFences_ReturnsUnchanged_WhenNoFences()
        {
            var method = typeof(LLMService)
                .GetMethod("StripCodeFences", BindingFlags.NonPublic | BindingFlags.Static);

            var input = "{\"SqlQuery\":\"SELECT 2\"}";
            var result = (string)method!.Invoke(null, new object[] { input })!;

            Assert.Equal(input, result);
        }
        [Fact]
        public async Task GroqService_ThrowsGroqServiceException_OnEmptyChoices()
        {
            var apiResponse = new LLMApiResponse { Choices = Array.Empty<Choice>() };
            var response = new HttpResponseMessage
            {
                Content = new StringContent(JsonSerializer.Serialize(apiResponse), Encoding.UTF8, "application/json")
            };
            var service = CreateService(response);

            var ex = await Assert.ThrowsAsync<LLMServiceException>(() =>
                service.ConvertToSqlAsync("{}", "query", ExecutionMode.ReadOnly));

            Assert.Equal("Groq API response contained no choices", ex.Message);
        }

    }
}
