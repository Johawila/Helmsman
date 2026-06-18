namespace Helmsman.Api.Models;

/// <summary>
/// An installed Helm release, decoded from its <c>helm.sh/release.v1</c> Secret. Only chart
/// metadata is surfaced — never the release's user values or rendered manifest, which can contain
/// secrets. <see cref="LatestVersion"/> is a best-effort Artifact Hub lookup and may be null.
/// </summary>
public class HelmReleaseInfo
{
    public string Name { get; set; } = "";
    public string Namespace { get; set; } = "";
    public string Chart { get; set; } = "";
    public string ChartVersion { get; set; } = "";
    public string AppVersion { get; set; } = "";
    public int Revision { get; set; }
    public string Status { get; set; } = "";
    public DateTimeOffset? Updated { get; set; }

    /// <summary>Latest chart version known to Artifact Hub, or null when unknown/unmatched.</summary>
    public string? LatestVersion { get; set; }
    public bool UpdateAvailable { get; set; }
}
