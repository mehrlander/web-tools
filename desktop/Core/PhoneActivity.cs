namespace WebTools.Desktop;

public record PhoneItem(string Key, string Id, string Kind, string Provider, string Location,
    string Title, string State, string Detail, DateTimeOffset At, DateTimeOffset CreatedAt,
    bool NeedsAttention, bool IsNew, string? Url, SessionCheckpoint? Checkpoint = null, SessionTurn? Turn = null, LocalWork? Work = null, string? SessionUrl = null,
    DateTimeOffset? ClaimedAt = null, List<PhoneItem>? Members = null, int MemberCount = 1, string? ActivityKey = null, List<string>? RelatedKeys = null);
public record PhoneErrandSnapshot(int SchemaVersion, DateTimeOffset ObservedAt, bool QueueAvailable,
    bool RecordsConnected, DateTimeOffset? SyncedAt, string? Notice, List<PhoneItem> Items);
public record PhoneSource(bool QueueAvailable, bool RecordsConnected, DateTimeOffset? RecordsSyncedAt,
    string WorkerState, DateTimeOffset? WorkerLogAt, DateTimeOffset? CloudCapturedAt, List<string> Notices,
    WorkerActivity? WorkerActivity = null, List<WorkerActivity>? WorkerReports = null,
    SyncHealth? Sync = null, List<string>? SyncNotices = null);
public record PhoneSnapshot(int SchemaVersion, string MachineName, DateTimeOffset ObservedAt,
    double ScanMilliseconds, PhoneSource Sources, List<PhoneItem> Items, List<ActivityEvent> Events,
    List<ActivityChange>? Changes = null, List<ProviderUsage>? Usage = null);

public static class PhoneActivity
{
    private static PhoneItem ErrandItem(Errand j) => new("errand:" + j.Id, j.Id, "errand", j.Provider,
        j.Location, j.Title, j.State, ErrandPreview(j), j.UpdatedAt, j.CreatedAt,
        j.State == "failed", j.IsNew, NavigationPolicy.ErrandUrl(j.Id, j.State is "reply" or "complete" or "failed" or "declined"),
        ClaimedAt: j.ClaimedAt);

    // The worker's message can be a fence opener. Prefer prose outside code,
    // with a final narrative from the full report when the message has none.
    public static string ErrandPreview(Errand job)
    {
        static List<string> Prose(string? value) {
            var text = value ?? "";
            text = text[..Math.Min(text.Length, 20000)];
            var lines = new List<string>();
            char fence = '\0';
            foreach (var raw in text.Split('\n')) {
                var line = raw.Trim();
                if (line.StartsWith("```") || line.StartsWith("~~~")) {
                    if (fence == '\0') fence = line[0];
                    else if (fence == line[0]) fence = '\0';
                    continue;
                }
                if (fence != '\0' || line.Length == 0 || line[0] is '{' or '[' or '}' or ']' or '"') continue;
                if (System.Text.RegularExpressions.Regex.IsMatch(line, @"^\P{L}*\*\*[\p{L} ]+:\*\*")) continue;
                line = System.Text.RegularExpressions.Regex.Replace(line, @"\[([^\]]+)\]\([^)]*\)", "$1");
                line = line.Replace("`", "").Replace("**", "").TrimStart('#', ' ');
                if (line.Length > 0) lines.Add(line);
            }
            return lines;
        }
        var preview = Prose(job.Message).FirstOrDefault() ?? Prose(job.Reply).LastOrDefault() ?? "";
        return preview[..Math.Min(preview.Length, 320)];
    }

    public static PhoneErrandSnapshot Errands(LaptopSnapshot snapshot, DateTimeOffset observedAt) =>
        new(1, observedAt, snapshot.Activity.Revision is not null, snapshot.Activity.Connected,
            snapshot.Activity.SyncedAt, snapshot.Activity.Notice, snapshot.Activity.Errands.Select(ErrandItem).ToList());

    public static bool NeedsAttention(LocalSession session) => session.State == "interrupted"
        || session.Location == "Cloud" && new[] { "needs you", "choice needed", "attention", "direction needed" }
            .Any(s => session.Detail.Contains(s, StringComparison.OrdinalIgnoreCase));

