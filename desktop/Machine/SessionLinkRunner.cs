using System.Management;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace WebTools.Desktop;

// Resolve existing remote routing without enabling access or starting a provider.
public sealed class SessionLinkRunner
{
    private string? geminiInstance;
    public string? GeminiInstance => Volatile.Read(ref geminiInstance);

    public async Task Run(CancellationToken stop)
    {
        if (!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("WEBTOOLS_COMPANION_DATA"))) return;
        using var http = new HttpClient(new HttpClientHandler { AllowAutoRedirect = false, UseProxy = false }) {
            Timeout = TimeSpan.FromSeconds(2), MaxResponseContentBufferSize = 16384
        };
        while (!stop.IsCancellationRequested) {
            string? instance = null;
            try {
                var executable = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "Programs", "antigravity", "resources", "bin", "language_server.exe");
                using var query = new ManagementObjectSearcher("SELECT ProcessId,ExecutablePath,CommandLine FROM Win32_Process WHERE Name='language_server.exe'");
                using var rows = query.Get();
                foreach (ManagementObject row in rows) {
                    using (row) {
                        if (!string.Equals(row["ExecutablePath"] as string, executable, StringComparison.OrdinalIgnoreCase)) continue;
                        var command = row["CommandLine"] as string ?? "";
                        var token = Flag(command,"csrf_token");
                        if (token.Length is < 1 or > 1024 || token.Any(char.IsControl)) continue;
                        var pid = Convert.ToUInt32(row["ProcessId"]);
                        foreach (var port in Ports(pid).Take(4)) {
                            try {
                                using var request = new HttpRequestMessage(HttpMethod.Post,
                                    $"http://127.0.0.1:{port}/exa.language_server_pb.LanguageServerService/GetRemoteControlInfo");
                                request.Content = new StringContent("{}",Encoding.UTF8,"application/json");
                                request.Headers.Add("Connect-Protocol-Version","1");
                                request.Headers.Add("X-Codeium-Csrf-Token",token);
                                using var response = await http.SendAsync(request,stop);
                                if (!response.IsSuccessStatusCode) continue;
                                using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(stop));
                                var root = doc.RootElement;
                                if (Activity.Child(root,"enabled").ValueKind != JsonValueKind.True) continue;
                                var id = Activity.Text(root,"instanceId");
                                if (SessionLinks.For("Gemini","00000000-0000-0000-0000-000000000001",geminiInstance:id) is not null) {
                                    instance = id; break;
                                }
                            } catch (Exception e) when (e is HttpRequestException or OperationCanceledException or JsonException or InvalidOperationException) { }
                        }
                        if (instance is not null) break;
                    }
                }
            } catch (Exception e) when (e is ManagementException or UnauthorizedAccessException or System.Runtime.InteropServices.COMException) { }
            Volatile.Write(ref geminiInstance,instance);
            try { await Task.Delay(TimeSpan.FromSeconds(30),stop); } catch (OperationCanceledException) { return; }
        }
    }

    private static string Flag(string command, string name)
    {
        var match = Regex.Match(command,"--" + name + "(?:=|\\s+)(?:\"([^\"]+)\"|(\\S+))");
        return match.Groups[1].Success ? match.Groups[1].Value : match.Groups[2].Value;
    }

    private static List<int> Ports(uint pid)
    {
        using var query = new ManagementObjectSearcher(@"root\StandardCimv2",
            $"SELECT LocalPort FROM MSFT_NetTCPConnection WHERE OwningProcess={pid} AND State=2 AND LocalAddress='127.0.0.1'");
        using var rows = query.Get();
        var ports = new List<int>();
        foreach (ManagementObject row in rows) using (row) {
            var port = Convert.ToInt32(row["LocalPort"]);
            if (port is > 0 and <= 65535) ports.Add(port);
        }
        return ports.Distinct().ToList();
    }
}
