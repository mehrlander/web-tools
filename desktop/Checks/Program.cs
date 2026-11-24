using System.Text.Json;
using WebTools.Desktop;

if (CommandChecks.RunFixture(args)) return;

var passed = 0;
void Check(bool condition, string message) {
    if (!condition) throw new Exception(message);
    Console.WriteLine("PASS " + message); passed++;
}
if (args.Contains("--sync-health-only")) {
    await SyncHealthChecks.Run(Check);
    await CommandChecks.Run(Check);
    WorkerProcessChecks.Run(Check);
    Console.WriteLine($"{passed} focused health, command and process checks passed.");
    return;
}
JsonElement Parse(string text) => JsonSerializer.Deserialize<JsonElement>(text);
var seen = DateTimeOffset.Parse("2026-01-02T00:00:00Z");
var request = Parse("""{"title":"Test errand","createdAt":"2026-01-01T00:00:00Z","run":{"method":"lenovo-daemon"}}""");
var claim = Parse("""{"by":"test-lenovo","claimedAt":"2026-01-02T01:00:00Z"}""");
var done = Parse("""{"ok":true,"closedAt":"2026-01-02T02:00:00Z","data":{"reply":"Ready","settled":true}}""");
var arriving = Parse("""{"ok":true,"closedAt":"2026-01-02T02:00:00Z","data":{"reply":"First reply","settled":false}}""");
var declined = Parse("""{"ok":true,"answered":false,"closedAt":"2026-01-02T03:00:00Z","message":"Cancelled by owner","data":{"settled":false,"updatedAt":"2026-01-02T02:00:00Z"}}""");
Check(Activity.Join("test-1", request, default, default, false, seen)?.State == "queued", "An unclaimed request is queued.");
Check(Activity.Join("test-1", request, claim, default, false, seen)?.State == "claimed", "A claim is reported as claimed, without inventing live progress.");
Check(Activity.Join("test-1", request, claim, done, true, seen) is { State: "complete", IsNew: true, IsOpen: false }, "A legacy result without answered closes the errand and takes precedence over a remaining claim.");
Check(Activity.Join("test-1", request, default, arriving, false, seen) is { State: "reply", IsOpen: true }, "A first reply stays open until a later settled result.");
Check(Activity.Join("test-1", request, claim, declined, false, seen) is { State: "declined", IsOpen: false, Message: "Cancelled by owner" } cancelledJob
    && cancelledJob.UpdatedAt == Activity.Date(declined, "closedAt"),
    "An explicit decline preserves its reason and close time ahead of old unsettled metadata.");
Check(Activity.Join("test-1", request, claim, Parse("""{"answered":false,"fulfilledAt":"2026-01-02T03:00:00Z","data":{"updatedAt":"2026-01-02T02:00:00Z"}}"""), false, seen)?.UpdatedAt == Activity.Date(declined, "closedAt")
    && Activity.Join("test-1", request, claim, Parse("""{"answered":false,"data":{"updatedAt":"2026-01-02T02:00:00Z"}}"""), false, seen)?.UpdatedAt == Activity.Date(Activity.Child(declined, "data"), "updatedAt"),
    "Legacy decline timestamps prefer fulfilledAt and preserve the existing update when no close time was recorded.");
Check(Activity.Join("test-1", request, claim, Parse("""{"ok":false,"answered":false,"data":{"settled":false}}"""), false, seen)?.State == "failed",
    "An explicit failure takes precedence over decline and interim-reply metadata.");
Check(Activity.Join("test-1", request, claim, Parse("""{"ok":"false","answered":"false","data":{"settled":"false"}}"""), false, seen)?.State == "complete",
    "String-valued flags do not masquerade as explicit failure, decline or unsettled booleans.");
