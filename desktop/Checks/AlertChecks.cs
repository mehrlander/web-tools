using WebTools.Desktop;

// The alert state machine and its monitor, with the clock, the daemon reading
// and the sender injected: no WMI, SMTP or real companion data folder.
static class AlertChecks
{
    private sealed class FakeSender : IAlertSender
    {
        public bool Configured { get; set; } = true;
        public bool Fail { get; set; }
        public List<AlertMessage> Sent { get; } = [];
        public Task Send(AlertMessage message, CancellationToken stop)
        {
            if (Fail) throw new IOException("Fixture SMTP failure.");
            Sent.Add(message);
            return Task.CompletedTask;
        }
    }

    private static Errand Gemini(string id, DateTimeOffset created, string state = "queued", string provider = "Gemini") =>
        new(id, "Fixture errand", "", state, created, created, null, null, null, false, false) { Provider = provider };

    public static async Task Run(Action<bool, string> check)
    {
        var start = DateTimeOffset.Parse("2026-11-21T08:00:00Z");
        var now = start;
        var folder = Path.Combine(Path.GetTempPath(), "alert-check-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(folder);
        var log = new List<string>();
        var sender = new FakeSender();
        AlertMonitor Monitor() => new(folder, sender, log.Add, () => now);
        AlertObservation At(string daemon, List<Errand>? errands = null, bool current = true, string? nowUrl = null) =>
            new(now, daemon, new WorkerActivity("idle", "Waiting for work", start.AddMinutes(-1)), errands ?? [], current, "FIXTURE-LAPTOP", nowUrl);
        // One observation a minute keeps each run inside the continuity gap.
        async Task Advance(AlertMonitor monitor, int minutes, string daemon, List<Errand>? errands = null, bool current = true, string? nowUrl = null) {
            for (var i = 0; i < minutes; i++) { now = now.AddMinutes(1); await monitor.Observe(At(daemon, errands, current, nowUrl)); }
        }
        try {
            var monitor = Monitor();
            await monitor.Observe(At("absent"));
            await Advance(monitor, 14, "absent");
            check(sender.Sent.Count == 0, "Fourteen minutes of absence sends no worker-down email.");
            await Advance(monitor, 1, "absent", nowUrl: NavigationPolicy.NowUrl("https://laptop.fixture.ts.net/"));
            check(sender.Sent.Count == 1 && sender.Sent[0].Subject == "[web-tools] Gemini worker down"
                && sender.Sent[0].Since == start && sender.Sent[0].Body.Contains("15 minutes")
                && sender.Sent[0].Body.Contains("Last worker report: Waiting for work")
                && sender.Sent[0].Body.Contains("Now view: https://laptop.fixture.ts.net/#view=now"),
                "Fifteen continuous minutes of absence sends one down email with its start, last report and Now link.");
            await Advance(monitor, 30, "absent");
            check(sender.Sent.Count == 1, "A persisting outage sends no repeat.");
            monitor = Monitor();
            await Advance(monitor, 2, "absent");
            check(sender.Sent.Count == 1 && monitor.State.DownSentAt is not null, "A companion restart reads the saved state and does not resend.");
            await Advance(monitor, 3, "unknown");
            check(sender.Sent.Count == 1, "An unknown reading neither ends the outage nor reports recovery.");
            await Advance(monitor, 1, "detected");
            check(sender.Sent.Count == 2 && sender.Sent[1].Subject == "[web-tools] Gemini worker back up" && sender.Sent[1].Since == start,
                "The first detection after a down email sends one back-up email naming when the outage began.");
            await Advance(monitor, 5, "detected");
            check(sender.Sent.Count == 2 && monitor.State is { DownSentAt: null, AbsentSince: null }, "A running worker sends nothing further.");

            sender.Sent.Clear();
            await Advance(monitor, 30, "unknown");
            check(sender.Sent.Count == 0 && monitor.State.AbsentSince is null, "Unknown readings never count as down.");
            await Advance(monitor, 10, "absent");
            now = now.AddMinutes(10);
            await monitor.Observe(At("absent"));
            await Advance(monitor, 10, "absent");
            check(sender.Sent.Count == 0, "An unobserved gap restarts the continuous absence count.");
            await Advance(monitor, 5, "absent");
            check(sender.Sent.Count == 1, "The restarted count still reaches the down email.");
            await Advance(monitor, 1, "detected");
            sender.Sent.Clear();

            File.WriteAllText(Path.Combine(folder, AlertMonitor.PauseFile), "");
            await Advance(monitor, 20, "absent");
            check(sender.Sent.Count == 0 && monitor.State.DownSentAt is null,
                "The pause file sends nothing and leaves the owed down email unrecorded.");
            File.Delete(Path.Combine(folder, AlertMonitor.PauseFile));
            await Advance(monitor, 1, "absent");
            check(sender.Sent.Count == 1 && sender.Sent[0].Subject == "[web-tools] Gemini worker down",
                "Removing the pause file delivers the owed email once.");
            await Advance(monitor, 1, "detected");
            sender.Sent.Clear();

            var created = now.AddMinutes(-10);
            var errands = new List<Errand> { Gemini("gemini-old", created), Gemini("codex-old", created.AddHours(-1), provider: "Codex"),
                Gemini("gemini-claimed", created.AddHours(-1), state: "claimed") };
            await Advance(monitor, 4, "detected", errands);
            check(sender.Sent.Count == 0, "An errand younger than fifteen minutes sends nothing.");
            await Advance(monitor, 1, "detected", errands);
            check(sender.Sent.Count == 1 && sender.Sent[0].Subject == "[web-tools] Gemini errand waiting"
                && sender.Sent[0].Body.Contains("gemini-old, waiting 15 minutes")
                && !sender.Sent[0].Body.Contains("codex-old") && !sender.Sent[0].Body.Contains("gemini-claimed")
                && !sender.Sent[0].Body.Contains("Now view"),
                "A Gemini errand unclaimed for fifteen minutes sends one email listing only unclaimed Gemini errands, without a Now link when none is known.");
            await Advance(monitor, 20, "detected", errands);
            check(sender.Sent.Count == 1, "A still-waiting errand sends no repeat.");
            await Advance(monitor, 5, "detected", errands, current: false);
            check(sender.Sent.Count == 1 && monitor.State.ErrandSentAt is not null, "Stale errand records neither resend nor clear the waiting alert.");
            await Advance(monitor, 1, "detected", [Gemini("gemini-old", created, state: "claimed")]);
            check(monitor.State.ErrandSentAt is null, "A claim ends the waiting condition.");
            await Advance(monitor, 1, "detected", [Gemini("gemini-next", now.AddMinutes(-20))]);
            check(sender.Sent.Count == 2 && sender.Sent[1].Body.Contains("gemini-next"), "A later waiting errand starts a new condition and one new email.");
            await Advance(monitor, 1, "detected");
            sender.Sent.Clear();

            sender.Fail = true;
            await Advance(monitor, 16, "absent");
            check(sender.Sent.Count == 0 && monitor.State.DownSentAt is null && log.Any(l => l.StartsWith("Could not send")),
                "A failed send is logged and stays owed.");
            sender.Fail = false;
            await Advance(monitor, 3, "absent");
            check(sender.Sent.Count == 0, "A failed send waits before retrying.");
            await Advance(monitor, 2, "absent");
            check(sender.Sent.Count == 1, "The owed email is retried after the wait.");
            await Advance(monitor, 1, "detected");
            sender.Sent.Clear();

            sender.Configured = false;
            log.Clear();
            var unconfigured = Monitor();
            await Advance(unconfigured, 20, "absent");
            check(sender.Sent.Count == 0 && log.Count(l => l.Contains("not configured")) == 1 && unconfigured.State.DownSentAt is null,
                "Without mail settings alerts are off, logged once, and nothing is recorded as sent.");
        } finally { Directory.Delete(folder, recursive: true); }
    }
}
