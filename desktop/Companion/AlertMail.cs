using System.Net;
using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace WebTools.Desktop;

public sealed record AlertMailSettings(string From, string To, string Password);

// Local alert mail settings. The sender and recipient are plain; the Gmail app
// password is encrypted with DPAPI for the signed-in Windows user. Nothing here
// enters an API response, a log line or a tracked file.
public static class AlertMail
{
    private sealed class Stored
    {
        public string From { get; set; } = "";
        public string To { get; set; } = "";
        public string Protection { get; set; } = "dpapi-currentuser";
        public string Password { get; set; } = "";
    }

    private static readonly byte[] Entropy = Encoding.UTF8.GetBytes("WebTools.Companion.AlertMail.v1");
    public static string FilePath => Path.Combine(UserSettings.DataDirectory, "alert-mail.json");

    public static bool Valid(string? address) => !string.IsNullOrWhiteSpace(address)
        && MailAddress.TryCreate(address, out var parsed) && parsed.Address == address.Trim();

    public static AlertMailSettings? Load()
    {
        try {
            var stored = JsonSerializer.Deserialize<Stored>(File.ReadAllText(FilePath));
            if (stored is null || !Valid(stored.From) || !Valid(stored.To) || stored.Protection != "dpapi-currentuser") return null;
            var password = Encoding.UTF8.GetString(ProtectedData.Unprotect(Convert.FromBase64String(stored.Password),
                Entropy, DataProtectionScope.CurrentUser));
            return password.Length > 0 ? new(stored.From.Trim(), stored.To.Trim(), password) : null;
        } catch (Exception e) when (e is IOException or UnauthorizedAccessException or JsonException
            or FormatException or CryptographicException) { return null; }
    }

    public static void Save(string from, string to, string password)
    {
        var protectedPassword = ProtectedData.Protect(Encoding.UTF8.GetBytes(password), Entropy, DataProtectionScope.CurrentUser);
        var stored = new Stored { From = from.Trim(), To = to.Trim(), Password = Convert.ToBase64String(protectedPassword) };
        Directory.CreateDirectory(UserSettings.DataDirectory);
        var temporary = FilePath + ".tmp";
        File.WriteAllText(temporary, JsonSerializer.Serialize(stored, new JsonSerializerOptions { WriteIndented = true }));
        File.Move(temporary, FilePath, overwrite: true);
    }
}

// Gmail SMTP on port 587 with STARTTLS (EnableSsl upgrades the plain connection).
public sealed class GmailAlertSender : IAlertSender
{
    public bool Configured => File.Exists(AlertMail.FilePath);

    public async Task Send(AlertMessage message, CancellationToken stop)
    {
        var settings = AlertMail.Load() ?? throw new InvalidOperationException("Alert mail settings are missing or cannot be decrypted by this Windows user.");
        using var mail = new MailMessage(settings.From, settings.To, message.Subject, message.Body) {
            IsBodyHtml = false, BodyEncoding = Encoding.UTF8, SubjectEncoding = Encoding.UTF8
        };
        // UseDefaultCredentials must be set before Credentials, since setting it clears them.
        using var client = new SmtpClient("smtp.gmail.com", 587) {
            EnableSsl = true, DeliveryMethod = SmtpDeliveryMethod.Network, UseDefaultCredentials = false,
            Credentials = new NetworkCredential(settings.From, settings.Password), Timeout = 30000
        };
        // SmtpClient.Timeout does not bound an asynchronous send, so a linked token does.
        using var bounded = CancellationTokenSource.CreateLinkedTokenSource(stop);
        bounded.CancelAfter(TimeSpan.FromSeconds(60));
        await client.SendMailAsync(mail, bounded.Token);
    }
}

// alerts.log beside the companion settings: one timestamped line per alert decision.
public static class AlertLog
{
    private static readonly object Gate = new();
    public static string FilePath => Path.Combine(UserSettings.DataDirectory, "alerts.log");

    public static void Write(string line)
    {
        lock (Gate) {
            try {
                Directory.CreateDirectory(UserSettings.DataDirectory);
                var info = new FileInfo(FilePath);
                if (info.Exists && info.Length > 256 * 1024) {
                    var kept = File.ReadAllLines(FilePath).TakeLast(500).ToArray();
                    File.WriteAllLines(FilePath, kept);
                }
                File.AppendAllText(FilePath, DateTimeOffset.Now.ToString("yyyy-MM-dd HH:mm:ss zzz") + " " + line + Environment.NewLine);
            } catch (Exception e) when (e is IOException or UnauthorizedAccessException) { }
        }
    }
}

// Configure and test modes. Both run before the single-instance check, so they
// work beside a running companion, and both exit without starting collection.
public static class AlertCommands
{
    private const string Usage = "Usage: WebTools.Companion --alert-mail-setup --from you@gmail.com --to you@example.com, with the Gmail app password piped on standard input; or WebTools.Companion --alert-mail-test.";

    public static async Task<int?> Run(string[] args)
    {
        if (args.Contains("--alert-mail-setup")) return Setup(args);
        if (args.Contains("--alert-mail-test")) return await Test();
        return null;
    }

    private static string? Value(string[] args, string name)
    {
        var at = Array.IndexOf(args, name);
        return at >= 0 && at + 1 < args.Length ? args[at + 1] : null;
    }

    private static int Setup(string[] args)
    {
        var from = Value(args, "--from");
        var to = Value(args, "--to");
        if (!AlertMail.Valid(from) || !AlertMail.Valid(to)) { Report("Alert mail setup needs valid --from and --to addresses. " + Usage); return 2; }
        // The password never arrives as an argument, where process listings and shell history would keep it.
        var line = Console.IsInputRedirected ? Console.In.ReadLine() : null;
        var password = new string((line ?? "").Where(c => !char.IsWhiteSpace(c)).ToArray());
        if (password.Length == 0) { Report("No app password arrived on standard input. " + Usage); return 2; }
        try { AlertMail.Save(from!, to!, password); }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException or CryptographicException or PlatformNotSupportedException) {
            Report("Alert mail settings could not be saved (" + e.GetType().Name + ").");
            return 1;
        }
        Report("Alert mail settings saved to alert-mail.json; the app password is encrypted for this Windows user. Run --alert-mail-test to send a test message.");
        return 0;
    }

    private static async Task<int> Test()
    {
        var sender = new GmailAlertSender();
        if (!sender.Configured) { Report("Alert mail is not configured. " + Usage); return 3; }
        var now = DateTimeOffset.UtcNow;
        try {
            await sender.Send(new AlertMessage("test", Alerts.TestSubject, Alerts.TestBody(Environment.MachineName, now), now), CancellationToken.None);
        } catch (Exception e) {
            var inner = e.InnerException is { } cause ? " " + cause.GetType().Name + ": " + cause.Message : "";
            var status = e is SmtpException smtp ? " (SMTP " + smtp.StatusCode + ")" : "";
            Report("The alert test message was not sent" + status + ": " + e.GetType().Name + ": " + e.Message + inner);
            return 1;
        }
        var paused = File.Exists(Path.Combine(UserSettings.DataDirectory, AlertMonitor.PauseFile))
            ? " Alerts are currently paused by " + AlertMonitor.PauseFile + "; the test ignores the pause." : "";
        Report("Sent \"" + Alerts.TestSubject + "\"." + paused);
        return 0;
    }

    // A WinExe has no console of its own: stdout reaches the caller only when redirected, so alerts.log also records it.
    private static void Report(string line)
    {
        Console.WriteLine(line);
        AlertLog.Write(line);
    }
}
