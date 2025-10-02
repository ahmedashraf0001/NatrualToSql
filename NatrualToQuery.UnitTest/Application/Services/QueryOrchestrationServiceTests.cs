using NaturalToQuery.Application.Interfaces;
using NaturalToQuery.Application.Services;
using NaturalToQuery.Core.Contributers.Entities.UserInfos;
using NaturalToQuery.Core.Interfaces;
using NaturalToQuery.Infrastructure.Interfaces;
using NaturalToQuery.Infrastructure.LLM;
using NaturalToQuery.SharedKernal.DTOs.Groq;
using NaturalToQuery.SharedKernal.DTOs.Providers;
using NaturalToQuery.SharedKernal.Interfaces;
using NatrualToQuery.UnitTest.Common;

namespace NatrualToQuery.UnitTest.Application.Services
{
    public class QueryOrchestrationServiceTests : TestBase
    {
        private readonly Mock<IUserInfoRepository> _mockUserInfoRepository;
        private readonly Mock<IProfileDbService> _mockProfileDbService;
        private readonly Mock<IAppLogger<QueryOrchestrationService>> _mockLogger;
        private readonly Mock<ILLMServiceFactory> _mockLlmFactory;
        private readonly Mock<ILLMService> _mockLlmService;
        private readonly QueryOrchestrationService _orchestrationService;

        public QueryOrchestrationServiceTests()
        {
            _mockUserInfoRepository = new Mock<IUserInfoRepository>();
            _mockProfileDbService = new Mock<IProfileDbService>();
            _mockLogger = Common.MockExtensions.SetupLogger<QueryOrchestrationService>();
            _mockLlmFactory = new Mock<ILLMServiceFactory>();
            _mockLlmService = new Mock<ILLMService>();

            _mockLlmFactory.Setup(x => x.Create(It.IsAny<UserInfo>()))
                .Returns(_mockLlmService.Object);

            _orchestrationService = new QueryOrchestrationService(
                _mockLlmFactory.Object,
                _mockUserInfoRepository.Object,
                _mockProfileDbService.Object,
                _mockLogger.Object
            );
        }

