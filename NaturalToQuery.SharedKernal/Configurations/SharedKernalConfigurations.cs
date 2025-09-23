using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using NaturalToQuery.SharedKernal.Interfaces;
using NaturalToQuery.SharedKernal.Logging;
using Serilog;

namespace NaturalToQuery.SharedKernal.Configurations
{
    public static class SharedKernalConfigurations
    {
        public static void ConfigureKernal(this WebApplicationBuilder builder)
        {
            builder.Services.ConfigureLogging();
            builder.Services.RegisterServices();
            builder.Host.UseSerilog();
        }
        public static void UseConfiguredKernal(this WebApplication app, IAppLogger<Exception> logger)
        {
            logger.LogInformation("Shared Kernal configured successfully.");
        }
        public static void ConfigureLogging(this IServiceCollection Services)
        {
            Log.Logger = new LoggerConfiguration()
                .MinimumLevel.Debug()
                .WriteTo.Console()
                .WriteTo.File("logs/log-.txt", rollingInterval: RollingInterval.Day)
                .CreateLogger();

            Log.Information("This is a test log to file!");
        }
        public static void RegisterServices(this IServiceCollection Services)
        {
            Services.AddTransient(typeof(IAppLogger<>), typeof(AppLogger<>));
        }
    }
}
