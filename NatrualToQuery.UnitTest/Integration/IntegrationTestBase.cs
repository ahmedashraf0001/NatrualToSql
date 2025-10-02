using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using NaturalToQuery.Application.Interfaces;
using NaturalToQuery.Application.Services;
using NaturalToQuery.Core.Interfaces;
using NaturalToQuery.Core.Contributers.Entities;
using NaturalToQuery.Core.Contributers.Entities.Profiles;
using NaturalToQuery.Core.Contributers.Entities.UserInfos;
using NaturalToQuery.Infrastructure.Persistence;
using NaturalToQuery.Infrastructure.Interfaces;
using NaturalToQuery.Infrastructure.Factory;
using NaturalToQuery.Infrastructure.Cache;
using NaturalToQuery.Infrastructure.Secrets;
using NaturalToQuery.Infrastructure.LLM;
using NaturalToQuery.SharedKernal.DTOs.Providers;
using NaturalToQuery.SharedKernal.Interfaces;
using NatrualToQuery.UnitTest.Common;
using MediatR;

namespace NatrualToQuery.UnitTest.Integration
{
    public class IntegrationTestBase : TestBase
    {
        protected readonly IServiceProvider ServiceProvider;
        protected readonly IServiceScope Scope;
        protected readonly ContextDB DbContext;

        protected IntegrationTestBase()
        {
            var services = new ServiceCollection();
            ConfigureServices(services);
            ServiceProvider = services.BuildServiceProvider();
            Scope = ServiceProvider.CreateScope();
            DbContext = Scope.ServiceProvider.GetRequiredService<ContextDB>();
            
            // Ensure the database is created
            DbContext.Database.EnsureCreated();
        }

        private void ConfigureServices(IServiceCollection services)
        {
            // Configuration
            var configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["SupportDBs:0:BaseKey"] = @"SOFTWARE\\Microsoft\\Microsoft SQL Server\\Instance Names\\SQL",
                    ["ConnectionStrings:DefaultConnection"] = "Data Source=:memory:",
                })
                .Build();

            services.AddSingleton<IConfiguration>(configuration);

            // Logging
            services.AddLogging();

            // Database
            services.AddDbContext<ContextDB>(options =>
                options.UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString()));

            // MediatR
            services.AddMediatR(cfg =>
            {
                cfg.RegisterServicesFromAssembly(typeof(ContextDB).Assembly);
            });

            // Repositories (mocked for integration tests)
            services.AddScoped<IProfileRepository>(provider => 
            {
                var mock = new Mock<IProfileRepository>();
                mock.Setup(x => x.ListAllAsync(It.IsAny<CancellationToken>()))
                    .ReturnsAsync((IReadOnlyList<Profile>)new List<Profile>());
                return mock.Object;
            });

            // Application Services
            services.AddScoped<IProfileService, ProfileService>();
            services.AddScoped<ISetupService, SetupService>();
            services.AddScoped<IQueryOrchestrationService, QueryOrchestrationService>();
            services.AddScoped<IProfileDbService, ProfileDbService>();

            // Infrastructure Services
            services.AddScoped<IDbProviderFactory, DbProviderFactory>();
            services.AddScoped<IProviderCache, ProviderCache>();
            services.AddScoped<ISecretStore<WindowsCredentialStore>, WindowsCredentialStore>();

            // Mocked services for integration tests
            services.AddScoped<IUserInfoRepository>(provider => 
            {
                var mock = new Mock<IUserInfoRepository>();
                var testUser = TestDataBuilder.CreateTestUserInfo();
                mock.Setup(x => x.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
                    .ReturnsAsync(testUser);
                return mock.Object;
            });

            services.AddScoped<ILLMServiceFactory>(provider =>
            {
                var mock = new Mock<ILLMServiceFactory>();
                var llmServiceMock = new Mock<ILLMService>();
                llmServiceMock.Setup(x => x.ConvertToSqlAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<ExecutionMode>(), It.IsAny<CancellationToken>()))
                    .ReturnsAsync(TestDataBuilder.CreateTestQueryConversionResult());
                mock.Setup(x => x.Create(It.IsAny<UserInfo>()))
                    .Returns(llmServiceMock.Object);
                return mock.Object;
            });

            // Logging
            services.AddScoped(typeof(IAppLogger<>), typeof(TestLogger<>));
        }

        protected T GetService<T>() where T : notnull
        {
            return Scope.ServiceProvider.GetRequiredService<T>();
        }

        protected T? GetService<T>(Type serviceType) where T : class
        {
            return Scope.ServiceProvider.GetService(serviceType) as T;
        }

        public override void Dispose()
        {
            DbContext?.Dispose();
            Scope?.Dispose();
            ServiceProvider?.GetService<IHostedService>()?.StopAsync(CancellationToken.None);
            (ServiceProvider as IDisposable)?.Dispose();
            base.Dispose();
        }
    }

    public class TestLogger<T> : IAppLogger<T>
    {
        public void LogInformation(string message, params object[] args)
        {
            try
            {
                Console.WriteLine($"[INFO] {typeof(T).Name}: {string.Format(message, args)}");
            }
            catch (FormatException)
            {
                Console.WriteLine($"[INFO] {typeof(T).Name}: {message}");
            }
        }

        public void LogWarning(string message, params object[] args)
        {
            try
            {
                Console.WriteLine($"[WARN] {typeof(T).Name}: {string.Format(message, args)}");
            }
            catch (FormatException)
            {
                Console.WriteLine($"[WARN] {typeof(T).Name}: {message}");
            }
        }

        public void LogError(string message, params object[] args)
        {
            try
            {
                Console.WriteLine($"[ERROR] {typeof(T).Name}: {string.Format(message, args)}");
            }
            catch (FormatException)
            {
                Console.WriteLine($"[ERROR] {typeof(T).Name}: {message}");
            }
        }

        public void LogDebug(string message, params object[] args)
        {
            try
            {
                Console.WriteLine($"[DEBUG] {typeof(T).Name}: {string.Format(message, args)}");
            }
            catch (FormatException)
            {
                Console.WriteLine($"[DEBUG] {typeof(T).Name}: {message}");
            }
        }

        public void LogError(Exception exception, string message, params object[] args)
        {
            try
            {
                Console.WriteLine($"[ERROR] {typeof(T).Name}: {string.Format(message, args)} - {exception}");
            }
            catch (FormatException)
            {
                Console.WriteLine($"[ERROR] {typeof(T).Name}: {message} - {exception}");
            }
        }
    }
}