namespace Helmsman.Api.Models;

/// <summary>
/// A Kubernetes event, flattened for the UI. Surfaces why things happen — scheduling failures,
/// image pull errors, crash back-offs, OOM kills. <see cref="Message"/> is cluster-originated
/// content and may contain sensitive data: stream it to the client, but never log it server-side.
/// </summary>
public class EventInfo
{
    /// <summary>Event object name — a generated, unique key used to dedupe in the live stream.</summary>
    public string Name { get; set; } = "";
    public string Type { get; set; } = ""; // Normal | Warning
    public string Reason { get; set; } = "";
    public string Message { get; set; } = "";
    public string ObjectKind { get; set; } = "";
    public string ObjectName { get; set; } = "";
    public int Count { get; set; }
    public DateTimeOffset? LastSeen { get; set; }
}