        [Fact]
        public async Task ConvertNaturalLanguageAsync_WithValidParameters_ShouldReturnQueryConversionResult()
        {
            // Arrange
            var userId = Guid.NewGuid();
            var profileId = Guid.NewGuid();
            var naturalLanguage = "Show me all users";
            var mode = ExecutionMode.ReadOnly;

            var user = TestDataBuilder.CreateTestUserInfo();
            var schema = TestDataBuilder.CreateTestDatabaseSchema();
            var expectedResult = TestDataBuilder.CreateTestQueryConversionResult();

            _mockUserInfoRepository.Setup(x => x.GetByIdAsync(userId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(user);

            // Cast to nullable type to match method signature
            SchemaModel? nullableSchema = schema;
            _mockProfileDbService.Setup(x => x.GetSchemaAsync(profileId, It.IsAny<bool>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(nullableSchema);

            _mockLlmService.Setup(x => x.ConvertToSqlAsync(It.IsAny<string>(), naturalLanguage, mode, It.IsAny<CancellationToken>()))
                .ReturnsAsync(expectedResult);

            // Act
            var result = await _orchestrationService.ConvertNaturalLanguageAsync(userId, profileId, naturalLanguage, mode);

            // Assert
            result.Should().Be(expectedResult);

            _mockUserInfoRepository.Verify(x => x.GetByIdAsync(userId, It.IsAny<CancellationToken>()), Times.Once);
            _mockProfileDbService.Verify(x => x.GetSchemaAsync(profileId, It.IsAny<bool>(), It.IsAny<CancellationToken>()), Times.Once);
            _mockLlmService.Verify(x => x.ConvertToSqlAsync(It.IsAny<string>(), naturalLanguage, mode, It.IsAny<CancellationToken>()), Times.Once);

            _mockLogger.VerifyLoggerCalled("Converting NL to SQL for profile");
        }

        [Fact]
        public async Task ConvertNaturalLanguageAsync_WithEmptyProfileId_ShouldThrowArgumentException()
        {
            // Arrange
            var userId = Guid.NewGuid();
            var profileId = Guid.Empty;
            var naturalLanguage = "Show me all users";
            var mode = ExecutionMode.ReadOnly;

            // Act & Assert
            var exception = await Assert.ThrowsAsync<ArgumentException>(
                () => _orchestrationService.ConvertNaturalLanguageAsync(userId, profileId, naturalLanguage, mode));

            exception.Message.Should().Be("Profile Id cannot be empty. (Parameter 'profileId')");

            _mockUserInfoRepository.Verify(x => x.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
            _mockProfileDbService.Verify(x => x.GetSchemaAsync(It.IsAny<Guid>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task ConvertNaturalLanguageAsync_WithEmptyUserId_ShouldThrowArgumentException()
        {
            // Arrange
            var userId = Guid.Empty;
            var profileId = Guid.NewGuid();
            var naturalLanguage = "Show me all users";
            var mode = ExecutionMode.ReadOnly;

            // Act & Assert
            var exception = await Assert.ThrowsAsync<ArgumentException>(
                () => _orchestrationService.ConvertNaturalLanguageAsync(userId, profileId, naturalLanguage, mode));

            exception.Message.Should().Be("User Id cannot be empty. (Parameter 'UserId')");

            _mockUserInfoRepository.Verify(x => x.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
            _mockProfileDbService.Verify(x => x.GetSchemaAsync(It.IsAny<Guid>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task ConvertNaturalLanguageAsync_WithNonExistentUser_ShouldThrowInvalidOperationException()
        {
            // Arrange
            var userId = Guid.NewGuid();
            var profileId = Guid.NewGuid();
            var naturalLanguage = "Show me all users";
            var mode = ExecutionMode.ReadOnly;

            _mockUserInfoRepository.Setup(x => x.GetByIdAsync(userId, It.IsAny<CancellationToken>()))
                .ReturnsAsync((UserInfo?)null);

            // Act & Assert
            var exception = await Assert.ThrowsAsync<InvalidOperationException>(
                () => _orchestrationService.ConvertNaturalLanguageAsync(userId, profileId, naturalLanguage, mode));

            exception.Message.Should().Be($"User with ID {userId} was not found.");

            _mockUserInfoRepository.Verify(x => x.GetByIdAsync(userId, It.IsAny<CancellationToken>()), Times.Once);
            _mockProfileDbService.Verify(x => x.GetSchemaAsync(It.IsAny<Guid>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()), Times.Never);

            _mockLogger.VerifyLoggerErrorCalled("No user found for UserId");
        }

        [Fact]
        public async Task ConvertNaturalLanguageAsync_WithNullSchema_ShouldThrowInvalidOperationException()
        {
            // Arrange
            var userId = Guid.NewGuid();
            var profileId = Guid.NewGuid();
            var naturalLanguage = "Show me all users";
            var mode = ExecutionMode.ReadOnly;

            var user = TestDataBuilder.CreateTestUserInfo();

            _mockUserInfoRepository.Setup(x => x.GetByIdAsync(userId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(user);

#pragma warning disable CS8620 // Argument of type cannot be used for parameter due to differences in the nullability of reference types
            _mockProfileDbService.Setup(x => x.GetSchemaAsync(profileId, It.IsAny<bool>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync((SchemaModel?)null);
#pragma warning restore CS8620

            // Act & Assert
            var exception = await Assert.ThrowsAsync<InvalidOperationException>(
                () => _orchestrationService.ConvertNaturalLanguageAsync(userId, profileId, naturalLanguage, mode));

            exception.Message.Should().Be($"Schema for profile {profileId} was not found.");

            _mockUserInfoRepository.Verify(x => x.GetByIdAsync(userId, It.IsAny<CancellationToken>()), Times.Once);
            _mockProfileDbService.Verify(x => x.GetSchemaAsync(profileId, It.IsAny<bool>(), It.IsAny<CancellationToken>()), Times.Once);
            _mockLlmService.Verify(x => x.ConvertToSqlAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<ExecutionMode>(), It.IsAny<CancellationToken>()), Times.Never);

            _mockLogger.VerifyLoggerErrorCalled("No schema returned for profile");
        }

        [Fact]
        public async Task ExecuteQueryAsync_WithValidParameters_ShouldReturnExecutionResult()
        {
            // Arrange
            var profileId = Guid.NewGuid();
            var sql = "SELECT * FROM Users";
            var userQuery = "Show me all users";
            var parameters = new Dictionary<string, string?> { { "Id", "1" } };
            var mode = ExecutionMode.ReadOnly;

            var expectedResult = TestDataBuilder.CreateTestExecutionResult();

            _mockProfileDbService.Setup(x => x.ExecuteAsync(profileId, sql, userQuery, parameters, mode, It.IsAny<CancellationToken>()))
                .ReturnsAsync(expectedResult);

            // Act
            var result = await _orchestrationService.ExecuteQueryAsync(profileId, sql, userQuery, parameters, mode);

            // Assert
            result.Should().Be(expectedResult);

            _mockProfileDbService.Verify(x => x.ExecuteAsync(profileId, sql, userQuery, parameters, mode, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task ExecuteQueryAsync_WithEmptyProfileId_ShouldThrowArgumentException()
        {
            // Arrange
            var profileId = Guid.Empty;
            var sql = "SELECT * FROM Users";
            var userQuery = "Show me all users";

            // Act & Assert
            var exception = await Assert.ThrowsAsync<ArgumentException>(
                () => _orchestrationService.ExecuteQueryAsync(profileId, sql, userQuery));

            exception.Message.Should().Be("Profile Id cannot be empty. (Parameter 'profileId')");

            _mockProfileDbService.Verify(x => x.ExecuteAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<IDictionary<string, string?>>(), It.IsAny<ExecutionMode>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task ExecuteQueryAsync_WithNullOrEmptySql_ShouldThrowArgumentException()
        {
            // Arrange
            var profileId = Guid.NewGuid();
            var userQuery = "Show me all users";

            // Act & Assert for null SQL
            var nullException = await Assert.ThrowsAsync<ArgumentException>(
                () => _orchestrationService.ExecuteQueryAsync(profileId, null!, userQuery));
            nullException.Message.Should().Be("SQL query cannot be null or empty. (Parameter 'sql')");

            // Act & Assert for empty SQL
            var emptyException = await Assert.ThrowsAsync<ArgumentException>(
                () => _orchestrationService.ExecuteQueryAsync(profileId, "", userQuery));
            emptyException.Message.Should().Be("SQL query cannot be null or empty. (Parameter 'sql')");

            // Act & Assert for whitespace SQL
            var whitespaceException = await Assert.ThrowsAsync<ArgumentException>(
                () => _orchestrationService.ExecuteQueryAsync(profileId, "   ", userQuery));
            whitespaceException.Message.Should().Be("SQL query cannot be null or empty. (Parameter 'sql')");

            _mockProfileDbService.Verify(x => x.ExecuteAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<IDictionary<string, string?>>(), It.IsAny<ExecutionMode>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task ExecuteQueryAsync_WithNullOrEmptyUserQuery_ShouldThrowArgumentException()
        {
            // Arrange
            var profileId = Guid.NewGuid();
            var sql = "SELECT * FROM Users";

            // Act & Assert for null user query
            var nullException = await Assert.ThrowsAsync<ArgumentException>(
                () => _orchestrationService.ExecuteQueryAsync(profileId, sql, null!));
            nullException.Message.Should().Be("User query cannot be null or empty. (Parameter 'userQuery')");

            // Act & Assert for empty user query
            var emptyException = await Assert.ThrowsAsync<ArgumentException>(
                () => _orchestrationService.ExecuteQueryAsync(profileId, sql, ""));
            emptyException.Message.Should().Be("User query cannot be null or empty. (Parameter 'userQuery')");

            // Act & Assert for whitespace user query
            var whitespaceException = await Assert.ThrowsAsync<ArgumentException>(
                () => _orchestrationService.ExecuteQueryAsync(profileId, sql, "   "));
            whitespaceException.Message.Should().Be("User query cannot be null or empty. (Parameter 'userQuery')");

            _mockProfileDbService.Verify(x => x.ExecuteAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<IDictionary<string, string?>>(), It.IsAny<ExecutionMode>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Theory]
        [InlineData(ExecutionMode.ReadOnly)]
        [InlineData(ExecutionMode.Write)]
        public async Task ExecuteQueryAsync_WithDifferentExecutionModes_ShouldPassModeCorrectly(ExecutionMode mode)
        {
            // Arrange
            var profileId = Guid.NewGuid();
            var sql = "SELECT * FROM Users";
            var userQuery = "Show me all users";

            var expectedResult = TestDataBuilder.CreateTestExecutionResult();

            _mockProfileDbService.Setup(x => x.ExecuteAsync(profileId, sql, userQuery, null!, mode, It.IsAny<CancellationToken>()))
                .ReturnsAsync(expectedResult);

            // Act
            var result = await _orchestrationService.ExecuteQueryAsync(profileId, sql, userQuery, mode: mode);

            // Assert
            result.Should().Be(expectedResult);

            _mockProfileDbService.Verify(x => x.ExecuteAsync(profileId, sql, userQuery, null!, mode, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task ExecuteQueryAsync_WithParameters_ShouldPassParametersCorrectly()
        {
            // Arrange
            var profileId = Guid.NewGuid();
            var sql = "SELECT * FROM Users WHERE Id = @Id";
            var userQuery = "Show me user with id 1";
            var parameters = new Dictionary<string, string?> 
            { 
                { "Id", "1" },
                { "Name", "Test User" }
            };

            var expectedResult = TestDataBuilder.CreateTestExecutionResult();

            _mockProfileDbService.Setup(x => x.ExecuteAsync(profileId, sql, userQuery, parameters, ExecutionMode.ReadOnly, It.IsAny<CancellationToken>()))
                .ReturnsAsync(expectedResult);

            // Act
            var result = await _orchestrationService.ExecuteQueryAsync(profileId, sql, userQuery, parameters);

            // Assert
            result.Should().Be(expectedResult);

            _mockProfileDbService.Verify(x => x.ExecuteAsync(profileId, sql, userQuery, parameters, ExecutionMode.ReadOnly, It.IsAny<CancellationToken>()), Times.Once);
        }
    }
}