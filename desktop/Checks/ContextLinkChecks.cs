using System.Text.Json;
using WebTools.Desktop;

static class ContextLinkChecks
{
    public static void Run(Action<bool, string> check)
    {
        var now = DateTimeOffset.Parse("2026-11-18T21:00:00Z");
        const string thread = "00000000-0000-0000-0000-000000000001";
        // These names follow the existing Python local-conversation fixture contract.
        const string codex = "a6f9dc04f81fdc14", gemini = "1eddb81cf175d941";
        object Row(string id, string provider, string day = "2026-11-18", string venue = "lenovo", string state = "prose") =>
            new { id, assistant = provider, day, venue, capture = new { state } };
        var cloud = CloudSessions.Parse(JsonSerializer.Serialize(new { generatedAt = now, rows = new[] {
            Row(codex,"codex"), Row(gemini,"gemini",state:"partial"),
            Row("cccccccccccccccc","codex",day:"../private"),
            Row("dddddddddddddddd","codex",venue:"unknown"),
            Row("eeeeeeeeeeeeeeee","gemini",state:"unavailable"),
            Row("ffffffffffffffff","other")
        } }), now);
        check(cloud.Items.Count == 0 && cloud.CapturedRecords?.Count == 2,
            "Captured local record metadata establishes links without reviving local records as cloud activity or accepting malformed capture paths.");
        var codexUrl = SessionLinks.CapturedRecord("Codex",thread,cloud.CapturedRecords);
        var geminiUrl = SessionLinks.CapturedRecord("Gemini",thread,cloud.CapturedRecords);
        check(codexUrl == "https://mehrlander.github.io/web-tools/pages/session.html#gh=mehrlander/web-tools-private@main:sessions/2026/11/2026-11-18-" + codex + ".json"
            && geminiUrl?.EndsWith("2026-11-18-" + gemini + ".json") == true,
            "Captured conversation links join the full local ID through the provider namespace to its confirmed saved path.");
        check(SessionLinks.CapturedRecord("Codex","00000000-0000-0000-0000-000000000099",cloud.CapturedRecords) is null
            && SessionLinks.CapturedRecord("Codex",thread,new() { ["gemini:" + codex] = codexUrl! }) is null
            && SessionLinks.CapturedRecord("Claude",thread,cloud.CapturedRecords) is null,
            "Missing captures, provider mismatches and cloud session IDs never produce guessed local-record links.");
        var local = new LocalSession(thread,"Codex","Working locally","working",now,"private folder");
        var snapshot = new LenovoSnapshot(new(now,now,"fixture",true,null,[]),new("unknown","",null),[],[],[],"Fixture",now,
            new([local,local with { Provider = "Gemini" },local with { Id = "00000000-0000-0000-0000-000000000099" }],[]),0,cloud,[],
            [new("session:Codex:" + thread,"change","Codex","Saved local work","idle",now,"","Lenovo",null)]);
        var phone = PhoneActivity.Create(snapshot,now);
        check(phone.Items.Count(i => i.Url is not null) == 2
            && phone.Items.Single(i => i.Provider == "Codex" && i.Id == thread).Url == codexUrl
            && phone.Items.Single(i => i.Provider == "Gemini").Url == geminiUrl
            && phone.Changes?.Single().Url == codexUrl,
            "The phone current list and saved changes bridge to confirmed local captures while uncaptured sessions stay without a recorded-reader link.");
        check(!JsonSerializer.Serialize(phone).Contains("private folder"),
            "Capture links preserve the phone API's local filesystem privacy boundary.");
    }
}
