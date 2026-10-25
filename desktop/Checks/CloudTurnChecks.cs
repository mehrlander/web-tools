using System.Text.Json;
using WebTools.Desktop;

static class CloudTurnChecks
{
    public static void Run(Action<bool, string> check)
    {
        var now = DateTimeOffset.UtcNow;
        var at = now.AddSeconds(-20);
        var start = now.AddMinutes(-1);
        var path = $"sessions/activity/{at:yyyy-MM-dd}/aabbccdd.json";
        var row = new { schemaVersion = 1, id = "aabbccdd", provider = "Claude", location = "Cloud",
            agent = "https://claude.ai/code/session_fixture", updatedAt = at, startedAt = start,
            state = "working", prompt = "Investigate a long-running task", response = "", lastTool = "Read" };
        string Encode(object value) => JsonSerializer.Serialize(value);
        CloudSnapshot Merge(string json, CloudSnapshot? records = null, DateTimeOffset? time = null, string? source = null) =>
            CloudTurns.Merge(records ?? new([], null, null), new Dictionary<string, string> { [source ?? path] = json }, time ?? now);
        var working = Merge(Encode(row)).Items.Single();
        check(working is { State: "working", Location: "Cloud", Turn.Prompt: "Investigate a long-running task", Detail: "Using Read" },
            "An explicit prompt/tool signal supplies current cloud work before any Stop record exists.");
        check(Merge(Encode(row), time: now.AddMinutes(4)).Items.Single().State == "quiet",
            "An unfinished cloud turn loses its working status after three minutes without a signal.");
        var idle = row with { state = "idle", response = "The result is ready" };
        check(Merge(Encode(idle)).Items.Single() is { State: "idle", Turn.Response: "The result is ready" },
            "A response signal ends the current turn and retains its prompt and response.");
        var recorded = new CloudSnapshot([new("aabbccdd", "Claude", "A published topic title", "recorded", at.AddMinutes(-1), "",
            "Recorded: pending", "Cloud", new("Prior summary", "Prior checkpoint", at.AddMinutes(-1), null, [], []))], now, null);
        check(Merge(Encode(row), recorded).Items.Single() is { State: "working", Title: "A published topic title", Checkpoint.Headline: "Prior checkpoint" },
            "Fresh turn signals preserve the published title and separate checkpoint.");
        var newer = recorded with { Items = [recorded.Items.Single() with { UpdatedAt = now, Detail = "Recorded: done" }] };
        check(Merge(Encode(row), newer).Items.Single() is { State: "recorded", Detail: "Recorded: done", Turn: not null },
            "A newer published response supersedes delayed working signals without discarding turn details.");
        check(Merge(Encode(row with { agent = "https://claude.ai.evil.test/code/session_fixture" })).Items.Count == 0
            && Merge(Encode(row), source: "sessions/activity/other/aabbccdd.json").Items.Count == 0
            && Merge(Encode(row with { updatedAt = now.AddHours(1) })).Items.Count == 0,
            "Cloud signals require a matching dated path, trusted session URL and plausible timestamp.");
        check(Merge("{broken").Items.Count == 0 && Merge("{}").Items.Count == 0
            && Merge(Encode(row), time: now.AddDays(2)).Items.Count == 0,
            "Missing, malformed and expired cloud signals do not invent current work.");
        var bounded = Merge(Encode(row with { prompt = new string('x', 4000), response = new string('y', 8000), lastTool = "private/path" })).Items.Single();
        check(bounded.Turn is { Prompt.Length: 2000, Response.Length: 4000, LastTool: "" },
            "The phone's turn projection bounds text and rejects tool names containing paths.");
        var stamp = DateTime.Now.AddSeconds(-10).ToString("yyyy-MM-dd HH:mm:ss");
        var reports = WorkerLog.ParseReports(string.Join('\n', Enumerable.Range(0,20).Select(i => stamp + $" [+] Pushed abc123: {i} companion(s)")));
        check(reports.Count == 12 && !JsonSerializer.Serialize(WorkerLog.ParseReports(stamp + " [-] Secret path/error")).Contains("Secret"),
            "Worker details expose at most twelve normalized reports and omit raw error bodies.");
        check(WorkerLog.ParseReports(stamp + " [*] Nothing to do.\n" + stamp + " [*] Nothing to do.").Count == 1
            && WorkerLog.Parse(stamp + " [+] 0 stale (since today), 0 settled and picked:")?.Kind == "idle",
            "Repeated idle checks collapse and an empty batch does not masquerade as active work.");
        var dir = Path.Combine(Path.GetTempPath(), "cloud-changes-" + Guid.NewGuid().ToString("N"));
        try {
            var changes = new ChangeJournal(Path.Combine(dir, "changes.json"));
            var original = changes.Observe([working], [], now).Single();
            var next = working with { UpdatedAt = now, Detail = "Using Write", Turn = working.Turn! with { UpdatedAt = now, LastTool = "Write" } };
            check(changes.Observe([next], [], now).Single().Id == original.Id,
                "Tool heartbeats do not create new unseen-work badges.");
            next = next with { Turn = next.Turn! with { StartedAt = now.AddSeconds(1), UpdatedAt = now.AddSeconds(1) } };
            check(changes.Observe([next], [], now.AddSeconds(1)).Single().Id != original.Id,
                "A new cloud prompt creates a new change even when the previous turn was also working.");
        } finally { if (Directory.Exists(dir)) Directory.Delete(dir, recursive: true); }
    }
}
