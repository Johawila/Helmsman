using System.Text.Json;

namespace Helmsman.Api.Charts;

/// <summary>
/// Best-effort "latest chart version" lookups against Artifact Hub. Only the public chart name is
/// sent. Helm doesn't persist a release's source repo, so we search by name and accept an exact
/// name match only — ambiguous/private/renamed charts simply return null rather than a wrong guess.
/// </summary>
public class ArtifactHubClient
{
    private readonly HttpClient _http;

    public ArtifactHubClient(HttpClient http)
    {
        _http = http;
    }

    /// <summary>Latest version for a chart name, or null if not confidently matched/unavailable.</summary>
    public async Task<string?> GetLatestVersionAsync(string chart, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(chart))
        {
            return null;
        }

        // Bound the external call so a slow/unreachable Artifact Hub never stalls the response.
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(TimeSpan.FromSeconds(4));

        try
        {
            string url = $"https://artifacthub.io/api/v1/packages/search?kind=0&limit=15&ts_query_web={Uri.EscapeDataString(chart)}";
            using HttpResponseMessage response = await _http.GetAsync(url, timeout.Token);
            if (!response.IsSuccessStatusCode)
            {
                return null;
            }

            await using Stream body = await response.Content.ReadAsStreamAsync(timeout.Token);
            using JsonDocument doc = await JsonDocument.ParseAsync(body, cancellationToken: timeout.Token);

            if (!doc.RootElement.TryGetProperty("packages", out JsonElement packages)
                || packages.ValueKind != JsonValueKind.Array)
            {
                return null;
            }

            foreach (JsonElement pkg in packages.EnumerateArray())
            {
                string? name = pkg.TryGetProperty("name", out JsonElement n) ? n.GetString() : null;
                if (string.Equals(name, chart, StringComparison.OrdinalIgnoreCase)
                    && pkg.TryGetProperty("version", out JsonElement v))
                {
                    return v.GetString();
                }
            }
        }
        catch
        {
            // Best-effort only — network/parse failures just mean "unknown".
        }

        return null;
    }
}
