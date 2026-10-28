using System.Globalization;
using System.Text;
using System.Text.Json;
using Microsoft.Data.Sqlite;

namespace WebTools.Desktop;

// Retain local metadata, lifecycle markers and short commentary updates.
// Full prompts, replies and approval contents are not collected.
public sealed class SessionReader(string profile)
{
    private readonly Dictionary<string, CodexCursor> cursors = new(StringComparer.OrdinalIgnoreCase);
    private static readonly TimeSpan Fresh = TimeSpan.FromMinutes(3);

    public SessionSnapshot Read(DateTimeOffset now)
    {
        var sessions = new List<LocalSession>();
        var notices = new List<string>();
        ReadCodex(now, sessions, notices);
        ReadGemini("antigravity", "Gemini", now, sessions, notices);
        // Headless inference conversations belong to the dedicated worker and
        // errand cards, rather than appearing as fresh user work each time.
        ReadClaude(now, sessions, notices);
        return new(sessions.Where(s => s.UpdatedAt <= now.AddMinutes(1) && now - s.UpdatedAt < TimeSpan.FromDays(1))
            .OrderByDescending(s => s.State == "working").ThenByDescending(s => s.UpdatedAt).Take(24).ToList(), notices);
    }

    private static SqliteConnection Open(string path)
    {
        var connection = new SqliteConnection(new SqliteConnectionStringBuilder {
            DataSource = path, Mode = SqliteOpenMode.ReadOnly, Pooling = false, DefaultTimeout = 1
        }.ToString());
        connection.Open();
        return connection;
    }

