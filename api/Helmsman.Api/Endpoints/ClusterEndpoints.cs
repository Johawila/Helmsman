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

        // Resolves a workload (Deployment/StatefulSet/DaemonSet/Job) to a representative pod so
        // its logs can be streamed. Returns { pod: null } when there's no matching pod.
        app.MapGet("/api/resolve-pod", async (string? context, string? @namespace, string? kind, string? name, ClusterReader reader, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(context) || string.IsNullOrWhiteSpace(@namespace)
                || string.IsNullOrWhiteSpace(kind) || string.IsNullOrWhiteSpace(name))
            {
                return Results.BadRequest("context, namespace, kind and name query parameters are required.");
            }

            try
            {
                string? pod = await reader.ResolvePodAsync(context, @namespace, kind, name, ct);
                return Results.Ok(new { pod });
            }
            catch (ArgumentException ex)
            {
                return Results.BadRequest(ex.Message);
            }
        });
    }
}
