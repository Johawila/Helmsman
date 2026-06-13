namespace Helmsman.Api.Models;

public class JobInfo
{
    public string Name { get; set; } = "";
    public int Completions { get; set; }
    public int Succeeded { get; set; }
    public int Failed { get; set; }
    public bool Complete { get; set; }
    public string? Image { get; set; }
    public DateTimeOffset? CreatedAt { get; set; }
}