    private void ReadCodex(DateTimeOffset now, List<LocalSession> items, List<string> notices)
    {
        var root = Path.Combine(profile, ".codex");
        if (!Directory.Exists(root)) return;
        try {
            var database = Directory.EnumerateFiles(root, "state_*.sqlite")
                .OrderByDescending(p => int.TryParse(Path.GetFileNameWithoutExtension(p)[6..], out var version) ? version : 0).FirstOrDefault();
            if (database is null) return;
            using var connection = Open(database);
            using var command = connection.CreateCommand();
            command.CommandText = "SELECT id,rollout_path,COALESCE(NULLIF(name,''),NULLIF(title,''),'Codex session'),cwd,source "
                + "FROM threads WHERE archived=0 ORDER BY updated_at_ms DESC LIMIT 64";
            using var rows = command.ExecuteReader();
            var found = new Dictionary<string, (LocalSession Session, string Parent)>();
            while (rows.Read()) {
                var id = rows.GetString(0);
                var origin = rows.IsDBNull(4) ? "" : rows.GetString(4);
                var parent = "";
                if (origin.Contains("subagent", StringComparison.OrdinalIgnoreCase)) {
                    try {
                        using var source = JsonDocument.Parse(origin);
                        parent = Activity.Text(Activity.Child(Activity.Child(source.RootElement, "subagent"), "thread_spawn"), "parent_thread_id");
                    } catch (JsonException) { }
                    if (parent.Length == 0) continue; // Internal approval agents are not delegated user work.
                }
                var path = rows.GetString(1);
                if (path.StartsWith(@"\\?\", StringComparison.Ordinal)) path = path[4..];
                // A metadata row must not redirect the reader to arbitrary files.
                var allowed = Path.GetFullPath(Path.Combine(root, "sessions")) + Path.DirectorySeparatorChar;
                if (!Path.GetFullPath(path).StartsWith(allowed, StringComparison.OrdinalIgnoreCase) || !File.Exists(path)) continue;
                if (!cursors.TryGetValue(path, out var cursor)) cursors[path] = cursor = new();
                try {
                    cursor.Read(path);
                    if (cursor.UpdatedAt.Year < 2000) continue;
                    var state = cursor.State == "working" && now - cursor.UpdatedAt > Fresh ? "quiet" : cursor.State;
                    found[id] = (new(id, "Codex", rows.GetString(2), state, cursor.UpdatedAt, rows.IsDBNull(3) ? "" : rows.GetString(3), cursor.Detail), parent);
                } catch (IOException) { notices.Add("A Codex session is temporarily unavailable."); }
            }
            AddGrouped(found, items, now);
        } catch (Exception ex) when (ex is SqliteException or IOException or UnauthorizedAccessException) {
            notices.Add("Codex session metadata is unavailable.");
        }
    }

    private void ReadGemini(string directory, string provider, DateTimeOffset now,
        List<LocalSession> items, List<string> notices)
    {
        var path = Path.Combine(profile, ".gemini", directory, "conversation_summaries.db");
        if (!File.Exists(path)) return;
        try {
            using var connection = Open(path);
            using var schema = connection.CreateCommand();
            schema.CommandText = "PRAGMA table_info(conversation_summaries)";
            var hasParent = false;
            using (var fields = schema.ExecuteReader()) while (fields.Read()) hasParent |= fields.GetString(1) == "parent_conversation_id";
            using var command = connection.CreateCommand();
            command.CommandText = "SELECT conversation_id,title,status,not_fully_idle,killed,last_modified_time "
                + (hasParent ? ",parent_conversation_id " : ",'' ")
                + "FROM conversation_summaries ORDER BY last_modified_time DESC LIMIT 128";
            using var rows = command.ExecuteReader();
            var found = new Dictionary<string, (LocalSession Session, string Parent)>();
            while (rows.Read()) {
                if (!DateTimeOffset.TryParse(rows.IsDBNull(5) ? "" : rows.GetString(5), CultureInfo.InvariantCulture,
                    DateTimeStyles.AssumeUniversal, out var updated) || updated.Year < 2000) continue;
                var reportedRunning = !rows.IsDBNull(2) && rows.GetString(2) == "CASCADE_RUN_STATUS_RUNNING";
                var busy = !rows.IsDBNull(3) && rows.GetInt64(3) != 0;
                var killed = !rows.IsDBNull(4) && rows.GetInt64(4) != 0;
                var state = killed ? "interrupted" : reportedRunning || busy ? now - updated <= Fresh ? "working" : "quiet" : "idle";
                var detail = state switch { "working" => "Conversation running", "quiet" => "No recent event", "interrupted" => "Conversation interrupted", _ => "Conversation idle" };
                var title = rows.IsDBNull(1) ? "" : rows.GetString(1);
                found[rows.GetString(0)] = (new(rows.GetString(0), provider, string.IsNullOrWhiteSpace(title) ? provider + " work" : title,
                    state, updated, "", detail), rows.IsDBNull(6) ? "" : rows.GetString(6));
            }
            AddGrouped(found, items, now);
        } catch (Exception ex) when (ex is SqliteException or IOException or UnauthorizedAccessException) {
            notices.Add(provider + " session metadata is unavailable.");
        }
    }

    private static void AddGrouped(Dictionary<string, (LocalSession Session, string Parent)> found, List<LocalSession> items, DateTimeOffset now)
    {
        string Root(string id) {
            var seen = new HashSet<string> { id };
            while (found.TryGetValue(id, out var entry) && found.ContainsKey(entry.Parent) && seen.Add(entry.Parent)) id = entry.Parent;
            return id;
        }
        foreach (var group in found.Values.GroupBy(r => Root(r.Session.Id))) {
            var parent = found[group.Key].Session;
            var members = group.Select(r => r.Session).Where(r => r.UpdatedAt <= now.AddMinutes(1) && now - r.UpdatedAt < TimeSpan.FromDays(1)).ToList();
            if (members.Count == 0) continue;
            var at = members.Max(r => r.UpdatedAt);
            var state = members.Any(r => r.State == "working") ? "working" : members.Any(r => r.State == "quiet") ? "quiet" : members.Any(r => r.State == "interrupted") ? "interrupted" : members.First().State;
            var count = members.Count(r => r.Id != parent.Id);
            items.Add(parent with { State = state, UpdatedAt = at,
                Detail = count > 0 ? "Delegated work: " + count + (count == 1 ? " agent" : " agents") : parent.Detail,
                Work = count > 0 ? new(at, count, [], members.Where(r => r.Id != parent.Id).Select(r => r.Id).ToList()) : null });
        }
    }

    private void ReadClaude(DateTimeOffset now, List<LocalSession> items, List<string> notices)
    {
        var root = Path.Combine(profile, "AppData", "Roaming", "Claude", "claude-code-sessions");
        if (!Directory.Exists(root)) return;
        try {
            foreach (var path in Directory.EnumerateFiles(root, "local_*.json", SearchOption.AllDirectories)
                .OrderByDescending(File.GetLastWriteTimeUtc).Take(24)) {
                try {
                    if (new FileInfo(path).Length > 1024 * 1024) continue;
                    using var document = JsonDocument.Parse(File.ReadAllText(path));
                    var row = document.RootElement;
                    if (Activity.Child(row, "isArchived").ValueKind == JsonValueKind.True) continue;
                    var lastActivity = Activity.Child(row, "lastActivityAt");
                    if (lastActivity.ValueKind != JsonValueKind.Number || !lastActivity.TryGetInt64(out var milliseconds)) continue;
                    var at = DateTimeOffset.FromUnixTimeMilliseconds(milliseconds);
                    if (now - at > TimeSpan.FromDays(1)) continue;
                    // A desktop metadata timestamp proves recent activity, not a running turn.
                    items.Add(new(Activity.Text(row, "cliSessionId", Activity.Text(row, "sessionId")), "Claude",
                        Activity.Text(row, "title", "Claude session"), "recent", at, Activity.Text(row, "cwd"), "Local session updated"));
                } catch (Exception ex) when (ex is JsonException or IOException or ArgumentOutOfRangeException) { }
            }
        } catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) {
            notices.Add("Claude local metadata is unavailable.");
        }
    }
}

public sealed class CodexCursor
{
    private long offset;
    private string turn = "";
    private DateTimeOffset lifecycleAt;
    public DateTimeOffset UpdatedAt { get; private set; }
    public string State { get; private set; } = "recent";
    public string Detail { get; private set; } = "Session updated";

