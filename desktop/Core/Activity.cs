using System.Globalization;
using System.Text.Json;

namespace WebTools.Desktop;

public record Errand(string Id, string Title, string Note, string State,
    DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, string? Host,
    string? Message, string? Reply, bool HasOutput, bool IsNew, bool HasLocalOutput = false)
{
    public bool IsOpen => State is "queued" or "claimed" or "reply";
}

public record ActivitySnapshot(DateTimeOffset ObservedAt, DateTimeOffset? SyncedAt,
    string? Revision, bool Connected, string? Notice, List<Errand> Errands);

public record ApplicationSignal(string Name, string State, string Detail, int Processes);
public record WorkerActivity(string Kind, string Headline, DateTimeOffset At, string? ItemId = null);
public record DaemonSignal(string State, string Detail, DateTimeOffset? LastLogAt, WorkerActivity? Activity = null,
    List<WorkerActivity>? Reports = null);
public record Place(string Id, string Name, string Detail);
public record RecentFile(string Id, string Name, DateTimeOffset ModifiedAt, long Bytes);
public record LocalSession(string Id, string Provider, string Title, string State,
    DateTimeOffset UpdatedAt, string Workspace, string Detail = "", string Location = "Laptop",
    SessionCheckpoint? Checkpoint = null, SessionTurn? Turn = null);
public record SessionTurn(string Prompt, string Response, DateTimeOffset StartedAt, DateTimeOffset UpdatedAt, string LastTool);
public record WorkLink(string Label, string Url);
public record CheckpointTurn(int Turn, string Headline, string Summary, int Files, int Pushes, int Agents);
public record SessionCheckpoint(string Summary, string Headline, DateTimeOffset At,
    DateTimeOffset? AnalyzedAt, List<CheckpointTurn> Turns, List<WorkLink> Links);
public record SessionSnapshot(List<LocalSession> Items, List<string> Notices);
public record CloudSnapshot(List<LocalSession> Items, DateTimeOffset? CapturedAt, string? Notice);
public record ActivityEvent(string Id, string Provider, string Title, string State,
    DateTimeOffset At, string Detail, string Location, string SessionId);
public record ActivityChange(string Key, string Id, string Provider, string Title, string State,
    DateTimeOffset At, string Detail, string Location, string? Url);
public record LaptopSnapshot(ActivitySnapshot Activity, DaemonSignal Daemon,
    List<ApplicationSignal> Applications, List<Place> Places, List<RecentFile> Downloads,
    string MachineName, DateTimeOffset SeenThrough, SessionSnapshot Sessions, double ScanMilliseconds,
    CloudSnapshot Cloud, List<ActivityEvent> Events, List<ActivityChange>? Changes = null);

public static class Activity
{
    public static string Text(JsonElement node, string name, string fallback = "") =>
        node.ValueKind == JsonValueKind.Object && node.TryGetProperty(name, out var value)
            && value.ValueKind == JsonValueKind.String ? value.GetString() ?? fallback : fallback;

    public static JsonElement Child(JsonElement node, string name) =>
        node.ValueKind == JsonValueKind.Object && node.TryGetProperty(name, out var value)
            ? value : default;

    public static bool IsFalse(JsonElement node, string name) => Child(node, name).ValueKind == JsonValueKind.False;

    public static DateTimeOffset Date(JsonElement node, string name, DateTimeOffset fallback = default) =>
        DateTimeOffset.TryParse(Text(node, name), CultureInfo.InvariantCulture,
            DateTimeStyles.AssumeUniversal, out var date) ? date : fallback;

    public static bool ValidId(string id) => id.Length is > 0 and <= 96
        && char.IsAsciiLetterOrDigit(id[0])
        && id.All(c => char.IsAsciiLetterOrDigit(c) || c is '-' or '.')
        && !id.Contains("..", StringComparison.Ordinal);

    public static Errand? Join(string id, JsonElement request, JsonElement claim,
        JsonElement result, bool hasOutput, DateTimeOffset seenThrough)
    {
        if (!ValidId(id) || request.ValueKind != JsonValueKind.Object) return null;
        var run = Child(request, "run");
        if (Text(run, "method") != "laptop-daemon") return null;
        var created = Date(request, "createdAt");
        var data = Child(result, "data");
        var closed = Date(result, "closedAt", Date(result, "fulfilledAt", created));
        var updated = Date(data, "updatedAt", closed);
        var hasResult = result.ValueKind == JsonValueKind.Object;
        var hasClaim = claim.ValueKind == JsonValueKind.Object;
        var state = hasResult
            ? IsFalse(result, "ok") ? "failed" : IsFalse(data, "settled") ? "reply" : "complete"
            : hasClaim ? "claimed" : "queued";
        if (!hasResult) updated = hasClaim ? Date(claim, "claimedAt", created) : created;
        return new(id, Text(request, "title", id), Text(request, "note"), state,
            created, updated, hasClaim ? Text(claim, "by") : Text(result, "by"),
            Text(result, "message"), Text(data, "reply"), hasOutput,
            hasResult && updated > seenThrough);
    }
}

public static class NavigationPolicy
{
    public const string AppUrl = "https://mehrlander.github.io/web-tools/app/";
    public const string LocalUrl = "https://desktop.web-tools.local/index.html";

    public static bool IsWebTools(string? address) => Uri.TryCreate(address, UriKind.Absolute, out var uri)
        && uri.Scheme == "https" && uri.IsDefaultPort && uri.UserInfo.Length == 0
        && uri.Host == "mehrlander.github.io" && uri.AbsolutePath.StartsWith("/web-tools/", StringComparison.Ordinal);

    public static bool IsLocal(string? address) => Uri.TryCreate(address, UriKind.Absolute, out var uri)
        && uri.GetLeftPart(UriPartial.Path) == LocalUrl && uri.Query.Length == 0;

    public static string ErrandUrl(string id, bool hasResult = false) => Activity.ValidId(id)
        ? hasResult
            ? AppUrl + "?repo=mehrlander/web-tools-private&ref=background&view=files&file="
                + Uri.EscapeDataString("errands/results/" + id + ".json")
            : AppUrl + "?view=stage&errand=" + Uri.EscapeDataString(id)
        : throw new ArgumentException("Invalid errand id.");
}
