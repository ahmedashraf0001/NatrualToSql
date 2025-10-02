using NaturalToQuery.Application.Interfaces;
using NaturalToQuery.Application.Services;
using NaturalToQuery.Core.Contributers.Entities;
using NaturalToQuery.Core.Interfaces;
using NaturalToQuery.Infrastructure.Interfaces;
using NaturalToQuery.Infrastructure.Providers;
using NaturalToQuery.SharedKernal.DTOs.Providers;
using NaturalToQuery.SharedKernal.Interfaces;
using NatrualToQuery.UnitTest.Common;

namespace NatrualToQuery.UnitTest.Application.Services
{
    public class ProfileDbServiceTests : TestBase
    {
        private readonly Mock<IProfileService> _mockProfileService;
        private readonly Mock<IDbProviderFactory> _mockDbProviderFactory;
        private readonly Mock<IAppLogger<ProfileDbService>> _mockLogger;
        private readonly Mock<IDbProvider> _mockDbProvider;
        private readonly ProfileDbService _profileDbService;

        public ProfileDbServiceTests()
        {
            _mockProfileService = new Mock<IProfileService>();
            _mockDbProviderFactory = new Mock<IDbProviderFactory>();
            _mockLogger = Common.MockExtensions.SetupLogger<ProfileDbService>();
            _mockDbProvider = new Mock<IDbProvider>();

            _profileDbService = new ProfileDbService(
                _mockLogger.Object,
                _mockProfileService.Object,
                _mockDbProviderFactory.Object
            );
        }

