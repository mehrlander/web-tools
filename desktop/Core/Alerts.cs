using System.Globalization;
using System.Text;
using System.Text.Json;

namespace WebTools.Desktop;

// One email the owner should receive. Since is when its condition began.
public sealed record AlertMessage(string Kind, string Subject, string Body, DateTimeOffset Since);

// One collector observation, reduced to what the alerts read.
public sealed record AlertObservation(DateTimeOffset At, string Daemon, WorkerActivity? LastReport,
    IReadOnlyList<Errand> Errands, bool ErrandsCurrent, string MachineName = "", string? NowUrl = null)
{
    public static AlertObservation From(LenovoSnapshot snapshot, DateTimeOffset at, string? phoneUrl) =>
        new(at, snapshot.Daemon.State, snapshot.Daemon.Activity, snapshot.Activity.Errands,
            snapshot.Activity.Connected, snapshot.MachineName, NavigationPolicy.NowUrl(phoneUrl));
}

// Persisted between companion runs so a restart does not resend.
public sealed record AlertState
{
    public int Schema { get; init; } = 1;
    public DateTimeOffset? LastObservedAt { get; init; }
    public DateTimeOffset? AbsentSince { get; init; }
    public DateTimeOffset? DownSince { get; init; }
    public DateTimeOffset? DownSentAt { get; init; }
    public DateTimeOffset? ErrandSentAt { get; init; }
}

// The state machine, free of files, clocks and mail so checks can drive it.
public static class Alerts
{
    public const string DownSubject = "[web-tools] Gemini worker down";
    public const string UpSubject = "[web-tools] Gemini worker back up";
    public const string ErrandSubject = "[web-tools] Gemini errand waiting";
    public const string TestSubject = "[web-tools] Alert test";
    public static readonly TimeSpan DownAfter = TimeSpan.FromMinutes(15);
    public static readonly TimeSpan WaitingAfter = TimeSpan.FromMinutes(15);
    // A longer silence (sleep, a stopped companion) was not observed, so an absence count restarts.
    public static readonly TimeSpan MaxGap = TimeSpan.FromMinutes(2);

    public static List<Errand> Queued(AlertObservation o) => o.Errands
        .Where(e => e.Provider == "Gemini" && e.State == "queued" && e.CreatedAt.Year >= 2000)
        .OrderBy(e => e.CreatedAt).ThenBy(e => e.Id, StringComparer.Ordinal).ToList();

    public static List<Errand> Waiting(AlertObservation o) => Queued(o).Where(e => o.At - e.CreatedAt >= WaitingAfter).ToList();

    // "detected" ends an absence, "absent" starts or continues one, and "unknown" changes nothing.
    // Errand records that are not current (GitHub unreachable) also change nothing.
    public static AlertState Observe(AlertState state, AlertObservation o)
    {
        if (state.LastObservedAt is { } last && o.At <= last) return state;
        var absentSince = state.LastObservedAt is { } previous && o.At - previous > MaxGap ? null : state.AbsentSince;
        absentSince = o.Daemon switch { "detected" => null, "absent" => absentSince ?? o.At, _ => absentSince };
        var errandSent = o.ErrandsCurrent && Waiting(o).Count == 0 ? null : state.ErrandSentAt;
        return state with { LastObservedAt = o.At, AbsentSince = absentSince, ErrandSentAt = errandSent };
    }

    // Messages owed now. A message stays owed until Sent records it.
    public static List<AlertMessage> Due(AlertState state, AlertObservation o)
    {
        var due = new List<AlertMessage>();
        if (o.Daemon == "absent" && state.AbsentSince is { } since && o.At - since >= DownAfter && state.DownSentAt is null)
            due.Add(new("worker-down", DownSubject, Body(o,
                $"The Gemini worker process (poll_followup.py --daemon) has not been detected on {Machine(o)} since {Time(since)} ({Age(o.At - since)}).",
                Queued(o)), since));
        if (o.Daemon == "detected" && state.DownSentAt is not null) {
            var downSince = state.DownSince ?? state.DownSentAt.Value;
            due.Add(new("worker-back-up", UpSubject, Body(o,
                $"The Gemini worker process was detected again on {Machine(o)} at {Time(o.At)}. It had not been detected since {Time(downSince)} ({Age(o.At - downSince)}).",
                Queued(o)), downSince));
        }
        var waiting = Waiting(o);
        if (o.ErrandsCurrent && waiting.Count > 0 && state.ErrandSentAt is null)
            due.Add(new("errand-waiting", ErrandSubject, Body(o,
                $"{(waiting.Count == 1 ? "A Gemini errand has" : waiting.Count + " Gemini errands have")} been open and unclaimed for {Age(WaitingAfter)} or more, the oldest since {Time(waiting[0].CreatedAt)}. Worker process: {o.Daemon}.",
                Queued(o)), waiting[0].CreatedAt));
        return due;
    }

    public static AlertState Sent(AlertState state, AlertMessage message, DateTimeOffset at) => message.Kind switch {
        "worker-down" => state with { DownSentAt = at, DownSince = message.Since },
        "worker-back-up" => state with { DownSentAt = null, DownSince = null },
        "errand-waiting" => state with { ErrandSentAt = at },
        _ => state
    };

    public static string TestBody(string machine, DateTimeOffset at) =>
        $"This is a test of the Web Tools Companion alert mail, sent from {(machine.Length > 0 ? machine : "this laptop")} at {Time(at)}.\n\nAlerts use these subjects:\n{DownSubject}\n{UpSubject}\n{ErrandSubject}\n";

