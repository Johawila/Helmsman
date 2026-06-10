namespace Helmsman.Api.Models;

public class PodInfo
{
    public string Name { get; set; } = "";
    public string Phase { get; set; } = "";
    public int ReadyContainers { get; set; }
    public int TotalContainers { get; set; }
    public int Restarts { get; set; }
    public string? Node { get; set; }
    public DateTimeOffset? CreatedAt { get; set; }
}