    public static PhoneSnapshot Create(LaptopSnapshot snapshot, DateTimeOffset observedAt, string? error = null)
    {
        var items = snapshot.Activity.Errands.Where(j => j.IsOpen || j.UpdatedAt > observedAt.AddDays(-1))
            .Select(ErrandItem).ToList();
        var changes = SessionLinks.HydrateChanges(snapshot.Changes ?? [],snapshot.Cloud.SessionUrls,snapshot.GeminiInstanceId,snapshot.Cloud.CapturedRecords);
        var changedThreads = changes.Where(c => c.Key.StartsWith("cloud:",StringComparison.Ordinal))
            .ToLookup(c => SessionLinks.Safe(c.SessionUrl) ?? "");
        PhoneItem SessionItem(LocalSession session, bool member = false) {
            var prefix = session.Location == "Cloud" ? "cloud:" : "session:" + session.Provider + ":";
            var source = session.Location == "Cloud" ? SessionLinks.Safe(session.SourceUrl) : null;
            List<string> relatedKeys = source is null || member ? [] : changedThreads[source].Where(c => c.Key != prefix + session.Id)
                .Select(c => c.Key).Distinct().Take(256).ToList();
            return new(prefix + session.Id, session.Id, session.Location == "Cloud" ? "cloud" : "session",
                session.Provider, session.Location, session.Title, session.State, session.Detail,
                session.UpdatedAt, session.UpdatedAt, NeedsAttention(session), false,
                session.Location == "Cloud" ? NavigationPolicy.AppUrl + "?view=sessions&session=" + Uri.EscapeDataString(session.Id)
                    : SessionLinks.CapturedRecord(session.Provider,session.Id,snapshot.Cloud.CapturedRecords),
                session.Checkpoint, session.Turn, session.Work, SessionLinks.For(session.Provider,session.Id,session.SourceUrl,snapshot.GeminiInstanceId),
                Members: member ? null : session.Members?.Select(s => SessionItem(s,true)).ToList(),
                MemberCount: member ? 1 : session.MemberCount,
                ActivityKey: member || session.ActivityId is null ? null : prefix + session.ActivityId,
                RelatedKeys: relatedKeys.Count == 0 ? null : relatedKeys);
        }
        items.AddRange(snapshot.Sessions.Items.Concat(snapshot.Cloud.Items).Select(s => SessionItem(s)));
        var activityNotices = snapshot.Activity.Sync is null ? new[] { snapshot.Activity.Notice }.OfType<string>()
            : (snapshot.Activity.SyncNotices ?? []).Concat(new[] { snapshot.Activity.RecordNotice }.OfType<string>());
        var notices = snapshot.Sessions.Notices.Concat(activityNotices).Concat(new[] { snapshot.Cloud.Notice, error }
            .OfType<string>()).Distinct().ToList();
        return new(1, snapshot.MachineName, observedAt, snapshot.ScanMilliseconds,
            new(snapshot.Activity.Revision is not null, snapshot.Activity.Connected, snapshot.Activity.SyncedAt,
                snapshot.Daemon.State, snapshot.Daemon.LastLogAt, snapshot.Cloud.CapturedAt, notices, snapshot.Daemon.Activity, snapshot.Daemon.Reports,
                snapshot.Activity.Sync, snapshot.Activity.SyncNotices),
            items.OrderByDescending(i => i.At).ToList(), snapshot.Events.Take(50).ToList(),
            changes, snapshot.Usage ?? []);
    }

    // Reply bodies are requested only for the selected result. Request notes,
    // machine paths, downloads and native actions are outside the phone API.
    public static string? Reply(LaptopSnapshot snapshot, string id)
    {
        var job = snapshot.Activity.Errands.Find(j => j.Id == id && j.State is "reply" or "complete" or "failed" or "declined");
        if (job is null) return null;
        var text = job.State == "declined" ? Activity.Nonblank(job.Message, job.Reply) : Activity.Nonblank(job.Reply, job.Message);
        return text[..Math.Min(text.Length, 20000)];
    }
}
