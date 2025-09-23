using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using NaturalToQuery.Application.Interfaces;
using NaturalToQuery.Application.Services;
using NaturalToQuery.Core.Interfaces;
using NaturalToQuery.SharedKernal.Interfaces;

namespace NaturalToQuery.Application.Configurations
{
    public static class ApplicationConfigurations
    {
        public static void ConfigureApplication(this WebApplicationBuilder builder, IConfiguration Configuration)
        {
            builder.Services.AddHttpClient();
            builder.Services.ConfigureApplicationServices(Configuration);
        }
        public static void UseConfiguredApplication(this WebApplication app, IAppLogger<Exception> logger)
        {
            logger.LogInformation("Infrastructure configured successfully.");
        }
        public static void ConfigureApplicationServices(this IServiceCollection Services, IConfiguration Configuration)
        {
            Services.AddScoped<IProfileService, ProfileService>();
            Services.AddScoped<ISetupService,SetupService>();
            Services.AddScoped<IQueryOrchestrationService,QueryOrchestrationService>();
            Services.AddScoped<IProfileDbService,ProfileDbService>();
            Services.AddScoped<IUserInfoService, UserInfoService>();
            Services.AddScoped<ILocalLLMCheck, LocalLLMCheck>();
            Services.AddHttpClient();
        }
    }
}
