using Helmsman.Api.Kube;
using Helmsman.Api.Models;
using Microsoft.AspNetCore.SignalR;

namespace Helmsman.Api.Hubs;

public class PodsHub : Hub
{
    private readonly ClusterReader _reader;

    public PodsHub(ClusterReader reader)
    {
        _reader = reader;
    }

    /// <summary>
    /// Server-to-client stream of live pod events for a namespace. SignalR cancels
    /// <paramref name="ct"/> when the client unsubscribes or disconnects, which stops the
    /// underlying Kubernetes watch.
    /// </summary>
    public IAsyncEnumerable<PodEvent> StreamPods(
        string context,
        string @namespace,
        CancellationToken ct
    )
    {
        return _reader.WatchPodsAsync(context, @namespace, ct);
    }
}
