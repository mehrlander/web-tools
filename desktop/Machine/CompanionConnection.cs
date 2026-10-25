using System.Diagnostics;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text.Json;

namespace WebTools.Desktop;

public sealed class CompanionAccess
{
    public const int Port = 47831;
    public const string Address = "http://127.0.0.1:47831";
    public string LocalToken { get; set; } = "";
    public string TailscaleLogin { get; set; } = "";
    public string PhoneUrl { get; set; } = "";
    public static string FilePath => Path.Combine(UserSettings.DataDirectory, "companion-access.json");

    public static CompanionAccess Load()
    {
        try { return JsonSerializer.Deserialize<CompanionAccess>(File.ReadAllText(FilePath)) ?? new(); }
        catch { return new(); }
    }

    public static CompanionAccess Ensure()
    {
        using var gate = new Mutex(false, "Local\\WebTools.Companion.Access");
        if (!gate.WaitOne(TimeSpan.FromSeconds(5))) throw new IOException("Companion access settings are busy.");
        try {
            var access = Load();
            if (access.LocalToken.Length < 32) {
                access.LocalToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
                Directory.CreateDirectory(UserSettings.DataDirectory);
                var temporary = FilePath + ".tmp";
                File.WriteAllText(temporary, JsonSerializer.Serialize(access));
                File.Move(temporary, FilePath, true);
            }
            return access;
        } finally { gate.ReleaseMutex(); }
    }

    public bool AcceptsLocal(string? authorization)
    {
        var expected = "Bearer " + LocalToken;
        return LocalToken.Length >= 32 && authorization is not null
            && CryptographicOperations.FixedTimeEquals(System.Text.Encoding.UTF8.GetBytes(expected),
                System.Text.Encoding.UTF8.GetBytes(authorization));
    }

    public static HttpClient Client()
    {
        var client = new HttpClient { BaseAddress = new Uri(Address), Timeout = TimeSpan.FromSeconds(3) };
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", Ensure().LocalToken);
        return client;
    }

    public static void Start()
    {
        var executable = Path.Combine(AppContext.BaseDirectory, "companion", "WebTools.Companion.exe");
        if (!File.Exists(executable)) executable = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory,
            "..", "..", "..", "..", "Companion", "bin", "Release", "net8.0-windows", "WebTools.Companion.exe"));
        if (!File.Exists(executable)) throw new FileNotFoundException("Build or install the Web Tools companion first.", executable);
        Process.Start(new ProcessStartInfo(executable) { UseShellExecute = false, CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden });
    }
}