Check(Activity.Join("test-1", request, default, Parse("""{"ok":false,"closedAt":"2026-01-02T03:00:00Z"}"""), false, seen)?.State == "failed", "Failed work is surfaced for review.");
Check(Activity.Join("test-1", request, default, done, false, seen.AddDays(1))?.IsNew == false, "Reviewed results stop counting as new.");
Check(Activity.Join("test-1", Parse("""{"run":{"method":"browser"}}"""), default, default, false, seen) is null, "Browser errands do not masquerade as local worker jobs.");
foreach (var (method, provider) in new[] { ("lenovo-daemon", "Gemini"), ("codex-errand", "Codex"), ("claude-errand", "Claude") }) {
    var routed = Parse(JsonSerializer.Serialize(new { title = "Routed work", createdAt = seen, run = new { method } }));
    Check(Activity.Join("routed", routed, default, default, false, seen) is { State: "queued" } queued && queued.Provider == provider,
        method + " supplies the correct assistant queue.");
    Check(Activity.Join("routed", routed, claim, default, false, seen) is { State: "claimed" } accepted && accepted.Provider == provider,
        method + " preserves claim ownership without asserting execution.");
    Check(Activity.Join("routed", routed, claim, arriving, false, seen) is { State: "reply" } reply && reply.Provider == provider,
        method + " retains arriving replies in its lane.");
    Check(Activity.Join("routed", routed, claim, done, true, seen) is { State: "complete", HasOutput: true } result && result.Provider == provider,
        method + " retains the result and output after a claim.");
}
Check(Activity.Join("unknown", Parse("""{"run":{"method":"future-runner"}}"""), default, done, false, seen) is null
    && Activity.Join("retired", Parse("""{"run":{"method":"laptop-daemon"}}"""), default, done, false, seen) is null
    && Activity.Join("missing", Parse("{}"), default, default, false, seen) is null,
    "Unknown, retired and missing methods do not enter an assistant lane.");
Check(Activity.Join("../../escape", request, default, default, false, seen) is null, "Errand identifiers cannot escape the output folder.");
foreach (var (method, venue, location) in new[] { ("codex-errand", "lenovo", "Lenovo"),
    ("claude-errand", "anthropic-cloud", "Cloud"), ("claude-errand", "lenovo", "Lenovo") }) {
    var routed = Parse(JsonSerializer.Serialize(new { run = new { method, venue } }));
    var report = Parse("""{"ok":true,"message":"Finished","data":{"reply":" ","report":"## Findings\nA useful report"}}""");
    Check(Activity.Join("report", routed, claim, report, false, seen) is { } job && job.Location == location
        && job.Reply == "## Findings\nA useful report" && job.ClaimedAt == Activity.Date(claim,"claimedAt"),
        "Agent reports preserve their report body, claim time and declared " + location + " venue.");
}
Check(Activity.Join("retired-venue", Parse("""{"run":{"method":"codex-errand","venue":"personal-laptop"}}"""), claim, default, false, seen)?.Location == "",
    "Retired venue identifiers do not map to Lenovo.");
Check(Activity.Join("stream", request, claim, arriving, false, seen)?.Reply == "First reply",
    "Gemini's streaming reply remains the preferred report body.");
var fencedReport = "Started the script.\n\n🟡 **Pending:** Waiting.\n\n```json\n[{\"name\":\"report.xlsx\",\"bytes\":20,\"error\":null}]\n```\n\nThe file was saved without errors.\n\n⚫ **Done:** Saved the file.";
var fencedJob = Activity.Join("fenced-report", request, claim,
    Parse(JsonSerializer.Serialize(new { ok = true, message = "```json", data = new { reply = fencedReport } })), false, seen)!;
Check(PhoneActivity.ErrandPreview(fencedJob) == "The file was saved without errors.",
    "A fence-only message falls back to the final narrative outside code and status markers.");
Check(PhoneActivity.ErrandPreview(fencedJob with { Message = "**Saved** [the report](https://example.test/report)" }) == "Saved the report",
    "A meaningful message remains the preview with inline Markdown removed.");
Check(PhoneActivity.ErrandPreview(fencedJob with { Reply = "```json\n[{\"bytes\":20}]\n```" }) == "",
    "Code-only results do not turn raw JSON or a fence into a preview.");
