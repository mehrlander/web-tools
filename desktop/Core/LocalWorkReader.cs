using System.Text.Json;

namespace WebTools.Desktop;

// Summaries enrich observations. Model text never establishes execution state,
// changes a source timestamp, or turns a local session into a cloud session.
public static class LocalWorkReader
{
    public static SessionSnapshot Join(SessionSnapshot snapshot, string path, DateTimeOffset now)
    {
        try {
            if (!File.Exists(path) || new FileInfo(path).Length > 2 * 1024 * 1024) return snapshot;
            using var doc = JsonDocument.Parse(File.ReadAllText(path));
            var root = doc.RootElement;
            if (Activity.Child(root, "schema").GetInt32() != 1 || Activity.Child(root, "items").ValueKind != JsonValueKind.Array) return snapshot;
            var work = new Dictionary<string, LocalWork>();
            foreach (var row in root.GetProperty("items").EnumerateArray().Take(64)) {
                var provider = Activity.Text(row, "provider");
                var id = Activity.Text(row, "id");
                var through = Activity.Date(row, "through");
                if (provider is not ("Codex" or "Gemini") || !Activity.ValidId(id)
                    || through > now.AddMinutes(1) || now - through > TimeSpan.FromDays(1)) continue;
                var agents = Activity.Child(row, "agents");
                var count = agents.ValueKind == JsonValueKind.Number && agents.TryGetInt32(out var n) ? Math.Clamp(n, 0, 32) : 0;
                var segments = new List<WorkSegment>();
                var rows = Activity.Child(row, "segments");
                foreach (var item in rows.ValueKind == JsonValueKind.Array ? rows.EnumerateArray().Take(6) : []) {
                    var at = Activity.Date(item, "at");
                    var generated = Activity.Date(item, "generatedAt");
                    var headline = Safe(Activity.Text(item, "headline"), 60);
                    var summary = Safe(Activity.Text(item, "summary"), 180);
                    var key = Activity.Text(item, "id");
                    if (!Activity.ValidId(key) || headline.Length == 0 || summary.Length == 0 || at.Year < 2000
                        || at > through.AddMinutes(1) || generated < at.AddMinutes(-1) || generated > now.AddMinutes(1)) continue;
                    var evidence = Activity.Child(item, "evidence");
                    segments.Add(new(key, headline, summary, at, generated,
                        evidence.ValueKind == JsonValueKind.Array ? evidence.EnumerateArray().Where(e => e.ValueKind == JsonValueKind.String)
                            .Select(e => Safe(e.GetString() ?? "", 80)).Where(e => e.Length > 0).Take(4).ToList() : []));
                }
                work[provider + ":" + id] = new(through, count, segments);
            }
            return snapshot with { Items = snapshot.Items.Select(s => work.TryGetValue(s.Provider + ":" + s.Id, out var value)
                ? s with { Work = value with { Members = s.Work?.Members, Agents = Math.Max(value.Agents, s.Work?.Agents ?? 0) } } : s).ToList() };
        } catch (Exception ex) when (ex is IOException or JsonException or InvalidOperationException or FormatException or UnauthorizedAccessException) {
            return snapshot;
        }
    }

    private static string Safe(string text, int most) => text.Length <= most && !text.Any(char.IsControl)
        && !text.Contains(":\\") && !text.Contains("/Users/") && !text.Contains("/home/")
        && !text.Contains("http", StringComparison.OrdinalIgnoreCase) ? text : "";
}
