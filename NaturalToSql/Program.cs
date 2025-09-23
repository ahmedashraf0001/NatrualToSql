using NaturalToQuery.Api.Configurations;
using NaturalToQuery.Application.Configurations;
using NaturalToQuery.Application.Services;
using NaturalToQuery.Infrastructure.Configurations;
using NaturalToQuery.SharedKernal.Configurations;
using NaturalToQuery.SharedKernal.Interfaces;
using System;

var builder = WebApplication.CreateBuilder(args);

var configuration = builder.Configuration;

builder.Services.AddOpenApi();
builder.Services.AddSwaggerGen();

builder.ConfigureKernal();
builder.ConfigureInfrastructure(configuration);
builder.ConfigureApplication(configuration);
builder.ConfigureApi();


var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
    app.MapOpenApi();
}
var logger = app.Services.GetRequiredService<IAppLogger<Exception>>();

app.UseConfiguredKernal(logger);

app.UseConfiguredApi(logger);

app.UseConfiguredInfrastructure(logger);

app.UseConfiguredApplication(logger);

app.UseHttpsRedirection();

app.UseAuthentication();

app.UseAuthorization();

app.MapControllers();

app.Run();
