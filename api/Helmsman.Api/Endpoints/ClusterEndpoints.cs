using Helmsman.Api.Charts;
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

        // Pods scheduled on a node (across namespaces), so the Nodes view can drill into pod logs.
        app.MapGet("/api/node-pods", async (string? context, string? node, ClusterReader reader, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(context))
            {
                return Results.BadRequest("A 'context' query parameter is required.");
            }
            if (string.IsNullOrWhiteSpace(node))
            {
                return Results.BadRequest("A 'node' query parameter is required.");
            }

            try
            {
                return Results.Ok(await reader.ListPodsOnNodeAsync(context, node, ct));
            }
            catch (ArgumentException ex)
            {
                return Results.BadRequest(ex.Message);
            }
        });

        // Installed Helm releases in a namespace, with a best-effort Artifact Hub "latest version".
        app.MapGet("/api/helm-releases", async (string? context, string? @namespace, ClusterReader reader, ArtifactHubClient hub, CancellationToken ct) =>
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
                var releases = await reader.ListHelmReleasesAsync(context, @namespace, ct);

                // One Artifact Hub lookup per distinct chart, run concurrently.
                var charts = releases.Select(r => r.Chart).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
                var lookups = await Task.WhenAll(charts.Select(async chart =>
                    (chart, latest: await hub.GetLatestVersionAsync(chart, ct))));
                var latestByChart = lookups.ToDictionary(x => x.chart, x => x.latest, StringComparer.OrdinalIgnoreCase);

                foreach (var release in releases)
                {
                    string? latest = latestByChart.GetValueOrDefault(release.Chart);
                    release.LatestVersion = latest;
                    release.UpdateAvailable = ChartVersion.IsNewer(release.ChartVersion, latest);
                }

                return Results.Ok(releases);
            }
            catch (ArgumentException ex)
            {
                return Results.BadRequest(ex.Message);
            }
        });

        // Read-only describe of a single resource: labels, conditions, images, recent events.
        app.MapGet("/api/describe", async (string? context, string? @namespace, string? kind, string? name, ClusterReader reader, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(context) || string.IsNullOrWhiteSpace(@namespace)
                || string.IsNullOrWhiteSpace(kind) || string.IsNullOrWhiteSpace(name))
            {
                return Results.BadRequest("context, namespace, kind and name query parameters are required.");
            }

            try
            {
                return Results.Ok(await reader.DescribeAsync(context, @namespace, kind, name, ct));
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
