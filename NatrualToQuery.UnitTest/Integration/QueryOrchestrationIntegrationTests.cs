using NaturalToQuery.Application.Interfaces;
using NaturalToQuery.SharedKernal.DTOs.Providers;
using NatrualToQuery.UnitTest.Common;

namespace NatrualToQuery.UnitTest.Integration
{
    public class QueryOrchestrationIntegrationTests : IntegrationTestBase
    {
        private readonly IQueryOrchestrationService _orchestrationService;

        public QueryOrchestrationIntegrationTests()
        {
            _orchestrationService = GetService<IQueryOrchestrationService>();
        }

        [Fact]
        public async Task ConvertNaturalLanguageAsync_WithInvalidUserId_ShouldThrowException()
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
        }

        [Fact]
        public async Task ExecuteQueryAsync_WithInvalidParameters_ShouldThrowException()
        {
            // Arrange
            var profileId = Guid.Empty;
            var sql = "SELECT * FROM Users";
            var userQuery = "Show me all users";

            // Act & Assert
            var exception = await Assert.ThrowsAsync<ArgumentException>(
                () => _orchestrationService.ExecuteQueryAsync(profileId, sql, userQuery));

            exception.Message.Should().Be("Profile Id cannot be empty. (Parameter 'profileId')");
        }
    }
}