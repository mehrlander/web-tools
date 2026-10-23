using System.Text.Json;
using WebTools.Desktop;

static class CheckpointChecks
{
    public static void Run(Action<bool, string> check)
    {
        var now = DateTimeOffset.UtcNow;
        var recordAt = now.AddMinutes(-1);
        var checkpointAt = now.AddMinutes(-5);
        var cloud = new CloudSnapshot([new("fixture", "Claude", "Original ask", "recorded", recordAt, "", "Recorded: pending", "Cloud")], now, null);
        var path = "sessions/topics/2026/10/2026-10-23-fixture.json";
        var rollup = JsonSerializer.Serialize(new { sessions = new Dictionary<string, object> {
            ["fixture"] = new { path, title = "A useful title", summary = "A published outcome", source_ended = checkpointAt, analyzed_at = recordAt }
        } });
        var companion = JsonSerializer.Serialize(new { short_id = "fixture", source_ended = checkpointAt, turns = new[] {
            new { turn = 0, headline = "First checkpoint", summary = "First summary", facts = new { edited = new[] { "private/path" }, pushed = new[] { "home branch" }, agents = new[] { "Review" }, prs = new[] { "opened home#72", "opened javascript:bad#1" } } },
            new { turn = 1, headline = "Latest checkpoint", summary = "Latest summary", facts = new { edited = Array.Empty<string>(), pushed = Array.Empty<string>(), agents = Array.Empty<string>(), prs = new[] { "merged mehrlander/home#72" } } }
        } });
        var enriched = SessionCheckpoints.Enrich(cloud, rollup, new Dictionary<string, string> { ["fixture"] = companion });
        var item = enriched.Items.Single();
        check(item.Title == "A useful title" && item.Checkpoint is { Headline: "Latest checkpoint", At: var at } && at == checkpointAt
            && item.UpdatedAt == recordAt && item.State == "recorded", "Published checkpoints keep their own time and never become live sessions.");
        check(item.Checkpoint!.Turns.Select(t => t.Turn).SequenceEqual([1,0]) && item.Checkpoint.Turns.Last().Files == 1,
            "The latest exchange summaries and measured action counts are available without raw paths.");
        check(item.Checkpoint.Links.Single().Url == "https://github.com/mehrlander/home/pull/72",
            "Checkpoint PR links are normalized, deduplicated and restricted to valid references.");
        check(!JsonSerializer.Serialize(item.Checkpoint).Contains("private/path"), "Checkpoint projections omit edited filesystem paths.");
        check(SessionCheckpoints.Paths(rollup, cloud.Items)["fixture"] == path
            && SessionCheckpoints.Paths(rollup.Replace(path, "../../secret"), cloud.Items).Count == 0,
            "Companion lookups accept only matching session-topic paths.");
        check(SessionCheckpoints.Enrich(cloud, rollup, new Dictionary<string, string> { ["fixture"] = "{broken" })
            .Items.Single().Checkpoint!.Summary == "A published outcome", "A damaged companion preserves the rollup's published summary.");
        var mismatched = companion.Replace("\"short_id\":\"fixture\"", "\"short_id\":\"another\"");
        check(SessionCheckpoints.Enrich(cloud, rollup, new Dictionary<string, string> { ["fixture"] = mismatched })
            .Items.Single().Checkpoint!.Turns.Count == 0, "A companion for another session cannot contribute exchange details.");
        check(SessionCheckpoints.Enrich(cloud, rollup.Replace(checkpointAt.ToString("O"), now.AddHours(1).ToString("O")), new Dictionary<string, string>())
            .Items.Single().Checkpoint is null, "A topic companion newer than its session record waits for the next record sync.");

        var dir = Path.Combine(Path.GetTempPath(), "now-checkpoints-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(dir);
        try {
            var journalPath = Path.Combine(dir, "changes.json");
            var journal = new ChangeJournal(journalPath);
            var working = new LocalSession("local", "Codex", "Local work", "working", now.AddMinutes(-10), "", "Reading a file");
            check(journal.Observe([working], [], now).Count == 1, "A newly observed task creates one change.");
            var first = journal.Observe([working], [], now).Single();
            var polled = working with { UpdatedAt = now.AddMinutes(-9), Detail = "Reading another file" };
            check(journal.Observe([polled], [], now).Single().Id == first.Id,
                "Commentary changes and repeated polling do not create new change badges.");
            var complete = working with { State = "idle", UpdatedAt = now.AddMinutes(-8), Detail = "Turn finished" };
            var ended = journal.Observe([complete], [], now).Single();
            check(ended.Id != first.Id && new ChangeJournal(journalPath).Observe([complete], [], now).Single().Id == ended.Id,
                "A completion changes the item once and retains its identity across companion restarts.");
            check(journal.Observe([working with { UpdatedAt = now.AddMinutes(-7) }], [], now).Single().Id != first.Id,
                "Starting another turn is a new change even when its state text repeats.");
            var job = new Errand("job", "Result", "Private note", "reply", now.AddHours(-1), now.AddMinutes(-2), null, "Reply", "Body", false, true);
            var replied = journal.Observe([], [job], now).Single(c => c.Key == "errand:job");
            check(journal.Observe([], [job with { UpdatedAt = now.AddMinutes(-1), Reply = "Later body" }], now)
                .Single(c => c.Key == "errand:job").Id != replied.Id, "A later arriving reply becomes a new change without duplicating the errand.");
            check(!JsonSerializer.Serialize(journal.Observe([], [job], now)).Contains("Private note"),
                "Change records do not copy private errand request notes or reply bodies.");
            check(journal.Observe([], [], now.AddDays(8)).Count == 0, "The change journal expires after seven days.");
        } finally { Directory.Delete(dir, recursive: true); }

        var stamp = now.LocalDateTime.ToString("yyyy-MM-dd HH:mm:ss");
        var batch = WorkerLog.Parse(stamp + " [+] 4 stale (since today), 2 settled and picked:\n" + stamp + "     - a-session (record)");
        check(batch is { Kind: "topics", Headline: "Summarising 2 sessions" }, "A worker batch report names its work without exposing raw log lines.");
        check(WorkerLog.Parse(stamp + " [+] Pushed abc123: 2 companion(s) and the rollup.") is { Kind: "published" },
            "Publishing summaries replaces the preceding batch report.");
        check(WorkerLog.Parse(stamp + " [+] Errand daemon-123 claimed by private-host.") is { Kind: "errand", ItemId: "daemon-123" },
            "A worker claim links to its known errand identifier.");
        var error = WorkerLog.Parse(stamp + " [-] Private path and error details");
        check(error?.Headline == "Worker reported a problem" && WorkerLog.Parse("not a timestamp [+] Work") is null,
            "Worker errors are summarized safely and malformed log lines are ignored.");
    }
}
