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
        const string thread = "00000000-0000-0000-0000-000000000001";
        const string instance = "00000000-0000-0000-0000-000000000002-v2";
        var geminiUrl = $"https://antigravity.google.com/r/{instance}?p=c%2F{thread}";
        var claudeUrl = "https://claude.ai/code/session_original";
        check(SessionLinks.For("Codex",thread) == "codex://threads/" + thread
            && SessionLinks.For("Gemini",thread,geminiInstance:instance) == geminiUrl
            && SessionLinks.For("Claude","short",claudeUrl) == claudeUrl,
            "Session links use the technical Codex thread, actual Gemini instance and original Claude source.");
        check(SessionLinks.For("Codex","new") is null && SessionLinks.For("Gemini",thread) is null
            && SessionLinks.For("Claude","short") is null,
            "Missing routing never becomes a guessed session or a new-conversation link.");
        check(new[] { "javascript:alert(1)", "codex://threads/new", "codex://threads/" + thread + "?prompt=run",
            "https://claude.ai.evil.test/code/session_original", "https://name@claude.ai/code/session_original",
            "https://claude.ai:8443/code/session_original", claudeUrl + "?q=send", claudeUrl + "#other",
            geminiUrl + "&action=run", geminiUrl.Replace(instance,"../../other"), geminiUrl.Replace("c%2F","file%2F")
        }.All(url => SessionLinks.Safe(url) is null), "Provider session navigation rejects injection, credentials, alternate ports and unsupported actions.");
        check(NavigationPolicy.IsExternalPage(geminiUrl) && NavigationPolicy.IsExternalPage(claudeUrl)
            && NavigationPolicy.IsExternalPage("codex://threads/" + thread),
            "Known exact session routes may leave the desktop WebView through the system handler.");
        check(NavigationPolicy.ExternalTarget("codex://threads/" + thread) == "codex://threads/" + thread
            && new[] { "codex://threads/new", "codex://settings", "file:///private", "javascript:alert(1)" }
                .All(url=>NavigationPolicy.ExternalTarget(url) is null),
            "The final shell dispatcher accepts the exact Codex thread URI and rejects unrelated native actions and schemes.");
        check(new[] { "https://chatgpt.com/", "https://antigravity.google.com/", "https://claude.ai/code",
            geminiUrl,claudeUrl,"codex://threads/" + thread,NavigationPolicy.ErrandUrl("saved"),NavigationPolicy.ErrandUrl("saved",true),
            NavigationPolicy.AppUrl + "?view=sessions&session=older" }.All(url=>NavigationPolicy.IsExternalPage(url) && NavigationPolicy.ExternalTarget(url) is not null)
            && !NavigationPolicy.IsExternalPage("https://mehrlander.github.io.evil.test/web-tools/app/"),
            "Every launcher destination category passes both the WebView boundary and final dispatcher, including saved Web Tools records.");
        var historical = CloudSessions.Parse(JsonSerializer.Serialize(new { rows = new[] {
            new { id = "older", agent = claudeUrl, ended = now.AddDays(-2) }
        } }),now);
        check(historical.Items.Count == 0 && historical.SessionUrls?["older"] == claudeUrl,
            "Original Claude URLs remain available for older recent cards without reviving old sessions as current work.");
        var linked = PhoneActivity.Create(snapshot with {
            Sessions = new([local with { Id = thread },local with { Id = thread, Provider = "Gemini" }],[]),
            Cloud = historical, GeminiInstanceId = instance,
            Changes = [new("cloud:older","journal-id","Claude","Older work","idle",now,"Reply","Cloud",null),
                new("errand:" + thread,"errand-change","Gemini","A saved errand","complete",now,"Result","Laptop",NavigationPolicy.ErrandUrl(thread,true))]
        },now);
        check(linked.Items.Single(i=>i.Provider == "Codex").SessionUrl == "codex://threads/" + thread
            && linked.Items.Single(i=>i.Provider == "Gemini" && i.Kind == "session").SessionUrl == geminiUrl
            && linked.Changes?.Single(c=>c.Key == "cloud:older").SessionUrl == claudeUrl,
            "The phone projects direct provider links for current local work and historical Claude records separately from Web Tools detail URLs.");
        check(linked.Changes?.Single(c=>c.Key.StartsWith("errand:")).SessionUrl is null,
            "An errand whose ID resembles a conversation UUID never gains a fabricated provider session link.");
    }
}
