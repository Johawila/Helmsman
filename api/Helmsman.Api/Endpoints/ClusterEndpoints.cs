using Helmsman.Api.Kube;

namespace Helmsman.Api.Endpoints;

public static class ClusterEndpoints
{
    public static void MapClusterEndpoints(this IEndpointRouteBuilder app)
    {
        // Reads the local kubeconfig only — does not contact any cluster.
        app.MapGet("/api/contexts", (KubeClientFactory factory) => Results.Ok(factory.ListContexts()));

        // Context comes as a query param (not a path segment) because EKS context
        // names are full ARNs containing '/' and ':'.
        app.MapGet("/api/namespaces", async (string? context, ClusterReader reader, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(context))
            {
                return Results.BadRequest("A 'context' query parameter is required.");
            }

            try
            {
                return Results.Ok(await reader.ListNamespacesAsync(context, ct));
            }
            catch (ArgumentException ex)
            {
                return Results.BadRequest(ex.Message);
            }
        });

        app.MapGet("/api/pods", async (string? context, string? @namespace, ClusterReader reader, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(context))
            {
                return Results.BadRequest("A 'context' query parameter is required.");
            }
            if (string.IsNullOrWhiteSpace(@namespace))
            {
                return Results.BadRequest("A 'namespace' query parameter is required.");
            }

            try
            {
                return Results.Ok(await reader.ListPodsAsync(context, @namespace, ct));
            }
            catch (ArgumentException ex)
            {
                return Results.BadRequest(ex.Message);
            }
        });

        app.MapGet("/api/metrics", async (string? context, string? @namespace, ClusterReader reader, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(context))
            {
                return Results.BadRequest("A 'context' query parameter is required.");
            }
            if (string.IsNullOrWhiteSpace(@namespace))
            {
                return Results.BadRequest("A 'namespace' query parameter is required.");
            }

            try
            {
                return Results.Ok(await reader.ListPodMetricsAsync(context, @namespace, ct));
            }
            catch (ArgumentException ex)
            {
                return Results.BadRequest(ex.Message);
            }
        });
    }
}