        [Fact]
        public async Task ExecuteAsync_WithValidParameters_ShouldReturnExecutionResult()
        {
            // Arrange
            var profileId = Guid.NewGuid();
            var sql = "SELECT * FROM Users";
            var userQuery = "Show me all users";
            var parameters = new Dictionary<string, string?> { { "Id", "1" } };
            var mode = ExecutionMode.ReadOnly;

            var providerType = ProviderType.SqlServer;
            var connectionString = "Server=localhost;Database=TestDb;Integrated Security=true;";
            var config = new ProviderConnectionConfig(connectionString);
            var expectedResult = TestDataBuilder.CreateTestExecutionResult();

            _mockProfileService.Setup(x => x.GetProviderTypeAsync(profileId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(providerType);

            _mockProfileService.Setup(x => x.GetConnectionStringAsync(profileId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(connectionString);

            _mockDbProviderFactory.Setup(x => x.CreateWithProfile(profileId, providerType))
                .Returns(_mockDbProvider.Object);

            _mockDbProvider.Setup(x => x.ExecuteAsync(It.IsAny<ProviderConnectionConfig>(), sql, userQuery, parameters, mode, It.IsAny<CancellationToken>()))
                .ReturnsAsync(expectedResult);

            // Act
            var result = await _profileDbService.ExecuteAsync(profileId, sql, userQuery, parameters, mode);

            // Assert
            result.Should().Be(expectedResult);

            _mockProfileService.Verify(x => x.GetProviderTypeAsync(profileId, It.IsAny<CancellationToken>()), Times.Once);
            _mockProfileService.Verify(x => x.GetConnectionStringAsync(profileId, It.IsAny<CancellationToken>()), Times.Once);
            _mockDbProviderFactory.Verify(x => x.CreateWithProfile(profileId, providerType), Times.Once);
            _mockDbProvider.Verify(x => x.ExecuteAsync(It.IsAny<ProviderConnectionConfig>(), sql, userQuery, parameters, mode, It.IsAny<CancellationToken>()), Times.Once);

            _mockLogger.VerifyLoggerCalled("Executing SQL for Profile");
        }

        [Fact]
        public async Task ExecuteAsync_WithNullConnectionString_ShouldThrowInvalidOperationException()
        {
            // Arrange
            var profileId = Guid.NewGuid();
            var sql = "SELECT * FROM Users";
            var userQuery = "Show me all users";
            var mode = ExecutionMode.ReadOnly;

            var providerType = ProviderType.SqlServer;

            _mockProfileService.Setup(x => x.GetProviderTypeAsync(profileId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(providerType);

            _mockProfileService.Setup(x => x.GetConnectionStringAsync(profileId, It.IsAny<CancellationToken>()))
                .ReturnsAsync((string?)null);

            // Act & Assert
            var exception = await Assert.ThrowsAsync<InvalidOperationException>(
                () => _profileDbService.ExecuteAsync(profileId, sql, userQuery, mode: mode));

            exception.Message.Should().Contain("No connection string for Profile");

            _mockProfileService.Verify(x => x.GetProviderTypeAsync(profileId, It.IsAny<CancellationToken>()), Times.Once);
            _mockProfileService.Verify(x => x.GetConnectionStringAsync(profileId, It.IsAny<CancellationToken>()), Times.Once);
            _mockDbProviderFactory.Verify(x => x.CreateWithProfile(It.IsAny<Guid>(), It.IsAny<ProviderType>()), Times.Once);
        }

        [Fact]
        public async Task GetSchemaAsync_WithValidProfileId_ShouldReturnSchema()
        {
            // Arrange
            var profileId = Guid.NewGuid();
            var forceRefresh = false;

            var providerType = ProviderType.SqlServer;
            var connectionString = "Server=localhost;Database=TestDb;Integrated Security=true;";
            var config = new ProviderConnectionConfig(connectionString);
            var expectedSchema = TestDataBuilder.CreateTestDatabaseSchema();

            _mockProfileService.Setup(x => x.GetProviderTypeAsync(profileId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(providerType);

            _mockProfileService.Setup(x => x.GetConnectionStringAsync(profileId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(connectionString);

            _mockDbProviderFactory.Setup(x => x.CreateWithProfile(profileId, providerType))
                .Returns(_mockDbProvider.Object);

            _mockDbProvider.Setup(x => x.GetSchemaAsync(It.IsAny<ProviderConnectionConfig>(), forceRefresh, It.IsAny<CancellationToken>()))
                .ReturnsAsync(expectedSchema);

            // Act
            var result = await _profileDbService.GetSchemaAsync(profileId, forceRefresh);

            // Assert
            result.Should().Be(expectedSchema);

            _mockProfileService.Verify(x => x.GetProviderTypeAsync(profileId, It.IsAny<CancellationToken>()), Times.Once);
            _mockProfileService.Verify(x => x.GetConnectionStringAsync(profileId, It.IsAny<CancellationToken>()), Times.Once);
            _mockDbProviderFactory.Verify(x => x.CreateWithProfile(profileId, providerType), Times.Once);
            _mockDbProvider.Verify(x => x.GetSchemaAsync(It.IsAny<ProviderConnectionConfig>(), forceRefresh, It.IsAny<CancellationToken>()), Times.Once);

            _mockLogger.VerifyLoggerDebugCalled("Fetching schema for Profile");
        }

        [Theory]
        [InlineData(true)]
        [InlineData(false)]
        public async Task GetSchemaAsync_WithForceRefreshFlag_ShouldPassFlagCorrectly(bool forceRefresh)
        {
            // Arrange
            var profileId = Guid.NewGuid();

            var providerType = ProviderType.SqlServer;
            var connectionString = "Server=localhost;Database=TestDb;Integrated Security=true;";
            var expectedSchema = TestDataBuilder.CreateTestDatabaseSchema();

            _mockProfileService.Setup(x => x.GetProviderTypeAsync(profileId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(providerType);

            _mockProfileService.Setup(x => x.GetConnectionStringAsync(profileId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(connectionString);

            _mockDbProviderFactory.Setup(x => x.CreateWithProfile(profileId, providerType))
                .Returns(_mockDbProvider.Object);

            _mockDbProvider.Setup(x => x.GetSchemaAsync(It.IsAny<ProviderConnectionConfig>(), forceRefresh, It.IsAny<CancellationToken>()))
                .ReturnsAsync(expectedSchema);

            // Act
            var result = await _profileDbService.GetSchemaAsync(profileId, forceRefresh);

            // Assert
            result.Should().Be(expectedSchema);

            _mockDbProvider.Verify(x => x.GetSchemaAsync(It.IsAny<ProviderConnectionConfig>(), forceRefresh, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task GetSchemaAsync_WithNullConnectionString_ShouldThrowInvalidOperationException()
        {
            // Arrange
            var profileId = Guid.NewGuid();
            var forceRefresh = false;

            var providerType = ProviderType.SqlServer;

            _mockProfileService.Setup(x => x.GetProviderTypeAsync(profileId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(providerType);

            _mockProfileService.Setup(x => x.GetConnectionStringAsync(profileId, It.IsAny<CancellationToken>()))
                .ReturnsAsync((string?)null);

            // Act & Assert
            var exception = await Assert.ThrowsAsync<InvalidOperationException>(
                () => _profileDbService.GetSchemaAsync(profileId, forceRefresh));

            exception.Message.Should().Contain("No connection string for Profile");

            _mockProfileService.Verify(x => x.GetProviderTypeAsync(profileId, It.IsAny<CancellationToken>()), Times.Once);
            _mockProfileService.Verify(x => x.GetConnectionStringAsync(profileId, It.IsAny<CancellationToken>()), Times.Once);
            _mockDbProviderFactory.Verify(x => x.CreateWithProfile(It.IsAny<Guid>(), It.IsAny<ProviderType>()), Times.Once);
        }

        [Fact]
        public async Task ExecuteAsync_WithDefaultExecutionMode_ShouldUseReadOnlyMode()
        {
            // Arrange
            var profileId = Guid.NewGuid();
            var sql = "SELECT * FROM Users";
            var userQuery = "Show me all users";

            var providerType = ProviderType.SqlServer;
            var connectionString = "Server=localhost;Database=TestDb;Integrated Security=true;";
            var expectedResult = TestDataBuilder.CreateTestExecutionResult();

            _mockProfileService.Setup(x => x.GetProviderTypeAsync(profileId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(providerType);

            _mockProfileService.Setup(x => x.GetConnectionStringAsync(profileId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(connectionString);

            _mockDbProviderFactory.Setup(x => x.CreateWithProfile(profileId, providerType))
                .Returns(_mockDbProvider.Object);

            _mockDbProvider.Setup(x => x.ExecuteAsync(It.IsAny<ProviderConnectionConfig>(), sql, userQuery, null!, ExecutionMode.ReadOnly, It.IsAny<CancellationToken>()))
                .ReturnsAsync(expectedResult);

            // Act
            var result = await _profileDbService.ExecuteAsync(profileId, sql, userQuery);

            // Assert
            result.Should().Be(expectedResult);

            _mockDbProvider.Verify(x => x.ExecuteAsync(It.IsAny<ProviderConnectionConfig>(), sql, userQuery, null!, ExecutionMode.ReadOnly, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task ExecuteAsync_WhenDbProviderThrowsException_ShouldPropagateException()
        {
            // Arrange
            var profileId = Guid.NewGuid();
            var sql = "SELECT * FROM Users";
            var userQuery = "Show me all users";
            var mode = ExecutionMode.ReadOnly;

            var providerType = ProviderType.SqlServer;
            var connectionString = "Server=localhost;Database=TestDb;Integrated Security=true;";

            _mockProfileService.Setup(x => x.GetProviderTypeAsync(profileId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(providerType);

            _mockProfileService.Setup(x => x.GetConnectionStringAsync(profileId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(connectionString);

            _mockDbProviderFactory.Setup(x => x.CreateWithProfile(profileId, providerType))
                .Returns(_mockDbProvider.Object);

            var expectedException = new InvalidOperationException("Database connection failed");
            _mockDbProvider.Setup(x => x.ExecuteAsync(It.IsAny<ProviderConnectionConfig>(), sql, userQuery, null!, mode, It.IsAny<CancellationToken>()))
                .ThrowsAsync(expectedException);

            // Act & Assert
            var exception = await Assert.ThrowsAsync<InvalidOperationException>(
                () => _profileDbService.ExecuteAsync(profileId, sql, userQuery, mode: mode));

            exception.Should().Be(expectedException);

            _mockDbProvider.Verify(x => x.ExecuteAsync(It.IsAny<ProviderConnectionConfig>(), sql, userQuery, null!, mode, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task GetSchemaAsync_WhenDbProviderThrowsException_ShouldPropagateException()
        {
            // Arrange
            var profileId = Guid.NewGuid();
            var forceRefresh = false;

            var providerType = ProviderType.SqlServer;
            var connectionString = "Server=localhost;Database=TestDb;Integrated Security=true;";

            _mockProfileService.Setup(x => x.GetProviderTypeAsync(profileId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(providerType);

            _mockProfileService.Setup(x => x.GetConnectionStringAsync(profileId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(connectionString);

            _mockDbProviderFactory.Setup(x => x.CreateWithProfile(profileId, providerType))
                .Returns(_mockDbProvider.Object);

            var expectedException = new InvalidOperationException("Schema loading failed");
            _mockDbProvider.Setup(x => x.GetSchemaAsync(It.IsAny<ProviderConnectionConfig>(), forceRefresh, It.IsAny<CancellationToken>()))
                .ThrowsAsync(expectedException);

            // Act & Assert
            var exception = await Assert.ThrowsAsync<InvalidOperationException>(
                () => _profileDbService.GetSchemaAsync(profileId, forceRefresh));

            exception.Should().Be(expectedException);

            _mockDbProvider.Verify(x => x.GetSchemaAsync(It.IsAny<ProviderConnectionConfig>(), forceRefresh, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Theory]
        [InlineData(ProviderType.SqlServer)]
        public async Task ExecuteAsync_WithDifferentProviderTypes_ShouldCreateCorrectProvider(ProviderType providerType)
        {
            // Arrange
            var profileId = Guid.NewGuid();
            var sql = "SELECT * FROM Users";
            var userQuery = "Show me all users";
            var mode = ExecutionMode.ReadOnly;

            var connectionString = "Server=localhost;Database=TestDb;Integrated Security=true;";
            var expectedResult = TestDataBuilder.CreateTestExecutionResult();

            _mockProfileService.Setup(x => x.GetProviderTypeAsync(profileId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(providerType);

            _mockProfileService.Setup(x => x.GetConnectionStringAsync(profileId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(connectionString);

            _mockDbProviderFactory.Setup(x => x.CreateWithProfile(profileId, providerType))
                .Returns(_mockDbProvider.Object);

            _mockDbProvider.Setup(x => x.ExecuteAsync(It.IsAny<ProviderConnectionConfig>(), sql, userQuery, null!, mode, It.IsAny<CancellationToken>()))
                .ReturnsAsync(expectedResult);

            // Act
            var result = await _profileDbService.ExecuteAsync(profileId, sql, userQuery, mode: mode);

            // Assert
            result.Should().Be(expectedResult);

            _mockDbProviderFactory.Verify(x => x.CreateWithProfile(profileId, providerType), Times.Once);
        }
    }
}