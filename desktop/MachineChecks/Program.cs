using WebTools.Desktop;
using System.Text.Json;

var checks = 0;
void Check(bool condition, string description)
{
    if (!condition) throw new InvalidOperationException(description);
    checks++;
}

var redirected = Path.Combine(Path.GetTempPath(), "redirected downloads", "résult with spaces");
Check(FileRoots.TryGet("downloads", () => redirected, out var root)
    && root.Id == "downloads" && root.FullPath == Path.GetFullPath(redirected),
    "Downloads uses the current known-folder location, including redirection and Unicode.");

foreach (var invalid in new string?[] { null, "", "  ", "relative/downloads", @"C:downloads", @"\downloads", redirected + '\0' })
    Check(!FileRoots.TryGet("downloads", () => invalid, out _),
        "An unavailable or invalid known-folder path cannot become a Downloads root.");

foreach (var id in new[] { "", "unknown", "Downloads", "downloads/.." })
    Check(!FileRoots.TryGet(id, () => throw new InvalidOperationException("Unexpected Downloads lookup."), out _),
        "Only a fixed known root ID can request a Downloads lookup.");

Check(FileRoots.TryGet("outputs", () => throw new InvalidOperationException("Unexpected Downloads lookup."), out var outputs)
    && outputs.FullPath == Path.GetFullPath(FileRoots.OutputsDirectory),
    "The outputs root remains independent of the Downloads resolver.");

foreach (var path in new[] { "../outside.txt", "folder/.git/config", "file.txt:stream", @"folder\file.txt" })
    Check(FileRoots.Resolve(root, path, file: true, out _) == 400,
        "Downloads retains traversal, Git administrative, stream and separator checks.");

if (OperatingSystem.IsWindows()) {
    var native = KnownFolders.DownloadsPath();
    Check(native is not null && Path.IsPathFullyQualified(native)
        && FileRoots.TryGet("downloads", out var current)
        && current.FullPath == Path.GetFullPath(native),
        "The production resolver reads the Windows Downloads location without creating or reading its files.");
}

bool Busy(RepositoryRefreshSchedule value, params string[] keys) =>
    value.BusyKeys.ToHashSet(StringComparer.Ordinal).SetEquals(keys);

var keyA = new string('a', 24);
var keyB = new string('b', 24);
var schedule = new RepositoryRefreshSchedule();
Check(schedule.TryQueue(keyA) && !schedule.TryQueue(keyA),
    "A queued repository rejects a duplicate request.");
Check(schedule.CaptureCompleted().Count == 0,
    "A scan cannot acknowledge a request that has not completed.");
schedule.Complete(keyA);
Check(!schedule.TryQueue(keyA) && Busy(schedule, keyA),
    "A completed fetch stays busy until its observation is published.");
Check(schedule.TryQueue(keyB),
    "One fetch awaiting publication does not block another repository request.");
var scanStart = schedule.CaptureCompleted();
Check(scanStart.Count == 1 && scanStart.ContainsKey(keyA),
    "A scan captures only the fetches completed before that scan starts.");
schedule.Complete(keyB);
Check(schedule.CaptureCompleted().Count == 2,
    "Another repository can finish before the prior completion is published.");
Check(scanStart.Count == 1 && !scanStart.ContainsKey(keyB),
    "Later fetch completions do not change an earlier scan capture.");
Check(Busy(schedule, keyA, keyB) && !schedule.TryQueue(keyA) && !schedule.TryQueue(keyB),
    "An unpublished or failed scan capture leaves completed requests busy.");
schedule.Published(scanStart);
Check(Busy(schedule, keyB),
    "Publication clears only completions captured at that scan's start.");
Check(schedule.TryQueue(keyA),
    "A successfully published repository accepts its next request.");
schedule.Published(scanStart);
Check(Busy(schedule, keyA, keyB) && !schedule.CaptureCompleted().ContainsKey(keyA),
    "An old publication cannot clear a newly queued request for the same repository.");
