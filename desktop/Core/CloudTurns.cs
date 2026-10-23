using System.Text.Json;
using System.Text.RegularExpressions;

namespace WebTools.Desktop;

// Published records describe outcomes. Only explicit hook signals describe a turn.
public static class CloudTurns
{
    public static CloudSnapshot Merge(CloudSnapshot records, IEnumerable<KeyValuePair<string, string>> signals, DateTimeOffset now)
    {
        var items = records.Items.ToDictionary(s => s.Id);
        var latest = new Dictionary<string, LocalSession>();
        foreach (var (path, json) in signals) {
            try {
                using var doc = JsonDocument.Parse(json);
                var row = doc.RootElement;
                var id = Activity.Text(row, "id");
                if (Activity.Child(row, "schemaVersion").GetInt32() != 1 || !Regex.IsMatch(id, "^[a-f0-9]{8}$")
                    || Activity.Text(row, "provider") != "Claude" || Activity.Text(row, "location") != "Cloud") continue;
                var at = Activity.Date(row, "updatedAt");
                var start = Activity.Date(row, "startedAt");
                if (start.Year < 2000 || at < start || at > now.AddMinutes(1) || at < now.AddDays(-1)
                    || path != $"sessions/activity/{at:yyyy-MM-dd}/{id}.json") continue;
                var source = Activity.Text(row, "agent");
                if (!Uri.TryCreate(source, UriKind.Absolute, out var uri) || uri.Scheme != "https" || uri.Host != "claude.ai"
                    || !uri.IsDefaultPort || uri.UserInfo.Length > 0 || uri.Query.Length > 0 || uri.Fragment.Length > 0
                    || !Regex.IsMatch(uri.AbsolutePath, "^/code/session_[A-Za-z0-9_-]+$")) continue;
                var state = Activity.Text(row, "state");
                if (state is not ("working" or "idle" or "interrupted" or "ended")) continue;
                var quiet = state == "working" && now - at > TimeSpan.FromMinutes(3);
                var tool = Activity.Text(row, "lastTool");
                if (!Regex.IsMatch(tool, "^[A-Za-z0-9_]{1,80}$")) tool = "";
                string Clip(string name, int max) { var s = Activity.Text(row, name); return s[..Math.Min(s.Length, max)]; }
                var prompt = Clip("prompt", 2000);
                var title = Clip("title", 180);
                if (string.IsNullOrWhiteSpace(title)) title = prompt.Split('\n')[0];
                if (string.IsNullOrWhiteSpace(title)) title = "Claude cloud turn";
                title = title[..Math.Min(title.Length, 180)];
                var detail = quiet ? "Turn has no recent activity report"
                    : state == "working" ? tool.Length > 0 ? "Using " + tool : "Prompt received"
                    : state == "interrupted" ? "Turn stopped with an error"
                    : state == "ended" ? "Cloud session ended" : "Response recorded";
                var item = new LocalSession(id, "Claude", title, quiet ? "quiet" : state == "ended" ? "idle" : state,
                    at, "", detail, "Cloud", Turn: new(prompt, Clip("response", 4000), start, at, tool));
                if (!latest.TryGetValue(id, out var previous) || previous.UpdatedAt < at) latest[id] = item;
            } catch (Exception e) when (e is JsonException or InvalidOperationException or FormatException) { }
        }
        foreach (var (id, signal) in latest) {
            if (items.TryGetValue(id, out var record)) {
                // A later recorded response supersedes a delayed start/tool publication.
                if (record.UpdatedAt > signal.UpdatedAt) {
                    items[id] = record with { Turn = signal.Turn };
                    continue;
                }
                items[id] = signal with { Title = record.Title, Checkpoint = record.Checkpoint };
            } else items[id] = signal;
        }
        return records with { Items = items.Values.OrderByDescending(s => s.UpdatedAt).Take(40).ToList() };
    }
}
