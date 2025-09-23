using NaturalToQuery.SharedKernal.Interfaces;
using System.Net;

namespace NaturalToQuery.Api.Middlewares
{
    public static class ExceptionMiddlewareExtensions
    {
        public static void ConfigureExceptionHandler(this WebApplication app, IAppLogger<Exception> logger)
        {
            app.UseExceptionHandler(errors =>
            {
                errors.Run(async context =>
                {
                    context.Response.ContentType = "application/json";

                    var contextfeature = context.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>();

                    if (contextfeature == null)
                        return;

                    var error = contextfeature.Error;

                    bool IsDevelopment = app.Environment.IsDevelopment();

                    if (ExceptionMiddlewareHelper.ExceptionHandlers.TryGetValue(error.GetType(), out var handler))
                    {
                        logger.LogError("Error occurred.", error);

                        var response = handler(error);
                        context.Response.StatusCode = response.StatusCode;
                        await context.Response.WriteAsJsonAsync(response);
                    }
                    else 
                    {
                        logger.LogError("Unhandled exception occurred.", error);

                        context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;
                        var response = new ErrorMessageDTO
                        {
                            Errors = new[] { error.Message },
                            StatusCode = context.Response.StatusCode,
                            Source = error.GetType().Name
                        };
                        await context.Response.WriteAsJsonAsync(response);
                    }
                });
            });
        }
    }
}
