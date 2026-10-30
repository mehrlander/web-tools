using System.Text.Json;
using WebTools.Desktop;

static class UsageChecks
{
    public static void Run(Action<bool, string> check)
    {
        check(new[] { "https://chatgpt.com/", "https://antigravity.google.com/", "https://claude.ai/code" }
            .All(NavigationPolicy.IsExternalPage), "The desktop opens each assistant's launch address in the system browser.");
        check(new[] { "https://chatgpt.com/?untrusted=1", "https://claude.ai/code/other", "https://antigravity.google.com.evil.test/", "javascript:alert(1)" }
            .All(url => !NavigationPolicy.IsExternalPage(url)), "Assistant launch links do not allow arbitrary external routes or schemes.");
        var path = Path.Combine(Path.GetTempPath(), "usage-check-" + Guid.NewGuid().ToString("N") + ".json");
        try {
            var at = DateTimeOffset.UtcNow;
            var reset = at.AddHours(3);
            var history = Enumerable.Range(0, 300).Select(i => new UsagePoint(at.AddMinutes(i - 300), i / 4.0, reset)).ToList();
            history.Add(new(at.AddHours(-6), 90, reset.AddHours(-5)));
            var zero = new UsageWindow("primary", "codex", 0, reset, 300, [], history);
            var bad = zero with { Id = "invalid", UsedPercent = 101 };
            File.WriteAllText(path, JsonSerializer.Serialize(new { providers = new[] {
                new ProviderUsage("codex", "Codex account", "available", "", at, [zero, bad])
            } }, new JsonSerializerOptions(JsonSerializerDefaults.Web)));
            var values = UsageReader.Read(path);
            check(values.Single().Windows is [{ UsedPercent: 0 }], "A reported zero quota survives projection while an invalid percentage is omitted.");
            var points = values.Single().Windows.Single().History;
            check(points.Count == 60 && points.First() == history.First() && points.Last() == history[^2],
                "Usage history is sampled with both endpoints and without another reset window.");
            File.WriteAllText(path, "{\"providers\":[{\"provider\":\"claude\",\"windows\":[null,{\"id\":null}]}]}");
            check(UsageReader.Read(path).Single().Windows.Count == 0, "Incomplete quota files never invent allowances or break activity collection.");
            File.WriteAllText(path, "{");
            check(UsageReader.Read(path).Count == 0, "A partial quota file is unavailable without failing the activity collector.");
        } finally { File.Delete(path); }
    }
}
