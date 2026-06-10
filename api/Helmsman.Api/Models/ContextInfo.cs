namespace Helmsman.Api.Models;

public class ContextInfo
{
    public string Name { get; set; } = "";
    public string Cluster { get; set; } = "";
    public string? Namespace { get; set; }
    public bool IsCurrent { get; set; }
}