Check(NavigationPolicy.IsWebTools(NavigationPolicy.AppUrl + "?view=stage"), "The hosted app and its routes stay inside the desktop window.");
Check(!NavigationPolicy.IsWebTools("https://mehrlander.github.io/web-tools-evil/app/"), "A lookalike path is outside the hosted app boundary.");
Check(!NavigationPolicy.IsWebTools("https://mehrlander.github.io.evil.test/web-tools/app/"), "A lookalike host is outside the hosted app boundary.");
Check(!NavigationPolicy.IsWebTools("http://mehrlander.github.io/web-tools/app/"), "The app boundary requires HTTPS.");
Check(!NavigationPolicy.IsLocal("https://desktop.web-tools.local/other.html"), "Only the local Lenovo document receives desktop actions.");
Check(!NavigationPolicy.IsLocal(NavigationPolicy.LocalUrl + "?untrusted=1"), "An alternate local document URL receives no desktop actions.");
Check(NavigationPolicy.ErrandUrl("test-1", hasResult: true).Contains("view=files")
    && NavigationPolicy.ErrandUrl("test-1", hasResult: true).Contains("ref=background"),
    "A closed errand opens its saved result instead of the Stage's open-only queue.");

// Exercise real Git objects, a separate branch and uncommitted worker edits.
// No fixture connects to GitHub or changes a user's repository.
var fixture = Path.Combine(Path.GetTempPath(), "web-tools-desktop-check-" + Guid.NewGuid().ToString("N"));
Directory.CreateDirectory(fixture);
var remote = Path.Combine(fixture, "remote.git");
var seed = Path.Combine(fixture, "seed");
var checkout = Path.Combine(fixture, "checkout");
async Task Git(string directory, params string[] arguments) => await Commands.Text("git", arguments, directory);
async Task CommitFixture() {
    await Git(seed, "add", ".");
    await Git(seed, "commit", "-m", "Update desktop fixture\n\nCo-Authored-By: Codex <codex@openai.com>");
    await Git(seed, "push", "--quiet", "origin", "background");
}
try {
    await Git(fixture, "init", "--bare", "--initial-branch=background", remote);
    await Git(fixture, "init", "--initial-branch=background", seed);
    await Git(seed, "config", "user.name", "Desktop fixture");
    await Git(seed, "config", "user.email", "fixture@example.test");
    await Git(seed, "config", "commit.gpgsign", "false");
    await Git(seed, "config", "core.hooksPath", ".git/hooks");
    await Git(seed, "remote", "add", "origin", remote);
    foreach (var directory in new[] { "requests", "claims", "results", "output/test-1" })
        Directory.CreateDirectory(Path.Combine(seed, "errands", directory));
    await File.WriteAllTextAsync(Path.Combine(seed, "errands/requests/test-1.json"), request.GetRawText());
    await File.WriteAllTextAsync(Path.Combine(seed, "errands/requests/test-2.json"), request.GetRawText());
    await File.WriteAllTextAsync(Path.Combine(seed, "errands/requests/codex-1.json"), request.GetRawText().Replace("lenovo-daemon", "codex-errand"));
    await File.WriteAllTextAsync(Path.Combine(seed, "errands/requests/claude-1.json"), request.GetRawText().Replace("lenovo-daemon", "claude-errand"));
    await File.WriteAllTextAsync(Path.Combine(seed, "errands/claims/claude-1.json"), claim.GetRawText());
    await File.WriteAllTextAsync(Path.Combine(seed, "errands/requests/unknown-1.json"), request.GetRawText().Replace("lenovo-daemon", "unknown"));
    await File.WriteAllTextAsync(Path.Combine(seed, "errands/results/test-1.json"), done.GetRawText());
    await File.WriteAllTextAsync(Path.Combine(seed, "errands/claims/test-1.json"), claim.GetRawText());
    await File.WriteAllTextAsync(Path.Combine(seed, "errands/output/test-1/report.txt"), "Fixture output");
    await File.WriteAllTextAsync(Path.Combine(seed, "worker.txt"), "Committed worker file");
    Directory.CreateDirectory(Path.Combine(seed, "state"));
    var cacheAt = DateTimeOffset.UtcNow.ToString("O");
    await File.WriteAllTextAsync(Path.Combine(seed, "state/sessions.json"), JsonSerializer.Serialize(new {
        generatedAt = cacheAt, rows = new[] { new { id = "cloud-1", agent = "https://claude.ai/code/session_fixture",
            ask = "Cloud fixture", ended = cacheAt, state = "needs" } }
    }));
    var topicPath = "sessions/topics/2026/10/2026-10-23-cloud-1.json";
    Directory.CreateDirectory(Path.GetDirectoryName(Path.Combine(seed, topicPath))!);
    await File.WriteAllTextAsync(Path.Combine(seed, "state/session-topics.json"), JsonSerializer.Serialize(new {
        sessions = new Dictionary<string, object> { ["cloud-1"] = new {
            path = topicPath, title = "Cloud checkpoint fixture", summary = "A captured result", source_ended = cacheAt
        } }
    }));
    await File.WriteAllTextAsync(Path.Combine(seed, topicPath), JsonSerializer.Serialize(new {
        short_id = "cloud-1", source_ended = cacheAt, turns = new[] { new { turn = 0, headline = "A published checkpoint", summary = "The result is ready" } }
    }));
    await CommitFixture();
    await Git(seed, "push", "--quiet", "origin", "background:main");
    await Git(fixture, "clone", "--quiet", "--", remote, checkout);
    await Git(checkout, "switch", "-c", "codex/fixture");
    await File.WriteAllTextAsync(Path.Combine(checkout, "worker.txt"), "Uncommitted worker edit");
    var statusBefore = await Commands.Text("git", ["status", "--porcelain"], checkout);
    var headBefore = await Commands.Text("git", ["rev-parse", "HEAD"], checkout);
    var healthClock = DateTimeOffset.UtcNow;
    var reader = new ErrandReader(checkout, () => healthClock);
    var live = await reader.Read(seen, force: true);
    Check(live.Connected && live.Errands.Count == 4, "A real Git object read joins all supported assistant records and skips unknown methods.");
    Check(live.Errands.Single(j => j.Id == "codex-1") is { Provider: "Codex", State: "queued" }
        && live.Errands.Single(j => j.Id == "claude-1") is { Provider: "Claude", State: "claimed" },
        "Codex and future Claude errands retain their lanes through the private background reader.");
    Check(reader.Cloud.Items.Single() is { State: "recorded", Location: "Cloud" },
        "The remote main cache supplies recorded cloud activity without asserting a running session.");
    Check(reader.Cloud.Items.Single() is { Title: "Cloud checkpoint fixture", Checkpoint.Headline: "A published checkpoint" },
        "Real Git objects join the main session cache with background topic companions.");
    Check(reader.Health is { Errands.State: "ok", Sessions.State: "ok", Summaries.State: "ok" }
        && reader.Health.Errands.SucceededAt == healthClock && reader.Health.Sessions.SucceededAt == healthClock,
        "Each feed reports its own completed fetch and usable record read.");
    var publishedAt = reader.Cloud.CapturedAt;
    healthClock = healthClock.AddSeconds(1);
    Check(reader.RequestRetry().Status == 202 && reader.RequestRetry().Status == 409
        && reader.Health.Errands.State == "refreshing", "A manual retry queues real work once and coalesces concurrent requests.");
    await reader.Synchronize();
    Check(reader.Health.Errands.SucceededAt == healthClock && reader.Health.Sessions.SucceededAt == healthClock
        && reader.Cloud.CapturedAt == publishedAt && reader.Health.Errands.NextAttemptAt == healthClock.AddSeconds(5),
        "An unchanged revision refresh advances successful sync time without rewriting the published capture time.");
    Check(reader.RequestRetry() is { Status: 429, RetryAfterSeconds: > 0 }, "Repeated manual sync requests respect a bounded cooldown.");
    Check(live.Errands.Single(j => j.Id == "test-1") is { State: "complete", HasOutput: true }, "Output presence and a result survive an old claim in Git.");
    Check(statusBefore == await Commands.Text("git", ["status", "--porcelain"], checkout)
        && headBefore == await Commands.Text("git", ["rev-parse", "HEAD"], checkout)
        && await File.ReadAllTextAsync(Path.Combine(checkout, "worker.txt")) == "Uncommitted worker edit",
        "Refreshing activity preserves the worker's branch, index and uncommitted edits.");
    await File.WriteAllTextAsync(Path.Combine(seed, "errands/results/test-2.json"), "{broken result");
    await CommitFixture();
    var damaged = await reader.Read(seen, force: true);
    Check(damaged.Errands.Count == 3 && damaged.Notice?.Contains("unreadable") == true,
        "A malformed result is reported and never turns completed work into a queued job.");
    Check(damaged.Sync?.Errands.ErrorCode == "invalid-data" && damaged.RecordNotice?.Contains("unreadable") == true
        && !damaged.SyncNotices!.Contains(damaged.RecordNotice),
        "Unreadable-record warnings remain separate from duplicate legacy feed notices.");
    var turnAt = healthClock;
    var turnPath = $"sessions/activity/{turnAt:yyyy-MM-dd}/aabbccdd.json";
    Directory.CreateDirectory(Path.GetDirectoryName(Path.Combine(seed, turnPath))!);
    await File.WriteAllTextAsync(Path.Combine(seed, turnPath), JsonSerializer.Serialize(new {
        schemaVersion = 1, id = "aabbccdd", provider = "Claude", location = "Cloud",
        agent = "https://claude.ai/code/session_fixture", updatedAt = turnAt, startedAt = turnAt,
        state = "working", prompt = "New cloud work", lastTool = "Read"
    }));
    await CommitFixture();
    var signaled = await reader.Read(seen, force: true);
    var signaledThread = reader.Cloud.Items.Single(s => s.SourceUrl == "https://claude.ai/code/session_fixture");
    Check(signaledThread.Id == "cloud-1" && signaledThread.State == "working" && signaledThread.ActivityId == "aabbccdd"
        && signaledThread.Members?.Single(s => s.Id == "aabbccdd").Turn?.Prompt == "New cloud work"
        && statusBefore == await Commands.Text("git", ["status", "--porcelain"], checkout),
        "Fresh background signals update their published provider thread before the main cache refresh, retain exact related prompts and leave worker edits unchanged.");
    var successfulHealth = reader.Health;
    await Git(checkout, "remote", "set-url", "origin", Path.Combine(fixture, "missing-remote"));
    var offline = await reader.Read(seen, force: true);
    Check(!offline.Connected && offline.Errands.Count == 3 && offline.Revision == signaled.Revision
        && offline.Notice?.Contains("last available") == true, "A failed fetch preserves the previous activity with an offline notice.");
    Check(offline.Sync is { Errands.ErrorCode: "fetch-failed", Sessions.ErrorCode: "fetch-failed", Summaries.ErrorCode: "fetch-failed" }
        && offline.Sync.Sessions.SucceededAt == successfulHealth.Sessions.SucceededAt
        && offline.Sync.Sessions.NextAttemptAt == healthClock.AddSeconds(30) && reader.Cloud.CapturedAt == publishedAt,
        "Failed fetches preserve successful refresh and capture times with a completion-based thirty-second retry deadline.");
    var failedAt = reader.Health.Errands.AttemptedAt;
    await reader.Synchronize();
    Check(reader.Health.Errands.AttemptedAt == failedAt && reader.RequestRetry().Status == 429,
        "The automatic loop and manual action do not immediately repeat a failed fetch.");
    healthClock = healthClock.AddSeconds(31);
    Check(reader.RequestRetry().Status == 202 && reader.Health.Sessions is { State: "refreshing", ErrorCode: "fetch-failed" },
        "A due retry keeps its previous error visible while refreshing.");
    await reader.Synchronize();
    for (var index = 0; index < 85; index++) {
        var id = "zzz-old-" + index;
        await File.WriteAllTextAsync(Path.Combine(seed,"errands/requests/" + id + ".json"), request.GetRawText());
        await File.WriteAllTextAsync(Path.Combine(seed,"errands/results/" + id + ".json"), done.GetRawText());
    }
    await File.WriteAllTextAsync(Path.Combine(seed,"errands/requests/codex-new-result.json"),
        """{"title":"Recent Codex result","run":{"method":"codex-errand","venue":"lenovo"}}""");
    await File.WriteAllTextAsync(Path.Combine(seed,"errands/results/codex-new-result.json"),
        JsonSerializer.Serialize(new { ok=true, closedAt=turnAt, data=new { report="Recent report" } }));
    await CommitFixture();
    await Git(checkout,"remote","set-url","origin",remote);
    var retained = await reader.Read(seen, force:true);
    Check(retained.Errands.Count(j=>!j.IsOpen)==80 && retained.Errands.Count(j=>j.IsOpen)==2
        && retained.Errands.Any(j=>j.Id=="codex-new-result" && j.Reply=="Recent report"),
        "Every open errand and the newest eighty results survive filename prefixes and old request dates.");
    Check(reader.Health.Sessions is { State: "ok", ErrorCode: null } && reader.Health.Summaries is { State: "ok", ErrorCode: null },
        "A successful retry clears only recovered feed errors.");
    var companionFile = Path.Combine(seed,topicPath);
    var validCompanion = await File.ReadAllTextAsync(companionFile);
    File.Delete(companionFile);
    await CommitFixture();
    await reader.Read(seen,force:true);
    Check(reader.Health.Summaries.ErrorCode == "read-failed" && reader.Cloud.Items.Any(s=>s.Checkpoint?.Headline=="A published checkpoint"),
        "A missing intended companion changes summary health without replacing its previous usable enrichment.");
    await File.WriteAllTextAsync(companionFile,new string('x',2097153));
    await CommitFixture();
    await reader.Read(seen,force:true);
    Check(reader.Health.Summaries.ErrorCode == "read-failed" && reader.Cloud.Items.Any(s=>s.Checkpoint?.Headline=="A published checkpoint"),
        "An oversized intended companion cannot silently erase prior detail or report a healthy summary refresh.");
    await File.WriteAllTextAsync(companionFile,validCompanion.Replace("cloud-1","wrong-fixture"));
    await CommitFixture();
    await reader.Read(seen,force:true);
    Check(reader.Health.Summaries.ErrorCode == "invalid-data" && reader.Cloud.Items.Any(s=>s.Checkpoint?.Headline=="A published checkpoint"),
        "A syntactically valid companion for another identifier does not replace validated summary content.");
    await File.WriteAllTextAsync(companionFile,JsonSerializer.Serialize(new { short_id="cloud-1",source_ended=healthClock.AddHours(-2),turns=Array.Empty<object>() }));
    await CommitFixture();
    await reader.Read(seen,force:true);
    Check(reader.Health.Summaries.ErrorCode == "invalid-data" && reader.Cloud.Items.Any(s=>s.Checkpoint?.Headline=="A published checkpoint"),
        "A companion with a mismatched source timestamp remains a failed refresh rather than healthy empty detail.");
    await File.WriteAllTextAsync(companionFile,validCompanion);
    await CommitFixture();
    await reader.Read(seen,force:true);
    Check(reader.Health.Summaries is { State:"ok",ErrorCode:null }, "Restoring the matching companion recovers only its summary feed health.");
    await File.WriteAllTextAsync(Path.Combine(seed,"state/session-topics.json"), "{}");
    await CommitFixture();
    var summaryFailure = await reader.Read(seen, force:true);
    Check(reader.Health.Summaries is { State: "error", ErrorCode: "invalid-data" }
        && reader.Health.Sessions.State == "ok" && reader.Cloud.Items.Any(s => s.Checkpoint is not null),
        "A damaged summary index preserves its last valid enrichment without marking session-history sync failed.");
    var lastSessionSuccess = reader.Health.Sessions.SucceededAt;
    await File.WriteAllTextAsync(Path.Combine(seed,"state/sessions.json"), "{broken session index");
    await CommitFixture();
    await Git(seed,"push","--quiet","origin","background:main");
    healthClock = healthClock.AddSeconds(1);
    var sessionFailure = await reader.Read(seen, force:true);
    Check(reader.Health.Sessions is { State: "error", ErrorCode: "invalid-data" }
        && reader.Health.Sessions.SucceededAt == lastSessionSuccess && reader.Cloud.CapturedAt == publishedAt
        && reader.Cloud.Items.Count > 0, "A damaged session index preserves the last usable session snapshot and successful refresh time.");
    var healthProjection = PhoneActivity.Create(new(sessionFailure,new("absent","",null),[],[],[],"Fixture",seen,new([],[]),0,reader.Cloud,[]),healthClock);
    var healthJson = JsonSerializer.Serialize(healthProjection);
    Check(healthProjection.Sources.Sync == sessionFailure.Sync && healthProjection.Sources.Notices.Contains(sessionFailure.RecordNotice!)
        && healthProjection.Sources.SyncNotices!.All(n => healthProjection.Sources.Notices.Contains(n))
        && !healthJson.Contains(fixture) && !healthJson.Contains("exited with code"),
        "The phone exposes structured feed health and exact duplicate notices without dropping unrelated warnings or copying command diagnostics.");
    var unavailableCheckout = checkout + "-unavailable";
    Check(Directory.GetParent(Path.GetFullPath(checkout))?.FullName == Path.GetFullPath(fixture)
        && Directory.GetParent(Path.GetFullPath(unavailableCheckout))?.FullName == Path.GetFullPath(fixture),
        "The missing-checkout fixture move stays inside its own temporary root.");
    Directory.Move(checkout,unavailableCheckout);
    try {
        var absentCheckout = await reader.Read(seen,synchronize:false);
        Check(absentCheckout.Errands.Count == sessionFailure.Errands.Count && absentCheckout.Revision == sessionFailure.Revision
            && absentCheckout.SyncedAt == sessionFailure.SyncedAt && absentCheckout.Sync?.Errands.ErrorCode == "repository-unavailable",
            "A disappearing checkout preserves its last queue, revision and sync time with explicit unavailable health.");
    } finally { Directory.Move(unavailableCheckout,checkout); }
    var missing = await new ErrandReader(Path.Combine(fixture, "missing-checkout")).Read(seen);
    Check(!missing.Connected && missing.Errands.Count == 0 && missing.Notice?.Contains("not found") == true,
        "Missing local configuration is explicit rather than an empty success.");
} finally {
    var fixtureRoot = Path.GetFullPath(fixture);
    if (Directory.GetParent(fixtureRoot)?.FullName == Path.TrimEndingDirectorySeparator(Path.GetFullPath(Path.GetTempPath()))) {
        foreach (var file in Directory.EnumerateFiles(fixtureRoot, "*", SearchOption.AllDirectories)) File.SetAttributes(file, FileAttributes.Normal);
        Directory.Delete(fixtureRoot, recursive: true);
    }
}
SessionChecks.Run(Check);
WorkerProcessChecks.Run(Check);
await CommandChecks.Run(Check);
await SyncHealthChecks.Run(Check);
PhoneChecks.Run(Check);
ContextLinkChecks.Run(Check);
LocalWorkChecks.Run(Check);
CheckpointChecks.Run(Check);
CloudTurnChecks.Run(Check);
TopicThreadChecks.Run(Check);
UsageChecks.Run(Check);
await ClaudeUsageChecks.Run(Check);
Console.WriteLine($"{passed} checks passed.");
