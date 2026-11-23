using WebTools.Desktop;

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

Console.WriteLine($"{checks} file root and repository refresh checks passed.");
