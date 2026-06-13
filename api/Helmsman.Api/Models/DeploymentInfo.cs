namespace Helmsman.Api.Models;

public class DeploymentInfo
{
    public string Name { get; set; } = "";
    public int DesiredReplicas { get; set; }
    public int ReadyReplicas { get; set; }
    public int UpToDateReplicas { get; set; }
    public int AvailableReplicas { get; set; }
    public string? Image { get; set; }
    public DateTimeOffset? CreatedAt { get; set; }
}
