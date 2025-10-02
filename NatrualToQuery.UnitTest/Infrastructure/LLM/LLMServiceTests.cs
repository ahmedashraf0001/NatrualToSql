using Microsoft.Extensions.Options;
using Moq.Protected;
using NaturalToQuery.Application.DTOs.Groq;
using NaturalToQuery.Core.Contributers.Entities.UserInfos;
using NaturalToQuery.Core.Exceptions;
using NaturalToQuery.Infrastructure.LLM;
using NaturalToQuery.SharedKernal.DTOs.Domain;
using NaturalToQuery.SharedKernal.DTOs.Groq;
using NaturalToQuery.SharedKernal.DTOs.Providers;
using NaturalToQuery.SharedKernal.Interfaces;
using NatrualToQuery.UnitTest.Common;
using System.Net;
using System.Text.Json;

namespace NatrualToQuery.UnitTest.Infrastructure.LLM
{
    public class LLMServiceTests : TestBase
    {
        private readonly Mock<IAppLogger<LLMService>> _mockLogger;
        private readonly Mock<HttpMessageHandler> _mockHttpHandler;
        private readonly HttpClient _httpClient;
        private readonly LLMOptions _options;
        private readonly UserInfo _user;

        public LLMServiceTests()
        {
            _mockLogger = Common.MockExtensions.SetupLogger<LLMService>();
            _mockHttpHandler = new Mock<HttpMessageHandler>();
            _httpClient = new HttpClient(_mockHttpHandler.Object)
            {
                BaseAddress = new Uri("https://api.groq.com/")
            };

            _options = new LLMOptions
            {
                GroqModel = "llama3-70b-8192",
                LocalModel = "qwen3:8b",
                BaseGroqUrl = "https://api.groq.com/openai/v1/",
                BaseLocalLLMUrl = "http://localhost:11434",
                SystemPrompt = "You are a SQL expert. Convert natural language to SQL queries.",
                FinalUserTemplate = "SCHEMA:{schema}\nQUERY:{userQuery}"
            };

            _user = TestDataBuilder.CreateTestUserInfo();
        }

        private LLMService CreateService(HttpResponseMessage? responseMessage = null)
        {
            if (responseMessage != null)
            {
                _mockHttpHandler.Protected()
                    .Setup<Task<HttpResponseMessage>>(
                        "SendAsync",
                        ItExpr.IsAny<HttpRequestMessage>(),
                        ItExpr.IsAny<CancellationToken>())
                    .ReturnsAsync(responseMessage);
            }

            var options = Options.Create(_options);
            return new LLMService(_user, options, _mockLogger.Object, _httpClient);
        }

        [Fact]
        public void Constructor_WithValidOptions_ShouldInitializeSuccessfully()
        {
            // Arrange & Act
            var service = CreateService();

            // Assert
            service.Should().NotBeNull();
        }

        [Fact]
        public void Constructor_WithNullApiKeyInUser_ShouldThrowException()
        {
            // Arrange
            var userWithNullApiKey = UserInfo.Create("", AIMode.Groq);

            var options = Options.Create(_options);

            // Act & Assert
            var exception = Assert.Throws<LLMServiceException>(
                () => new LLMService(userWithNullApiKey, options, _mockLogger.Object, _httpClient));

            exception.Message.Should().Be("No Groq API key provided");
        }

        [Fact]
        public void Constructor_WithNullSystemPrompt_ShouldThrowException()
        {
            // Arrange
            var invalidOptions = new LLMOptions
            {
                GroqModel = "test-model",
                SystemPrompt = null!,
                FinalUserTemplate = "test"
            };

            var options = Options.Create(invalidOptions);

            // Act & Assert
            var exception = Assert.Throws<LLMServiceException>(
                () => new LLMService(_user, options, _mockLogger.Object, _httpClient));

            exception.Message.Should().Be("No System Prompts Provided");
        }

        [Fact]
        public async Task ConvertToSqlAsync_WithValidResponse_ShouldReturnQueryResult()
        {
            // Arrange
            var schema = JsonSerializer.Serialize(TestDataBuilder.CreateTestDatabaseSchema());
            var userQuery = "Show me all users";
            var mode = ExecutionMode.ReadOnly;

            var expectedResult = TestDataBuilder.CreateTestQueryConversionResult();
            var apiResponse = new LLMApiResponse
            {
                Choices = new[]
                {
                    new Choice
                    {
                        Message = new LLMMessage
                        {
                            Content = JsonSerializer.Serialize(expectedResult)
                        }
                    }
                }
            };

            var responseMessage = new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(JsonSerializer.Serialize(apiResponse), System.Text.Encoding.UTF8, "application/json")
            };

            var service = CreateService(responseMessage);

            // Act
            var result = await service.ConvertToSqlAsync(schema, userQuery, mode);

            // Assert
            result.Should().NotBeNull();
            result.Sql.Should().Be(expectedResult.Sql);
            result.Parameters.Should().HaveCount(expectedResult.Parameters.Count);
            result.Explanation.Should().Be(expectedResult.Explanation);
        }

