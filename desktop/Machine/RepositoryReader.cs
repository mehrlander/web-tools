using System.Diagnostics;
using System.Text.Json;
using System.Threading.Channels;

namespace WebTools.Desktop;

public sealed class RepositoryRefreshSchedule
{
    private readonly object gate = new();
    private readonly Dictionary<string, long?> busy = [];
    private readonly Dictionary<string, RepositorySyncJob> jobs = [];
    private RepositorySyncJob? lastCompleted;
    private DateTimeOffset? scanStartedAt;
    private long generation;
    private readonly Channel<bool> wake = Channel.CreateBounded<bool>(new BoundedChannelOptions(1) {
        SingleReader = true, FullMode = BoundedChannelFullMode.DropWrite
    });

    public IReadOnlyList<string> BusyKeys { get { lock (gate) return busy.Keys.ToList(); } }
    public RepositorySyncProgress Progress => Observe().Sync;

    public (IReadOnlyList<string> BusyKeys, RepositorySyncProgress Sync) Observe()
    {
        lock (gate) return (busy.Keys.ToList(), new(
            jobs.Values.FirstOrDefault(j => j.StartedAt.HasValue && !j.FinishedAt.HasValue),
            jobs.Values.Where(j => !j.StartedAt.HasValue && !j.FinishedAt.HasValue).ToList(),
            jobs.Values.Where(j => j.FinishedAt.HasValue).ToList(),
            lastCompleted, scanStartedAt.HasValue, scanStartedAt));
    }

    public bool TryQueue(string key, bool updateMain = false)
    {
        lock (gate) {
            if (!busy.TryAdd(key, null)) return false;
            jobs[key] = new(key, updateMain ? "update" : "check", DateTimeOffset.UtcNow);
            return true;
        }
    }

    public bool Start(string key)
    {
        lock (gate) {
            if (!jobs.TryGetValue(key, out var job) || job.StartedAt.HasValue || job.FinishedAt.HasValue
                || jobs.Values.Any(j => j.StartedAt.HasValue && !j.FinishedAt.HasValue)) return false;
            jobs[key] = job with { StartedAt = DateTimeOffset.UtcNow };
            return true;
        }
    }

    private static string FetchOutcome(string? output)
    {
        if (output is null) return "unconfirmed";
        try {
            using var value = JsonDocument.Parse(output);
            if (value.RootElement.ValueKind == JsonValueKind.Object && value.RootElement.TryGetProperty("fetched", out var fetched))
                return fetched.ValueKind == JsonValueKind.True ? "checked" : fetched.ValueKind == JsonValueKind.False ? "failed" : "unconfirmed";
        } catch (JsonException) { }
        return "unconfirmed";
    }

    public void Complete(string key, string? output = null)
    {
        lock (gate) {
            if (!busy.TryGetValue(key, out var completed) || completed.HasValue) return;
            busy[key] = ++generation;
            jobs[key] = lastCompleted = jobs[key] with { FinishedAt = DateTimeOffset.UtcNow, Outcome = FetchOutcome(output) };
        }
        wake.Writer.TryWrite(true);
    }

    public IReadOnlyDictionary<string, long> CaptureCompleted()
    {
        lock (gate) return busy.Where(p => p.Value.HasValue).ToDictionary(p => p.Key, p => p.Value.GetValueOrDefault());
    }

    public IReadOnlyDictionary<string, long> BeginScan()
    {
        lock (gate) {
            scanStartedAt = DateTimeOffset.UtcNow;
            return busy.Where(p => p.Value.HasValue).ToDictionary(p => p.Key, p => p.Value.GetValueOrDefault());
        }
    }

    public void EndScan()
    {
        lock (gate) scanStartedAt = null;
    }

    public void Published(IReadOnlyDictionary<string, long> started)
    {
        lock (gate) foreach (var (key, observed) in started)
            if (busy.TryGetValue(key, out var completed) && completed == observed) {
                busy.Remove(key);
                jobs.Remove(key);
            }
    }

    public async Task WaitForScan(TimeSpan interval, CancellationToken stop)
    {
        stop.ThrowIfCancellationRequested();
        using var cadence = CancellationTokenSource.CreateLinkedTokenSource(stop);
        cadence.CancelAfter(interval);
        try { await wake.Reader.ReadAsync(cadence.Token); }
        catch (OperationCanceledException) when (!stop.IsCancellationRequested) { }
    }
}

