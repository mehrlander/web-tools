using System.Net;
using System.Security.Cryptography;
using System.Text.Json;
using WebTools.Desktop;

var port = int.TryParse(Environment.GetEnvironmentVariable("WEBTOOLS_COMPANION_PORT"), out var configuredPort) ? configuredPort : CompanionAccess.Port;
using var instance = new Mutex(true, "Local\\WebTools.Companion." + port, out var first);
if (!first) return;
CompanionAccess.Ensure();
var collector = new ActivityCollector();
var builder = WebApplication.CreateSlimBuilder(args);
builder.Logging.ClearProviders();
builder.WebHost.ConfigureKestrel(server => server.Listen(IPAddress.Loopback, port));
var app = builder.Build();
var json = new JsonSerializerOptions(JsonSerializerDefaults.Web);

app.Use(async (context, next) => {
    var request = context.Request;
    var access = CompanionAccess.Load();
    // No LAN listener or forwarded-header middleware. Only the local desktop
    // bearer or the owner's identity supplied by Tailscale Serve is accepted.
    var local = access.AcceptsLocal(request.Headers.Authorization);
    var phoneHost = Uri.TryCreate(access.PhoneUrl, UriKind.Absolute, out var url) ? url.Host : "";
    var host = request.Host.Host;
    var validHost = host is "127.0.0.1" or "localhost" || phoneHost.Length > 0 && host.Equals(phoneHost, StringComparison.OrdinalIgnoreCase);
    var owner = access.TailscaleLogin.Length > 0
        && string.Equals(request.Headers["Tailscale-User-Login"], access.TailscaleLogin, StringComparison.OrdinalIgnoreCase);
    var desktop = request.Path.StartsWithSegments("/api/v1/desktop");
    context.Response.Headers.CacheControl = "no-store";
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["Referrer-Policy"] = "no-referrer";
    context.Response.Headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'";
    if (!IPAddress.IsLoopback(context.Connection.RemoteIpAddress ?? IPAddress.None) || !validHost || !(local || owner && !desktop)) {
        context.Response.StatusCode = 403;
        await context.Response.WriteAsync("Connect through your private Tailscale address using the owner's account.");
        return;
    }
    if (request.Method is not ("GET" or "HEAD")) {
        context.Response.StatusCode = 405;
        context.Response.Headers.Allow = "GET, HEAD";
        return;
    }
    // Same-origin reads only, with no CORS opt-in or cookie authentication.
    if (request.Headers.Origin.Count > 0 && request.Headers.Origin != "https://" + request.Host
        && request.Headers.Origin != "http://" + request.Host) {
        context.Response.StatusCode = 403;
        return;
    }
    await next(context);
});

app.MapGet("/api/v1/desktop", () => collector.Latest is { } activity
    ? Results.Json(activity, json) : Results.StatusCode(503));
app.MapGet("/api/v1/now", (HttpContext context) => {
    if (collector.Latest is not { } activity) return Results.StatusCode(503);
    var payload = JsonSerializer.SerializeToUtf8Bytes(PhoneActivity.Create(activity.Snapshot, activity.ObservedAt, collector.Error), json);
    var etag = "\"" + Convert.ToHexString(SHA256.HashData(payload)) + "\"";
    context.Response.Headers.ETag = etag;
    if (context.Request.Headers.IfNoneMatch == etag) return Results.StatusCode(304);
    return Results.Bytes(payload, "application/json; charset=utf-8");
});
app.MapGet("/api/v1/results/{id}", (string id) => collector.Latest is { } activity && Activity.ValidId(id)
    && PhoneActivity.Reply(activity.Snapshot, id) is { } reply ? Results.Json(new { reply }, json) : Results.NotFound());

// Explicit assets only. No file browsing, arbitrary path, diagnostics or settings route.
var assets = new Dictionary<string, (string File, string Type)> {
    ["/"] = ("index.html", "text/html; charset=utf-8"),
    ["/phone.js"] = ("phone.js", "text/javascript; charset=utf-8"),
    ["/reading.js"] = ("reading.js", "text/javascript; charset=utf-8"),
    ["/now-shared.js"] = ("now-shared.js", "text/javascript; charset=utf-8"),
    ["/usage-view.js"] = ("usage-view.js", "text/javascript; charset=utf-8"),
    ["/icon.svg"] = ("icon.svg", "image/svg+xml"),
    ["/apple-touch-icon.png"] = ("apple-touch-icon.png", "image/png"),
    ["/manifest.webmanifest"] = ("manifest.webmanifest", "application/manifest+json"),
    ["/vendor/tailwind.js"] = ("vendor/tailwind.js", "text/javascript; charset=utf-8"),
    ["/vendor/marked.js"] = ("vendor/marked.js", "text/javascript; charset=utf-8"),
    ["/vendor/purify.js"] = ("vendor/purify.js", "text/javascript; charset=utf-8"),
    ["/vendor/assistant-mark.js"] = ("vendor/assistant-mark.js", "text/javascript; charset=utf-8"),
    ["/vendor/claude-mark.js"] = ("vendor/claude-mark.js", "text/javascript; charset=utf-8")
};
foreach (var (route, asset) in assets) app.MapGet(route, () => Results.File(Path.Combine(AppContext.BaseDirectory, "phone", asset.File), asset.Type));
var sampling = Task.Run(() => collector.Run(app.Lifetime.ApplicationStopping));
var summaries = Task.Run(() => LocalSummaryRunner.Run(app.Lifetime.ApplicationStopping));
await app.RunAsync();
await sampling;
await summaries;
