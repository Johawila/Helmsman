namespace Helmsman.Api.Models;

/// <summary>
/// A single message in the live pod stream.
/// - Snapshot: the full current set (sent on (re)connect and after a watch resync). Replaces client state.
/// - Added / Modified: upsert a single pod by name.
/// - Deleted: remove a single pod by name.
/// </summary>
public class PodEvent
{
    public string Type { get; set; } = "";
    public IReadOnlyList<PodInfo>? Pods { get; set; }
    public PodInfo? Pod { get; set; }
    public string? Name { get; set; }

    public static PodEvent Snapshot(IReadOnlyList<PodInfo> pods) =>
        new() { Type = "Snapshot", Pods = pods };

    public static PodEvent Upsert(string type, PodInfo pod) => new() { Type = type, Pod = pod };

    public static PodEvent Deleted(string name) => new() { Type = "Deleted", Name = name };
}