    private static string Body(AlertObservation o, string condition, List<Errand> queued)
    {
        var text = new StringBuilder(condition).Append("\n\n");
        text.Append(o.LastReport is { } report
            ? $"Last worker report: {report.Headline}, {Time(report.At)}.\n"
            : "No worker report was found in poller.log.\n");
        if (queued.Count == 0) text.Append("No Gemini errands are waiting.\n");
        else {
            text.Append("Waiting Gemini errands:\n");
            foreach (var errand in queued) text.Append($"- {errand.Id}, waiting {Age(o.At - errand.CreatedAt)}\n");
        }
        if (o.NowUrl is { } url) text.Append("\nNow view: ").Append(url).Append('\n');
        text.Append("\nThe companion observes the worker and never starts, stops or restarts it.\n");
        return text.ToString();
    }

    private static string Machine(AlertObservation o) => o.MachineName.Length > 0 ? o.MachineName : "the laptop";

    private static string Time(DateTimeOffset at) => at.ToLocalTime().ToString("yyyy-MM-dd HH:mm zzz", CultureInfo.InvariantCulture);

    public static string Age(TimeSpan span)
    {
        static string Unit(int n, string name) => n + " " + name + (n == 1 ? "" : "s");
        if (span < TimeSpan.Zero) span = TimeSpan.Zero;
        if (span.TotalHours < 1) return Unit((int)span.TotalMinutes, "minute");
        if (span.TotalDays < 1) return Unit((int)span.TotalHours, "hour") + (span.Minutes > 0 ? " " + Unit(span.Minutes, "minute") : "");
        return Unit((int)span.TotalDays, "day") + (span.Hours > 0 ? " " + Unit(span.Hours, "hour") : "");
    }
}

public interface IAlertSender
{
    bool Configured { get; }
    Task Send(AlertMessage message, CancellationToken stop);
}

// Holds the persisted state, honors the pause file and hands owed messages to a sender.
// Observe returns quickly; delivery runs in the background and its task is returned for checks.
public sealed class AlertMonitor
{
    public const string PauseFile = "alerts-paused";
    public const string StateFile = "alert-state.json";
    public static readonly TimeSpan RetryAfterFailure = TimeSpan.FromMinutes(5);
    private readonly string directory;
    private readonly IAlertSender sender;
    private readonly Action<string> log;
    private readonly Func<DateTimeOffset> clock;
    private readonly object gate = new();
    private AlertState state;
    private bool sending, offLogged, pausedLogged;
    private DateTimeOffset retryAfter;
    private DateTimeOffset? savedObservedAt;

    public AlertMonitor(string directory, IAlertSender sender, Action<string> log, Func<DateTimeOffset>? clock = null)
    {
        this.directory = directory;
        this.sender = sender;
        this.log = log;
        this.clock = clock ?? (() => DateTimeOffset.UtcNow);
        state = Load();
        savedObservedAt = state.LastObservedAt;
        if (!sender.Configured) OffOnce();
    }

    public AlertState State { get { lock (gate) return state; } }
    private string StatePath => Path.Combine(directory, StateFile);
    private bool Paused => File.Exists(Path.Combine(directory, PauseFile));

    public Task Observe(AlertObservation observation, CancellationToken stop = default)
    {
        List<AlertMessage> due;
        lock (gate) {
            var next = Alerts.Observe(state, observation);
            // LastObservedAt alone is saved once a minute, often enough to keep MaxGap continuity across a restart.
            if (next with { LastObservedAt = null } != state with { LastObservedAt = null }
                || savedObservedAt is null || next.LastObservedAt - savedObservedAt > TimeSpan.FromMinutes(1)) Save(next);
            state = next;
            due = Alerts.Due(state, observation);
            if (due.Count == 0 || sending) return Task.CompletedTask;
            if (Paused) {
                if (!pausedLogged) log("Alerts are paused by " + PauseFile + "; owed messages stay unsent: " + string.Join(", ", due.Select(m => m.Subject)));
                pausedLogged = true;
                return Task.CompletedTask;
            }
            pausedLogged = false;
            if (!sender.Configured) { OffOnce(); return Task.CompletedTask; }
            offLogged = false;
            if (clock() < retryAfter) return Task.CompletedTask;
            sending = true;
        }
        return Task.Run(() => Deliver(due, stop));
    }

    private async Task Deliver(List<AlertMessage> due, CancellationToken stop)
    {
        try {
            foreach (var message in due) {
                if (Paused) return;
                try { await sender.Send(message, stop); }
                catch (Exception e) when (!stop.IsCancellationRequested) {
                    lock (gate) retryAfter = clock() + RetryAfterFailure;
                    log("Could not send \"" + message.Subject + "\" (" + e.GetType().Name + ": " + e.Message + "). Retrying in five minutes.");
                    return;
                }
                lock (gate) { state = Alerts.Sent(state, message, clock()); Save(state); }
                log("Sent \"" + message.Subject + "\".");
            }
        } catch (OperationCanceledException) when (stop.IsCancellationRequested) { }
        finally { lock (gate) sending = false; }
    }

    private void OffOnce()
    {
        if (offLogged) return;
        offLogged = true;
        log("Alert mail is not configured, so alerts are off. Run WebTools.Companion --alert-mail-setup to turn them on.");
    }

    private AlertState Load()
    {
        try { return JsonSerializer.Deserialize<AlertState>(File.ReadAllText(StatePath)) ?? new(); }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException or JsonException) { return new(); }
    }

    private void Save(AlertState value)
    {
        try {
            Directory.CreateDirectory(directory);
            var temporary = StatePath + ".tmp";
            File.WriteAllText(temporary, JsonSerializer.Serialize(value));
            File.Move(temporary, StatePath, overwrite: true);
            savedObservedAt = value.LastObservedAt;
        } catch (Exception e) when (e is IOException or UnauthorizedAccessException) {
            log("Could not save alert state (" + e.GetType().Name + ").");
        }
    }
}
