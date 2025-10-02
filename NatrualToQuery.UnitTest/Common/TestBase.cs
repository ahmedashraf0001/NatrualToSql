using AutoFixture;
using AutoFixture.AutoMoq;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using NaturalToQuery.Infrastructure.Persistence;
using NaturalToQuery.SharedKernal.Interfaces;
using System;
using System.Collections.Generic;

namespace NatrualToQuery.UnitTest.Common
{
    public abstract class TestBase : IDisposable
    {
        protected readonly IFixture Fixture;
        protected readonly Mock<IAppLogger<Exception>> MockLogger;
        protected readonly Mock<IConfiguration> MockConfiguration;
        protected readonly string TestDatabaseName;

        protected TestBase()
        {
            Fixture = new Fixture();
            Fixture.Customize(new AutoMoqCustomization { ConfigureMembers = true });
            
            // Configure AutoFixture to handle circular references
            Fixture.Behaviors.OfType<ThrowingRecursionBehavior>()
                .ToList()
                .ForEach(b => Fixture.Behaviors.Remove(b));
            Fixture.Behaviors.Add(new OmitOnRecursionBehavior());

            MockLogger = new Mock<IAppLogger<Exception>>();
            MockConfiguration = new Mock<IConfiguration>();
            TestDatabaseName = Guid.NewGuid().ToString();
        }

        protected ContextDB CreateInMemoryContext()
        {
            var options = new DbContextOptionsBuilder<ContextDB>()
                .UseInMemoryDatabase(databaseName: TestDatabaseName)
                .Options;

            var mockMediator = new Mock<MediatR.IMediator>();
            return new ContextDB(options, mockMediator.Object);
        }

        protected Mock<IAppLogger<T>> CreateMockLogger<T>()
        {
            return new Mock<IAppLogger<T>>();
        }

        protected IConfiguration CreateTestConfiguration(Dictionary<string, string?> settings = null!)
        {
            var configurationBuilder = new ConfigurationBuilder();
            
            if (settings != null)
            {
                configurationBuilder.AddInMemoryCollection(settings);
            }
            
            return configurationBuilder.Build();
        }

        protected ServiceCollection CreateServiceCollection()
        {
            var services = new ServiceCollection();
            return services;
        }

        public virtual void Dispose()
        {
            // Cleanup if needed
        }
    }
}