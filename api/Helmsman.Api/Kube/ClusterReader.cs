using System.Runtime.CompilerServices;
using Helmsman.Api.Models;
using k8s;
using k8s.Autorest;
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

    public async Task<IReadOnlyList<string>> ListNamespacesAsync(
        string context,
        CancellationToken ct
    )
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(context);

        using IKubernetes client = _factory.CreateClient(context);
        V1NamespaceList namespaces = await client.CoreV1.ListNamespaceAsync(cancellationToken: ct);
        return namespaces
            .Items.Select(ns => ns.Metadata.Name)
            .OrderBy(name => name, StringComparer.Ordinal)
            .ToList();
    }

    public async Task<IReadOnlyList<PodInfo>> ListPodsAsync(
        string context,
        string @namespace,
        CancellationToken ct
    )
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(context);
        ArgumentException.ThrowIfNullOrWhiteSpace(@namespace);

        using IKubernetes client = _factory.CreateClient(context);
        V1PodList pods = await client.CoreV1.ListNamespacedPodAsync(
            @namespace,
            cancellationToken: ct
        );
        return pods
            .Items.Select(ToPodInfo)
            .OrderBy(pod => pod.Name, StringComparer.Ordinal)
            .ToList();
    }

    /// <summary>
    /// Current CPU/memory usage per pod from metrics-server (metrics.k8s.io). Polled, not watched —
    /// the metrics API has no watch. Pods without samples (e.g. just-started or completed) are omitted.
    /// </summary>
    public async Task<IReadOnlyList<PodMetricsInfo>> ListPodMetricsAsync(
        string context,
        string @namespace,
        CancellationToken ct)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(context);
        ArgumentException.ThrowIfNullOrWhiteSpace(@namespace);
        ct.ThrowIfCancellationRequested();

        using IKubernetes client = _factory.CreateClient(context);
        PodMetricsList metrics = await client.GetKubernetesPodsMetricsByNamespaceAsync(@namespace);
        return metrics.Items
            .Select(ToMetricsInfo)
            .OrderBy(m => m.Name, StringComparer.Ordinal)
            .ToList();
    }

    private static PodMetricsInfo ToMetricsInfo(PodMetrics metrics)
    {
        decimal cores = 0m;
        decimal bytes = 0m;
        foreach (ContainerMetrics container in metrics.Containers ?? [])
        {
            if (container.Usage.TryGetValue("cpu", out ResourceQuantity? cpu))
            {
                cores += cpu.ToDecimal();
            }
            if (container.Usage.TryGetValue("memory", out ResourceQuantity? memory))
            {
                bytes += memory.ToDecimal();
            }
        }

        return new PodMetricsInfo
        {
            Name = metrics.Metadata.Name,
            CpuMillicores = (int)Math.Round(cores * 1000m),
            MemoryMi = (int)Math.Round(bytes / (1024m * 1024m)),
        };
    }

    /// <summary>
    /// Live stream of pods in a namespace — snapshot then add/modify/delete deltas. See
    /// <see cref="WatchResourceAsync{TItem,TList,TInfo}"/> for the watch/resync mechanics.
    /// </summary>
    public async IAsyncEnumerable<ResourceEvent<PodInfo>> WatchPodsAsync(
        string context,
        string @namespace,
        [EnumeratorCancellation] CancellationToken ct)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(context);
        ArgumentException.ThrowIfNullOrWhiteSpace(@namespace);

        using IKubernetes client = _factory.CreateClient(context);
        IAsyncEnumerable<ResourceEvent<PodInfo>> stream = WatchResourceAsync<V1Pod, V1PodList, PodInfo>(
            c => client.CoreV1.ListNamespacedPodAsync(@namespace, cancellationToken: c),
            rv => client.CoreV1.ListNamespacedPodWithHttpMessagesAsync(
                @namespace, watch: true, resourceVersion: rv, cancellationToken: ct),
            ToPodInfo,
            pod => pod.Metadata.Name,
            ct);
        await foreach (ResourceEvent<PodInfo> e in stream)
        {
            yield return e;
        }
    }

    /// <summary>
    /// Live stream of deployments in a namespace — snapshot then add/modify/delete deltas.
    /// </summary>
    public async IAsyncEnumerable<ResourceEvent<DeploymentInfo>> WatchDeploymentsAsync(
        string context,
        string @namespace,
        [EnumeratorCancellation] CancellationToken ct)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(context);
        ArgumentException.ThrowIfNullOrWhiteSpace(@namespace);

        using IKubernetes client = _factory.CreateClient(context);
        IAsyncEnumerable<ResourceEvent<DeploymentInfo>> stream =
            WatchResourceAsync<V1Deployment, V1DeploymentList, DeploymentInfo>(
                c => client.AppsV1.ListNamespacedDeploymentAsync(@namespace, cancellationToken: c),
                rv => client.AppsV1.ListNamespacedDeploymentWithHttpMessagesAsync(
                    @namespace, watch: true, resourceVersion: rv, cancellationToken: ct),
                ToDeploymentInfo,
                deployment => deployment.Metadata.Name,
                ct);
        await foreach (ResourceEvent<DeploymentInfo> e in stream)
        {
            yield return e;
        }
    }

    /// <summary>
    /// Generic list+watch loop shared by all resource kinds: emit a snapshot, watch from its
    /// resourceVersion, yield deltas, and resync (re-list → fresh snapshot) when the watch drops
    /// or the server expires it (410 Gone). Stops when <paramref name="ct"/> is cancelled.
    /// </summary>
    private static async IAsyncEnumerable<ResourceEvent<TInfo>> WatchResourceAsync<TItem, TList, TInfo>(
        Func<CancellationToken, Task<TList>> listAsync,
        Func<string, Task<HttpOperationResponse<TList>>> watchFrom,
        Func<TItem, TInfo> map,
        Func<TItem, string> nameOf,
        [EnumeratorCancellation] CancellationToken ct)
        where TItem : IKubernetesObject<V1ObjectMeta>
        where TList : IKubernetesObject<V1ListMeta>, IItems<TItem>
    {
        while (!ct.IsCancellationRequested)
        {
            TList list = await listAsync(ct);
            yield return ResourceEvent<TInfo>.Snapshot(
                list.Items.OrderBy(nameOf, StringComparer.Ordinal).Select(map).ToList());

            // WatchAsync is marked obsolete in v19, but it is the only IAsyncEnumerable-based
            // watch overload; the suggested replacement is callback-based and doesn't fit a stream.
#pragma warning disable CS0618
            IAsyncEnumerator<(WatchEventType Type, TItem Item)> events = watchFrom(list.Metadata.ResourceVersion)
                .WatchAsync<TItem, TList>(cancellationToken: ct)
                .GetAsyncEnumerator(ct);
#pragma warning restore CS0618
            try
            {
                while (true)
                {
                    bool moved;
                    try
                    {
                        moved = await events.MoveNextAsync();
                    }
                    catch (OperationCanceledException)
                    {
                        yield break;
                    }
                    catch
                    {
                        break; // watch expired / dropped — resync via re-list
                    }

                    if (!moved)
                    {
                        break;
                    }

                    (WatchEventType type, TItem item) = events.Current;
                    ResourceEvent<TInfo>? delta = type switch
                    {
                        WatchEventType.Added => ResourceEvent<TInfo>.Upsert("Added", map(item)),
                        WatchEventType.Modified => ResourceEvent<TInfo>.Upsert("Modified", map(item)),
                        WatchEventType.Deleted => ResourceEvent<TInfo>.Deleted(nameOf(item)),
                        _ => null,
                    };
                    if (delta is not null)
                    {
                        yield return delta;
                    }
                }
            }
            finally
            {
                await events.DisposeAsync();
            }
        }
    }

    /// <summary>
    /// Streams a pod's logs line by line, following new output until the client disconnects
    /// (<paramref name="ct"/> cancelled) or the pod stops producing logs. Starts with the last
    /// 500 lines. If <paramref name="container"/> is null, the pod's first container is used.
    /// </summary>
    public async IAsyncEnumerable<string> StreamPodLogAsync(
        string context,
        string @namespace,
        string pod,
        string? container,
        [EnumeratorCancellation] CancellationToken ct)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(context);
        ArgumentException.ThrowIfNullOrWhiteSpace(@namespace);
        ArgumentException.ThrowIfNullOrWhiteSpace(pod);

        using IKubernetes client = _factory.CreateClient(context);

        string? containerName = container;
        if (string.IsNullOrWhiteSpace(containerName))
        {
            V1Pod target = await client.CoreV1.ReadNamespacedPodAsync(pod, @namespace, cancellationToken: ct);
            containerName = target.Spec?.Containers?.FirstOrDefault()?.Name;
        }

        using HttpOperationResponse<Stream> response =
            await client.CoreV1.ReadNamespacedPodLogWithHttpMessagesAsync(
                pod, @namespace, container: containerName, follow: true, tailLines: 500, cancellationToken: ct);
        using StreamReader reader = new(response.Body);

        while (!ct.IsCancellationRequested)
        {
            string? line;
            try
            {
                line = await reader.ReadLineAsync(ct);
            }
            catch (OperationCanceledException)
            {
                yield break;
            }

            if (line is null)
            {
                yield break;
            }

            yield return line;
        }
    }

    private static DeploymentInfo ToDeploymentInfo(V1Deployment deployment) =>
        new()
        {
            Name = deployment.Metadata.Name,
            DesiredReplicas = deployment.Spec?.Replicas ?? 0,
            ReadyReplicas = deployment.Status?.ReadyReplicas ?? 0,
            UpToDateReplicas = deployment.Status?.UpdatedReplicas ?? 0,
            AvailableReplicas = deployment.Status?.AvailableReplicas ?? 0,
            Image = deployment.Spec?.Template?.Spec?.Containers?.FirstOrDefault()?.Image,
            CreatedAt = deployment.Metadata?.CreationTimestamp is { } ts
                ? new DateTimeOffset(ts, TimeSpan.Zero)
                : null,
        };

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
