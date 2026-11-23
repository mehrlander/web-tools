namespace WebTools.Desktop;

// A provider thread can publish several captures and live hook records. Group
// their presentation, retaining their distinct records and observed turn bodies.
public static class CloudThreads
{
    public const int MaximumThreads = 40;
    public const int MaximumMembersPerThread = 64;
    public const int MaximumMembers = 128;

    public static string Key(LocalSession session)
    {
        var url = session.Provider == "Claude" && session.Location == "Cloud" ? SessionLinks.Safe(session.SourceUrl) : null;
        return url?.StartsWith("https://claude.ai/code/", StringComparison.Ordinal) == true
            ? "thread:" + url : "record:" + session.Provider + ":" + session.Id;
    }

    public static List<LocalSession> Candidates(CloudSnapshot records, IEnumerable<LocalSession> signals)
    {
        var live = signals.ToList();
        var current = records.Items.SelectMany(s => (s.Members ?? []).Append(s)).ToList();
        var active = current.Concat(live).GroupBy(Key).ToDictionary(g => g.Key, g => g.Max(s => s.UpdatedAt));
        return current.Concat(records.Catalog ?? []).GroupBy(s => s.Id).Select(g => g.MaxBy(s => s.UpdatedAt)!)
            .Where(s => active.ContainsKey(Key(s)) || live.Any(x => x.Id == s.Id))
            .OrderByDescending(s => active.GetValueOrDefault(Key(s), s.UpdatedAt)).ThenByDescending(s => s.UpdatedAt).ToList();
    }

    private static int TopicCoverage(LocalSession session) => Math.Max(
        session.Checkpoint?.Topics?.SelectMany(t => t.Spans).Select(s => s.End).DefaultIfEmpty(0).Max() ?? 0,
        session.Checkpoint?.Turns.Select(t => t.Turn).DefaultIfEmpty(0).Max() ?? 0);

    public static List<LocalSession> Group(IEnumerable<LocalSession> sessions, HashSet<string> published, HashSet<string> observed)
    {
        var groups = sessions.GroupBy(Key).OrderByDescending(g => g.Max(s => s.UpdatedAt)).Take(MaximumThreads).ToList();
        var result = new List<LocalSession>();
        var available = MaximumMembers;
        foreach (var group in groups) {
            var rows = group.OrderByDescending(s => s.UpdatedAt).ToList();
            var canonical = rows.OrderByDescending(s => s.Checkpoint is not null)
                .ThenByDescending(TopicCoverage).ThenByDescending(s => published.Contains(s.Id))
                .ThenByDescending(s => s.Checkpoint?.At ?? DateTimeOffset.MinValue)
                .ThenBy(s => s.Turn?.StartedAt ?? s.UpdatedAt).ThenBy(s => s.Id, StringComparer.Ordinal).First();
            var signals = rows.Where(s => observed.Contains(s.Id)).ToList();
            var activity = signals.Where(s => s.State == "working").MaxBy(s => s.UpdatedAt)
                ?? signals.MaxBy(s => s.UpdatedAt) ?? rows[0];
            var reserved = Math.Max(0, groups.Count - result.Count - 1);
            var members = rows.Where(s => s.Id != canonical.Id).OrderByDescending(s => s.Id == activity.Id)
                .ThenByDescending(s => observed.Contains(s.Id)).ThenByDescending(s => s.UpdatedAt)
                .Take(Math.Min(Math.Max(0, available - reserved), MaximumMembersPerThread))
                .Select(s => s with { Members = null, MemberCount = 1, ActivityId = null }).ToList();
            available -= members.Count;
            result.Add(canonical with {
                State = activity.State, Detail = activity.Detail, UpdatedAt = activity.UpdatedAt,
                Members = members.Count == 0 ? null : members, MemberCount = rows.Count, ActivityId = activity.Id
            });
        }
        return result.OrderByDescending(s => s.UpdatedAt).ToList();
    }
}