schedule.Complete(keyA);
var newer = schedule.CaptureCompleted();
Check(newer[keyA] > scanStart[keyA],
    "A later fetch completion retains a newer generation after an earlier publication.");
schedule.Published(scanStart);
Check(Busy(schedule, keyA, keyB),
    "An old publication cannot clear a newer completion for the same repository.");
schedule.Published(newer);
Check(Busy(schedule) && schedule.TryQueue(keyA) && schedule.TryQueue(keyB),
    "Publishing the captured generations releases both repositories for later requests.");

var wakeSchedule = new RepositoryRefreshSchedule();
Check(wakeSchedule.TryQueue(keyA) && wakeSchedule.TryQueue(keyB),
    "Independent repository requests can share the scan wake mechanism.");
wakeSchedule.Complete(keyA);
wakeSchedule.Complete(keyB);
var wake = wakeSchedule.WaitForScan(TimeSpan.FromMinutes(1), CancellationToken.None);
await wake.WaitAsync(TimeSpan.FromSeconds(5));
Check(wake.IsCompletedSuccessfully,
    "A burst of fetch completions wakes the next repository scan.");
using var stopWaiting = new CancellationTokenSource();
var pendingWake = wakeSchedule.WaitForScan(TimeSpan.FromMinutes(1), stopWaiting.Token);
Check(!pendingWake.IsCompleted,
    "A completion burst is coalesced into one wake rather than repeated scans.");
stopWaiting.Cancel();
var canceled = false;
try { await pendingWake.WaitAsync(TimeSpan.FromSeconds(5)); }
catch (OperationCanceledException) when (stopWaiting.IsCancellationRequested) { canceled = true; }
Check(canceled,
    "Explicit cancellation stops a pending scan wait without repository I/O.");

var cadence = new RepositoryRefreshSchedule().WaitForScan(TimeSpan.Zero, CancellationToken.None);
await cadence.WaitAsync(TimeSpan.FromSeconds(5));
Check(cadence.IsCompletedSuccessfully,
    "The periodic scan interval still completes when no fetch supplies a wake.");

var progress = new RepositoryRefreshSchedule();
Check(progress.Progress is { Active: null, Queued.Count: 0, AwaitingObservation.Count: 0, LastCompleted: null, Scanning: false, ScanStartedAt: null },
    "A new schedule has no resurrected live jobs, completions or scan activity.");
Check(progress.TryQueue(keyA, updateMain: true) && progress.TryQueue(keyB),
    "Automatic update and manual check requests can both enter the queue.");
var queuedProgress = progress.Progress;
Check(queuedProgress.Queued.Select(j => j.Key).SequenceEqual(new[] { keyA, keyB })
    && queuedProgress.Queued[0] is { Mode: "update", StartedAt: null, FinishedAt: null, Outcome: null }
    && queuedProgress.Queued[1].Mode == "check",
    "Queued progress preserves request order and distinguishes requested update from check-only work.");
Check(!progress.Start("unknown") && progress.Start(keyA) && !progress.Start(keyB),
    "Only a queued job can start, and a second repository cannot become active concurrently.");
var activeProgress = progress.Progress;
Check(activeProgress.Active is { Key: var activeKey, Mode: "update", StartedAt: not null, FinishedAt: null, Outcome: null }
    && activeKey == keyA && activeProgress.Queued.Count == 1 && activeProgress.Queued[0].Key == keyB,
    "The active job has a start time and leaves the queued list without pretending an update succeeded.");
var activeObservation = progress.Observe();
Check(activeObservation.BusyKeys.ToHashSet().SetEquals(activeObservation.Sync.Queued.Select(j => j.Key)
    .Concat(activeObservation.Sync.AwaitingObservation.Select(j => j.Key)).Append(activeObservation.Sync.Active!.Key)),
    "The busy keys and phase lists are captured together as one coherent schedule observation.");
Check(queuedProgress.Queued[0].StartedAt is null && queuedProgress.Active is null,
    "Previously returned job records remain unchanged when a request starts.");
