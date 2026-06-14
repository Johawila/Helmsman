namespace Helmsman.Api.Models;

/// <summary>
/// A cluster node (not namespaced). Capacity is the node's allocatable CPU/memory; the pressure
/// flags mirror the node conditions kubectl surfaces.
/// </summary>
public class NodeInfo
{
    public string Name { get; set; } = "";
    public string Status { get; set; } = ""; // Ready | NotReady, optionally ",SchedulingDisabled"
    public string Roles { get; set; } = ""; // e.g. control-plane, worker, or <none>
    public string KubeletVersion { get; set; } = "";
    public int CpuMillicores { get; set; }
    public int MemoryMi { get; set; }
    public bool MemoryPressure { get; set; }
    public bool DiskPressure { get; set; }
    public bool PidPressure { get; set; }
    public DateTimeOffset? CreatedAt { get; set; }
}
