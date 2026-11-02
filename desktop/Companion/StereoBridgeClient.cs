using System.Net;
using System.Text.Json;

namespace WebTools.Desktop;

internal sealed record StereoSnapshot(int SchemaVersion, string MachineName, DateTimeOffset ObservedAt,
    bool Reachable, bool SessionAvailable, string Source, string Title, string Artist, string Album,
    string PlaybackState, double PositionSeconds, double EndSeconds,
    bool CanPlayPause, bool CanGoPrevious, bool CanGoNext, string? Notice = null);

// A fixed loopback adapter for the installed Stereo Bridge, not a general proxy.
internal sealed class StereoBridgeClient : IDisposable
{
    private readonly HttpClient client = new(new HttpClientHandler { AllowAutoRedirect = false, UseProxy = false }) {
        Timeout = TimeSpan.FromSeconds(3), MaxResponseContentBufferSize = 16384
    };
    private readonly Uri? origin;
    private readonly SemaphoreSlim actions = new(1, 1);
    public static bool Supports(string action) => action is "previous" or "play-pause" or "next" or "volume-down" or "mute" or "volume-up";

    public StereoBridgeClient()
    {
        var isolated = !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("WEBTOOLS_COMPANION_DATA"));
        // Isolated checks never contact the user's real media player. A fixture
        // may supply only a loopback port, never a host, URL or redirect target.
        if (!isolated) origin = new("http://127.0.0.1:45831/");
        else if (int.TryParse(Environment.GetEnvironmentVariable("WEBTOOLS_TEST_STEREO_PORT"), out var port) && port is > 0 and <= 65535)
            origin = new($"http://127.0.0.1:{port}/");
    }

    private static string Text(JsonElement value, string key) => value.TryGetProperty(key, out var field) && field.ValueKind == JsonValueKind.String
        ? new string((field.GetString() ?? "").Where(c => !char.IsControl(c)).Take(512).ToArray()) : "";
    private static bool Flag(JsonElement value, string key) => value.TryGetProperty(key, out var field) && field.ValueKind == JsonValueKind.True;
    private static double Seconds(JsonElement value, string key) => value.TryGetProperty(key, out var field) && field.TryGetDouble(out var number) && double.IsFinite(number)
        ? Math.Clamp(number, 0, 604800) : 0;
    private static StereoSnapshot Unavailable() => new(1, Environment.MachineName, DateTimeOffset.UtcNow,
        false, false, "", "", "", "", "unknown", 0, 0, false, false, false, "Stereo Bridge is unavailable. Open Stereo Bridge on the laptop.");

    public async Task<StereoSnapshot> Read(CancellationToken stop)
    {
        if (origin is null) return Unavailable();
        try {
            using var response = await client.GetAsync(new Uri(origin, "api/status"), stop);
            response.EnsureSuccessStatusCode();
            using var document = JsonDocument.Parse(await response.Content.ReadAsByteArrayAsync(stop), new JsonDocumentOptions { MaxDepth = 8 });
            var value = document.RootElement;
            if (value.ValueKind != JsonValueKind.Object || !value.TryGetProperty("sessionAvailable", out var session)
                || session.ValueKind is not (JsonValueKind.True or JsonValueKind.False)) return Unavailable();
            // Native exception text and unrecognized fields never enter the phone API.
            if (value.TryGetProperty("error", out var error) && error.ValueKind == JsonValueKind.String && !string.IsNullOrEmpty(error.GetString())) return Unavailable();
            var available = session.GetBoolean();
            var state = Text(value, "playbackStatus").ToLowerInvariant();
            if (state is not ("playing" or "paused" or "stopped")) state = "unknown";
            var end = available ? Seconds(value, "endSeconds") : 0;
            return new(1, Environment.MachineName, DateTimeOffset.UtcNow, true, available,
                available ? Text(value, "source") : "", available ? Text(value, "title") : "",
                available ? Text(value, "artist") : "", available ? Text(value, "album") : "",
                available ? state : "stopped", available ? Math.Min(Seconds(value, "positionSeconds"), end) : 0, end,
                available && Flag(value, "canPlayPause"), available && Flag(value, "canGoPrevious"), available && Flag(value, "canGoNext"));
        } catch (Exception e) when (e is HttpRequestException or JsonException or InvalidOperationException or TaskCanceledException) {
            stop.ThrowIfCancellationRequested();
            return Unavailable();
        }
    }

    public async Task<(int Status, bool Ok, string Message)> Execute(string action, CancellationToken stop)
    {
        if (!Supports(action)) return (404, false, "Unknown media action.");
        if (!await actions.WaitAsync(0, stop)) return (409, false, "Another control is still completing.");
        try {
            var status = await Read(stop);
            if (!status.Reachable) return (503, false, "Stereo Bridge is unavailable.");
            var allowed = action switch {
                "previous" => status.CanGoPrevious,
                "next" => status.CanGoNext,
                "play-pause" => status.CanPlayPause,
                _ => true // Volume keys affect the laptop's selected audio output.
            };
            if (!allowed) return (409, false, "That control is unavailable for the current player.");
            using var response = await client.PostAsync(new Uri(origin!, "api/action/" + action), null, stop);
            if (response.StatusCode == HttpStatusCode.Conflict) return (409, false, "The player did not accept that control.");
            response.EnsureSuccessStatusCode();
            using var body = JsonDocument.Parse(await response.Content.ReadAsByteArrayAsync(stop), new JsonDocumentOptions { MaxDepth = 8 });
            if (body.RootElement.ValueKind != JsonValueKind.Object || !Flag(body.RootElement, "ok"))
                return (502, false, "Could not confirm the control. It was not retried.");
            return (200, true, "Control sent.");
        } catch (Exception e) when (e is HttpRequestException or JsonException or TaskCanceledException) {
            stop.ThrowIfCancellationRequested();
            // A timeout can happen after a key was delivered. Never retry toggles.
            return (502, false, "Could not confirm the control. It was not retried.");
        } finally { actions.Release(); }
    }

    public void Dispose() { client.Dispose(); actions.Dispose(); }
}
