using System.Text;
using System.Text.Json;
using System.Diagnostics;

namespace WebTools.Desktop;

// Read a single immutable Git revision. Fetch changes remote-tracking refs only;
// the worker's index, checkout, branches and local edits are never changed.
public sealed class ErrandReader(string repository)
{
    private sealed record RemoteState(DateTimeOffset Attempt, DateTimeOffset? SyncedAt, bool Connected, string? Notice, double Milliseconds);
    private RemoteState remote = new(default, null, false, null, 0);
    private readonly SemaphoreSlim syncGate = new(1, 1);
    private string? revision;
    private string? recordNotice;
    private List<Errand> cached = [];
    private DateTimeOffset cachedSeen;
    private DateTimeOffset cloudAttempt;
    private string? cloudSha;
    private string? cloudContentNotice;
    private CloudSnapshot cloud = new([], null, null);

    private Task<string> Git(params string[] args) => Commands.Text("git", args, repository);

    public double SyncMilliseconds => remote.Milliseconds;
    public CloudSnapshot Cloud => cloud;

    public async Task Synchronize(bool force = false)
    {
        if (!Directory.Exists(repository) || !force && DateTimeOffset.UtcNow - remote.Attempt < TimeSpan.FromSeconds(5)) return;
        if (!await syncGate.WaitAsync(0)) return;
        var previous = remote;
        var attempted = DateTimeOffset.UtcNow;
        var watch = Stopwatch.StartNew();
        try {
            await Git("fetch", "--quiet", "--no-tags", "origin", "+refs/heads/background:refs/remotes/origin/background");
            remote = new(attempted, DateTimeOffset.UtcNow, true, null, watch.Elapsed.TotalMilliseconds);
        } catch {
            remote = new(attempted, previous.SyncedAt, false,
                "GitHub could not be reached. Showing the last available activity records.", watch.Elapsed.TotalMilliseconds);
        } finally {
            if (DateTimeOffset.UtcNow - cloudAttempt > TimeSpan.FromSeconds(30)) {
                cloudAttempt = DateTimeOffset.UtcNow;
                try {
                    await Git("fetch", "--quiet", "--no-tags", "origin", "+refs/heads/main:refs/remotes/origin/main");
                    var sha = await Git("rev-parse", "--verify", "refs/remotes/origin/main:state/sessions.json");
                    string? background = null;
                    string? topicSha = null;
                    try {
                        background = await Git("rev-parse", "--verify", "refs/remotes/origin/background^{commit}");
                        topicSha = await Git("rev-parse", "--verify", background + ":state/session-topics.json");
                    } catch { }
                    var signature = sha + ":" + topicSha;
                    if (signature != cloudSha) {
                        var parsed = CloudSessions.Parse(await Git("cat-file", "blob", sha), DateTimeOffset.UtcNow);
                        if (topicSha is not null) {
                            try {
                                var rollup = await Git("cat-file", "blob", topicSha);
                                var paths = SessionCheckpoints.Paths(rollup, parsed.Items);
                                var companions = new Dictionary<string, string>();
                                // A single background revision owns the rollup and all companions.
                                var tree = await Git("ls-tree", "-r", background!, "--", "sessions/topics");
                                var blobs = tree.Split('\n', StringSplitOptions.RemoveEmptyEntries)
                                    .Select(line => line.TrimEnd('\r').Split('\t')).Where(parts => parts.Length == 2)
                                    .ToDictionary(parts => parts[1], parts => parts[0].Split(' ')[2]);
                                var wanted = paths.Where(p => blobs.ContainsKey(p.Value)).ToDictionary(p => p.Key, p => blobs[p.Value]);
                                var contents = await ReadBlobs(wanted.Values.Distinct().ToList());
                                foreach (var (id, blob) in wanted) if (contents.TryGetValue(blob, out var bytes))
                                    companions[id] = Encoding.UTF8.GetString(bytes);
                                parsed = SessionCheckpoints.Enrich(parsed, rollup, companions);
                            } catch { parsed = parsed with { Notice = "Session summaries unavailable; showing recorded session activity." }; }
                        }
                        cloud = parsed;
                        cloudContentNotice = parsed.Notice;
                        cloudSha = signature;
                    } else cloud = cloud with { Notice = cloudContentNotice };
                } catch {
                    cloud = cloud with { Notice = cloud.CapturedAt is null ? "Cloud session records unavailable." : "Cloud sync unavailable; showing saved session records." };
                }
            }
            syncGate.Release();
        }
    }

    public async Task<ActivitySnapshot> Read(DateTimeOffset seenThrough, bool force = false, bool synchronize = true)
    {
        var now = DateTimeOffset.UtcNow;
        if (!Directory.Exists(repository))
            return new(now, null, null, false, "The private activity repository was not found. Check the repositories folder in Settings.", []);
        if (synchronize) await Synchronize(force);
        var state = remote;
        var connected = state.Connected;
        var notice = state.Notice;
        try {
            var current = await Git("rev-parse", "--verify", "refs/remotes/origin/background^{commit}");
            if (current != revision || cachedSeen != seenThrough) {
                var tree = await Git("ls-tree", "-r", current, "--", "errands/requests", "errands/claims", "errands/results", "errands/output");
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
                var requests = files.Keys.Where(p => p.StartsWith("errands/requests/", StringComparison.Ordinal) && p.Count(c => c == '/') == 2)
                    .OrderDescending(StringComparer.Ordinal).ToList();
                var selected = requests.Take(80).Concat(requests.Where(p => !files.ContainsKey(p.Replace("/requests/", "/results/", StringComparison.Ordinal))))
                    .Distinct().ToList();
                var wanted = selected.SelectMany(p => new[] { p, p.Replace("/requests/", "/claims/", StringComparison.Ordinal), p.Replace("/requests/", "/results/", StringComparison.Ordinal) })
                    .Where(files.ContainsKey).ToDictionary(p => p, p => files[p]);
                var blobs = await ReadBlobs(wanted.Values.Distinct().ToList());
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
                cached = jobs.OrderByDescending(j => j.IsOpen).ThenByDescending(j => j.UpdatedAt).ToList();
                cachedSeen = seenThrough;
                recordNotice = invalid.Count == 0 ? null : $"{invalid.Count} unreadable activity record(s) were omitted. Open Web Tools to inspect the source records.";
                revision = current;
            }
        } catch {
            connected = false;
            notice = revision is null ? "Activity records are unavailable. The private repository needs its background branch and GitHub access."
                : "Activity could not be read. Keeping the previous snapshot until the next refresh.";
        }
        var notices = new[] { notice, recordNotice }.Where(n => n is not null);
        return new(DateTimeOffset.UtcNow, state.SyncedAt, revision, connected, string.Join(" ", notices) is { Length: > 0 } text ? text : null, cached);
    }

    private async Task<Dictionary<string, byte[]>> ReadBlobs(List<string> shas)
    {
        if (shas.Count == 0) return [];
        var bytes = await Commands.Run("git", ["cat-file", "--batch"], repository,
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
