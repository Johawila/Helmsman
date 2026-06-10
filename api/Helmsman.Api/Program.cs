using Helmsman.Api.Endpoints;
using Helmsman.Api.Kube;

var builder = WebApplication.CreateBuilder(args);

const string FrontendCors = "frontend";
builder.Services.AddCors(options =>
{
    options.AddPolicy(
        FrontendCors,
        policy =>
            policy
                .WithOrigins("http://localhost:5174")
                .AllowAnyHeader()
                .AllowAnyMethod()
                .AllowCredentials()
    );
});

builder.Services.AddSingleton<KubeClientFactory>();
builder.Services.AddSingleton<ClusterReader>();

var app = builder.Build();

app.UseCors(FrontendCors);
app.MapClusterEndpoints();

app.Run();
