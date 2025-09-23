using Microsoft.AspNetCore.Builder;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using NaturalToQuery.Application.DTOs.Groq;
using NaturalToQuery.Application.DTOs.UI;
using NaturalToQuery.Core.Interfaces;
using NaturalToQuery.Infrastructure.Interfaces;
using NaturalToQuery.Infrastructure.LLM;
using NaturalToQuery.Infrastructure.Persistence;
using NaturalToQuery.Infrastructure.Secrets;
using NaturalToQuery.SharedKernal.Interfaces;
using NaturalToQuery.Infrastructure.Cache;
using NaturalToQuery.Core.Contributers.Entities.Profiles.Handlers;
using NaturalToQuery.Infrastructure.Persistence.Repositories;
namespace NaturalToQuery.Infrastructure.Configurations
{
    public static class InfrastructureConfigurations
    {
        public static void ConfigureInfrastructure(this WebApplicationBuilder builder, IConfiguration Configuration)
        {
            builder.Services.ConfigureInfrastructureServices(Configuration);
            builder.Services.ConfigureInfrastructureStorage(Configuration);

            builder.Services.AddMediatR(cfg =>
            {
                cfg.RegisterServicesFromAssembly(typeof(ProfileEmbeddingsBuildingEventHandler).Assembly);
            });
        }
        public static void UseConfiguredInfrastructure(this WebApplication app, IAppLogger<Exception> logger)
        {
            using (var scope = app.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<ContextDB>();
                db.Database.Migrate();
            }
            logger.LogInformation("Infrastructure configured successfully.");
        }
        public static void ConfigureInfrastructureServices(this IServiceCollection Services, IConfiguration Configuration)
        {
            Services.Configure<LLMOptions>(Configuration.GetSection("Groq"));
            Services.Configure<List<SupportedDB>>(Configuration.GetSection("SupportDBs"));
            Services.AddScoped<IProfileRepository, ProfileRepository>();
            Services.AddSingleton<IProviderCache, ProviderCache>();
            Services.AddScoped<IDbProviderFactory, Factory.DbProviderFactory>();
            Services.AddSingleton<ISecretStore<WindowsCredentialStore>, WindowsCredentialStore>();
            Services.AddScoped<IUserInfoRepository, UserInfoRepository>();
            Services.AddSingleton<ILLMServiceFactory, LLMServiceFactory>();
        }
        public static void ConfigureInfrastructureStorage(this IServiceCollection Services, IConfiguration Configuration)
        {
            Services.AddDbContext<ContextDB>(options =>
            {
                var connectionString = Configuration.GetConnectionString("DefaultConnection");
                options.UseSqlite(connectionString);
            });
        }
    }
}
