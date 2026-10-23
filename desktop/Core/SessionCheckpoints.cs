using System.Text.Json;
using System.Text.RegularExpressions;

namespace WebTools.Desktop;

public static class SessionCheckpoints
{
    private static IEnumerable<JsonElement> Array(JsonElement node, string key) =>
        Activity.Child(node, key).ValueKind == JsonValueKind.Array ? Activity.Child(node, key).EnumerateArray() : [];
    private static string Text(JsonElement node, string key, int limit) => Activity.Text(node, key) is var text
        && text.Length > limit ? text[..limit] + "…" : text;
    private static int Count(JsonElement node, string key) => Array(node, key).Count();

    public static Dictionary<string, string> Paths(string rollup, IEnumerable<LocalSession> sessions)
    {
        using var doc = JsonDocument.Parse(rollup);
        var index = Activity.Child(doc.RootElement, "sessions");
        var paths = new Dictionary<string, string>();
        foreach (var session in sessions) {
            var entry = Activity.Child(index, session.Id);
            var path = Activity.Text(entry, "path");
            if (Regex.IsMatch(path, @"^sessions/topics/20\d{2}/\d{2}/20\d{2}-\d{2}-\d{2}-[a-zA-Z0-9.-]+\.json$")
                && path.EndsWith("-" + session.Id + ".json", StringComparison.Ordinal)) paths[session.Id] = path;
        }
        return paths;
    }

    public static CloudSnapshot Enrich(CloudSnapshot cloud, string rollup, IReadOnlyDictionary<string, string> companions)
    {
        using var doc = JsonDocument.Parse(rollup);
        var index = Activity.Child(doc.RootElement, "sessions");
        var items = cloud.Items.Select(session => {
            var entry = Activity.Child(index, session.Id);
            if (entry.ValueKind != JsonValueKind.Object) return session;
            var at = Activity.Date(entry, "source_ended");
            if (at.Year < 2000 || at > session.UpdatedAt.AddMinutes(1)) return session;
            var turns = new List<CheckpointTurn>();
            var links = new List<WorkLink>();
            if (companions.TryGetValue(session.Id, out var json)) {
                try {
                    using var companion = JsonDocument.Parse(json);
                    var source = companion.RootElement;
                    if (Activity.Text(source, "short_id") == session.Id
                        && Activity.Date(source, "source_ended") == at) {
                        foreach (var turn in Array(source, "turns").Reverse().Take(3)) {
                            var summary = Text(turn, "summary", 1600);
                            if (string.IsNullOrWhiteSpace(summary)) continue;
                            var facts = Activity.Child(turn, "facts");
                            var number = Activity.Child(turn, "turn");
                            turns.Add(new(number.ValueKind == JsonValueKind.Number && number.TryGetInt32(out var n) ? n : 0,
                                Text(turn, "headline", 200), summary, Count(facts, "edited"), Count(facts, "pushed"), Count(facts, "agents")));
                        }
                        foreach (var pr in Array(source, "turns").Reverse().SelectMany(t => Array(Activity.Child(t, "facts"), "prs"))) {
                            if (pr.ValueKind != JsonValueKind.String) continue;
                            var match = Regex.Match(pr.GetString() ?? "", @"^(?:opened|merged|closed) (?<repo>[\w.-]+(?:/[\w.-]+)?)#(?<n>[1-9]\d*)$");
                            if (!match.Success) continue;
                            var repo = match.Groups["repo"].Value;
                            if (!repo.Contains('/')) repo = "mehrlander/" + repo;
                            var link = new WorkLink(repo.Split('/')[1] + " #" + match.Groups["n"].Value,
                                "https://github.com/" + repo + "/pull/" + match.Groups["n"].Value);
                            if (!links.Contains(link) && links.Count < 6) links.Add(link);
                        }
                    }
                } catch (JsonException) { /* The rollup still supplies its published summary. */ }
            }
            var summaryText = Text(entry, "summary", 2000);
            var headline = turns.FirstOrDefault()?.Headline;
            if (string.IsNullOrWhiteSpace(headline)) headline = summaryText;
            var title = Text(entry, "title", 180);
            return session with { Title = string.IsNullOrWhiteSpace(title) ? session.Title : title,
                Checkpoint = new(summaryText, headline, at,
                    Activity.Date(entry, "analyzed_at") is var analyzed && analyzed.Year >= 2000 ? analyzed : null, turns, links) };
        }).ToList();
        return cloud with { Items = items };
    }
}
