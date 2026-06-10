using Helmsman.Api.Models;
using k8s;
using k8s.Models;

namespace Helmsman.Api.Kube;

/// <summary>
/// Read-only queries against a cluster. Builds a client for the chosen context per call and
/// maps Kubernetes objects to framework-free <see cref="Models"/> DTOs before returning, so
/// the rest of the app never sees raw k8s types.
/// </summary>
public class ClusterReader
{
    private readonly KubeClientFactory _factory;

    public ClusterReader(KubeClientFactory factory)
    {
        _factory = factory;
    }

    public async Task<IReadOnlyList<string>> ListNamespacesAsync(string context, CancellationToken ct)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(context);

        using IKubernetes client = _factory.CreateClient(context);
        V1NamespaceList namespaces = await client.CoreV1.ListNamespaceAsync(cancellationToken: ct);
        return namespaces.Items
            .Select(ns => ns.Metadata.Name)
            .OrderBy(name => name, StringComparer.Ordinal)
            .ToList();
    }

    public async Task<IReadOnlyList<PodInfo>> ListPodsAsync(string context, string @namespace, CancellationToken ct)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(context);
        ArgumentException.ThrowIfNullOrWhiteSpace(@namespace);

        using IKubernetes client = _factory.CreateClient(context);
        V1PodList pods = await client.CoreV1.ListNamespacedPodAsync(@namespace, cancellationToken: ct);
        return pods.Items
            .Select(ToPodInfo)
            .OrderBy(pod => pod.Name, StringComparer.Ordinal)
            .ToList();
    }

    private static PodInfo ToPodInfo(V1Pod pod)
    {
        IList<V1ContainerStatus> statuses = pod.Status?.ContainerStatuses ?? [];
        int total = statuses.Count > 0 ? statuses.Count : pod.Spec?.Containers?.Count ?? 0;

        return new PodInfo
        {
            Name = pod.Metadata.Name,
            Phase = pod.Status?.Phase ?? "Unknown",
            ReadyContainers = statuses.Count(s => s.Ready),
            TotalContainers = total,
            Restarts = statuses.Sum(s => s.RestartCount),
            Node = pod.Spec?.NodeName,
            CreatedAt = pod.Metadata?.CreationTimestamp is { } ts
                ? new DateTimeOffset(ts, TimeSpan.Zero)
                : null,
        };
    }
}
