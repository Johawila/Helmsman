namespace Helmsman.Api.Models;

/// <summary>
/// Read-only "describe" of a single resource: identifying metadata, status conditions, container
/// images, and the events Kubernetes has recorded for it. Assembled from a single object read plus
/// an events query. Event messages are cluster content — streamed to the client, never logged.
/// </summary>
public class ResourceDetail
{
    public string Kind { get; set; } = "";
    public string Name { get; set; } = "";
    public string Namespace { get; set; } = "";
    public Dictionary<string, string> Labels { get; set; } = [];
    public List<ConditionInfo> Conditions { get; set; } = [];
    public List<string> Images { get; set; } = [];
    public DateTimeOffset? CreatedAt { get; set; }
    public List<EventInfo> Events { get; set; } = [];
}

public class ConditionInfo
{
    public string Type { get; set; } = "";
    public string Status { get; set; } = "";
    public string Reason { get; set; } = "";
    public string Message { get; set; } = "";
    public DateTimeOffset? LastTransition { get; set; }
}
