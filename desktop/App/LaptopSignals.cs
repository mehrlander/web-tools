using System.Diagnostics;
using System.IO;
using System.Management;

namespace WebTools.Desktop;

public static class LaptopSignals
{
    public static string Outbox(string id) => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "session-topics", "errand-output", id);

    public static List<ApplicationSignal> Applications()
    {
        var specs = new[] {
            ("Codex", new[] { "codex", "ChatGPT.Codex" }),
            ("Gemini / Antigravity", new[] { "Antigravity" }),
            ("Claude", new[] { "Claude" }),
            ("Stereo Bridge", new[] { "StereoBridge" }),
            ("Ollama", new[] { "ollama" })
        };
        return specs.Select(spec => {
            var count = 0;
            foreach (var name in spec.Item2) {
                var processes = Process.GetProcessesByName(name);
                count += processes.Length;
                foreach (var p in processes) p.Dispose();
            }
            return new ApplicationSignal(spec.Item1, count > 0 ? "open" : "absent",
                count > 0 ? "Application detected. Individual task progress is not reported." : "No matching application process was detected.", count);
        }).ToList();
    }

    public static DaemonSignal Daemon(string registry)
    {
        DateTimeOffset? lastLog = null;
        var log = Path.Combine(registry, "poller.log");
        if (File.Exists(log)) lastLog = new DateTimeOffset(File.GetLastWriteTimeUtc(log));
        var activity = WorkerLog.Read(log);
        try {
            using var query = new ManagementObjectSearcher("SELECT CommandLine FROM Win32_Process WHERE Name='pythonw.exe' OR Name='python.exe'");
            using var rows = query.Get();
            foreach (ManagementObject row in rows) {
                using (row) {
                    var command = row["CommandLine"] as string ?? "";
                    if (command.Contains("poll_followup.py", StringComparison.OrdinalIgnoreCase)
                        && command.Contains("--daemon", StringComparison.Ordinal))
                        return new("detected", "Gemini worker process detected. Reported tasks are observations, not a heartbeat.", lastLog, activity);
                }
            }
            return new("absent", "The Gemini worker process was not detected. Queued errands may wait until the worker starts.", lastLog, activity);
        } catch {
            return new("unknown", "Worker process status could not be checked. The last report is shown when available.", lastLog, activity);
        }
    }

    public static Dictionary<string, string> PlacePaths(string root) => new() {
        ["repositories"] = root,
        ["downloads"] = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads"),
        ["outputs"] = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "session-topics", "errand-output"),
        ["activity"] = Path.Combine(root, "web-tools-private"),
        ["desktop-source"] = AppContext.BaseDirectory
    };

    public static List<Place> Places(string root)
    {
        var paths = PlacePaths(root);
        return new[] { ("repositories", "Repositories"), ("downloads", "Downloads"), ("outputs", "Errand outputs"), ("activity", "Activity records") }
            .Where(p => Directory.Exists(paths[p.Item1])).Select(p => new Place(p.Item1, p.Item2, paths[p.Item1])).ToList();
    }

    public static List<RecentFile> Downloads()
    {
        try {
            var path = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads");
            return new DirectoryInfo(path).EnumerateFiles().OrderByDescending(f => f.LastWriteTimeUtc).Take(6)
                .Select((f, i) => new RecentFile(i.ToString(), f.Name, new DateTimeOffset(f.LastWriteTimeUtc), f.Length)).ToList();
        } catch { return []; }
    }
}
