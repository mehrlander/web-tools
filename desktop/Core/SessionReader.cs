using System.Globalization;
using System.Text;
using System.Text.Json;
using Microsoft.Data.Sqlite;

namespace WebTools.Desktop;

// Local session metadata stays local. Read only titles, timestamps, workspace
// names and lifecycle markers, never prompts, replies or approval contents.
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
        ReadGemini("antigravity-worker", "Gemini worker", now, sessions, notices);
        return new(sessions.Where(s => s.State == "working" || now - s.UpdatedAt < TimeSpan.FromMinutes(30))
            .OrderByDescending(s => s.State == "working").ThenByDescending(s => s.UpdatedAt).Take(8).ToList(), notices);
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
            command.CommandText = "SELECT id,rollout_path,COALESCE(NULLIF(name,''),NULLIF(title,''),'Codex session'),cwd "
                + "FROM threads WHERE archived=0 AND source NOT LIKE '%subagent%' ORDER BY updated_at_ms DESC LIMIT 16";
            using var rows = command.ExecuteReader();
            while (rows.Read()) {
                var id = rows.GetString(0);
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
                    items.Add(new(id, "Codex", rows.GetString(2), state, cursor.UpdatedAt, rows.IsDBNull(3) ? "" : rows.GetString(3)));
                } catch (IOException) { notices.Add("A Codex session is temporarily unavailable."); }
            }
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
            using var command = connection.CreateCommand();
            command.CommandText = "SELECT conversation_id,title,status,not_fully_idle,killed,last_modified_time "
                + "FROM conversation_summaries ORDER BY last_modified_time DESC LIMIT 16";
            using var rows = command.ExecuteReader();
            while (rows.Read()) {
                if (!DateTimeOffset.TryParse(rows.IsDBNull(5) ? "" : rows.GetString(5), CultureInfo.InvariantCulture,
                    DateTimeStyles.AssumeUniversal, out var updated) || updated.Year < 2000) continue;
                var reportedRunning = !rows.IsDBNull(2) && rows.GetString(2) == "CASCADE_RUN_STATUS_RUNNING";
                var busy = !rows.IsDBNull(3) && rows.GetInt64(3) != 0;
                var killed = !rows.IsDBNull(4) && rows.GetInt64(4) != 0;
                var state = killed ? "interrupted" : reportedRunning || busy ? now - updated <= Fresh ? "working" : "quiet" : "idle";
                items.Add(new(rows.GetString(0), provider, rows.IsDBNull(1) ? provider + " session" : rows.GetString(1), state, updated, ""));
            }
        } catch (Exception ex) when (ex is SqliteException or IOException or UnauthorizedAccessException) {
            notices.Add(provider + " session metadata is unavailable.");
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

    public void Read(string path)
    {
        using var file = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
        var length = file.Length;
        if (length < offset) { offset = 0; State = "recent"; lifecycleAt = default; UpdatedAt = default; turn = ""; }
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
            if (Activity.Text(root, "type") != "event_msg") return;
            var payload = Activity.Child(root, "payload");
            var type = Activity.Text(payload, "type");
            var at = Activity.Date(root, "timestamp");
            if (at > UpdatedAt) UpdatedAt = at;
            var rootTurn = Activity.Text(payload, "root_turn_id", Activity.Text(payload, "turn_id"));
            if (type == "task_started" && at >= lifecycleAt) { State = "working"; turn = rootTurn; lifecycleAt = at; }
            if (type is "task_complete" or "turn_aborted" && at >= lifecycleAt && (turn.Length == 0 || rootTurn.Length == 0 || rootTurn == turn)) {
                State = type == "task_complete" ? "idle" : "interrupted";
                lifecycleAt = at;
            }
        } catch (JsonException) { }
    }
}
