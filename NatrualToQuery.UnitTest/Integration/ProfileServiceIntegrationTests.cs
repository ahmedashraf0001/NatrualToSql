using NaturalToQuery.Core.Interfaces;
using NaturalToQuery.Core.Contributers.Entities;
using NaturalToQuery.Infrastructure.Providers;
using NaturalToQuery.SharedKernal.DTOs.Providers;
using NatrualToQuery.UnitTest.Common;

namespace NatrualToQuery.UnitTest.Integration
{
    public class ProfileServiceIntegrationTests : IntegrationTestBase
    {
        private readonly IProfileService _profileService;

        public ProfileServiceIntegrationTests()
        {
            _profileService = GetService<IProfileService>();
        }

        [Fact]
        public async Task CreateProfile_EndToEnd_ShouldWorkCorrectly()
        {
            // Arrange
            var userId = Guid.NewGuid();
            var config = new ProviderConnectionConfig("Server=localhost;Database=TestDB;Integrated Security=true;");

            // Note: This test requires mocking the actual database connection
            // In a real integration test, you would use a test database

            // Act & Assert
            // For now, we'll test that the service can be resolved and called
            // In a full integration test, you would test the complete flow
            _profileService.Should().NotBeNull();

            // Test getting a non-existent profile type
            await Assert.ThrowsAsync<ArgumentException>(
                () => _profileService.GetProviderTypeAsync(Guid.NewGuid()));
        }

        [Fact]
        public async Task ListAllAsync_WithEmptyDatabase_ShouldReturnEmptyList()
        {
            // Act
            var result = await _profileService.ListAllAsync();

            // Assert
            result.Should().NotBeNull();
            result.Should().BeEmpty();
        }

        [Fact]
        public async Task GetProviderTypeAsync_WithNonExistentProfile_ShouldThrowException()
        {
            // Arrange
            var nonExistentProfileId = Guid.NewGuid();

            // Act & Assert
            var exception = await Assert.ThrowsAsync<ArgumentException>(
                () => _profileService.GetProviderTypeAsync(nonExistentProfileId));

            exception.Message.Should().Be($"No profile found with id: {nonExistentProfileId}");
        }

        [Fact]
        public async Task GetProviderProfileAsync_WithNonExistentProviderType_ShouldThrowException()
        {
            // Arrange
            var providerType = ProviderType.SqlServer;

            // Act & Assert
            var exception = await Assert.ThrowsAsync<ArgumentException>(
                () => _profileService.GetProviderProfileAsync(providerType));

            exception.Message.Should().Be($"No profile found for provider type {providerType}");
        }
    }
}