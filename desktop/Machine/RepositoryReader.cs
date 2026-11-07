using System.Diagnostics;
using System.Text.Json;
using System.Threading.Channels;

namespace WebTools.Desktop;

public sealed class RepositoryReader
{
    private RepositorySnapshot? latest;
    private readonly object gate = new();
    private readonly HashSet<string> refreshing = [];
    private readonly Channel<string> requests = Channel.CreateUnbounded<string>(new UnboundedChannelOptions { SingleReader = true });
    private readonly SemaphoreSlim scans = new(1, 1);
    private readonly JsonSerializerOptions json = new(JsonSerializerDefaults.Web);
    private readonly string saved = Path.Combine(UserSettings.DataDirectory, "repositories-snapshot.json");
    private readonly string filesSaved = Path.Combine(UserSettings.DataDirectory, "repository-local-files.json");
    private Dictionary<string, RepositoryFileInventory> inventories = [];
    private bool filesPaused;
    private readonly bool isolated = !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("WEBTOOLS_COMPANION_DATA"));
    public RepositorySnapshot? Latest {
        get {
            lock (gate) return latest is { } value ? value with {
                Refreshing = refreshing.ToList(),
                Repositories = value.Repositories.Select(r => r with {
                    Checkouts = r.Checkouts.Select(c => c with {
                        LocalFiles = inventories.TryGetValue(c.Key, out var files)
                            ? filesPaused ? files with { Notice = "Local file readings paused. Showing the last inventory." } : files
                            : null
                    }).ToList()
                }).ToList()
            } : null;
        }
    }

    public int RequestFetch(string key)
    {
        lock (gate) {
            if (latest is null) return 503;
            var groups = latest.Repositories.Where(r => r.Url is not null && (key == "all" || r.Key == key)).ToList();
            if (groups.Count == 0) return 404;
            var added = false;
            foreach (var group in groups) if (refreshing.Add(group.Key)) { requests.Writer.TryWrite(group.Key); added = true; }
            return added ? 202 : 409;
        }
    }

    private async Task<string?> RunScript(string? key, CancellationToken stop, bool files = false, bool publish = false)
    {
        var start = new ProcessStartInfo("python") { UseShellExecute = false, CreateNoWindow = true,
            RedirectStandardOutput = true, RedirectStandardError = true };
        foreach (var arg in new[] { "-u", Path.Combine(AppContext.BaseDirectory, "worker", "repositories.py"),
            "--root", UserSettings.Load().RepositoriesRoot, "--state", UserSettings.DataDirectory }) start.ArgumentList.Add(arg);
        if (files) start.ArgumentList.Add("--local-files");
        if (publish) start.ArgumentList.Add("--publish-laptop-files");
        if (key is not null) {
            start.ArgumentList.Add("--fetch"); start.ArgumentList.Add(key);
            List<string> folders;
            lock (gate) folders = latest?.Repositories.FirstOrDefault(r => r.Key == key)?.Checkouts.Select(c => c.Name).ToList() ?? [];
            if (folders.Count == 0) return null;
            foreach (var folder in folders) { start.ArgumentList.Add("--checkout"); start.ArgumentList.Add(folder); }
        }
        start.Environment["PYTHONIOENCODING"] = "utf-8";
        using var process = Process.Start(start);
        if (process is null) return null;
        using var budget = CancellationTokenSource.CreateLinkedTokenSource(stop);
        budget.CancelAfter(TimeSpan.FromSeconds(publish ? 600 : files ? 180 : key is null ? 90 : 240));
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
        try {
            var prior = JsonSerializer.Deserialize<RepositoryLocalFiles>(await File.ReadAllTextAsync(filesSaved, stop), json);
            if (prior is { SchemaVersion: 1 } && prior.MachineName == Environment.MachineName)
                lock (gate) inventories = prior.Checkouts.ToDictionary(c => c.Key);
        } catch (Exception e) when (e is IOException or JsonException) { }
        Task<DateTimeOffset>? publication = null;
        var nextPublication = DateTimeOffset.MinValue;
        try {
            do {
                if (publication?.IsCompleted == true) {
                    nextPublication = (await publication).AddMinutes(15);
                    publication = null;
                }
                if (publication is null && DateTimeOffset.UtcNow >= nextPublication)
                    publication = PublishInventory(stop);
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
                await Task.Delay(TimeSpan.FromMinutes(1), stop);
            } while (!stop.IsCancellationRequested);
        }
        finally { if (publication is not null) await publication; }
    }

    private async Task Scan(CancellationToken stop)
    {
        if (!await scans.WaitAsync(0, stop)) return;
        try {
            var output = await RunScript(null, stop);
            var value = output is null ? null : JsonSerializer.Deserialize<RepositorySnapshot>(output, json);
            if (value is not { SchemaVersion: 1 } || value.Repositories.Count > 256) throw new IOException();
            lock (gate) latest = value;
            Directory.CreateDirectory(UserSettings.DataDirectory);
            await File.WriteAllTextAsync(saved + ".tmp", JsonSerializer.Serialize(value, json), stop);
            File.Move(saved + ".tmp", saved, true);
        } catch (Exception e) when (e is IOException or JsonException or System.ComponentModel.Win32Exception or OperationCanceledException) {
            lock (gate) if (latest is { } value) latest = value with { Notice = "Repository readings paused. Showing the last observation." };
        } finally { scans.Release(); }
    }

    private async Task FetchLoop(CancellationToken stop)
    {
        await foreach (var key in requests.Reader.ReadAllAsync(stop)) {
            try { await RunScript(key, stop); }
            catch (Exception e) when (e is IOException or System.ComponentModel.Win32Exception or OperationCanceledException) { }
            finally { lock (gate) refreshing.Remove(key); }
            await Scan(stop);
        }
    }

    public async Task Run(CancellationToken stop)
    {
        if (isolated) {
            lock (gate) latest = new(1, Environment.MachineName, DateTimeOffset.UtcNow, [], [], "No repository collection in an isolated API fixture.");
            return;
        }
        try {
            var prior = JsonSerializer.Deserialize<RepositorySnapshot>(await File.ReadAllTextAsync(saved, stop), json);
            if (prior?.MachineName == Environment.MachineName) lock (gate) latest = prior with { Refreshing = [] };
        } catch (Exception e) when (e is IOException or JsonException) { }
        var fetching = FetchLoop(stop);
        var fileSampling = FilesLoop(stop);
        var nextFetch = DateTimeOffset.MinValue;
        try {
            using var timer = new PeriodicTimer(TimeSpan.FromSeconds(10));
            do {
                await Scan(stop);
                if (DateTimeOffset.UtcNow >= nextFetch) { RequestFetch("all"); nextFetch = DateTimeOffset.UtcNow.AddMinutes(5); }
            } while (await timer.WaitForNextTickAsync(stop));
        } catch (OperationCanceledException) when (stop.IsCancellationRequested) { }
        try { await fetching; } catch (OperationCanceledException) when (stop.IsCancellationRequested) { }
        try { await fileSampling; } catch (OperationCanceledException) when (stop.IsCancellationRequested) { }
    }
}
