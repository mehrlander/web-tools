using System.Text.Json;

namespace WebTools.Desktop;

public record UsagePoint(DateTimeOffset At, double UsedPercent, DateTimeOffset ResetsAt);
public record UsageWindow(string Id, string Label, double UsedPercent, DateTimeOffset ResetsAt,
    double? DurationMinutes, List<string> Models, List<UsagePoint> History);
public record ProviderUsage(string Provider, string Source, string Status, string Notice,
    DateTimeOffset? ObservedAt, List<UsageWindow> Windows);

public static class UsageReader
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    public static List<ProviderUsage> Read(string path)
    {
        try {
            if (new FileInfo(path).Length > 8_000_000) return [];
            using var document = JsonDocument.Parse(File.ReadAllText(path));
            var result = new List<ProviderUsage>();
            foreach (var provider in Activity.Child(document.RootElement, "providers").EnumerateArray().Take(3)) {
                var value = provider.Deserialize<ProviderUsage>(Json);
                if (value is null || value.Provider is not ("codex" or "gemini" or "claude")) continue;
                var windows = (value.Windows ?? []).OfType<UsageWindow>().Where(w => w.Id is { Length: <= 160 } && w.Label is { Length: <= 100 }
                    && double.IsFinite(w.UsedPercent) && w.UsedPercent is >= 0 and <= 100
                    && w.ResetsAt.Year >= 2000).Take(20).Select(w => w with {
                        DurationMinutes = w.DurationMinutes is > 0 and <= 525600 ? w.DurationMinutes : null,
                        Models = (w.Models ?? []).OfType<string>().Take(20).Select(s => s[..Math.Min(s.Length, 100)]).ToList(),
                        History = Sample((w.History ?? []).OfType<UsagePoint>().Where(p => double.IsFinite(p.UsedPercent)
                            && p.UsedPercent is >= 0 and <= 100 && p.ResetsAt == w.ResetsAt).ToList())
                    }).ToList();
                result.Add(value with { Windows = windows });
            }
            return result;
        } catch (Exception ex) when (ex is IOException or JsonException or InvalidOperationException or UnauthorizedAccessException) { return []; }
    }

    private static List<UsagePoint> Sample(List<UsagePoint> points) => points.Count <= 60 ? points
        : Enumerable.Range(0, 60).Select(i => points[(int)Math.Round(i * (points.Count - 1) / 59.0)]).ToList();
}
