using System.Net;
using System.Security.Cryptography;
using System.Text.Json;
using WebTools.Desktop;

var port = int.TryParse(Environment.GetEnvironmentVariable("WEBTOOLS_COMPANION_PORT"), out var configuredPort) ? configuredPort : CompanionAccess.Port;
using var instance = new Mutex(true, "Local\\WebTools.Companion." + port, out var first);
if (!first) return;
CompanionAccess.Ensure();
var collector = new ActivityCollector();
var computer = new ComputerReader();
var repositories = new RepositoryReader();
var folders = new FolderReader();
var fileContents = new FileContentReader();
try { Directory.CreateDirectory(FileRoots.OutputsDirectory); } catch (Exception e) when (e is IOException or UnauthorizedAccessException) { }
using var stereo = new StereoBridgeClient();
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
    context.Response.Headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'";
    if (!IPAddress.IsLoopback(context.Connection.RemoteIpAddress ?? IPAddress.None) || !validHost || !(local || owner && !desktop)) {
        context.Response.StatusCode = 403;
        await context.Response.WriteAsync("Connect through your private Tailscale address using the owner's account.");
        return;
    }
    var mediaAction = request.Method == "POST" && request.Path.StartsWithSegments("/api/v1/devices/stereo");
    var repositoryAction = request.Method == "POST" && request.Path.StartsWithSegments("/api/v1/repositories")
        && request.Path.Value!.EndsWith("/fetch", StringComparison.Ordinal);
    var syncAction = request.Method == "POST" && request.Path == "/api/v1/sync/retry";
    if (request.Method is not ("GET" or "HEAD") && !mediaAction && !repositoryAction && !syncAction) {
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
    // Browser controls need a same-origin POST and a custom header. Cross-site
    // forms cannot supply that header, and no preflight/CORS access is offered.
    if ((mediaAction || repositoryAction || syncAction) && (request.Headers["X-WebTools-Action"] != "1" || !local && request.Headers.Origin.Count != 1
        || request.Headers["Sec-Fetch-Site"] == "cross-site" || request.QueryString.HasValue
        || request.ContentLength is > 0 || request.Headers.TransferEncoding.Count > 0)) {
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
app.MapGet("/api/v1/errands", (HttpContext context) => {
    if (collector.Latest is not { } activity) return Results.StatusCode(503);
    var payload = JsonSerializer.SerializeToUtf8Bytes(PhoneActivity.Errands(activity.Snapshot, activity.ObservedAt), json);
    var etag = "\"" + Convert.ToHexString(SHA256.HashData(payload)) + "\"";
    context.Response.Headers.ETag = etag;
    if (context.Request.Headers.IfNoneMatch == etag) return Results.StatusCode(304);
    return Results.Bytes(payload, "application/json; charset=utf-8");
});
app.MapGet("/api/v1/usage-history", (HttpContext context) => {
    if (context.Request.QueryString.HasValue) return Results.BadRequest();
    return UsageArchiveReader.Read() is { } payload
        ? Results.Bytes(payload, "application/json; charset=utf-8") : Results.StatusCode(503);
});
app.MapGet("/api/v1/computer", (HttpContext context) => {
    if (computer.Latest is not { } value) return Results.StatusCode(503);
    var payload = JsonSerializer.SerializeToUtf8Bytes(value, json);
    var etag = "\"" + Convert.ToHexString(SHA256.HashData(payload)) + "\"";
    context.Response.Headers.ETag = etag;
    if (context.Request.Headers.IfNoneMatch == etag) return Results.StatusCode(304);
    return Results.Bytes(payload, "application/json; charset=utf-8");
});
app.MapGet("/api/v1/devices", async (CancellationToken stop) => Results.Json(await stereo.Read(stop), json));
app.MapGet("/api/v1/repositories", (HttpContext context) => {
    if (repositories.Latest is not { } value) return Results.StatusCode(503);
    var payload = JsonSerializer.SerializeToUtf8Bytes(value, json);
    var etag = "\"" + Convert.ToHexString(SHA256.HashData(payload)) + "\"";
    context.Response.Headers.ETag = etag;
    if (context.Request.Headers.IfNoneMatch == etag) return Results.StatusCode(304);
    return Results.Bytes(payload, "application/json; charset=utf-8");
});
app.MapPost("/api/v1/repositories/{key}/fetch", (string key) => {
    var status = repositories.RequestFetch(key);
    return Results.Json(new { accepted = status == 202 }, json, statusCode: status);
});
app.MapPost("/api/v1/sync/retry", (HttpContext context) => {
    var result = collector.RequestSync();
    if (result.RetryAfterSeconds > 0) context.Response.Headers.RetryAfter = result.RetryAfterSeconds.ToString();
    return Results.Json(new { accepted = result.Status == 202, retryAfterSeconds = result.RetryAfterSeconds }, json, statusCode: result.Status);
});
app.MapGet("/api/v1/files", async (HttpContext context) => {
    if (context.Request.Query.Any(p => p.Key is not ("path" or "root") || p.Value.Count != 1)) return Results.BadRequest();
    var root = context.Request.Query.TryGetValue("root", out var selectedRoot) ? selectedRoot.ToString() : "gh";
    var result = await folders.Read(root, context.Request.Query["path"].ToString(), context.RequestAborted);
    return result.Value is { } value ? Results.Json(value, json) : Results.StatusCode(result.Status);
});
app.MapMethods("/api/v1/files/content", ["GET", "HEAD"], async Task<IResult> (HttpContext context) => {
    var query = context.Request.Query;
    if (query.Any(p => p.Key is not ("root" or "path" or "download") || p.Value.Count != 1)
        || !query.ContainsKey("path") || query.TryGetValue("download", out var download) && download != "1") return Results.BadRequest();
    var root = query.TryGetValue("root", out var selectedRoot) ? selectedRoot.ToString() : "gh";
    var result = await fileContents.Open(root, query["path"].ToString(), query.ContainsKey("download"), context.RequestAborted);
    if (result.Value is not { } value) return Results.StatusCode(result.Status);
    context.Response.Headers["Content-Security-Policy"] = "default-src 'none'; sandbox allow-downloads; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
        + (value.ContentType.StartsWith("image/", StringComparison.Ordinal) ? "; style-src 'unsafe-inline'" : "");
    context.Response.RegisterForDisposeAsync(value.Stream);
    return Results.File(value.Stream, value.ContentType, value.DownloadName, enableRangeProcessing: true);
});
app.MapPost("/api/v1/devices/stereo/{action}", async (HttpContext context, string action) => {
    var result = await stereo.Execute(action, context.RequestAborted);
    return Results.Json(new { result.Ok, result.Message }, json, statusCode: result.Status);
});
app.MapGet("/api/v1/results/{id}", (string id) => collector.Latest is { } activity && Activity.ValidId(id)
    && PhoneActivity.Reply(activity.Snapshot, id) is { } reply ? Results.Json(new { reply }, json) : Results.NotFound());

// Explicit assets only. Folder metadata has its own root-bound API.
var assets = new Dictionary<string, (string File, string Type)> {
    ["/"] = ("index.html", "text/html; charset=utf-8"),
    ["/phone.js"] = ("phone.js", "text/javascript; charset=utf-8"),
    ["/phone-usage.js"] = ("phone-usage.js", "text/javascript; charset=utf-8"),
    ["/phone-usage.css"] = ("phone-usage.css", "text/css; charset=utf-8"),
    ["/phone-ui.css"] = ("phone-ui.css", "text/css; charset=utf-8"),
    ["/computer.js"] = ("computer.js", "text/javascript; charset=utf-8"),
    ["/devices.js"] = ("devices.js", "text/javascript; charset=utf-8"),
    ["/views.js"] = ("views.js", "text/javascript; charset=utf-8"),
    ["/repositories.js"] = ("repositories.js", "text/javascript; charset=utf-8"),
    ["/local-files.js"] = ("local-files.js", "text/javascript; charset=utf-8"),
    ["/sw.js"] = ("sw.js", "text/javascript; charset=utf-8"),
    ["/reading.js"] = ("reading.js", "text/javascript; charset=utf-8"),
    ["/now-shared.js"] = ("now-shared.js", "text/javascript; charset=utf-8"),
    ["/usage-view.js"] = ("usage-view.js", "text/javascript; charset=utf-8"),
    ["/recent-usage.js"] = ("recent-usage.js", "text/javascript; charset=utf-8"),
    ["/phone-info.js"] = ("phone-info.js", "text/javascript; charset=utf-8"),
    ["/errands-view.js"] = ("errands-view.js", "text/javascript; charset=utf-8"),
    ["/icon.svg"] = ("icon.svg", "image/svg+xml"),
    ["/apple-touch-icon.png"] = ("apple-touch-icon.png", "image/png"),
    ["/manifest.webmanifest"] = ("manifest.webmanifest", "application/manifest+json"),
    ["/vendor/tailwind.js"] = ("vendor/tailwind.js", "text/javascript; charset=utf-8"),
    ["/vendor/marked.js"] = ("vendor/marked.js", "text/javascript; charset=utf-8"),
    ["/vendor/purify.js"] = ("vendor/purify.js", "text/javascript; charset=utf-8"),
    ["/vendor/assistant-mark.js"] = ("vendor/assistant-mark.js", "text/javascript; charset=utf-8"),
    ["/vendor/claude-mark.js"] = ("vendor/claude-mark.js", "text/javascript; charset=utf-8"),
    ["/vendor/title-tip.js"] = ("vendor/title-tip.js", "text/javascript; charset=utf-8"),
    ["/vendor/panel-tip.js"] = ("vendor/panel-tip.js", "text/javascript; charset=utf-8")
};
assets["/vendor/swipe-deck.js"] = ("vendor/swipe-deck.js", "text/javascript; charset=utf-8");
foreach (var (route, asset) in assets) app.MapGet(route, () => Results.File(Path.Combine(AppContext.BaseDirectory, "phone", asset.File), asset.Type));
var sampling = Task.Run(() => collector.Run(app.Lifetime.ApplicationStopping));
var summaries = Task.Run(() => LocalSummaryRunner.Run(app.Lifetime.ApplicationStopping));
var usageArchive = Task.Run(() => UsageArchiveRunner.Run(app.Lifetime.ApplicationStopping));
var machineSampling = Task.Run(() => computer.Run(app.Lifetime.ApplicationStopping));
var repositorySampling = Task.Run(() => repositories.Run(app.Lifetime.ApplicationStopping));
await app.RunAsync();
await sampling;
await summaries;
await usageArchive;
await machineSampling;
await repositorySampling;
