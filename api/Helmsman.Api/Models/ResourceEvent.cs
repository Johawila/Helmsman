namespace Helmsman.Api.Models;

/// <summary>
/// A message in a live resource stream, generic over the resource DTO (PodInfo, DeploymentInfo, …).
/// - Snapshot: the full current set (on (re)connect and after a watch resync). Replaces client state.
/// - Added / Modified: upsert a single item (keyed by its name).
/// - Deleted: remove a single item by name.
/// </summary>
public class ResourceEvent<T>
{
    public string Type { get; set; } = "";
    public IReadOnlyList<T>? Items { get; set; }
    public T? Item { get; set; }
    public string? Name { get; set; }

    public static ResourceEvent<T> Snapshot(IReadOnlyList<T> items) =>
        new() { Type = "Snapshot", Items = items };

    public static ResourceEvent<T> Upsert(string type, T item) =>
        new() { Type = type, Item = item };

    public static ResourceEvent<T> Deleted(string name) =>
        new() { Type = "Deleted", Name = name };
}
