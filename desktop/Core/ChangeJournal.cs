using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace WebTools.Desktop;

// One latest meaningful change per piece of work. The browser owns review state.
public sealed class ChangeJournal(string path)
{
    private List<ActivityChange>? changes;

    public List<ActivityChange> Observe(IEnumerable<LocalSession> sessions, IEnumerable<Errand> errands, DateTimeOffset now)
    {
        if (changes is null) {
            try { changes = JsonSerializer.Deserialize<List<ActivityChange>>(File.ReadAllText(path)) ?? []; }
            catch (Exception e) when (e is IOException or JsonException or UnauthorizedAccessException) { changes = []; }
        }
        var before = changes.ToList();
        var items = changes.GroupBy(c => c.Key).ToDictionary(g => g.Key, g => g.First());
        void Add(string key, string provider, string title, string state, DateTimeOffset at, string detail, string location, string? url, bool versioned = false) {
            if (at.Year < 2000 || at > now.AddMinutes(1) || at < now.AddDays(-7)) return;
            // A repeated scan, clock advance, or companion restart is not a change.
            var signature = state + "\n" + detail;
            if (items.TryGetValue(key, out var previous) && previous.State == state && previous.Detail == detail
                && (!versioned || previous.At == at)) {
                items[key] = previous with { Title = title };
                return;
            }
            var id = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(key + "\n" + signature + "\n" + at.ToString("O"))))[..24];
            items[key] = new(key, id, provider, title, state, at, detail, location, url);
        }
        foreach (var session in sessions) {
            var cloud = session.Location == "Cloud";
            if (!cloud && session.State is not ("working" or "idle" or "interrupted")) continue;
            var key = cloud ? "cloud:" + session.Id : "session:" + session.Provider + ":" + session.Id;
            if (cloud && session.Turn is { } turn && session.State != "recorded") {
                var state = session.State == "quiet" ? "working" : session.State;
                Add(key, session.Provider, session.Title, state, state == "working" ? turn.StartedAt : turn.UpdatedAt,
                    state == "working" ? "Started cloud turn" : state == "idle" ? "Response recorded" : "Turn interrupted",
                    session.Location, NavigationPolicy.AppUrl + "?view=sessions&session=" + Uri.EscapeDataString(session.Id), versioned: true);
                continue;
            }
            var detail = cloud ? session.Checkpoint?.Headline ?? session.Detail
                : session.State == "working" ? "Started work" : session.State == "idle" ? "Turn finished" : "Turn interrupted";
            Add(key, session.Provider, session.Title, session.State, session.Checkpoint?.At ?? session.UpdatedAt,
                detail + (cloud && session.Checkpoint is not null ? " · " + session.Detail : ""), session.Location,
                cloud ? NavigationPolicy.AppUrl + "?view=sessions&session=" + Uri.EscapeDataString(session.Id) : null);
        }
        foreach (var job in errands) {
            var detail = job.State switch {
                "queued" => "Added to the Gemini queue", "claimed" => "Accepted by the Gemini worker",
                "reply" => "A reply is arriving", "complete" => "Result ready", "failed" => "Result needs review", _ => "Errand updated"
            };
            // Later replies are meaningful even when the errand remains in the same state.
            if (job.State is "reply" or "complete" or "failed") detail += " · " + (job.Message ?? "");
            Add("errand:" + job.Id, "Gemini", job.Title, job.State, job.UpdatedAt, detail, "Laptop",
                NavigationPolicy.ErrandUrl(job.Id, job.State is "reply" or "complete" or "failed"), versioned: true);
        }
        changes = items.Values.Where(c => c.At >= now.AddDays(-7) && c.At <= now.AddMinutes(1))
            .OrderByDescending(c => c.At).Take(150).ToList();
        if (!before.SequenceEqual(changes)) {
            try {
                Directory.CreateDirectory(Path.GetDirectoryName(path)!);
                File.WriteAllText(path + ".tmp", JsonSerializer.Serialize(changes));
                File.Move(path + ".tmp", path, overwrite: true);
            } catch (Exception e) when (e is IOException or UnauthorizedAccessException) { }
        }
        return changes;
    }
}
