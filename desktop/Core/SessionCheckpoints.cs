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

    public const int MaximumCompanions = 40;
    private static int Coverage(JsonElement entry)
    {
        var count = Activity.Child(entry, "turn_count");
        var result = count.ValueKind == JsonValueKind.Number && count.TryGetInt32(out var n) ? Math.Clamp(n, 0, 1000000) : 0;
        foreach (var stretch in Array(entry, "agenda").Take(512)) {
            var turns = Activity.Child(stretch, "turns");
            if (turns.ValueKind == JsonValueKind.Array && turns.GetArrayLength() == 2
                && turns[1].ValueKind == JsonValueKind.Number && turns[1].TryGetInt32(out var end)) result = Math.Max(result, Math.Clamp(end, 0, 1000000));
        }
        return result;
    }

    public static Dictionary<string, string> Paths(string rollup, IEnumerable<LocalSession> sessions)
    {
        using var doc = JsonDocument.Parse(rollup);
        var index = Activity.Child(doc.RootElement, "sessions");
        var candidates = sessions.DistinctBy(s => s.Id).Select(session => {
            var entry = Activity.Child(index, session.Id);
            var path = Activity.Text(entry, "path");
            var valid = Regex.IsMatch(path, @"^sessions/topics/20\d{2}/\d{2}/20\d{2}-\d{2}-\d{2}-[a-zA-Z0-9.-]+\.json$")
                && path.EndsWith("-" + session.Id + ".json", StringComparison.Ordinal);
            return new { Session = session, Path = path, Valid = valid, Coverage = Coverage(entry), At = Activity.Date(entry, "source_ended") };
        }).Where(x => x.Valid).GroupBy(x => CloudThreads.Key(x.Session))
            .Select(g => g.OrderByDescending(x => x.Coverage).ThenByDescending(x => x.At).Take(2).ToList()).ToList();
        // One parent from every relevant provider thread precedes a second
        // capture from any thread, so a busy helper thread cannot fill the cap.
        return Enumerable.Range(0, 2).SelectMany(i => candidates.Where(g => g.Count > i).Select(g => g[i]))
            .Take(MaximumCompanions).ToDictionary(x => x.Session.Id, x => x.Path);
    }

    private sealed class TopicBuilder(string topic, string? kind, string? area, bool minor, int first)
    {
        public string Topic = topic;
        public string? Kind = kind, Area = area;
        public bool Minor = minor;
        public int First = first, Last = first, Turns;
        public List<TopicSpan> Spans = [];
    }

    private static (List<SessionTopic> Topics, bool Partial) Topics(JsonElement entry, JsonElement fallback = default)
    {
        JsonElement Source(string name) => Activity.Child(entry, name).ValueKind == JsonValueKind.Array
            ? entry : fallback;
        var agenda = Array(Source("agenda"), "agenda").Take(513).ToList();
        var partial = agenda.Count > 512;
        var builders = new Dictionary<string, TopicBuilder>(StringComparer.OrdinalIgnoreCase);
        var spans = new List<(JsonElement Row, int Start, int End)>();
        foreach (var row in agenda.Take(512)) {
            var range = Activity.Child(row, "turns");
            if (range.ValueKind != JsonValueKind.Array || range.GetArrayLength() != 2
                || range[0].ValueKind != JsonValueKind.Number || range[1].ValueKind != JsonValueKind.Number
                || !range[0].TryGetInt32(out var start) || !range[1].TryGetInt32(out var end)
                || start < 0 || end < start || end > 1000000) continue;
            spans.Add((row, start, end));
        }
        var index = 0;
        foreach (var span in spans.OrderBy(s => s.Start)) {
            var name = Text(span.Row, "topic", 160).Trim();
            if (name.Length == 0) continue;
            var kind = Text(span.Row, "kind", 32).Trim();
            if (kind is not ("new" or "improve" or "fix" or "explore")) kind = "";
            var area = Text(span.Row, "area", 80).Trim();
            var minor = Activity.Child(span.Row, "minor").ValueKind == JsonValueKind.True;
            if (!builders.TryGetValue(name, out var builder)) builders[name] = builder = new(name,
                kind.Length == 0 ? null : kind, area.Length == 0 ? null : area, minor, index);
            builder.Last = index++;
            builder.Minor &= minor;
            builder.Kind ??= kind.Length == 0 ? null : kind;
            builder.Area ??= area.Length == 0 ? null : area;
            builder.Turns = Math.Min(1000000, builder.Turns + span.End - span.Start + 1);
            builder.Spans.Add(new(span.Start, span.End));
        }
        var names = Array(Source("topics"), "topics").Take(129).ToList();
        if (builders.Count == 0 && names.Count > 128) partial = true;
        if (builders.Count == 0) foreach (var item in names.Take(128)) {
            if (item.ValueKind != JsonValueKind.String) continue;
            var name = item.GetString()?.Trim() ?? "";
            name = name[..Math.Min(name.Length, 160)];
            if (name.Length > 0 && !builders.ContainsKey(name)) builders[name] = new(name, null, null, false, index++);
        }
        var statuses = new Dictionary<string, JsonElement>(StringComparer.OrdinalIgnoreCase);
        foreach (var status in Array(Source("topic_status"), "topic_status").Take(512)) {
            var topic = Text(status, "topic", 160).Trim();
            if (topic.Length > 0) statuses[topic] = status;
        }
        var all = builders.Values.OrderBy(b => b.First).ToList();
        if (all.Count > 32) { partial = true; all = all.Take(16).Concat(all.OrderByDescending(b => b.Last).Take(16)).Distinct().OrderBy(b => b.First).ToList(); }
        var topics = all.Select(b => {
            statuses.TryGetValue(b.Topic, out var metadata);
            var raw = Activity.Text(metadata, "status");
            var state = raw is "open" or "done" or "dropped" ? raw : null;
            var who = Activity.Text(metadata, "waits_on");
            var waits = state == "open" && who is "owner" or "session" or "external" ? who : null;
            if (b.Spans.Count > 8) partial = true;
            var kept = b.Spans.Count <= 8 ? b.Spans : b.Spans.Take(4).Concat(b.Spans.TakeLast(4)).ToList();
            return new SessionTopic(b.Topic, b.Kind, b.Area, b.Minor, b.First, b.Last, b.Turns, kept,
                state, waits, state == "open" ? Text(metadata, "waiting", 240) : "",
                Text(metadata, "basis", 40), Text(metadata, "evidence", 500));
        }).ToList();
        return (topics, partial);
    }

    public static CloudSnapshot Enrich(CloudSnapshot cloud, string rollup, IReadOnlyDictionary<string, string> companions)
    {
        using var doc = JsonDocument.Parse(rollup);
        var index = Activity.Child(doc.RootElement, "sessions");
        LocalSession EnrichOne(LocalSession session) {
            var entry = Activity.Child(index, session.Id);
            if (entry.ValueKind != JsonValueKind.Object) return session;
            var at = Activity.Date(entry, "source_ended");
            if (at.Year < 2000 || at > session.UpdatedAt.AddMinutes(1)) return session;
            var turns = new List<CheckpointTurn>();
            var links = new List<WorkLink>();
            var (topics, partial) = Topics(entry);
            if (companions.TryGetValue(session.Id, out var json)) {
                try {
                    using var companion = JsonDocument.Parse(json);
                    var source = companion.RootElement;
                    if (Activity.Text(source, "short_id") == session.Id
                        && Activity.Date(source, "source_ended") == at) {
                        (topics, partial) = Topics(entry, source);
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
                    Activity.Date(entry, "analyzed_at") is var analyzed && analyzed.Year >= 2000 ? analyzed : null, turns, links, topics, partial) };
        }
        var enriched = (cloud.Catalog ?? cloud.Items).Concat(cloud.Items).DistinctBy(s => s.Id)
            .ToDictionary(s => s.Id, EnrichOne);
        return cloud with { Items = cloud.Items.Select(s => enriched[s.Id]).ToList(),
            Catalog = cloud.Catalog?.Select(s => enriched[s.Id]).ToList() };
    }
}
