namespace Helmsman.Api.Models;

/// <summary>
/// A replica-style workload (Deployment, StatefulSet, DaemonSet). For DaemonSets the replica
/// fields map onto the scheduling counts (desired/ready/up-to-date/available scheduled).
/// </summary>
public class WorkloadInfo
{
    public string Name { get; set; } = "";
    public int Desired { get; set; }
    public int Ready { get; set; }
    public int UpToDate { get; set; }
    public int Available { get; set; }
    public string? Image { get; set; }
    public DateTimeOffset? CreatedAt { get; set; }
}
