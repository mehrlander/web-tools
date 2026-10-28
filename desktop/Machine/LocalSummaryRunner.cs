using System.Diagnostics;

namespace WebTools.Desktop;

public static class LocalSummaryRunner
{
    public static async Task Run(CancellationToken stop)
    {
        // API fixtures and standalone collectors do not start model work.
        if (!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("WEBTOOLS_COMPANION_DATA"))) return;
        var script = Path.Combine(AppContext.BaseDirectory, "worker", "work_summaries.py");
        if (!File.Exists(script)) return;
        while (!stop.IsCancellationRequested) {
            try {
                var start = new ProcessStartInfo("python") {
                    UseShellExecute = false, CreateNoWindow = true,
                    RedirectStandardOutput = true, RedirectStandardError = true
                };
                foreach (var arg in new[] { "-u", script, "--profile", Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
                    "--state", Path.Combine(UserSettings.DataDirectory, "work"), "--repo", Path.Combine(UserSettings.Load().RepositoriesRoot, "web-tools-private") })
                    start.ArgumentList.Add(arg);
                using var process = Process.Start(start);
                if (process is null) return;
                using var budget = CancellationTokenSource.CreateLinkedTokenSource(stop);
                budget.CancelAfter(TimeSpan.FromMinutes(4));
                using var cancel = budget.Token.Register(() => { try { if (!process.HasExited) process.Kill(); } catch (InvalidOperationException) { } });
                process.OutputDataReceived += (_, _) => { };
                process.ErrorDataReceived += (_, _) => { };
                process.BeginOutputReadLine();
                process.BeginErrorReadLine();
                await process.WaitForExitAsync(budget.Token);
            } catch (Exception ex) when (ex is IOException or System.ComponentModel.Win32Exception or OperationCanceledException) { }
            try { await Task.Delay(TimeSpan.FromSeconds(30), stop); } catch (OperationCanceledException) { return; }
        }
    }
}
