using NaturalToQuery.Application.Services;
using NaturalToQuery.Core.Contributers.Entities;
using NaturalToQuery.Core.Contributers.Entities.Profiles;
using NaturalToQuery.Core.Interfaces;
using NaturalToQuery.Infrastructure.Interfaces;
using NaturalToQuery.Infrastructure.Providers;
using NaturalToQuery.Infrastructure.Secrets;
using NaturalToQuery.SharedKernal.DTOs.UI;
using NaturalToQuery.SharedKernal.Interfaces;
using NatrualToQuery.UnitTest.Common;

namespace NatrualToQuery.UnitTest.Application.Services
{
    public class ProfileServiceTests : TestBase
    {
        private readonly Mock<IProfileRepository> _mockProfileRepository;
        private readonly Mock<ISecretStore<WindowsCredentialStore>> _mockSecretStore;
        private readonly Mock<IAppLogger<ProfileService>> _mockLogger;
        private readonly Mock<IDbProviderFactory> _mockDbProviderFactory;
        private readonly Mock<IDbProvider> _mockDbProvider;
        private readonly ProfileService _profileService;

        public ProfileServiceTests()
        {
            _mockProfileRepository = new Mock<IProfileRepository>();
            _mockSecretStore = new Mock<ISecretStore<WindowsCredentialStore>>();
            _mockLogger = Common.MockExtensions.SetupLogger<ProfileService>();
            _mockDbProviderFactory = new Mock<IDbProviderFactory>();
            _mockDbProvider = new Mock<IDbProvider>();

            _mockDbProviderFactory.Setup(x => x.CreateStandalone(It.IsAny<ProviderType>()))
                .Returns(_mockDbProvider.Object);

            _profileService = new ProfileService(
                _mockProfileRepository.Object,
                _mockSecretStore.Object,
                _mockLogger.Object,
                _mockDbProviderFactory.Object
            );
        }

