using System.Diagnostics;

namespace WebTools.Desktop;

public record CollectedActivity(DateTimeOffset ObservedAt, LaptopSnapshot Snapshot, double SyncMilliseconds);

// One owner of the readers and journal, independent of any browser or window.
public sealed class ActivityCollector
{
    private readonly SessionReader sessions = new(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile));
    private readonly ActivityJournal journal = new(Path.Combine(UserSettings.DataDirectory, "activity-history.json"));
    private ErrandReader? reader;
    private string root = "";
    private DateTimeOffset processesChecked;
    private List<ApplicationSignal> applications = [];
    private DaemonSignal daemon = new("unknown", "Checking the worker process.", null);
    private CollectedActivity? latest;
    private string? error;
    public CollectedActivity? Latest => Volatile.Read(ref latest);
    public string? Error => Volatile.Read(ref error);

    public async Task Run(CancellationToken stop)
    {
        // Network reads never block the two-second local sampling loop.
        var synchronize = Synchronize(stop);
        try {
            using var timer = new PeriodicTimer(TimeSpan.FromSeconds(2));
            do {
                try {
                    var settings = UserSettings.Load();
                    if (reader is null || root != settings.RepositoriesRoot) {
                        root = settings.RepositoriesRoot;
                        Volatile.Write(ref reader, new ErrandReader(Path.Combine(root, "web-tools-private")));
                        processesChecked = default;
                    }
                    var active = reader;
                    var watch = Stopwatch.StartNew();
                    var activity = await active.Read(settings.SeenThrough, synchronize: false);
                    activity = activity with { Errands = activity.Errands.Select(j => j with {
                        HasLocalOutput = Directory.Exists(LaptopSignals.Outbox(j.Id)) }).ToList() };
                    var now = DateTimeOffset.UtcNow;
                    if (now - processesChecked > TimeSpan.FromSeconds(10)) {
                        daemon = LaptopSignals.Daemon(Path.Combine(root, "web-tools-private"));
                        applications = LaptopSignals.Applications();
                        processesChecked = now;
                    }
                    var current = sessions.Read(now);
                    var events = journal.Observe(current.Items, now);
                    var snapshot = new LaptopSnapshot(activity, daemon, applications, LaptopSignals.Places(root),
                        LaptopSignals.Downloads(), Environment.MachineName, settings.SeenThrough, current,
                        watch.Elapsed.TotalMilliseconds, active.Cloud, events);
                    Volatile.Write(ref latest, new(now, snapshot, active.SyncMilliseconds));
                    Volatile.Write(ref error, null);
                } catch { Volatile.Write(ref error, "The latest local activity scan failed. Showing the last observation."); }
            } while (await timer.WaitForNextTickAsync(stop));
        } catch (OperationCanceledException) when (stop.IsCancellationRequested) { }
        finally { await synchronize; }
    }

    private async Task Synchronize(CancellationToken stop)
    {
        try {
            // Give the first scan time to create its reader.
            await Task.Delay(300, stop);
            using var timer = new PeriodicTimer(TimeSpan.FromSeconds(5));
            do {
                var active = Volatile.Read(ref reader);
                if (active is not null) await active.Synchronize(force: true);
            } while (await timer.WaitForNextTickAsync(stop));
        } catch (OperationCanceledException) when (stop.IsCancellationRequested) { }
    }
}
