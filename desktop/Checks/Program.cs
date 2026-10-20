using System.Text.Json;
using WebTools.Desktop;

var passed = 0;
void Check(bool condition, string message) {
    if (!condition) throw new Exception(message);
    Console.WriteLine("PASS " + message); passed++;
}
JsonElement Parse(string text) => JsonSerializer.Deserialize<JsonElement>(text);
var seen = DateTimeOffset.Parse("2026-01-02T00:00:00Z");
var request = Parse("""{"title":"Test errand","createdAt":"2026-01-01T00:00:00Z","run":{"method":"laptop-daemon"}}""");
var claim = Parse("""{"by":"test-laptop","claimedAt":"2026-01-02T01:00:00Z"}""");
var done = Parse("""{"ok":true,"closedAt":"2026-01-02T02:00:00Z","data":{"reply":"Ready","settled":true}}""");
var arriving = Parse("""{"ok":true,"closedAt":"2026-01-02T02:00:00Z","data":{"reply":"First reply","settled":false}}""");
Check(Activity.Join("test-1", request, default, default, false, seen)?.State == "queued", "An unclaimed request is queued.");
Check(Activity.Join("test-1", request, claim, default, false, seen)?.State == "claimed", "A claim is reported as claimed, without inventing live progress.");
Check(Activity.Join("test-1", request, claim, done, true, seen) is { State: "complete", IsNew: true }, "A result takes precedence over a remaining claim.");
Check(Activity.Join("test-1", request, default, arriving, false, seen)?.State == "reply", "A first reply is distinguished from a settled result.");
Check(Activity.Join("test-1", request, default, Parse("""{"ok":false,"closedAt":"2026-01-02T03:00:00Z"}"""), false, seen)?.State == "failed", "Failed work is surfaced for review.");
Check(Activity.Join("test-1", request, default, done, false, seen.AddDays(1))?.IsNew == false, "Reviewed results stop counting as new.");
Check(Activity.Join("test-1", Parse("""{"run":{"method":"browser"}}"""), default, default, false, seen) is null, "Browser errands do not masquerade as local worker jobs.");
Check(Activity.Join("../../escape", request, default, default, false, seen) is null, "Errand identifiers cannot escape the output folder.");
Check(NavigationPolicy.IsWebTools(NavigationPolicy.AppUrl + "?view=stage"), "The hosted app and its routes stay inside the desktop window.");
Check(!NavigationPolicy.IsWebTools("https://mehrlander.github.io/web-tools-evil/app/"), "A lookalike path is outside the hosted app boundary.");
Check(!NavigationPolicy.IsWebTools("https://mehrlander.github.io.evil.test/web-tools/app/"), "A lookalike host is outside the hosted app boundary.");
Check(!NavigationPolicy.IsWebTools("http://mehrlander.github.io/web-tools/app/"), "The app boundary requires HTTPS.");
Check(!NavigationPolicy.IsLocal("https://desktop.web-tools.local/other.html"), "Only the local laptop document receives desktop actions.");
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
    await File.WriteAllTextAsync(Path.Combine(seed, "errands/results/test-1.json"), done.GetRawText());
    await File.WriteAllTextAsync(Path.Combine(seed, "errands/claims/test-1.json"), claim.GetRawText());
    await File.WriteAllTextAsync(Path.Combine(seed, "errands/output/test-1/report.txt"), "Fixture output");
    await File.WriteAllTextAsync(Path.Combine(seed, "worker.txt"), "Committed worker file");
    await CommitFixture();
    await Git(fixture, "clone", "--quiet", "--", remote, checkout);
    await Git(checkout, "switch", "-c", "codex/fixture");
    await File.WriteAllTextAsync(Path.Combine(checkout, "worker.txt"), "Uncommitted worker edit");
    var statusBefore = await Commands.Text("git", ["status", "--porcelain"], checkout);
    var headBefore = await Commands.Text("git", ["rev-parse", "HEAD"], checkout);
    var reader = new ErrandReader(checkout);
    var live = await reader.Read(seen, force: true);
    Check(live.Connected && live.Errands.Count == 2, "A real Git object read joins the available worker records.");
    Check(live.Errands.Single(j => j.Id == "test-1") is { State: "complete", HasOutput: true }, "Output presence and a result survive an old claim in Git.");
    Check(statusBefore == await Commands.Text("git", ["status", "--porcelain"], checkout)
        && headBefore == await Commands.Text("git", ["rev-parse", "HEAD"], checkout)
        && await File.ReadAllTextAsync(Path.Combine(checkout, "worker.txt")) == "Uncommitted worker edit",
        "Refreshing activity preserves the worker's branch, index and uncommitted edits.");
    await File.WriteAllTextAsync(Path.Combine(seed, "errands/results/test-2.json"), "{broken result");
    await CommitFixture();
    var damaged = await reader.Read(seen, force: true);
    Check(damaged.Errands.Count == 1 && damaged.Notice?.Contains("unreadable") == true,
        "A malformed result is reported and never turns completed work into a queued job.");
    await Git(checkout, "remote", "set-url", "origin", Path.Combine(fixture, "missing-remote"));
    var offline = await reader.Read(seen, force: true);
    Check(!offline.Connected && offline.Errands.Count == 1 && offline.Revision == damaged.Revision
        && offline.Notice?.Contains("last available") == true, "A failed fetch preserves the previous activity with an offline notice.");
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
Console.WriteLine($"{passed} checks passed.");
