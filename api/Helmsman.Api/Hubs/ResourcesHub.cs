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

    public IAsyncEnumerable<ResourceEvent<PodInfo>> StreamPods(
        string context,
        string @namespace,
        CancellationToken ct)
    {
        return _reader.WatchPodsAsync(context, @namespace, ct);
    }

    public IAsyncEnumerable<ResourceEvent<DeploymentInfo>> StreamDeployments(
        string context,
        string @namespace,
        CancellationToken ct)
    {
        return _reader.WatchDeploymentsAsync(context, @namespace, ct);
    }
}
