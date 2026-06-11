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
    /// Streams the live state of pods in a namespace: a full snapshot first, then incremental
    /// add/modify/delete deltas via a Kubernetes watch. If the watch drops (e.g. the server
    /// expires it with 410 Gone), it resyncs by re-listing and emitting a fresh snapshot.
    /// Stops when <paramref name="ct"/> is cancelled (the client unsubscribed or disconnected).
    /// </summary>
    public async IAsyncEnumerable<PodEvent> WatchPodsAsync(
        string context,
        string @namespace,
        [EnumeratorCancellation] CancellationToken ct
    )
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(context);
        ArgumentException.ThrowIfNullOrWhiteSpace(@namespace);

        using IKubernetes client = _factory.CreateClient(context);

        while (!ct.IsCancellationRequested)
        {
            // 1. Snapshot current state and capture the resourceVersion to watch from.
            V1PodList list = await client.CoreV1.ListNamespacedPodAsync(
                @namespace,
                cancellationToken: ct
            );
            yield return PodEvent.Snapshot(
                list.Items.Select(ToPodInfo).OrderBy(p => p.Name, StringComparer.Ordinal).ToList()
            );

            // 2. Watch for changes from that version, yielding deltas until the watch drops.
            Task<HttpOperationResponse<V1PodList>> response =
                client.CoreV1.ListNamespacedPodWithHttpMessagesAsync(
                    @namespace,
                    watch: true,
                    resourceVersion: list.Metadata.ResourceVersion,
                    cancellationToken: ct
                );

            // WatchAsync is marked obsolete in v19, but it is the only IAsyncEnumerable-based
            // watch overload; the suggested replacement is callback-based and doesn't fit a stream.
#pragma warning disable CS0618
            IAsyncEnumerator<(WatchEventType Type, V1Pod Pod)> events = response
                .WatchAsync<V1Pod, V1PodList>(cancellationToken: ct)
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
                        // Watch expired or connection dropped — break out and resync via re-list.
                        break;
                    }

                    if (!moved)
                    {
                        break;
                    }

                    PodEvent? delta = ToDelta(events.Current.Type, events.Current.Pod);
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

    private static PodEvent? ToDelta(WatchEventType type, V1Pod pod) =>
        type switch
        {
            WatchEventType.Added => PodEvent.Upsert("Added", ToPodInfo(pod)),
            WatchEventType.Modified => PodEvent.Upsert("Modified", ToPodInfo(pod)),
            WatchEventType.Deleted => PodEvent.Deleted(pod.Metadata.Name),
            _ => null,
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
