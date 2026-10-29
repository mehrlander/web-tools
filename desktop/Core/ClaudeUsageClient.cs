using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace WebTools.Desktop;

// The same account usage and OAuth endpoints shipped with Claude Code. No model
// request is made. Credentials remain in Claude's existing local credential file.
public sealed class ClaudeUsageClient(HttpClient http, string credentialsPath, string stateDirectory)
{
    public const string UsageUrl = "https://api.anthropic.com/api/oauth/usage";
    private const string TokenUrl = "https://platform.claude.com/v1/oauth/token";
    private const string ClientId = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
    private DateTimeOffset nextCheck;
    private DateTime credentialWrite;

    public async Task Capture(DateTimeOffset now, CancellationToken stop)
    {
        var modified = File.GetLastWriteTimeUtc(credentialsPath);
        if (now < nextCheck && modified == credentialWrite) return;
        nextCheck = now.AddMinutes(5);
        credentialWrite = modified;
        try {
            var root = ReadCredentials();
            var oauth = root?["claudeAiOauth"];
            var access = oauth?["accessToken"]?.GetValue<string>();
            var refresh = oauth?["refreshToken"]?.GetValue<string>();
            if (string.IsNullOrEmpty(access) && string.IsNullOrEmpty(refresh)) {
                await Status("signin_required", "Sign in to Claude Code on this laptop to connect usage.", now, stop);
                return;
            }
            var expiry = oauth?["expiresAt"]?.GetValue<long>() ?? 0;
            var refreshed = false;
            if (string.IsNullOrEmpty(access) || expiry > 0 && expiry <= now.ToUnixTimeMilliseconds()) {
                access = await Refresh(root!, now, stop);
                refreshed = true;
            }
            using var first = await ReadUsage(access!, stop);
            HttpResponseMessage? retry = null;
            try {
                var response = first;
                if (first.StatusCode == HttpStatusCode.Unauthorized && !refreshed) {
                    access = await Refresh(ReadCredentials()!, now, stop);
                    response = retry = await ReadUsage(access, stop);
                }
                if (!response.IsSuccessStatusCode) {
                    await Status(response.StatusCode == HttpStatusCode.Unauthorized ? "signin_required" : "unavailable",
                        response.StatusCode == HttpStatusCode.Unauthorized ? "Claude sign-in has expired. Sign in again on this laptop." : "Claude account usage is temporarily unavailable.", now, stop);
                    return;
                }
                using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync(stop));
                var limits = Normalize(body.RootElement);
                await Write(Path.Combine(stateDirectory, "usage-inputs", "claude.json"), new {
                    capturedAt = now, source = "Claude account", status = "available", rate_limits = limits
                }, stop);
                await Status("available", limits.Count == 0 ? "No active quota windows reported by Claude." : "", now, stop);
            } finally { retry?.Dispose(); }
        } catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException or HttpRequestException or InvalidOperationException or OperationCanceledException) {
            if (!stop.IsCancellationRequested)
                await Status("unavailable", "Claude account usage is unavailable. Check the laptop's Claude sign-in.", now, stop);
        }
    }

    private JsonNode? ReadCredentials() => File.Exists(credentialsPath)
        ? JsonNode.Parse(File.ReadAllText(credentialsPath)) : null;

    private Task<HttpResponseMessage> ReadUsage(string access, CancellationToken stop)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, UsageUrl);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", access);
        request.Headers.Add("anthropic-beta", "oauth-2025-04-20");
        return http.SendAsync(request, stop);
    }

    private async Task<string> Refresh(JsonNode root, DateTimeOffset now, CancellationToken stop)
    {
        var oauth = root["claudeAiOauth"]!;
        var refresh = oauth["refreshToken"]?.GetValue<string>();
        if (string.IsNullOrEmpty(refresh)) throw new InvalidOperationException("Sign-in required.");
        using var response = await http.PostAsJsonAsync(TokenUrl, new {
            grant_type = "refresh_token", refresh_token = refresh, client_id = ClientId
        }, stop);
        response.EnsureSuccessStatusCode();
        var tokens = JsonNode.Parse(await response.Content.ReadAsStringAsync(stop));
        var access = tokens?["access_token"]?.GetValue<string>();
        var expires = tokens?["expires_in"]?.GetValue<int>() ?? 0;
        if (string.IsNullOrEmpty(access) || expires <= 0) throw new InvalidOperationException("Refresh unavailable.");
        // Preserve unrelated settings and a newer sign-in made by Claude itself.
        var current = ReadCredentials();
        if (current?["claudeAiOauth"]?["refreshToken"]?.GetValue<string>() != refresh
            || current?["claudeAiOauth"]?["accessToken"]?.GetValue<string>() != oauth["accessToken"]?.GetValue<string>())
            return current?["claudeAiOauth"]?["accessToken"]?.GetValue<string>() ?? throw new InvalidOperationException("Sign-in changed.");
        var updated = current!["claudeAiOauth"]!;
        updated["accessToken"] = access;
        updated["refreshToken"] = tokens!["refresh_token"]?.GetValue<string>() ?? refresh;
        updated["expiresAt"] = now.AddSeconds(expires).ToUnixTimeMilliseconds();
        await Write(credentialsPath, current, stop);
        credentialWrite = File.GetLastWriteTimeUtc(credentialsPath);
        return access;
    }

    public static Dictionary<string, object> Normalize(JsonElement body)
    {
        var result = new Dictionary<string, object>();
        foreach (var key in new[] { "five_hour", "seven_day", "seven_day_sonnet", "seven_day_opus", "seven_day_fable", "seven_day_cowork" }) {
            var row = Activity.Child(body, key);
            var used = Activity.Child(row, "utilization");
            var reset = Activity.Date(row, "resets_at");
            if (used.ValueKind == JsonValueKind.Number && used.TryGetDouble(out var value)
                && double.IsFinite(value) && value is >= 0 and <= 100 && reset.Year >= 2000)
                result[key] = new { used_percentage = value, resets_at = reset.ToUnixTimeSeconds() };
        }
        return result;
    }

    private Task Status(string status, string notice, DateTimeOffset at, CancellationToken stop) =>
        Write(Path.Combine(stateDirectory, "usage-inputs", "claude-status.json"), new { status, notice, checkedAt = at }, stop);

    private static async Task Write(string path, object value, CancellationToken stop)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        var temporary = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try {
            await File.WriteAllTextAsync(temporary, JsonSerializer.Serialize(value), stop);
            File.Move(temporary, path, overwrite: true);
        } finally { if (File.Exists(temporary)) File.Delete(temporary); }
    }
}
