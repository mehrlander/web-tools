using System.Diagnostics;

namespace WebTools.Desktop;

public static class UsageArchiveRunner
{
    public static async Task Run(CancellationToken stop)
    {
        // Isolated API fixtures never discover stores or inspect real checkouts.
        if (!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("WEBTOOLS_COMPANION_DATA"))) return;
        var script = Path.Combine(AppContext.BaseDirectory, "worker", "usage_archive.py");
        if (!File.Exists(script)) return;
        while (!stop.IsCancellationRequested) {
            try {
                var start = new ProcessStartInfo("python") {
                    UseShellExecute = false, CreateNoWindow = true,
                    RedirectStandardOutput = true, RedirectStandardError = true
                };
                foreach (var argument in new[] { "-u", script, "--once", "--state", UserSettings.DataDirectory,
                    "--session-repo", Path.Combine(UserSettings.Load().RepositoriesRoot, "web-tools-private") })
                    start.ArgumentList.Add(argument);
                using var process = Process.Start(start);
                if (process is null) return;
                process.BeginOutputReadLine(); process.BeginErrorReadLine();
                using var budget = CancellationTokenSource.CreateLinkedTokenSource(stop);
                budget.CancelAfter(TimeSpan.FromSeconds(45));
                using var cancel = budget.Token.Register(() => {
                    try { if (!process.HasExited) process.Kill(entireProcessTree: true); }
                    catch (InvalidOperationException) { }
                });
                await process.WaitForExitAsync(budget.Token);
            } catch (Exception ex) when (ex is IOException or System.ComponentModel.Win32Exception or OperationCanceledException) { }
            try { await Task.Delay(TimeSpan.FromSeconds(60), stop); }
            catch (OperationCanceledException) { return; }
        }
    }
}
