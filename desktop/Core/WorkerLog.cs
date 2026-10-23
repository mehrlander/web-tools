using System.Globalization;
using System.Text.RegularExpressions;

namespace WebTools.Desktop;

public static class WorkerLog
{
    // Only known events become product copy. Raw commands, paths and errors stay local.
    public static WorkerActivity? Parse(string tail)
    {
        WorkerActivity? latest = null;
        foreach (var line in tail.Split('\n')) {
            if (line.Length < 21 || !DateTimeOffset.TryParseExact(line[..19], "yyyy-MM-dd HH:mm:ss",
                CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out var at)) continue;
            if (at.Year < 2000 || at > DateTimeOffset.UtcNow.AddMinutes(1)) continue;
            var message = line[20..].Trim();
            WorkerActivity? activity = null;
            var batch = Regex.Match(message, @"^\[\+\] \d+ stale .*?, (\d+) settled and picked:");
            var published = Regex.Match(message, @"^\[\+\] Pushed [a-f0-9]+: (\d+) companion\(s\)");
            var errand = Regex.Match(message, @"^\[[+*\-]\] Errand ([a-zA-Z0-9.-]+)(?::| )");
            var scheduled = Regex.Match(message, @"^\[.*?\] Scheduled ([a-z0-9-]+):");
            if (batch.Success) activity = new("topics", "Summarising " + batch.Groups[1].Value + " sessions", at);
            else if (published.Success) activity = new("published", "Published " + published.Groups[1].Value + " session summaries", at);
            else if (message.Contains("Update sessions cache", StringComparison.Ordinal) && message.StartsWith("[+] Pushed"))
                activity = new("published", "Updated the session list", at);
            else if (errand.Success && Activity.ValidId(errand.Groups[1].Value)) {
                var headline = message.Contains("claimed by", StringComparison.Ordinal) ? "Accepted an errand"
                    : message.Contains("settled", StringComparison.Ordinal) ? "An errand reply settled"
                    : message.Contains("later reply added", StringComparison.Ordinal) ? "Added an errand reply"
                    : message.Contains("closed:", StringComparison.Ordinal) ? "Returned an errand result" : "Updated an errand";
                activity = new("errand", headline, at, errand.Groups[1].Value);
            } else if (message == "[*] Nothing to do.") activity = new("idle", "Waiting for work", at);
            else if (message.StartsWith("[-]")) activity = new("error", "Worker reported a problem", at);
            else if (scheduled.Success) activity = new("scheduled", "Background job: " + scheduled.Groups[1].Value.Replace('-', ' '), at);
            if (activity is not null) latest = activity;
        }
        return latest;
    }

    public static WorkerActivity? Read(string path)
    {
        try {
            using var file = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
            if (file.Length > 65536) file.Seek(-65536, SeekOrigin.End);
            using var text = new StreamReader(file);
            return Parse(text.ReadToEnd());
        } catch (Exception e) when (e is IOException or UnauthorizedAccessException) { return null; }
    }
}