public sealed class RepositoryReader
{
    private RepositorySnapshot? latest;
    private readonly object gate = new();
    private readonly RepositoryRefreshSchedule refresh = new();
    private sealed record FetchRequest(string Key, bool UpdateMain);
    private readonly Channel<FetchRequest> requests = Channel.CreateUnbounded<FetchRequest>(new UnboundedChannelOptions { SingleReader = true });
    private readonly SemaphoreSlim scans = new(1, 1);
    private readonly JsonSerializerOptions json = new(JsonSerializerDefaults.Web);
    private readonly string saved = Path.Combine(UserSettings.DataDirectory, "repositories-snapshot.json");
    private readonly string filesSaved = Path.Combine(UserSettings.DataDirectory, "repository-local-files.json");
    private Dictionary<string, RepositoryFileInventory> inventories = [];
    private bool filesPaused;
    private readonly bool isolated = !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("WEBTOOLS_COMPANION_DATA"));
    public RepositorySnapshot? Latest {
        get {
            lock (gate) {
                if (latest is not { } value) return null;
                var progress = refresh.Observe();
                return value with {
                    Refreshing = progress.BusyKeys.ToList(),
                    Sync = progress.Sync,
                    Repositories = value.Repositories.Select(r => r with {
                        Checkouts = r.Checkouts.Select(c => c with {
                            LocalFiles = inventories.TryGetValue(c.Key, out var files)
                                ? filesPaused ? files with { Notice = "Local file readings paused. Showing the last inventory." } : files
                                : null
                        }).ToList()
                    }).ToList()
                };
            }
        }
    }

    public int RequestFetch(string key, bool updateMain = false)
    {
        lock (gate) {
            if (latest is null) return 503;
            var groups = latest.Repositories.Where(r => r.Url is not null && (key == "all" || r.Key == key)).ToList();
            if (groups.Count == 0) return 404;
            var added = false;
            foreach (var group in groups) if (refresh.TryQueue(group.Key, updateMain)) { requests.Writer.TryWrite(new(group.Key, updateMain)); added = true; }
            return added ? 202 : 409;
        }
    }

    private async Task<string?> RunScript(string? key, CancellationToken stop, bool files = false, bool publish = false, bool updateMain = false)
    {
        stop.ThrowIfCancellationRequested();
        var start = new ProcessStartInfo("python") { UseShellExecute = false, CreateNoWindow = true,
            RedirectStandardOutput = true, RedirectStandardError = true };
        foreach (var arg in new[] { "-u", Path.Combine(AppContext.BaseDirectory, "worker", "repositories.py"),
            "--root", UserSettings.Load().RepositoriesRoot, "--state", UserSettings.DataDirectory }) start.ArgumentList.Add(arg);
        if (files) start.ArgumentList.Add("--local-files");
        if (publish) start.ArgumentList.Add("--publish-lenovo-files");
        if (key is not null) {
            start.ArgumentList.Add("--fetch"); start.ArgumentList.Add(key);
            if (updateMain) start.ArgumentList.Add("--update-main");
            List<string> folders;
            lock (gate) folders = latest?.Repositories.FirstOrDefault(r => r.Key == key)?.Checkouts.Select(c => c.Name).ToList() ?? [];
            if (folders.Count == 0) return null;
            foreach (var folder in folders) { start.ArgumentList.Add("--checkout"); start.ArgumentList.Add(folder); }
        }
        start.Environment["PYTHONIOENCODING"] = "utf-8";
        stop.ThrowIfCancellationRequested();
        using var process = Process.Start(start);
        if (process is null) return null;
        using var budget = CancellationTokenSource.CreateLinkedTokenSource(stop);
        // Cold observations read several Git facts per checkout. Later passes
        // reuse worker caches; the cold pass still has a finite allowance.
        budget.CancelAfter(TimeSpan.FromSeconds(publish ? 1800 : files ? 180 : key is null ? 300 : 240));
        using var cancel = budget.Token.Register(() => { try { if (!process.HasExited) process.Kill(entireProcessTree: true); } catch (InvalidOperationException) { } });
        // Ignore diagnostics; raw Git errors can contain credential-helper or path details.
        process.BeginErrorReadLine();
        var output = process.StandardOutput.ReadToEndAsync(budget.Token);
        await process.WaitForExitAsync(budget.Token);
        var value = await output;
        return process.ExitCode == 0 && value.Length < (files ? 4_194_304 : 2_097_152) ? value : null;
    }

    private async Task<DateTimeOffset> PublishInventory(CancellationToken stop)
    {
        try { await RunScript(null, stop, publish: true); }
        catch (Exception e) when (e is IOException or JsonException or System.ComponentModel.Win32Exception or OperationCanceledException) { }
        return DateTimeOffset.UtcNow;
    }

    private async Task FilesLoop(CancellationToken stop)
    {
        var nextPublication = DateTimeOffset.MinValue;
        do {
            // Both modes walk the estate. Finish the local reading before a
            // publisher starts, and never overlap successive publisher walks.
            try {
                var output = await RunScript(null, stop, files: true);
                var value = output is null ? null : JsonSerializer.Deserialize<RepositoryLocalFiles>(output, json);
                if (value is not { SchemaVersion: 1 } || value.Checkouts.Count > 256) throw new IOException();
                lock (gate) {
                    foreach (var item in value.Checkouts) {
                        if (item.State != "ready" && inventories.TryGetValue(item.Key, out var old))
                            inventories[item.Key] = old with { Notice = "Local file scan unavailable. Showing the last inventory." };
                        else inventories[item.Key] = item;
                    }
                    inventories = inventories.Where(p => value.Checkouts.Any(c => c.Key == p.Key)).ToDictionary(p => p.Key, p => p.Value);
                    filesPaused = false;
                    value = value with { Checkouts = inventories.Values.ToList() };
                }
                Directory.CreateDirectory(UserSettings.DataDirectory);
                await File.WriteAllTextAsync(filesSaved + ".tmp", JsonSerializer.Serialize(value, json), stop);
                File.Move(filesSaved + ".tmp", filesSaved, true);
            } catch (Exception e) when (e is IOException or JsonException or System.ComponentModel.Win32Exception or OperationCanceledException) {
                lock (gate) filesPaused = true;
            }
            stop.ThrowIfCancellationRequested();
            if (DateTimeOffset.UtcNow >= nextPublication)
                nextPublication = (await PublishInventory(stop)).AddMinutes(15);
            await Task.Delay(TimeSpan.FromMinutes(1), stop);
        } while (!stop.IsCancellationRequested);
    }

    private async Task<bool> Scan(CancellationToken stop)
    {
        if (!await scans.WaitAsync(0, stop)) return false;
        // A completion that arrives during this read must remain busy until a
        // later observation starts after it and successfully publishes.
        var started = refresh.BeginScan();
        try {
            var output = await RunScript(null, stop);
            var value = output is null ? null : JsonSerializer.Deserialize<RepositorySnapshot>(output, json);
            if (value is not { SchemaVersion: 1 } || value.Repositories.Count > 256) throw new IOException();
            value = value with { Sync = null };
            Directory.CreateDirectory(UserSettings.DataDirectory);
            await File.WriteAllTextAsync(saved + ".tmp", JsonSerializer.Serialize(value, json), stop);
            File.Move(saved + ".tmp", saved, true);
            lock (gate) {
                latest = value;
                refresh.Published(started);
            }
            return true;
        } catch (Exception e) when (e is IOException or JsonException or System.ComponentModel.Win32Exception or OperationCanceledException) {
            lock (gate) if (latest is { } value) latest = value with { Notice = "Repository readings paused. Showing the last observation." };
            return false;
        } finally { refresh.EndScan(); scans.Release(); }
    }

    private async Task FetchLoop(CancellationToken stop)
    {
        await foreach (var request in requests.Reader.ReadAllAsync(stop)) {
            stop.ThrowIfCancellationRequested();
            if (!refresh.Start(request.Key)) continue;
            string? output = null;
            try {
                output = await RunScript(request.Key, stop, updateMain: request.UpdateMain);
            }
            catch (Exception e) when (e is IOException or System.ComponentModel.Win32Exception or OperationCanceledException) { }
            finally { refresh.Complete(request.Key, output); }
        }
    }

    public async Task Run(CancellationToken stop)
    {
        if (isolated) {
            lock (gate) latest = new(1, Environment.MachineName, DateTimeOffset.UtcNow, [], [], "No repository collection in an isolated API fixture.");
            return;
        }
        stop.ThrowIfCancellationRequested();
        try {
            var prior = JsonSerializer.Deserialize<RepositorySnapshot>(await File.ReadAllTextAsync(saved, stop), json);
            if (prior?.MachineName == Environment.MachineName) lock (gate) latest = prior with { Refreshing = [], Sync = null };
        } catch (Exception e) when (e is IOException or JsonException) { }
        try {
            var prior = JsonSerializer.Deserialize<RepositoryLocalFiles>(await File.ReadAllTextAsync(filesSaved, stop), json);
            if (prior is { SchemaVersion: 1, Checkouts: not null } && prior.MachineName == Environment.MachineName)
                lock (gate) inventories = prior.Checkouts.ToDictionary(c => c.Key);
        } catch (Exception e) when (e is IOException or JsonException or ArgumentException) { }
        var fetching = FetchLoop(stop);
        Task fileSampling = Task.CompletedTask;
        var observed = false;
        var nextFetch = DateTimeOffset.MinValue;
        try {
            do {
                var published = await Scan(stop);
                stop.ThrowIfCancellationRequested();
                if (published && !observed) {
                    observed = true;
                    // The first live repository result has already been made
                    // visible before either metadata walk can compete with it.
                    fileSampling = FilesLoop(stop);
                }
                if (observed && DateTimeOffset.UtcNow >= nextFetch) {
                    RequestFetch("all", updateMain: true);
                    nextFetch = DateTimeOffset.UtcNow.AddMinutes(5);
                }
                await refresh.WaitForScan(TimeSpan.FromSeconds(10), stop);
            } while (!stop.IsCancellationRequested);
        } catch (OperationCanceledException) when (stop.IsCancellationRequested) { }
        try { await fetching; } catch (OperationCanceledException) when (stop.IsCancellationRequested) { }
        try { await fileSampling; } catch (OperationCanceledException) when (stop.IsCancellationRequested) { }
    }
}
