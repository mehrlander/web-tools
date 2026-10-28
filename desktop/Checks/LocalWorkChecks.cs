using System.Text.Json;
using WebTools.Desktop;

static class LocalWorkChecks
{
    public static void Run(Action<bool, string> check)
    {
        var now = DateTimeOffset.UtcNow;
        var path = Path.Combine(Path.GetTempPath(), "local-work-" + Guid.NewGuid().ToString("N") + ".json");
        var source = new SessionSnapshot([new("local", "Codex", "A chat", "working", now, "private", "Observed tool")], []);
        try {
            var row = new { provider = "Codex", id = "local", through = now.AddMinutes(-1), agents = 2,
                segments = new[] { new { id = "segment", headline = "Phone layout", summary = "Reduced card spacing.",
                    at = now.AddMinutes(-1), generatedAt = now, evidence = new[] { "2 file edits confirmed" } } } };
            File.WriteAllText(path, JsonSerializer.Serialize(new { schema = 1, items = new[] { row } }));
            var item = LocalWorkReader.Join(source, path, now).Items.Single();
            check(item is { State: "working", Title: "A chat", Detail: "Observed tool", Work.Agents: 2 }
                && item.UpdatedAt == now && item.Work.Segments.Single().Summary == "Reduced card spacing.",
                "Local work summaries enrich sessions without replacing live status or timestamps.");
            File.WriteAllText(path, JsonSerializer.Serialize(new { schema = 1, items = new[] { row with { through = now.AddMinutes(5) } } }));
            check(LocalWorkReader.Join(source, path, now).Items.Single().Work is null, "Future summary evidence cannot enter the live view.");
            File.WriteAllText(path, "{broken");
            check(LocalWorkReader.Join(source, path, now).Items.Single().State == "working", "An incomplete summary snapshot leaves observed activity available.");
        } finally { File.Delete(path); }
    }
}
