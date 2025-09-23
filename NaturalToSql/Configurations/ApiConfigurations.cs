using FastEndpoints;
using Microsoft.Extensions.Caching.Memory;
using NaturalToQuery.Api.Middlewares;
using NaturalToQuery.SharedKernal.Interfaces;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;

namespace NaturalToQuery.Api.Configurations
{
    public static class ApiConfigurations
    {

        public static void ConfigureApi(this WebApplicationBuilder builder)
        {
            builder.Services.ConfigureCors();
            builder.Services.ConfigureRateLimiting();
            builder.Services.ConfigureEndPoints();
            builder.Services.ConfigureCaching();
        }
        public static void UseConfiguredApi(this WebApplication app, IAppLogger<Exception> logger)
        {
            app.UseCors("AllowAll");
            app.ConfigureExceptionHandler(logger);
            logger.LogInformation("API configured successfully.");
            app.UseFastEndpoints();
        }
        public static void ConfigureCors(this IServiceCollection Services)
        {
            Services.AddCors(options =>
            {
                options.AddPolicy("AllowAll", builder =>
                {
                    builder.AllowAnyOrigin()
                           .AllowAnyMethod()
                           .AllowAnyHeader();
                });
            });
        }
        public static void ConfigureEndPoints(this IServiceCollection Services)
        {
            Services.AddFastEndpoints();
            Services.AddControllers().AddJsonOptions(options =>
            {
                options.JsonSerializerOptions.Converters.Add(
                     new JsonStringEnumConverter(JsonNamingPolicy.CamelCase, allowIntegerValues: false));
                options.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
            });
        }
        public static void ConfigureCaching(this IServiceCollection Services)
        {
            Services.AddMemoryCache();
        }
        public static void ConfigureRateLimiting(this IServiceCollection Services)
        {
            Services.AddRateLimiter(options =>
            {
                options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
                {
                    return RateLimitPartition.GetFixedWindowLimiter(partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown", factory: partition => new FixedWindowRateLimiterOptions
                    {
                        AutoReplenishment = true,
                        PermitLimit = 100,
                        QueueLimit = 0,
                        Window = TimeSpan.FromMinutes(1)
                    });
                });
                options.OnRejected = async (context, token) =>
                {
                    context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                    await context.HttpContext.Response.WriteAsync("Too many requests. Please try again later.", cancellationToken: token);
                };
            });
        }
    }
}
