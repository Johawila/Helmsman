namespace Helmsman.Api.Charts;

/// <summary>
/// Minimal semver comparison for chart versions — enough to decide "is latest newer than installed".
/// Compares the numeric major.minor.patch only; a leading 'v' is tolerated and pre-release/build
/// suffixes are ignored. Returns false when either side can't be parsed (best-effort, no false alarms).
/// </summary>
public static class ChartVersion
{
    public static bool IsNewer(string installed, string? latest)
    {
        if (string.IsNullOrWhiteSpace(latest))
        {
            return false;
        }

        if (!TryParse(installed, out (int Major, int Minor, int Patch) a)
            || !TryParse(latest, out (int Major, int Minor, int Patch) b))
        {
            return false;
        }

        if (b.Major != a.Major) return b.Major > a.Major;
        if (b.Minor != a.Minor) return b.Minor > a.Minor;
        return b.Patch > a.Patch;
    }

    private static bool TryParse(string version, out (int Major, int Minor, int Patch) parsed)
    {
        parsed = default;
        if (string.IsNullOrWhiteSpace(version))
        {
            return false;
        }

        string v = version.Trim().TrimStart('v', 'V');
        // Drop any pre-release/build metadata: 1.2.3-rc1+meta -> 1.2.3
        int cut = v.IndexOfAny(['-', '+']);
        if (cut >= 0)
        {
            v = v[..cut];
        }

        string[] parts = v.Split('.');
        if (parts.Length == 0)
        {
            return false;
        }

        int Part(int i) => i < parts.Length && int.TryParse(parts[i], out int n) ? n : 0;
        if (!int.TryParse(parts[0], out _))
        {
            return false;
        }

        parsed = (Part(0), Part(1), Part(2));
        return true;
    }
}
