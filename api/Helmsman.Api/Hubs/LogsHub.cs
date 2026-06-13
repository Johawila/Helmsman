using Helmsman.Api.Kube;
using Microsoft.AspNetCore.SignalR;

namespace Helmsman.Api.Hubs;

public class LogsHub : Hub
{
    private readonly ClusterReader _reader;

    public LogsHub(ClusterReader reader)
    {
        _reader = reader;
    }

    /// <summary>
    /// Server-to-client stream of a pod's log lines (last 500 then follow). SignalR cancels
    /// <paramref name="ct"/> when the client unsubscribes or disconnects, which closes the log stream.
    /// </summary>
    public IAsyncEnumerable<string> StreamLogs(
        string context,
        string @namespace,
        string pod,
        string? container,
        CancellationToken ct)
    {
        return _reader.StreamPodLogAsync(context, @namespace, pod, container, ct);
    }
}