        [Fact]
        public async Task CreateAsync_WithValidParameters_ShouldCreateProfile()
        {
            // Arrange
            var userId = Guid.NewGuid();
            var providerType = ProviderType.SqlServer;
            var config = TestDataBuilder.CreateTestConnectionConfig();
            var expectedSecretRef = "test-secret-ref";

            _mockDbProvider.Setup(x => x.CheckConnection(config, It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            _mockSecretStore.Setup(x => x.SaveSecretAsync(It.IsAny<string>(), config.ConnectionString, It.IsAny<CancellationToken>()))
                .ReturnsAsync(expectedSecretRef);

            _mockProfileRepository.Setup(x => x.AddAsync(It.IsAny<Profile>(), It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

            _mockProfileRepository.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(1);

            // Act
            var result = await _profileService.CreateAsync(userId, providerType, config);

            // Assert
            result.Should().NotBeNull();
            result.Provider.Should().Be(providerType);
            result.DatabaseName.Should().Be(config.Database);
            result.SecretRef.Should().Be(expectedSecretRef);

            _mockDbProvider.Verify(x => x.CheckConnection(config, It.IsAny<CancellationToken>()), Times.Once);
            _mockSecretStore.Verify(x => x.SaveSecretAsync(It.IsAny<string>(), config.ConnectionString, It.IsAny<CancellationToken>()), Times.Once);
            _mockProfileRepository.Verify(x => x.AddAsync(It.IsAny<Profile>(), It.IsAny<CancellationToken>()), Times.Once);
            _mockProfileRepository.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);

            _mockLogger.VerifyLoggerCalled("Creating profile for provider");
            _mockLogger.VerifyLoggerCalled("Profile created successfully");
        }

        [Fact]
        public async Task CreateAsync_WithInvalidConnection_ShouldThrowException()
        {
            // Arrange
            var userId = Guid.NewGuid();
            var providerType = ProviderType.SqlServer;
            var config = TestDataBuilder.CreateTestConnectionConfig();

            _mockDbProvider.Setup(x => x.CheckConnection(config, It.IsAny<CancellationToken>()))
                .ReturnsAsync(false);

            // Act & Assert
            var exception = await Assert.ThrowsAsync<InvalidOperationException>(
                () => _profileService.CreateAsync(userId, providerType, config));

            exception.Message.Should().Contain("failed to connect to the configured connection string");

            _mockDbProvider.Verify(x => x.CheckConnection(config, It.IsAny<CancellationToken>()), Times.Once);
            _mockSecretStore.Verify(x => x.SaveSecretAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
            _mockProfileRepository.Verify(x => x.AddAsync(It.IsAny<Profile>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task RemoveAsync_WithValidProfileId_ShouldDeleteProfile()
        {
            // Arrange
            var profileId = Guid.NewGuid();
            var profile = TestDataBuilder.CreateTestProfile();
            var secretRef = "test-secret-ref";
            profile.SetSecretRef(secretRef);

            _mockProfileRepository.Setup(x => x.GetByIdAsync(profileId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(profile);

            _mockSecretStore.Setup(x => x.DeleteSecretAsync(secretRef, It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

            _mockProfileRepository.Setup(x => x.DeleteAsync(profile, It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

            _mockProfileRepository.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(1);

            // Act
            await _profileService.RemoveAsync(profileId);

            // Assert
            _mockProfileRepository.Verify(x => x.GetByIdAsync(profileId, It.IsAny<CancellationToken>()), Times.Once);
            _mockSecretStore.Verify(x => x.DeleteSecretAsync(secretRef, It.IsAny<CancellationToken>()), Times.Once);
            _mockProfileRepository.Verify(x => x.DeleteAsync(profile, It.IsAny<CancellationToken>()), Times.Once);
            _mockProfileRepository.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);

            _mockLogger.VerifyLoggerCalled("Deleting profile");
            _mockLogger.VerifyLoggerCalled("deleted successfully");
        }

        [Fact]
        public async Task RemoveAsync_WithEmptyProfileId_ShouldThrowArgumentException()
        {
            // Arrange
            var profileId = Guid.Empty;

            // Act & Assert
            var exception = await Assert.ThrowsAsync<ArgumentException>(
                () => _profileService.RemoveAsync(profileId));

            exception.Message.Should().Be("Profile Id cannot be empty. (Parameter 'profileId')");

            _mockProfileRepository.Verify(x => x.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task RemoveAsync_WithNonExistentProfile_ShouldThrowArgumentException()
        {
            // Arrange
            var profileId = Guid.NewGuid();

            _mockProfileRepository.Setup(x => x.GetByIdAsync(profileId, It.IsAny<CancellationToken>()))
                .ReturnsAsync((Profile?)null);

            // Act & Assert
            var exception = await Assert.ThrowsAsync<ArgumentException>(
                () => _profileService.RemoveAsync(profileId));

            exception.Message.Should().Be("Profile not found");

            _mockProfileRepository.Verify(x => x.GetByIdAsync(profileId, It.IsAny<CancellationToken>()), Times.Once);
            _mockLogger.VerifyLoggerWarningCalled("not found while attempting delete");
        }

        [Fact]
        public async Task SetConnectionStringAsync_WithValidProfileId_ShouldUpdateConnectionString()
        {
            // Arrange
            var profileId = Guid.NewGuid();
            var profile = TestDataBuilder.CreateTestProfile();
            var newConnectionString = "new-connection-string";
            var expectedSecretRef = "updated-secret-ref";

            _mockProfileRepository.Setup(x => x.GetByIdAsync(profileId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(profile);

            _mockSecretStore.Setup(x => x.SaveSecretAsync(It.IsAny<string>(), newConnectionString, It.IsAny<CancellationToken>()))
                .ReturnsAsync(expectedSecretRef);

            _mockProfileRepository.Setup(x => x.UpdateAsync(profile, It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

            _mockProfileRepository.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(1);

            // Act
            await _profileService.SetConnectionStringAsync(profileId, newConnectionString);

            // Assert
            _mockProfileRepository.Verify(x => x.GetByIdAsync(profileId, It.IsAny<CancellationToken>()), Times.Once);
            _mockSecretStore.Verify(x => x.SaveSecretAsync(It.IsAny<string>(), newConnectionString, It.IsAny<CancellationToken>()), Times.Once);
            _mockProfileRepository.Verify(x => x.UpdateAsync(profile, It.IsAny<CancellationToken>()), Times.Once);
            _mockProfileRepository.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);

            _mockLogger.VerifyLoggerCalled("Updating connection string for profile");
            _mockLogger.VerifyLoggerCalled("Connection string updated for profile");
        }

        [Fact]
        public async Task GetConnectionStringAsync_WithValidProfileId_ShouldReturnConnectionString()
        {
            // Arrange
            var profileId = Guid.NewGuid();
            var profile = TestDataBuilder.CreateTestProfile();
            var secretRef = "test-secret-ref";
            profile.SetSecretRef(secretRef);
            var expectedConnectionString = "test-connection-string";

            _mockProfileRepository.Setup(x => x.GetByIdAsync(profileId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(profile);

            _mockSecretStore.Setup(x => x.GetSecretAsync(secretRef, It.IsAny<CancellationToken>()))
                .ReturnsAsync(expectedConnectionString);

            // Act
            var result = await _profileService.GetConnectionStringAsync(profileId);

            // Assert
            result.Should().Be(expectedConnectionString);

            _mockProfileRepository.Verify(x => x.GetByIdAsync(profileId, It.IsAny<CancellationToken>()), Times.Once);
            _mockSecretStore.Verify(x => x.GetSecretAsync(secretRef, It.IsAny<CancellationToken>()), Times.Once);

            _mockLogger.VerifyLoggerCalled("Fetching connection string for profile");
        }

        [Fact]
        public async Task GetConnectionStringAsync_WithProfileWithoutSecretRef_ShouldReturnNull()
        {
            // Arrange
            var profileId = Guid.NewGuid();
            var profile = TestDataBuilder.CreateTestProfile();
            // Clear the SecretRef to test null scenario
            profile.GetType().GetProperty("SecretRef")?.SetValue(profile, null);

            _mockProfileRepository.Setup(x => x.GetByIdAsync(profileId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(profile);

            // Act
            var result = await _profileService.GetConnectionStringAsync(profileId);

            // Assert
            result.Should().BeNull();

            _mockProfileRepository.Verify(x => x.GetByIdAsync(profileId, It.IsAny<CancellationToken>()), Times.Once);
            _mockSecretStore.Verify(x => x.GetSecretAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);

            _mockLogger.VerifyLoggerCalled("Fetching connection string for profile");
        }

        [Fact]
        public async Task GetProviderProfileAsync_WithValidProviderType_ShouldReturnProfile()
        {
            // Arrange
            var providerType = ProviderType.SqlServer;
            var expectedProfile = TestDataBuilder.CreateTestProfile(providerType: providerType);

            _mockProfileRepository.Setup(x => x.GetByTypeAsync(providerType, It.IsAny<CancellationToken>()))
                .ReturnsAsync(expectedProfile);

            // Act
            var result = await _profileService.GetProviderProfileAsync(providerType);

            // Assert
            result.Should().Be(expectedProfile);

            _mockProfileRepository.Verify(x => x.GetByTypeAsync(providerType, It.IsAny<CancellationToken>()), Times.Once);

            _mockLogger.VerifyLoggerCalled("Fetching provider profile for type");
        }

        [Fact]
        public async Task GetProviderProfileAsync_WithNonExistentProviderType_ShouldThrowArgumentException()
        {
            // Arrange
            var providerType = ProviderType.SqlServer;

            _mockProfileRepository.Setup(x => x.GetByTypeAsync(providerType, It.IsAny<CancellationToken>()))
                .ReturnsAsync((Profile?)null);

            // Act & Assert
            var exception = await Assert.ThrowsAsync<ArgumentException>(
                () => _profileService.GetProviderProfileAsync(providerType));

            exception.Message.Should().Be($"No profile found for provider type {providerType}");

            _mockProfileRepository.Verify(x => x.GetByTypeAsync(providerType, It.IsAny<CancellationToken>()), Times.Once);
            _mockLogger.VerifyLoggerWarningCalled("No profile found for provider type");
        }

        [Fact]
        public async Task GetProviderTypeAsync_WithValidProfileId_ShouldReturnProviderType()
        {
            // Arrange
            var profileId = Guid.NewGuid();
            var expectedProviderType = ProviderType.SqlServer;
            var profile = TestDataBuilder.CreateTestProfile(providerType: expectedProviderType);

            _mockProfileRepository.Setup(x => x.GetByIdAsync(profileId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(profile);

            // Act
            var result = await _profileService.GetProviderTypeAsync(profileId);

            // Assert
            result.Should().Be(expectedProviderType);

            _mockProfileRepository.Verify(x => x.GetByIdAsync(profileId, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task GetProviderTypeAsync_WithEmptyProfileId_ShouldThrowArgumentException()
        {
            // Arrange
            var profileId = Guid.Empty;

            // Act & Assert
            var exception = await Assert.ThrowsAsync<ArgumentException>(
                () => _profileService.GetProviderTypeAsync(profileId));

            exception.Message.Should().Be("Profile Id cannot be empty. (Parameter 'profileId')");

            _mockProfileRepository.Verify(x => x.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task GetProviderTypeAsync_WithNonExistentProfile_ShouldThrowArgumentException()
        {
            // Arrange
            var profileId = Guid.NewGuid();

            _mockProfileRepository.Setup(x => x.GetByIdAsync(profileId, It.IsAny<CancellationToken>()))
                .ReturnsAsync((Profile?)null);

            // Act & Assert
            var exception = await Assert.ThrowsAsync<ArgumentException>(
                () => _profileService.GetProviderTypeAsync(profileId));

            exception.Message.Should().Be($"No profile found with id: {profileId}");

            _mockProfileRepository.Verify(x => x.GetByIdAsync(profileId, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task ListAllAsync_ShouldReturnAllProfilesAsDtos()
        {
            // Arrange
            var profiles = new List<Profile>
            {
                TestDataBuilder.CreateTestProfile(),
                TestDataBuilder.CreateTestProfile(),
                TestDataBuilder.CreateTestProfile()
            };

            _mockProfileRepository.Setup(x => x.ListAllAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(profiles);

            // Setup individual profile lookups for GetConnectionStringAsync calls
            foreach (var profile in profiles)
            {
                _mockProfileRepository.Setup(x => x.GetByIdAsync(profile.Id, It.IsAny<CancellationToken>()))
                    .ReturnsAsync(profile);
            }

            foreach (var profile in profiles)
            {
                _mockSecretStore.Setup(x => x.GetSecretAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
                    .ReturnsAsync("test-connection-string");
            }

            // Act
            var result = await _profileService.ListAllAsync();

            // Assert
            result.Should().HaveCount(3);
            result.Should().AllSatisfy(dto =>
            {
                dto.Should().NotBeNull();
                dto.Id.Should().NotBeEmpty();
                dto.Name.Should().NotBeNullOrEmpty();
                dto.ConnectionString.Should().NotBeNullOrEmpty();
            });

            _mockProfileRepository.Verify(x => x.ListAllAsync(It.IsAny<CancellationToken>()), Times.Once);
            _mockLogger.VerifyLoggerCalled("Listing all profiles");
        }
    }
}