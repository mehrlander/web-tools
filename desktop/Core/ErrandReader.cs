using System.Text;
using System.Text.Json;

namespace WebTools.Desktop;

// Read a single immutable Git revision. Fetch changes remote-tracking refs only;
// the worker's index, checkout, branches and local edits are never changed.
public sealed class ErrandReader(string repository)
{
    private DateTimeOffset lastFetchAttempt;
    private DateTimeOffset? syncedAt;
    private string? revision;
    private bool connected;
    private string? notice;
    private string? recordNotice;
    private List<Errand> cached = [];
    private DateTimeOffset cachedSeen;

    private Task<string> Git(params string[] args) => Commands.Text("git", args, repository);

    public async Task<ActivitySnapshot> Read(DateTimeOffset seenThrough, bool force = false)
    {
        var now = DateTimeOffset.UtcNow;
        if (!Directory.Exists(repository))
            return new(now, null, null, false, "The private activity repository was not found. Check the repositories folder in Settings.", []);
        if (force || now - lastFetchAttempt > TimeSpan.FromSeconds(60)) {
            lastFetchAttempt = now;
            try {
                await Git("fetch", "--quiet", "--no-tags", "origin", "+refs/heads/background:refs/remotes/origin/background");
                syncedAt = DateTimeOffset.UtcNow;
                connected = true;
                notice = null;
            } catch {
                connected = false;
                notice = "GitHub could not be reached. Showing the last available activity records.";
            }
        }
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
        return new(DateTimeOffset.UtcNow, syncedAt, revision, connected, string.Join(" ", notices) is { Length: > 0 } text ? text : null, cached);
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
