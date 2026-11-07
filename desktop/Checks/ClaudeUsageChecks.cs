using System.Net;
using System.Text;
using System.Text.Json;
using WebTools.Desktop;

static class ClaudeUsageChecks
{
    public static async Task Run(Action<bool, string> check)
    {
        var folder = Path.Combine(Path.GetTempPath(), "claude-usage-check-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(folder);
        var credentials = Path.Combine(folder, "credentials.json");
        var now = DateTimeOffset.Parse("2027-01-15T05:00:00Z");
        var handler = new FixtureHandler();
        using var http = new HttpClient(handler);
        var reader = new ClaudeUsageClient(http, credentials, folder);
        try {
            check(NavigationPolicy.IsUsagePage("https://claude.ai/settings/usage") && NavigationPolicy.IsUsagePage("https://chatgpt.com/settings/usage")
                && NavigationPolicy.IsUsagePage("https://antigravity.google.com/"), "The desktop can open all three approved usage destinations.");
            check(!NavigationPolicy.IsUsagePage("https://claude.ai.evil.test/settings/usage") && !NavigationPolicy.IsUsagePage("javascript:alert(1)")
                && !NavigationPolicy.IsUsagePage("https://claude.ai/settings/usage?redirect=https://evil.test"), "Usage navigation rejects lookalikes and arbitrary external destinations.");
            await reader.Capture(now, CancellationToken.None);
            check(handler.Requests == 0 && File.ReadAllText(Path.Combine(folder,"usage-inputs","claude-status.json")).Contains("signin_required"),
                "A missing Claude sign-in reports a concrete action without contacting the provider.");
            await File.WriteAllTextAsync(credentials, JsonSerializer.Serialize(new {
                claudeAiOauth = new { accessToken="old-test-access", refreshToken="old-test-refresh", expiresAt=now.AddHours(-1).ToUnixTimeMilliseconds(), scopes=new[]{"user:profile"} },
                unrelated = new { preserve="yes" }
            }));
            await reader.Capture(now.AddMinutes(1), CancellationToken.None);
            var capture = File.ReadAllText(Path.Combine(folder,"usage-inputs","claude.json"));
            check(handler.Refreshes == 1 && handler.Reads == 1 && capture.Contains("23.5") && capture.Contains("seven_day_sonnet"),
                "Expired sign-in refreshes once and collects account-wide and model-specific windows.");
            check(!capture.Contains("test-access") && !capture.Contains("test-refresh") && !capture.Contains("private@example.test"),
                "Normalized Claude readings omit credentials, account metadata and unrelated response fields.");
            using (var saved = JsonDocument.Parse(File.ReadAllText(credentials)))
                check(saved.RootElement.GetProperty("unrelated").GetProperty("preserve").GetString() == "yes"
                    && saved.RootElement.GetProperty("claudeAiOauth").GetProperty("refreshToken").GetString() == "new-test-refresh",
                    "Token rotation preserves unrelated Claude credential-file data.");
            await reader.Capture(now.AddMinutes(2), CancellationToken.None);
            check(handler.Requests == 2, "Claude account polling respects its five-minute cache.");
            handler.Fail = true;
            await reader.Capture(now.AddMinutes(7), CancellationToken.None);
            check(File.ReadAllText(Path.Combine(folder,"usage-inputs","claude.json")) == capture
                && !File.ReadAllText(Path.Combine(folder,"usage-inputs","claude-status.json")).Contains("server-secret"),
                "Provider failures retain the last reading and never publish raw error bodies.");
        } finally {
            var expected = Path.Combine(Path.GetTempPath(), Path.GetFileName(folder));
            if (Path.GetFullPath(folder) == Path.GetFullPath(expected) && Path.GetFileName(folder).StartsWith("claude-usage-check-")) Directory.Delete(folder, recursive:true);
        }
    }

    sealed class FixtureHandler : HttpMessageHandler
    {
        public int Requests, Refreshes, Reads;
        public bool Fail;
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken stop)
        {
            Requests++;
            string body;
            if (request.RequestUri?.AbsoluteUri == "https://platform.claude.com/v1/oauth/token") {
                Refreshes++;
                body = """{"access_token":"new-test-access","refresh_token":"new-test-refresh","expires_in":3600}""";
            } else if (request.RequestUri?.AbsoluteUri == ClaudeUsageClient.UsageUrl && request.Headers.Authorization?.Parameter == "new-test-access") {
                Reads++;
                body = """{"five_hour":{"utilization":23.5,"resets_at":"2027-01-15T08:00:00Z"},"seven_day_sonnet":{"utilization":61,"resets_at":"2027-01-18T08:00:00Z"},"email":"private@example.test"}""";
            } else throw new Exception("Unexpected quota destination or authentication.");
            return Task.FromResult(new HttpResponseMessage(Fail ? HttpStatusCode.ServiceUnavailable : HttpStatusCode.OK) {
                Content = new StringContent(Fail ? "server-secret" : body, Encoding.UTF8, "application/json")
            });
        }
    }
}
