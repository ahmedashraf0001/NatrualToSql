using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using NaturalToQuery.Core.Contributers.Entities;
using NaturalToQuery.Core.Interfaces;
using NaturalToQuery.Infrastructure.Factory;
using NaturalToQuery.Infrastructure.Interfaces;
using NaturalToQuery.Infrastructure.Providers;
using NaturalToQuery.SharedKernal.Interfaces;
using System;
using Xunit;

public class DbProviderFactoryTests
{
    private readonly Mock<IServiceProvider> _mockServiceProvider;
    private readonly Mock<IAppLogger<DbProviderFactory>> _mockLogger;
    private readonly Mock<IConfiguration> _mockConfiguration;
    private readonly Mock<IProfileRepository> _mockProfileRepository;
    private readonly Mock<IAppLogger<SqlServerDbProvider>> _mockSqlLogger;
    private readonly Mock<IProviderCache> _mockProviderCache;
    private readonly DbProviderFactory _factory;

    public DbProviderFactoryTests()
    {
        _mockServiceProvider = new Mock<IServiceProvider>();
        _mockLogger = new Mock<IAppLogger<DbProviderFactory>>();
        _mockConfiguration = new Mock<IConfiguration>();
        _mockProfileRepository = new Mock<IProfileRepository>();
        _mockSqlLogger = new Mock<IAppLogger<SqlServerDbProvider>>();
        _mockProviderCache = new Mock<IProviderCache>();

        // Setup service provider to return mocked dependencies
        _mockServiceProvider.Setup(sp => sp.GetService(typeof(IConfiguration)))
            .Returns(_mockConfiguration.Object);
        _mockServiceProvider.Setup(sp => sp.GetService(typeof(IProfileRepository)))
            .Returns(_mockProfileRepository.Object);
        _mockServiceProvider.Setup(sp => sp.GetService(typeof(IAppLogger<SqlServerDbProvider>)))
            .Returns(_mockSqlLogger.Object);
        _mockServiceProvider.Setup(sp => sp.GetService(typeof(IProviderCache)))
            .Returns(_mockProviderCache.Object);

        _factory = new DbProviderFactory(_mockServiceProvider.Object, _mockLogger.Object);
    }

    [Fact]
    public void CreateWithProfile_SqlServerType_ReturnsProvider()
    {
        // Arrange
        var profileId = Guid.NewGuid();

        // Act
        var result = _factory.CreateWithProfile(profileId, ProviderType.SqlServer);

        // Assert
        Assert.NotNull(result);
        Assert.IsType<SqlServerDbProvider>(result);
    }

    [Fact]
    public void CreateStandalone_SqlServerType_ReturnsProvider()
    {
        // Act
        var result = _factory.CreateStandalone(ProviderType.SqlServer);

        // Assert
        Assert.NotNull(result);
        Assert.IsType<SqlServerDbProvider>(result);
    }

    [Fact]
    public void CreateWithProfile_UnsupportedType_ThrowsNotImplementedException()
    {
        // Arrange
        var profileId = Guid.NewGuid();
        var unsupportedType = (ProviderType)999; // Assuming this doesn't exist

        // Act & Assert
        Assert.Throws<NotImplementedException>(() =>
            _factory.CreateWithProfile(profileId, unsupportedType));
    }

    [Fact]
    public void CreateStandalone_UnsupportedType_ThrowsNotImplementedException()
    {
        // Arrange
        var unsupportedType = (ProviderType)999;

        // Act & Assert
        Assert.Throws<NotImplementedException>(() =>
            _factory.CreateStandalone(unsupportedType));
    }

    [Fact]
    public void CreateWithProfile_UnsupportedType_LogsError()
    {
        // Arrange
        var profileId = Guid.NewGuid();
        var unsupportedType = (ProviderType)999;

        // Act & Assert
        Assert.Throws<NotImplementedException>(() =>
            _factory.CreateWithProfile(profileId, unsupportedType));

        // Verify error was logged - Note: your code passes "CreateStandalone" even for CreateWithProfile
        _mockLogger.Verify(
            logger => logger.LogError(
                It.Is<string>(s => s.Contains("Unsupported provider type")),
                unsupportedType,
                "CreateStandalone"), // This matches what your code actually passes
            Times.Once);
    }
}