using System.Diagnostics;
using System.Text.Json;

namespace WebTools.Desktop;

public sealed class FolderReader
{
    private readonly SemaphoreSlim slots = new(2, 2);
    private readonly JsonSerializerOptions json = new(JsonSerializerDefaults.Web);
    private readonly Dictionary<string, (DateTimeOffset At, FolderSnapshot Value)> cache = [];

    public Task<(int Status, FolderSnapshot? Value)> Read(string path, CancellationToken stop) => Read("gh", path, stop);

    public async Task<(int Status, FolderSnapshot? Value)> Read(string rootId, string path, CancellationToken stop)
    {
        if (!FileRoots.TryGet(rootId, out var root) || !FileRoots.ValidPath(path)) return (400, null);
        var status = FileRoots.Resolve(root, path, file: false, out _);
        if (status != 200) return (status, null);
        var key = rootId + ":" + root.FullPath + ":" + path;
        lock (cache) if (cache.TryGetValue(key, out var prior) && DateTimeOffset.UtcNow - prior.At < TimeSpan.FromSeconds(8))
            return (200, prior.Value);
        if (!await slots.WaitAsync(0, stop)) return (429, null);
        try {
            var start = new ProcessStartInfo("python") { UseShellExecute = false, CreateNoWindow = true,
                RedirectStandardOutput = true, RedirectStandardError = true };
            foreach (var arg in new[] { "-u", Path.Combine(AppContext.BaseDirectory, "worker", "folder_explorer.py"),
                "--root", root.FullPath, "--path=" + path }) start.ArgumentList.Add(arg);
            start.Environment["PYTHONIOENCODING"] = "utf-8";
            using var process = Process.Start(start);
            if (process is null) return (503, null);
            using var budget = CancellationTokenSource.CreateLinkedTokenSource(stop);
            budget.CancelAfter(TimeSpan.FromSeconds(12));
            using var cancel = budget.Token.Register(() => { try { if (!process.HasExited) process.Kill(entireProcessTree: true); } catch (InvalidOperationException) { } });
            process.BeginErrorReadLine();
            var output = process.StandardOutput.ReadToEndAsync(budget.Token);
            await process.WaitForExitAsync(budget.Token);
            var text = await output;
            if (process.ExitCode != 0 || text.Length > 2_097_152) return (503, null);
            var value = JsonSerializer.Deserialize<FolderSnapshot>(text, json);
            if (value is not { SchemaVersion: 1 } || value.Path != path || value.Entries.Count > 2000) return (503, null);
            if (value.State != "ready") return (value.State switch { "invalid" => 400, "blocked" => 403, "missing" => 404, _ => 503 }, null);
            lock (cache) {
                if (cache.Count >= 24) cache.Remove(cache.MinBy(p => p.Value.At).Key);
                cache[key] = (DateTimeOffset.UtcNow, value);
            }
            return (200, value);
        } catch (Exception e) when (e is IOException or JsonException or System.ComponentModel.Win32Exception or OperationCanceledException) {
            return (503, null);
        } finally { slots.Release(); }
    }
}
