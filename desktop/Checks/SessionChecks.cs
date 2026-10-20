using System.Text.Json;
using Microsoft.Data.Sqlite;
using WebTools.Desktop;

static class SessionChecks
{
    public static void Run(Action<bool, string> check)
    {
        var now = DateTimeOffset.Parse("2026-10-20T20:00:00Z");
        string Event(string type, string turn, int seconds = 0) => JsonSerializer.Serialize(new {
            timestamp = now.AddSeconds(seconds), type = "event_msg", payload = new { type, root_turn_id = turn }
        });
        var cursor = new CodexCursor();
        cursor.Observe(Event("task_started", "current"));
        cursor.Observe(Event("task_complete", "previous", 1));
        check(cursor.State == "working", "A late completion from another turn does not finish current work.");
        cursor.Observe(Event("task_complete", "current", 2));
        check(cursor.State == "idle", "A matching Codex completion settles its current turn.");
        cursor.Observe(Event("task_started", "next", 3));
        cursor.Observe(Event("turn_aborted", "next", 4));
        check(cursor.State == "interrupted", "An aborted Codex turn appears interrupted.");
        cursor.Observe("{broken append");
        cursor.Observe(JsonSerializer.Serialize(new { timestamp = now.AddSeconds(5), type = "response_item",
            payload = new { type = "task_started", root_turn_id = "spoof" } }));
        check(cursor.State == "interrupted", "Malformed records and response content cannot create working sessions.");

        var fixture = Path.Combine(Path.GetTempPath(), "desktop-sessions-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(fixture);
        try {
            var codex = Path.Combine(fixture, ".codex");
            var logs = Path.Combine(codex, "sessions");
            Directory.CreateDirectory(logs);
            var rollout = Path.Combine(logs, "current.jsonl");
            File.WriteAllText(rollout, Event("task_started", "current") + "\n");
            var partial = new CodexCursor();
            partial.Read(rollout);
            File.AppendAllText(rollout, Event("task_complete", "current", 1));
            partial.Read(rollout);
            check(partial.State == "working", "A partial session append waits for the complete JSONL record.");
            File.AppendAllText(rollout, "\n");
            partial.Read(rollout);
            partial.Read(rollout);
            check(partial.State == "idle", "A completed append updates once and an unchanged file remains stable.");
            File.WriteAllText(rollout, Event("task_started", "replacement") + "\n");
            partial.Read(rollout);
            check(partial.State == "working", "A truncated session file resets its incremental cursor.");

            void Database(string path, string sql, Action<SqliteCommand>? configure = null) {
                using var db = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = path, Pooling = false }.ToString());
                db.Open();
                using var command = db.CreateCommand();
                command.CommandText = sql;
                configure?.Invoke(command);
                command.ExecuteNonQuery();
            }
            var codexDb = Path.Combine(codex, "state_5.sqlite");
            Database(codexDb, "CREATE TABLE threads(id TEXT,rollout_path TEXT,name TEXT,title TEXT,cwd TEXT,archived INTEGER,source TEXT,updated_at_ms INTEGER);"
                + "INSERT INTO threads VALUES('local',$path,'Laptop project','Original title','C:/fixture',0,'vscode',1);"
                + "INSERT INTO threads VALUES('guardian',$path,'Approval review','','',0,'subagent',2);"
                + "INSERT INTO threads VALUES('outside',$outside,'Unrelated file','','',0,'vscode',3);",
                c => { c.Parameters.AddWithValue("$path", rollout); c.Parameters.AddWithValue("$outside", Path.Combine(fixture, "outside.jsonl")); });
            File.WriteAllText(Path.Combine(fixture, "outside.jsonl"), Event("task_started", "outside") + "\n");
            var gemini = Path.Combine(fixture, ".gemini", "antigravity");
            Directory.CreateDirectory(gemini);
            var geminiDb = Path.Combine(gemini, "conversation_summaries.db");
            Database(geminiDb, "CREATE TABLE conversation_summaries(conversation_id TEXT,title TEXT,status TEXT,not_fully_idle INTEGER,killed INTEGER,last_modified_time TEXT);"
                + "INSERT INTO conversation_summaries VALUES('gemini','Current Gemini','CASCADE_RUN_STATUS_RUNNING',1,0,$now);"
                + "INSERT INTO conversation_summaries VALUES('invalid','Invalid clock','CASCADE_RUN_STATUS_RUNNING',1,0,'0001-01-01T00:00:00Z');",
                c => c.Parameters.AddWithValue("$now", now.ToString("O")));
            var before = File.ReadAllBytes(codexDb);
            var reader = new SessionReader(fixture);
            var live = reader.Read(now);
            check(live.Items.Count == 2 && live.Items.All(s => s.State == "working")
                && live.Items.Any(s => s.Title == "Laptop project"),
                "Local metadata identifies working Codex and Gemini sessions, excluding internal agents, invalid dates and outside paths.");
            var quiet = reader.Read(now.AddMinutes(4));
            check(quiet.Items.Count == 2 && quiet.Items.All(s => s.State == "quiet"),
                "A stale running flag becomes quiet instead of claiming continued execution.");
            File.AppendAllText(rollout, Event("task_complete", "replacement", 5) + "\n");
            check(reader.Read(now.AddSeconds(6)).Items.Single(s => s.Provider == "Codex").State == "idle",
                "A polling reader sees a session finish without reopening its metadata source.");
            check(reader.Read(now.AddHours(1)).Items.Count == 0, "Old quiet and idle sessions leave the current activity list.");
            check(before.SequenceEqual(File.ReadAllBytes(codexDb)), "Session polling leaves the source database unchanged.");
            Database(geminiDb, "DROP TABLE conversation_summaries;");
            var changedSchema = reader.Read(now.AddSeconds(6));
            check(changedSchema.Notices.Count == 1 && changedSchema.Items.Count == 1,
                "An unavailable agent schema leaves the other agent's sessions readable.");
        } finally {
            if (Directory.GetParent(Path.GetFullPath(fixture))?.FullName == Path.TrimEndingDirectorySeparator(Path.GetFullPath(Path.GetTempPath())))
                Directory.Delete(fixture, recursive: true);
        }
    }
}
