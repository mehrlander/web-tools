using System.Text.Json;

namespace WebTools.Desktop;

// A small local record of observed transitions, not a transcript archive.
public sealed class ActivityJournal
{
    private readonly string path;
    private readonly Dictionary<string, string> observed = [];
    private List<ActivityEvent> events = [];

    public ActivityJournal(string path)
    {
        this.path = path;
        try { events = JsonSerializer.Deserialize<List<ActivityEvent>>(File.ReadAllText(path))?.Take(150).ToList() ?? []; }
        catch (Exception ex) when (ex is IOException or JsonException or UnauthorizedAccessException) { }
    }

    public List<ActivityEvent> Observe(IEnumerable<LocalSession> sessions, DateTimeOffset now)
    {
        var changed = false;
        foreach (var session in sessions) {
            var key = session.Provider + ":" + session.Id;
            var value = session.State + ":" + session.Detail;
            if (observed.TryGetValue(key, out var previous) && previous == value) continue;
            observed[key] = value;
            var id = key + ":" + session.UpdatedAt.ToUnixTimeMilliseconds() + ":" + session.State;
            if (events.Any(e => e.Id == id)) continue;
            events.Add(new(id, session.Provider, session.Title, session.State, session.UpdatedAt,
                session.Detail, session.Location, session.Id));
            changed = true;
        }
        var recent = events.Where(e => now - e.At < TimeSpan.FromDays(1) && e.At <= now.AddMinutes(1))
            .OrderByDescending(e => e.At).Take(150).ToList();
        changed |= events.Count != recent.Count;
        events = recent;
        if (changed) {
            try {
                Directory.CreateDirectory(Path.GetDirectoryName(path)!);
                var temporary = path + ".tmp";
                File.WriteAllText(temporary, JsonSerializer.Serialize(events));
                File.Move(temporary, path, overwrite: true);
            } catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { }
        }
        return events.ToList();
    }
}