    public void Read(string path)
    {
        using var file = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
        var length = file.Length;
        if (length < offset) { offset = 0; State = "recent"; Detail = "Session updated"; lifecycleAt = default; UpdatedAt = default; turn = ""; }
        const int maximum = 8 * 1024 * 1024;
        var skipPartial = length - offset > maximum;
        if (skipPartial) offset = length - maximum;
        var bytes = new byte[(int)(length - offset)];
        file.Position = offset;
        var read = 0;
        while (read < bytes.Length) { var got = file.Read(bytes, read, bytes.Length - read); if (got == 0) break; read += got; }
        if (read == 0) return;
        var last = Array.LastIndexOf(bytes, (byte)'\n', read - 1, read);
        if (last < 0) return; // Leave an incomplete append for the next pass.
        var start = skipPartial ? Array.IndexOf(bytes, (byte)'\n', 0, last + 1) + 1 : 0;
        foreach (var line in Encoding.UTF8.GetString(bytes, start, last + 1 - start).Split('\n', StringSplitOptions.RemoveEmptyEntries))
            Observe(line);
        offset += last + 1;
    }

    public void Observe(string line)
    {
        try {
            using var document = JsonDocument.Parse(line);
            var root = document.RootElement;
            var payload = Activity.Child(root, "payload");
            var at = Activity.Date(root, "timestamp");
            if (Activity.Text(root, "type") == "response_item") {
                if (Activity.Text(payload, "type") == "message" && Activity.Text(payload, "role") == "assistant"
                    && Activity.Text(payload, "phase") == "commentary" && State == "working" && at >= lifecycleAt) {
                    var content = Activity.Child(payload, "content");
                    if (content.ValueKind == JsonValueKind.Array) {
                        Progress(string.Join(' ', content.EnumerateArray().Where(c => Activity.Text(c, "type") == "output_text")
                            .Select(c => Activity.Text(c, "text"))));
                        if (at > UpdatedAt) UpdatedAt = at;
                    }
                }
                return;
            }
            if (Activity.Text(root, "type") != "event_msg") return;
            var type = Activity.Text(payload, "type");
            if (at > UpdatedAt) UpdatedAt = at;
            var rootTurn = Activity.Text(payload, "root_turn_id", Activity.Text(payload, "turn_id"));
            if (type == "task_started" && at >= lifecycleAt) { State = "working"; Detail = "Turn started"; turn = rootTurn; lifecycleAt = at; }
            if (type == "agent_message" && Activity.Text(payload, "phase") == "commentary" && State == "working" && at >= lifecycleAt) {
                Progress(Activity.Text(payload, "message"));
            }
            if (type is "task_complete" or "turn_aborted" && at >= lifecycleAt && (turn.Length == 0 || rootTurn.Length == 0 || rootTurn == turn)) {
                State = type == "task_complete" ? "idle" : "interrupted";
                Detail = type == "task_complete" ? "Turn finished" : "Turn interrupted";
                lifecycleAt = at;
            }
        } catch (JsonException) { }
    }

    private void Progress(string message)
    {
        var paragraph = message.Split("\n\n", 2)[0].Replace("**", "").Replace("`", "");
        var text = string.Join(' ', paragraph.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        if (text.Length > 0) Detail = text.Length > 220 ? text[..220] + "…" : text;
    }
}
