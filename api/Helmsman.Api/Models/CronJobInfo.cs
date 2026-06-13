namespace Helmsman.Api.Models;

public class CronJobInfo
{
    public string Name { get; set; } = "";
    public string Schedule { get; set; } = "";
    public bool Suspended { get; set; }
    public int Active { get; set; }
    public DateTimeOffset? LastSchedule { get; set; }
    public DateTimeOffset? CreatedAt { get; set; }
}
