using System.Text.Json;
using WebTools.Desktop;

static class PhoneChecks
{
    public static void Run(Action<bool, string> check)
    {
        var now = DateTimeOffset.UtcNow;
        var job = new Errand("test-1", "A result", "Private request note", "complete", now, now,
            "private host", "Settled", new string('r', 25000), true, true, true);
        var local = new LocalSession("local", "Codex", "Working locally", "working", now, "C:\\private\\workspace", "Checking changes");
        var cloud = new LocalSession("cloud", "Claude", "Cloud choice", "recorded", now, "", "Recorded: choice needed", "Cloud");
        var snapshot = new LaptopSnapshot(new(now, now, "revision", true, null, [job]),
            new("detected", "Process present", now), [], [new("private", "Private place", "C:\\private")],
            [new("download", "private-file.txt", now, 42)], "Fixture laptop", now,
            new([local], []), 8, new([cloud], now, null), []);
        var phone = PhoneActivity.Create(snapshot, now);
        var text = JsonSerializer.Serialize(phone);
        check(!new[] { "Private request note", "private host", "private-file.txt", "workspace", "Places", "Downloads" }.Any(text.Contains),
            "The phone snapshot omits filesystem paths, downloads, host metadata and request notes.");
        check(!text.Contains(new string('r', 100)), "Reply bodies are excluded from the phone activity list.");
        check(PhoneActivity.Reply(snapshot, "test-1")?.Length == 20000 && PhoneActivity.Reply(snapshot, "missing") is null,
            "Result bodies are bounded and only existing results are available.");
        check(phone.Items.Single(i => i.Kind == "cloud") is { State: "recorded", NeedsAttention: true, Location: "Cloud" },
            "Published cloud choices need attention without becoming running sessions.");
        check(phone.Items.Single(i => i.Kind == "session").Url is null && phone.Items.Single(i => i.Kind == "errand").Url!.Contains("view=files"),
            "Phone links use Web Tools results and omit desktop folder actions.");
        check(PhoneActivity.Create(snapshot with { Activity = snapshot.Activity with { Connected = false, Revision = null } }, now)
            .Sources is { QueueAvailable: false, RecordsConnected: false }, "An unavailable queue remains distinct from a clear queue.");
        var blankTitle = CloudSessions.Parse(JsonSerializer.Serialize(new { rows = new[] {
            new { id = "cloud", agent = "https://claude.ai/code/session_test", title = "", ask = "A named session", ended = now }
        } }), now);
        check(blankTitle.Items.Single().Title == "A named session", "A blank cloud title falls back to the session request.");
    }
}
