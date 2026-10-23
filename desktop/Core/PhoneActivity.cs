namespace WebTools.Desktop;

public record PhoneItem(string Key, string Id, string Kind, string Provider, string Location,
    string Title, string State, string Detail, DateTimeOffset At, DateTimeOffset CreatedAt,
    bool NeedsAttention, bool IsNew, string? Url, SessionCheckpoint? Checkpoint = null, SessionTurn? Turn = null);
public record PhoneSource(bool QueueAvailable, bool RecordsConnected, DateTimeOffset? RecordsSyncedAt,
    string WorkerState, DateTimeOffset? WorkerLogAt, DateTimeOffset? CloudCapturedAt, List<string> Notices,
    WorkerActivity? WorkerActivity = null, List<WorkerActivity>? WorkerReports = null);
public record PhoneSnapshot(int SchemaVersion, string MachineName, DateTimeOffset ObservedAt,
    double ScanMilliseconds, PhoneSource Sources, List<PhoneItem> Items, List<ActivityEvent> Events,
    List<ActivityChange>? Changes = null);

public static class PhoneActivity
{
    public static bool NeedsAttention(LocalSession session) => session.State == "interrupted"
        || session.Location == "Cloud" && new[] { "needs you", "choice needed", "attention", "direction needed" }
            .Any(s => session.Detail.Contains(s, StringComparison.OrdinalIgnoreCase));

    public static PhoneSnapshot Create(LaptopSnapshot snapshot, DateTimeOffset observedAt, string? error = null)
    {
        var items = snapshot.Activity.Errands.Where(j => j.IsOpen || j.UpdatedAt > observedAt.AddDays(-1))
            .Select(j => new PhoneItem("errand:" + j.Id, j.Id, "errand", "Gemini", "Laptop", j.Title,
                j.State, j.Message ?? "", j.UpdatedAt, j.CreatedAt, j.State == "failed" && j.IsNew, j.IsNew,
                NavigationPolicy.ErrandUrl(j.Id, j.State is "reply" or "complete" or "failed"))).ToList();
        items.AddRange(snapshot.Sessions.Items.Concat(snapshot.Cloud.Items).Select(s => new PhoneItem(
            (s.Location == "Cloud" ? "cloud:" : "session:" + s.Provider + ":") + s.Id, s.Id,
            s.Location == "Cloud" ? "cloud" : "session", s.Provider, s.Location, s.Title, s.State,
            s.Detail, s.UpdatedAt, s.UpdatedAt, NeedsAttention(s), false,
            s.Location == "Cloud" ? NavigationPolicy.AppUrl + "?view=sessions&session=" + Uri.EscapeDataString(s.Id) : null, s.Checkpoint, s.Turn)));
        var notices = snapshot.Sessions.Notices.Concat(new[] { snapshot.Activity.Notice, snapshot.Cloud.Notice, error }
            .OfType<string>()).Distinct().ToList();
        return new(1, snapshot.MachineName, observedAt, snapshot.ScanMilliseconds,
            new(snapshot.Activity.Revision is not null, snapshot.Activity.Connected, snapshot.Activity.SyncedAt,
                snapshot.Daemon.State, snapshot.Daemon.LastLogAt, snapshot.Cloud.CapturedAt, notices, snapshot.Daemon.Activity, snapshot.Daemon.Reports),
            items.OrderByDescending(i => i.At).ToList(), snapshot.Events.Take(50).ToList(), snapshot.Changes ?? []);
    }

    // Reply bodies are requested only for the selected result. Request notes,
    // machine paths, downloads and native actions are outside the phone API.
    public static string? Reply(LaptopSnapshot snapshot, string id)
    {
        var job = snapshot.Activity.Errands.Find(j => j.Id == id && j.State is "reply" or "complete" or "failed");
        if (job is null) return null;
        var text = job.Reply ?? job.Message ?? "";
        return text[..Math.Min(text.Length, 20000)];
    }
}
