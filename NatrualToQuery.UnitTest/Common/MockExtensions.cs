using Microsoft.Extensions.Configuration;
using NaturalToQuery.SharedKernal.Interfaces;
using System.Collections.Generic;

namespace NatrualToQuery.UnitTest.Common
{
    public static class MockExtensions
    {
        public static Mock<IAppLogger<T>> SetupLogger<T>()
        {
            return new Mock<IAppLogger<T>>();
        }

        public static Mock<IConfiguration> SetupConfiguration(Dictionary<string, string?>? settings = null)
        {
            var mockConfig = new Mock<IConfiguration>();
            
            if (settings != null)
            {
                foreach (var kvp in settings)
                {
                    mockConfig.Setup(x => x[kvp.Key]).Returns(kvp.Value);
                }
            }

            return mockConfig;
        }

        public static void VerifyLoggerCalled<T>(this Mock<IAppLogger<T>> mockLogger, string message, Times? times = null)
        {
            mockLogger.Verify(
                x => x.LogInformation(It.Is<string>(s => s.Contains(message)), It.IsAny<object[]>()),
                times ?? Times.AtLeastOnce());
        }

        public static void VerifyLoggerErrorCalled<T>(this Mock<IAppLogger<T>> mockLogger, string message, Times? times = null)
        {
            mockLogger.Verify(
                x => x.LogError(It.Is<string>(s => s.Contains(message)), It.IsAny<object[]>()),
                times ?? Times.AtLeastOnce());
        }

        public static void VerifyLoggerWarningCalled<T>(this Mock<IAppLogger<T>> mockLogger, string message, Times? times = null)
        {
            mockLogger.Verify(
                x => x.LogWarning(It.Is<string>(s => s.Contains(message)), It.IsAny<object[]>()),
                times ?? Times.AtLeastOnce());
        }

        public static void VerifyLoggerDebugCalled<T>(this Mock<IAppLogger<T>> mockLogger, string message, Times? times = null)
        {
            mockLogger.Verify(
                x => x.LogDebug(It.Is<string>(s => s.Contains(message)), It.IsAny<object[]>()),
                times ?? Times.AtLeastOnce());
        }
    }
}