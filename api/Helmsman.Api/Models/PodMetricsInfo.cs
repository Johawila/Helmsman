namespace Helmsman.Api.Models;

public class PodMetricsInfo
{
    public string Name { get; set; } = "";
    public int CpuMillicores { get; set; }
    public int MemoryMi { get; set; }
}
