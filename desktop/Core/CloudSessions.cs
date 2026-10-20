using System.Text.Json;

namespace WebTools.Desktop;

public static class CloudSessions
{
    public static CloudSnapshot Parse(string json, DateTimeOffset now)
    {
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        var captured = Activity.Date(root, "generatedAt");
        var rows = Activity.Child(root, "rows");
        if (rows.ValueKind != JsonValueKind.Array) throw new JsonException("Missing session rows.");
        var items = new List<LocalSession>();
        foreach (var row in rows.EnumerateArray()) {
            var id = Activity.Text(row, "id");
            var source = Activity.Text(row, "agent");
            if (!Activity.ValidId(id) || !Uri.TryCreate(source, UriKind.Absolute, out var uri)
                || uri.Scheme != "https" || uri.Host != "claude.ai" || !uri.AbsolutePath.StartsWith("/code/session_", StringComparison.Ordinal)) continue;
            var at = Activity.Date(row, "ended", Activity.Date(row, "started"));
            if (at.Year < 2000 || at > now.AddMinutes(1) || now - at >= TimeSpan.FromDays(1)) continue;
            var state = Activity.Text(row, "state");
            var detail = state switch {
                "needs" => "Recorded: needs you", "choice" => "Recorded: choice needed",
                "pending" => "Recorded: pending", "merged" => "Recorded: merged",
                "closed" => "Recorded: closed", "done" => "Recorded: done",
                "assess" => "Recorded: ready to assess", "ready" => "Recorded: ready to continue",
                "clean" => "Recorded: clean exit", _ => "Recorded session update"
            };
            var title = Activity.Text(row, "title", Activity.Text(row, "ask", "Claude session"));
            if (title.Length > 180) title = title[..180] + "…";
            items.Add(new(id, "Claude", title, "recorded", at, "", detail, "Cloud"));
        }
        return new(items.OrderByDescending(s => s.UpdatedAt).Take(16).ToList(), captured.Year < 2000 ? null : captured, null);
    }
}
