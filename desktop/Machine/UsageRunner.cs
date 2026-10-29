using System.Diagnostics;

namespace WebTools.Desktop;

public sealed class UsageRunner
{
    private List<ProviderUsage> latest = [];
    public List<ProviderUsage> Latest => Volatile.Read(ref latest);

    public async Task Run(CancellationToken stop)
    {
        var script = Path.Combine(AppContext.BaseDirectory, "worker", "usage.py");
        var state = UserSettings.DataDirectory;
        Volatile.Write(ref latest, UsageReader.Read(Path.Combine(state, "usage.json")));
        // Isolated API fixtures never contact signed-in provider accounts.
        if (!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("WEBTOOLS_COMPANION_DATA")) || !File.Exists(script)) return;
        while (!stop.IsCancellationRequested) {
            try {
                var start = new ProcessStartInfo("python") { UseShellExecute = false, CreateNoWindow = true,
                    RedirectStandardOutput = true, RedirectStandardError = true };
                foreach (var arg in new[] { script, "--state", state, "--repo", Path.Combine(UserSettings.Load().RepositoriesRoot, "web-tools-private") })
                    start.ArgumentList.Add(arg);
                using var process = Process.Start(start);
                if (process is null) return;
                process.BeginOutputReadLine(); process.BeginErrorReadLine();
                using var budget = CancellationTokenSource.CreateLinkedTokenSource(stop);
                budget.CancelAfter(TimeSpan.FromSeconds(45));
                using var cancel = budget.Token.Register(() => { try { if (!process.HasExited) process.Kill(entireProcessTree: true); } catch (InvalidOperationException) { } });
                await process.WaitForExitAsync(budget.Token);
                Volatile.Write(ref latest, UsageReader.Read(Path.Combine(state, "usage.json")));
            } catch (Exception ex) when (ex is IOException or System.ComponentModel.Win32Exception or OperationCanceledException) { }
            try { await Task.Delay(TimeSpan.FromSeconds(60), stop); } catch (OperationCanceledException) { return; }
        }
    }
}
