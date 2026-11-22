using System.Text;
using System.Text.Json;
using System.Diagnostics;

namespace WebTools.Desktop;

// Read a single immutable Git revision. Fetch changes remote-tracking refs only;
// the worker's index, checkout, branches and local edits are never changed.
public sealed class ErrandReader(string repository, Func<DateTimeOffset>? clock = null,
    Func<string[], byte[]?, int, Task<byte[]>>? executeGit = null)
{
    private sealed record RemoteState(DateTimeOffset Attempt, DateTimeOffset? SyncedAt, bool Connected, string? Notice, double Milliseconds);
    private sealed record CachedActivity(DateTimeOffset ReadAt, DateTimeOffset? SyncedAt,
        string? Revision, List<Errand> Errands, string? RecordNotice);
    private RemoteState remote = new(default, null, false, null, 0);
    private CachedActivity publishedActivity = new(default, null, null, [], null);
    private readonly SemaphoreSlim syncGate = new(1, 1);
    private readonly SemaphoreSlim readGate = new(1, 1);
    private readonly object healthGate = new();
    private FeedHealth errandsHealth = new(), sessionsHealth = new(), summariesHealth = new();
    private bool synchronizing, retryRequested;
    private DateTimeOffset manualRetryAfter;
    private long seenTicks;
    private int bootstrapped;
    private string? errandsNotice, sessionsNotice, summariesNotice;
    private string? revision;
    private string? recordNotice;
    private List<Errand> cached = [];
    private string? cloudContentNotice;
    private CloudSnapshot sessionRecords = new([], null, null);
    private string? sessionSha, summarySignature, renderedSignature;
    private CloudSnapshot cloud = new([], null, null);
    private string? summaryRollup;
    private Dictionary<string, string> summaryCompanions = [];
    private Dictionary<string, string> turns = [];

    private Task<byte[]> RunGit(string[] args, byte[]? input = null, int timeout = 25) =>
        executeGit?.Invoke(args, input, timeout) ?? Commands.Run("git", args, repository, input, timeout);
    private async Task<string> Git(params string[] args) => Encoding.UTF8.GetString(await RunGit(args)).Trim();
    private async Task Fetch(string branch) => _ = await RunGit(
        ["fetch", "--quiet", "--no-tags", "origin", $"+refs/heads/{branch}:refs/remotes/origin/{branch}"], timeout: 45);
    private DateTimeOffset Now => clock?.Invoke() ?? DateTimeOffset.UtcNow;

    public SyncHealth Health { get { lock (healthGate) return new(errandsHealth, sessionsHealth, summariesHealth); } }
    private List<string> SyncNotices { get { lock (healthGate) return new[] { errandsNotice, sessionsNotice, summariesNotice }.OfType<string>().Distinct().ToList(); } }
    private static bool Due(FeedHealth feed, DateTimeOffset now) => feed.NextAttemptAt is null || feed.NextAttemptAt <= now;
    private static FeedHealth Begin(FeedHealth feed, DateTimeOffset now) => feed with { State = "refreshing", AttemptedAt = now, NextAttemptAt = null };
    private static FeedHealth Finish(FeedHealth feed, DateTimeOffset now, double elapsed, int interval, string? error = null) =>
        feed with { State = error is null ? "ok" : "error", SucceededAt = error is null ? now : feed.SucceededAt,
            ErrorCode = error, NextAttemptAt = now.AddSeconds(error is null ? interval : 30), DurationMilliseconds = elapsed };
    private static string Failure(Exception error, bool fetch = false) => error switch {
        CommandFailureException { Kind: CommandFailureKind.TimedOut } => "timeout",
        JsonException => "invalid-data",
        _ => fetch ? "fetch-failed" : "read-failed"
    };

    private static List<Errand> Project(List<Errand> items, DateTimeOffset seenThrough) => items.Select(item => item with {
        IsNew = (item.State is "reply" or "complete" or "failed" or "declined") && item.UpdatedAt > seenThrough
    }).ToList();

    // A local scan never waits for Git, the read gate or a network refresh.
    // ReadAt and SyncedAt belong to the stored records, not this projection.
    public ActivitySnapshot Cached(DateTimeOffset seenThrough)
    {
        Interlocked.Exchange(ref seenTicks, seenThrough.UtcDateTime.Ticks);
        var value = Volatile.Read(ref publishedActivity);
        var health = Health;
        var notices = SyncNotices;
        var connected = value.SyncedAt is not null && health.Errands.SucceededAt is not null && health.Errands.ErrorCode is null;
        var message = string.Join(" ", new[] { errandsNotice, value.RecordNotice }.OfType<string>());
        return new(value.ReadAt, value.SyncedAt, value.Revision, connected, message.Length == 0 ? null : message, Project(value.Errands, seenThrough)) {
            Sync = health, SyncNotices = notices, RecordNotice = value.RecordNotice
        };
    }

    // Populate saved remote-tracking records once, on the synchronization task.
    // A bootstrap read does not establish a successful remote refresh.
    public async Task Bootstrap()
    {
        if (Interlocked.Exchange(ref bootstrapped, 1) == 0)
            await Read(new DateTimeOffset(Interlocked.Read(ref seenTicks), TimeSpan.Zero), synchronize: false, trackHealth: false);
    }

    // The HTTP action requests work; only the existing synchronization loop runs Git.
    public (int Status, int RetryAfterSeconds) RequestRetry()
    {
        lock (healthGate) {
            if (synchronizing || retryRequested) return (409, 0);
            if (!Directory.Exists(repository)) return (503, 0);
            var now = Now;
            var retryAt = new[] { errandsHealth, sessionsHealth, summariesHealth }
                .Where(f => f.ErrorCode is not null).Select(f => f.NextAttemptAt ?? now)
                .Append(manualRetryAfter).Max();
            if (retryAt > now) return (429, Math.Max(1, (int)Math.Ceiling((retryAt-now).TotalSeconds)));
            retryRequested = true;
            manualRetryAfter = now.AddSeconds(30);
            errandsHealth = errandsHealth with { State = "refreshing", NextAttemptAt = null };
            sessionsHealth = sessionsHealth with { State = "refreshing", NextAttemptAt = null };
            summariesHealth = summariesHealth with { State = "refreshing", NextAttemptAt = null };
            return (202, 0);
        }
    }

    public double SyncMilliseconds => remote.Milliseconds;
    private static CloudSnapshot Window(CloudSnapshot value, DateTimeOffset now) => value with {
        Items = value.Items.Where(s => s.UpdatedAt > now.AddDays(-1)).ToList(),
        Catalog = value.Catalog?.Where(s => s.UpdatedAt > now.AddDays(-7)).ToList()
    };
    public CloudSnapshot Cloud => CloudTurns.Merge(Window(cloud, Now), turns, Now);
    private void PublishRecords()
    {
        var key = sessionSha + ":" + summarySignature;
        if (renderedSignature == key) return;
        cloud = summaryRollup is null ? sessionRecords : SessionCheckpoints.Enrich(sessionRecords, summaryRollup, summaryCompanions);
        renderedSignature = key;
    }

    public async Task Synchronize(bool force = false)
    {
        if (!await syncGate.WaitAsync(0)) return;
        bool backgroundDue, sessionsDue, summariesDue;
        lock (healthGate) {
            var now = Now;
            force |= retryRequested;
            summariesDue = force || Due(summariesHealth, now);
            backgroundDue = force || Due(errandsHealth, now) || summariesDue && errandsHealth.ErrorCode is null;
            if (summariesDue && !backgroundDue) {
                summariesHealth = summariesHealth with { NextAttemptAt = errandsHealth.NextAttemptAt };
                summariesDue = false;
            }
            sessionsDue = force || Due(sessionsHealth, now);
            if (!backgroundDue && !sessionsDue) { syncGate.Release(); return; }
            retryRequested = false;
            synchronizing = true;
            if (backgroundDue) errandsHealth = Begin(errandsHealth, now);
            if (sessionsDue) sessionsHealth = Begin(sessionsHealth, now);
            if (summariesDue) summariesHealth = Begin(summariesHealth, now);
        }
        try {
            var backgroundFresh = false;
            string? backgroundError = null;
            if (backgroundDue) {
                var previous = remote;
                var watch = Stopwatch.StartNew();
                var attempted = Now;
                try {
                    if (!Directory.Exists(repository)) throw new DirectoryNotFoundException();
                    await Fetch("background");
                    backgroundFresh = true;
                    remote = new(attempted, Now, true, null, watch.Elapsed.TotalMilliseconds);
                    var read = await Read(new DateTimeOffset(Interlocked.Read(ref seenTicks), TimeSpan.Zero), synchronize: false, trackHealth: false);
                    if (!read.Connected) throw new IOException();
                    lock (healthGate) {
                        var error = recordNotice is null ? null : "invalid-data";
                        errandsHealth = Finish(errandsHealth, Now, watch.Elapsed.TotalMilliseconds, 5, error);
                        errandsNotice = error is null ? null : "Some activity records could not be read. Showing available records.";
                    }
                } catch (Exception e) {
                    backgroundError = !Directory.Exists(repository) ? "repository-unavailable" : Failure(e, !backgroundFresh);
                    var notice = backgroundError == "repository-unavailable" ? "The private activity repository was not found. Check the repositories folder in Settings."
                        : backgroundFresh ? "Activity could not be read. Keeping the previous snapshot until the next refresh."
                        : "GitHub could not be reached. Showing the last available activity records.";
                    remote = new(attempted, previous.SyncedAt, false, notice, watch.Elapsed.TotalMilliseconds);
                    lock (healthGate) { errandsHealth = Finish(errandsHealth, Now, watch.Elapsed.TotalMilliseconds, 5, backgroundError); errandsNotice = notice; }
                }
            }
            if (sessionsDue) {
                var watch = Stopwatch.StartNew();
                var fetched = false;
                try {
                    if (!Directory.Exists(repository)) throw new DirectoryNotFoundException();
                    await Fetch("main");
                    fetched = true;
                    var sha = await Git("rev-parse", "--verify", "refs/remotes/origin/main:state/sessions.json");
                    if (sha != sessionSha) {
                        sessionRecords = CloudSessions.Parse(await Git("cat-file", "blob", sha), Now);
                        sessionSha = sha;
                    }
                    sessionRecords = Window(sessionRecords, Now);
                    cloudContentNotice = sessionRecords.Notice;
                    // Publish the validated history before reporting success;
                    // the independent summary feed may still be slow or fail.
                    PublishRecords();
                    lock (healthGate) { sessionsHealth = Finish(sessionsHealth, Now, watch.Elapsed.TotalMilliseconds, 30); sessionsNotice = null; }
                } catch (Exception e) {
                    var code = !Directory.Exists(repository) ? "repository-unavailable" : Failure(e, !fetched);
                    lock (healthGate) {
                        sessionsHealth = Finish(sessionsHealth, Now, watch.Elapsed.TotalMilliseconds, 30, code);
                        sessionsNotice = sessionRecords.CapturedAt is null ? "Cloud session records unavailable." : "Cloud sync unavailable; showing saved session records.";
                    }
                }
            }
            if (summariesDue) {
                var watch = Stopwatch.StartNew();
                try {
                    if (!backgroundFresh) throw new IOException();
                    var background = await Git("rev-parse", "--verify", "refs/remotes/origin/background^{commit}");
                    var topicSha = await Git("rev-parse", "--verify", background + ":state/session-topics.json");
                    // Tree identity catches a changed or removed companion even
                    // when the publication has not changed its rollup yet.
                    string? treeSha = null;
                    try { treeSha = await Git("rev-parse", "--verify", background + ":sessions/topics"); } catch { }
                    var records = Window(sessionRecords, Now);
                    var windowKey = string.Join(',', records.Items.Select(s => s.Id)) + ":" + string.Join(',', (records.Catalog ?? []).Select(s => s.Id));
                    var signature = sessionSha + ":" + topicSha + ":" + treeSha + ":" + CloudTurns.SelectionKey(turns, Now) + ":" + windowKey;
                    if (signature != summarySignature) {
                    var rollup = await Git("cat-file", "blob", topicSha);
                    using (var document = JsonDocument.Parse(rollup))
                        if (Activity.Child(document.RootElement, "sessions").ValueKind != JsonValueKind.Object) throw new JsonException();
                    var paths = SessionCheckpoints.Paths(rollup, CloudTurns.TopicCandidates(records, turns, Now));
                    var tree = await Git("ls-tree", "-r", "-l", background, "--", "sessions/topics");
                    var blobs = new Dictionary<string,(string Sha,long Bytes)>();
                    foreach (var line in tree.Split('\n', StringSplitOptions.RemoveEmptyEntries)) {
                        var parts = line.TrimEnd('\r').Split('\t');
                        var fields = parts[0].Split(' ',StringSplitOptions.RemoveEmptyEntries);
                        if (parts.Length == 2 && fields.Length == 4 && fields[1] == "blob"
                            && long.TryParse(fields[3],out var size) && size is >= 0 and <= 2097152) blobs[parts[1]] = (fields[2],size);
                    }
                    var wanted = new Dictionary<string,string>();
                    long remaining = 8 * 1024 * 1024;
                    foreach (var (id,path) in paths) if (blobs.TryGetValue(path,out var blob) && blob.Bytes <= remaining) {
                        wanted[id] = blob.Sha; remaining -= blob.Bytes;
                    }
                    if (wanted.Count != paths.Count) throw new IOException();
                    var contents = await ReadBlobs(wanted.Values.Distinct().ToList());
                    var companions = wanted.Where(p => contents.ContainsKey(p.Value)).ToDictionary(p => p.Key, p => Encoding.UTF8.GetString(contents[p.Value]));
                    if (companions.Count != paths.Count) throw new IOException();
                    using (var rollupDocument = JsonDocument.Parse(rollup)) foreach (var (id,value) in companions) {
                        using var document = JsonDocument.Parse(value);
                        var expectedAt = Activity.Date(Activity.Child(Activity.Child(rollupDocument.RootElement,"sessions"),id),"source_ended");
                        if (Activity.Text(document.RootElement,"short_id") != id || expectedAt.Year < 2000
                            || Activity.Date(document.RootElement,"source_ended") != expectedAt) throw new JsonException();
                    }
                    var enriched = SessionCheckpoints.Enrich(sessionRecords, rollup, companions);
                    summaryRollup = rollup; summaryCompanions = companions;
                    summarySignature = signature;
                    cloud = enriched;
                    renderedSignature = sessionSha + ":" + summarySignature;
                    }
                    lock (healthGate) { summariesHealth = Finish(summariesHealth, Now, watch.Elapsed.TotalMilliseconds, 30); summariesNotice = null; }
                } catch (Exception e) {
                    var code = !Directory.Exists(repository) ? "repository-unavailable" : backgroundError ?? Failure(e);
                    lock (healthGate) {
                        summariesHealth = Finish(summariesHealth, Now, watch.Elapsed.TotalMilliseconds, 30, code);
                        summariesNotice = "Session summaries unavailable; showing recorded session activity.";
                    }
                }
            }
            PublishRecords();
            cloud = cloud with { Notice = sessionsNotice ?? summariesNotice ?? cloudContentNotice };
        } finally {
            lock (healthGate) synchronizing = false;
            syncGate.Release();
        }
    }

    public async Task<ActivitySnapshot> Read(DateTimeOffset seenThrough, bool force = false, bool synchronize = true, bool trackHealth = true)
    {
        Interlocked.Exchange(ref seenTicks, seenThrough.UtcDateTime.Ticks);
        var now = Now;
        if (!Directory.Exists(repository)) {
            const string missing = "The private activity repository was not found. Check the repositories folder in Settings.";
            lock (healthGate) {
                if (errandsHealth.ErrorCode != "repository-unavailable") errandsHealth = Finish(errandsHealth, now, 0, 5, "repository-unavailable");
                if (sessionsHealth.ErrorCode != "repository-unavailable") sessionsHealth = Finish(sessionsHealth, now, 0, 30, "repository-unavailable");
                if (summariesHealth.ErrorCode != "repository-unavailable") summariesHealth = Finish(summariesHealth, now, 0, 30, "repository-unavailable");
                errandsNotice = missing;
            }
            return new(now, remote.SyncedAt, revision, false, missing, cached) {
                Sync = Health, SyncNotices = SyncNotices, RecordNotice = recordNotice };
        }
        if (synchronize) await Synchronize(force);
        await readGate.WaitAsync();
        var state = remote;
        var connected = state.Connected;
        var notice = state.Notice;
        try {
            var current = await Git("rev-parse", "--verify", "refs/remotes/origin/background^{commit}");
            if (current != revision) {
                var tree = await Git("ls-tree", "-r", current, "--", "errands/requests", "errands/claims", "errands/results", "errands/output", "sessions/activity");
                var files = new Dictionary<string, string>(StringComparer.Ordinal);
                var outputs = new HashSet<string>(StringComparer.Ordinal);
                foreach (var line in tree.Split('\n', StringSplitOptions.RemoveEmptyEntries)) {
                    var tab = line.IndexOf('\t');
                    if (tab < 0) continue;
                    var fields = line[..tab].Split(' ');
                    var path = line[(tab + 1)..].TrimEnd('\r');
                    if (path.StartsWith("errands/output/", StringComparison.Ordinal)) {
                        var pieces = path.Split('/');
                        if (pieces.Length > 3) outputs.Add(pieces[2]);
                    } else if (fields.Length == 3 && path.EndsWith(".json", StringComparison.Ordinal)) files[path] = fields[2];
                }
                // Assistant-prefixed filenames do not sort by completion time.
                // Join records before retaining the newest results and every open request.
                var selected = files.Keys.Where(p => p.StartsWith("errands/requests/", StringComparison.Ordinal) && p.Count(c => c == '/') == 2).ToList();
                var wanted = selected.SelectMany(p => new[] { p, p.Replace("/requests/", "/claims/", StringComparison.Ordinal), p.Replace("/requests/", "/results/", StringComparison.Ordinal) })
                    .Where(files.ContainsKey).ToDictionary(p => p, p => files[p]);
                foreach (var path in files.Keys.Where(p => p.StartsWith("sessions/activity/", StringComparison.Ordinal)
                    && p.Split('/') is { Length: 4 } parts && DateOnly.TryParseExact(parts[2], "yyyy-MM-dd", out var day)
                    && day >= DateOnly.FromDateTime(now.UtcDateTime.AddDays(-1)) && day <= DateOnly.FromDateTime(now.UtcDateTime))
                    .OrderDescending(StringComparer.Ordinal).Take(256)) wanted[path] = files[path];
                var blobs = await ReadBlobs(wanted.Values.Distinct().ToList());
                turns = wanted.Where(p => p.Key.StartsWith("sessions/activity/", StringComparison.Ordinal) && blobs.ContainsKey(p.Value))
                    .ToDictionary(p => p.Key, p => Encoding.UTF8.GetString(blobs[p.Value]));
                var invalid = new HashSet<string>();
                JsonElement Parse(string path) {
                    if (!wanted.TryGetValue(path, out var sha) || !blobs.TryGetValue(sha, out var bytes)) return default;
                    try { using var doc = JsonDocument.Parse(bytes); return doc.RootElement.Clone(); }
                    catch (JsonException) { invalid.Add(path); return default; }
                }
                var jobs = new List<Errand>();
                foreach (var path in selected) {
                    var id = Path.GetFileNameWithoutExtension(path);
                    var claimPath = path.Replace("/requests/", "/claims/", StringComparison.Ordinal);
                    var resultPath = path.Replace("/requests/", "/results/", StringComparison.Ordinal);
                    var request = Parse(path); var claim = Parse(claimPath); var result = Parse(resultPath);
                    // A damaged result must never make finished work look queued.
                    if (invalid.Contains(path) || invalid.Contains(claimPath) || invalid.Contains(resultPath)) continue;
                    var job = Activity.Join(id, request, claim, result, outputs.Contains(id), seenThrough);
                    if (job is not null) jobs.Add(job);
                }
                cached = jobs.Where(j => j.IsOpen).Concat(jobs.Where(j => !j.IsOpen)
                    .OrderByDescending(j => j.UpdatedAt).ThenBy(j => j.Id, StringComparer.Ordinal).Take(80))
                    .OrderByDescending(j => j.IsOpen).ThenByDescending(j => j.UpdatedAt).ToList();
                recordNotice = invalid.Count == 0 ? null : $"{invalid.Count} unreadable activity record(s) were omitted. Open Web Tools to inspect the source records.";
                revision = current;
            }
            Volatile.Write(ref publishedActivity, new(Now, state.SyncedAt, revision, cached.ToList(), recordNotice));
        } catch (Exception e) {
            connected = false;
            notice = revision is null ? "Activity records are unavailable. The private repository needs its background branch and GitHub access."
                : "Activity could not be read. Keeping the previous snapshot until the next refresh.";
            if (trackHealth) lock (healthGate) {
                var code = Failure(e);
                if (errandsHealth.State != "error" || errandsHealth.ErrorCode != code)
                    errandsHealth = Finish(errandsHealth, Now, 0, 5, code);
                errandsNotice = notice;
            }
        } finally {
            readGate.Release();
        }
        var notices = new[] { notice, recordNotice }.Where(n => n is not null);
        return new(Now, state.SyncedAt, revision, connected, string.Join(" ", notices) is { Length: > 0 } text ? text : null, Project(cached, seenThrough))
            { Sync = Health, SyncNotices = SyncNotices, RecordNotice = recordNotice };
    }

    private async Task<Dictionary<string, byte[]>> ReadBlobs(List<string> shas)
    {
        if (shas.Count == 0) return [];
        var bytes = await RunGit(["cat-file", "--batch"],
            Encoding.ASCII.GetBytes(string.Join('\n', shas) + "\n"));
        var output = new Dictionary<string, byte[]>();
        var offset = 0;
        while (offset < bytes.Length) {
            var end = Array.IndexOf(bytes, (byte)'\n', offset);
            if (end < 0) throw new IOException("Incomplete Git object header.");
            var header = Encoding.ASCII.GetString(bytes, offset, end - offset).Split(' ');
            if (header.Length != 3 || header[1] != "blob" || !int.TryParse(header[2], out var size)
                || size < 0 || end + 1L + size >= bytes.Length) throw new IOException("Invalid Git object response.");
            output[header[0]] = bytes.AsSpan(end + 1, size).ToArray();
            offset = end + 1 + size + 1;
        }
        return output;
    }
}