queuedProgress.Queued.Clear();
Check(progress.Progress.Queued.Count == 1,
    "A caller cannot mutate the live queue through a returned progress list.");
var beforeCompletion = progress.BeginScan();
Check(progress.Progress is { Scanning: true, ScanStartedAt: not null } && beforeCompletion.Count == 0,
    "Beginning an observation exposes scan activity and atomically captures only prior completions.");
progress.Complete(keyA, "{\"fetched\":true,\"automaticMain\":true}");
var completedProgress = progress.Progress;
Check(activeObservation.Sync.Active?.Key == keyA && activeObservation.Sync.AwaitingObservation.Count == 0,
    "An earlier coherent observation stays unchanged after an active job completes.");
Check(completedProgress.Active is null && completedProgress.AwaitingObservation.Single() is { Outcome: "checked", FinishedAt: not null }
    && completedProgress.LastCompleted?.Outcome == "checked" && Busy(progress, keyA, keyB),
    "A successful GitHub check awaits publication and reports checked, without claiming the main checkout was updated.");
progress.Published(beforeCompletion);
Check(progress.Progress.AwaitingObservation.Count == 1 && Busy(progress, keyA, keyB),
    "A scan that began before completion cannot remove the awaiting-observation job.");
progress.EndScan();
Check(progress.Progress is { Scanning: false, ScanStartedAt: null },
    "Finishing or canceling an observation clears only its live scan activity.");
Check(progress.Start(keyB), "Another queued repository can start while a prior completion awaits observation.");
var coveringScan = progress.BeginScan();
progress.Complete(keyB, "{\"fetched\":false}");
Check(progress.Progress.LastCompleted is { Key: var failedKey, Outcome: "failed", StartedAt: not null, FinishedAt: not null }
    && failedKey == keyB,
    "A completed worker's explicit false result is a failed check with bounded completion history.");
var failedCompletion = progress.Progress.LastCompleted;
progress.Complete(keyB, "{\"fetched\":true}");
progress.Complete("unknown", "{\"fetched\":true}");
Check(progress.Progress.LastCompleted == failedCompletion,
    "Duplicate or unknown completions cannot overwrite a real outcome or invent a successful job.");
progress.Published(coveringScan);
Check(progress.Progress.AwaitingObservation.Single().Key == keyB && Busy(progress, keyB),
    "Publication removes only the covered generation while a later completion remains awaiting observation.");
progress.EndScan();
progress.Published(progress.CaptureCompleted());
Check(!progress.BusyKeys.Any() && progress.Progress.AwaitingObservation.Count == 0
    && progress.Progress.LastCompleted == failedCompletion,
    "The last completion remains available after all busy jobs are published.");
foreach (var missing in new string?[] { null, "", "{}", "not JSON", "{\"fetched\":\"true\"}", "{\"fetched\":null}", "true" }) {
    Check(progress.TryQueue(keyA) && progress.Start(keyA), "An unconfirmed worker fixture starts from an actual queued job.");
    progress.Complete(keyA, missing);
    Check(progress.Progress.LastCompleted?.Outcome == "unconfirmed"
        && progress.Progress.LastCompleted.FinishedAt.HasValue && progress.Progress.Active is null,
        "Timeout, cancellation or missing/malformed worker results finish without a phantom successful check.");
    progress.Published(progress.CaptureCompleted());
}
Check(new RepositoryRefreshSchedule().Progress.LastCompleted is null,
    "Completion history is owned by the running schedule rather than restored from another reader instance.");
var legacySnapshot = JsonSerializer.Deserialize<RepositorySnapshot>(
    "{\"schemaVersion\":1,\"machineName\":\"fixture\",\"observedAt\":\"2026-11-23T00:00:00Z\",\"repositories\":[],\"refreshing\":[]}",
    new JsonSerializerOptions(JsonSerializerDefaults.Web));
Check(legacySnapshot is { Sync: null, SchemaVersion: 1 },
    "Existing repository snapshots remain compatible when optional live progress is absent.");

Console.WriteLine($"{checks} file root and repository refresh checks passed.");