        [Fact]
        public async Task ConvertToSqlAsync_WithHttpErrorResponse_ShouldThrowException()
        {
            // Arrange
            var schema = JsonSerializer.Serialize(TestDataBuilder.CreateTestDatabaseSchema());
            var userQuery = "Show me all users";
            var mode = ExecutionMode.ReadOnly;

            var responseMessage = new HttpResponseMessage(HttpStatusCode.BadRequest)
            {
                Content = new StringContent("Bad request error")
            };

            var service = CreateService(responseMessage);

            // Act & Assert
            var exception = await Assert.ThrowsAsync<LLMServiceException>(
                () => service.ConvertToSqlAsync(schema, userQuery, mode));

            exception.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            exception.ResponseBody.Should().Contain("Bad request error");
        }

        [Fact]
        public async Task ConvertToSqlAsync_WithInvalidJsonResponse_ShouldThrowException()
        {
            // Arrange
            var schema = JsonSerializer.Serialize(TestDataBuilder.CreateTestDatabaseSchema());
            var userQuery = "Show me all users";
            var mode = ExecutionMode.ReadOnly;

            var responseMessage = new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("invalid json", System.Text.Encoding.UTF8, "application/json")
            };

            var service = CreateService(responseMessage);

            // Act & Assert
            var exception = await Assert.ThrowsAsync<LLMServiceException>(
                () => service.ConvertToSqlAsync(schema, userQuery, mode));

            exception.Message.Should().Be("Failed to deserialize LLM API response");
        }

        [Fact]
        public async Task ConvertToSqlAsync_WithEmptyChoices_ShouldThrowException()
        {
            // Arrange
            var schema = JsonSerializer.Serialize(TestDataBuilder.CreateTestDatabaseSchema());
            var userQuery = "Show me all users";
            var mode = ExecutionMode.ReadOnly;

            var apiResponse = new LLMApiResponse
            {
                Choices = Array.Empty<Choice>()
            };

            var responseMessage = new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(JsonSerializer.Serialize(apiResponse), System.Text.Encoding.UTF8, "application/json")
            };

            var service = CreateService(responseMessage);

            // Act & Assert
            var exception = await Assert.ThrowsAsync<LLMServiceException>(
                () => service.ConvertToSqlAsync(schema, userQuery, mode));

            exception.Message.Should().Be("Received empty or null content from LLM provider");
        }

        [Fact]
        public async Task ConvertToSqlAsync_WithCodeFences_ShouldStripFences()
        {
            // Arrange
            var schema = JsonSerializer.Serialize(TestDataBuilder.CreateTestDatabaseSchema());
            var userQuery = "Show me all users";
            var mode = ExecutionMode.ReadOnly;

            var expectedResult = TestDataBuilder.CreateTestQueryConversionResult();
            var contentWithFences = $"```json\n{JsonSerializer.Serialize(expectedResult)}\n```";

            var apiResponse = new LLMApiResponse
            {
                Choices = new[]
                {
                    new Choice
                    {
                        Message = new LLMMessage
                        {
                            Content = contentWithFences
                        }
                    }
                }
            };

            var responseMessage = new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(JsonSerializer.Serialize(apiResponse), System.Text.Encoding.UTF8, "application/json")
            };

            var service = CreateService(responseMessage);

            // Act
            var result = await service.ConvertToSqlAsync(schema, userQuery, mode);

            // Assert
            result.Should().NotBeNull();
            result.Sql.Should().Be(expectedResult.Sql);
        }

        [Theory]
        [InlineData(ExecutionMode.ReadOnly)]
        [InlineData(ExecutionMode.Write)]
        public async Task ConvertToSqlAsync_WithDifferentExecutionModes_ShouldSucceed(ExecutionMode mode)
        {
            // Arrange
            var schema = JsonSerializer.Serialize(TestDataBuilder.CreateTestDatabaseSchema());
            var userQuery = "Show me all users";

            var expectedResult = TestDataBuilder.CreateTestQueryConversionResult();
            var apiResponse = new LLMApiResponse
            {
                Choices = new[]
                {
                    new Choice
                    {
                        Message = new LLMMessage
                        {
                            Content = JsonSerializer.Serialize(expectedResult)
                        }
                    }
                }
            };

            var responseMessage = new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(JsonSerializer.Serialize(apiResponse), System.Text.Encoding.UTF8, "application/json")
            };

            var service = CreateService(responseMessage);

            // Act
            var result = await service.ConvertToSqlAsync(schema, userQuery, mode);

            // Assert
            result.Should().NotBeNull();
            result.Sql.Should().Be(expectedResult.Sql);
        }
    

        [Fact]
        public async Task ConvertToSqlAsync_WithNullSchema_ShouldThrowArgumentException()
        {
            // Arrange
            var service = CreateService();
            var userQuery = "Show me all users";
            var mode = ExecutionMode.ReadOnly;

            // Act & Assert
            await Assert.ThrowsAsync<ArgumentNullException>(
                () => service.ConvertToSqlAsync(null!, userQuery, mode));
        }

        [Fact]
        public async Task ConvertToSqlAsync_WithNullUserQuery_ShouldThrowArgumentException()
        {
            // Arrange
            var service = CreateService();
            var schema = JsonSerializer.Serialize(TestDataBuilder.CreateTestDatabaseSchema());
            var mode = ExecutionMode.ReadOnly;

            // Act & Assert
            await Assert.ThrowsAsync<ArgumentNullException>(
                () => service.ConvertToSqlAsync(schema, null!, mode));
        }

    }
}