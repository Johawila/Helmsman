using Helmsman.Api.Kube;
using Helmsman.Api.Models;
using Microsoft.AspNetCore.SignalR;

namespace Helmsman.Api.Hubs;

/// <summary>
/// Live streams of namespaced resources. Each method returns an IAsyncEnumerable that SignalR
/// pumps to the caller; the supplied CancellationToken is tripped when the client unsubscribes
/// or disconnects, which stops the underlying Kubernetes watch.
/// </summary>
public class ResourcesHub : Hub
{
    private readonly ClusterReader _reader;

    public ResourcesHub(ClusterReader reader)
    {
        _reader = reader;
    }

    public IAsyncEnumerable<ResourceEvent<PodInfo>> StreamPods(string context, string @namespace, CancellationToken ct) =>
        _reader.WatchPodsAsync(context, @namespace, ct);

    public IAsyncEnumerable<ResourceEvent<WorkloadInfo>> StreamDeployments(string context, string @namespace, CancellationToken ct) =>
        _reader.WatchDeploymentsAsync(context, @namespace, ct);

    public IAsyncEnumerable<ResourceEvent<WorkloadInfo>> StreamStatefulSets(string context, string @namespace, CancellationToken ct) =>
        _reader.WatchStatefulSetsAsync(context, @namespace, ct);

    public IAsyncEnumerable<ResourceEvent<WorkloadInfo>> StreamDaemonSets(string context, string @namespace, CancellationToken ct) =>
        _reader.WatchDaemonSetsAsync(context, @namespace, ct);

    public IAsyncEnumerable<ResourceEvent<JobInfo>> StreamJobs(string context, string @namespace, CancellationToken ct) =>
        _reader.WatchJobsAsync(context, @namespace, ct);

    public IAsyncEnumerable<ResourceEvent<CronJobInfo>> StreamCronJobs(string context, string @namespace, CancellationToken ct) =>
        _reader.WatchCronJobsAsync(context, @namespace, ct);

    public IAsyncEnumerable<ResourceEvent<EventInfo>> StreamEvents(string context, string @namespace, CancellationToken ct) =>
        _reader.WatchEventsAsync(context, @namespace, ct);

    // Nodes are cluster-scoped; the namespace argument is accepted for a uniform client API and ignored.
    public IAsyncEnumerable<ResourceEvent<NodeInfo>> StreamNodes(string context, string @namespace, CancellationToken ct) =>
        _reader.WatchNodesAsync(context, ct);
}
