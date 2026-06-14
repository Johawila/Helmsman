namespace Helmsman.Api.Models;

public class PodInfo
{
    public string Name { get; set; } = "";

    /// <summary>Owning namespace. Populated for cross-namespace listings (e.g. pods on a node).</summary>
    public string Namespace { get; set; } = "";

    /// <summary>Raw pod phase (Pending/Running/Succeeded/Failed/Unknown).</summary>
    public string Phase { get; set; } = "";

    /// <summary>
    /// Human-facing status derived kubectl-style from container states — surfaces CrashLoopBackOff,
    /// ImagePullBackOff, OOMKilled, Terminating, Completed, Unschedulable, etc. A pod can read
    /// Running here yet be CrashLoopBackOff, so this (not Phase) drives health classification.
    /// </summary>
    public string Status { get; set; } = "";
    public int ReadyContainers { get; set; }
    public int TotalContainers { get; set; }
    public int Restarts { get; set; }
    public string? Node { get; set; }
    public DateTimeOffset? CreatedAt { get; set; }
}
