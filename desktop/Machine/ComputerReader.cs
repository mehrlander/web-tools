using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace WebTools.Desktop;

// Read-only collection in this user's interactive session. No window activation,
// screenshots, process command lines, remote commands or elevation.
public sealed class ComputerReader
{
    private ComputerSnapshot? latest;
    private ulong previousIdle, previousKernel, previousUser;
    private readonly Dictionary<string, (string Name, string? Icon)> identities = new(StringComparer.OrdinalIgnoreCase);
    public ComputerSnapshot? Latest => Volatile.Read(ref latest);
    private readonly string saved = Path.Combine(UserSettings.DataDirectory, "computer-snapshot.json");

    public async Task Run(CancellationToken stop)
    {
        try {
            var prior = JsonSerializer.Deserialize<ComputerSnapshot>(await File.ReadAllTextAsync(saved, stop));
            if (prior is { SchemaVersion: 1 } && prior.MachineName == Environment.MachineName)
                Volatile.Write(ref latest, prior);
        } catch (Exception e) when (e is not OperationCanceledException) { }
        try {
            using var timer = new PeriodicTimer(TimeSpan.FromSeconds(5));
            do {
                try {
                    var value = Read();
                    Volatile.Write(ref latest, value);
                    Directory.CreateDirectory(UserSettings.DataDirectory);
                    await File.WriteAllTextAsync(saved + ".tmp", JsonSerializer.Serialize(value), stop);
                    File.Move(saved + ".tmp", saved, true);
                } catch (Exception e) when (e is not OperationCanceledException) {
                    if (Latest is { } previous) Volatile.Write(ref latest, previous with { Notice = "Computer readings paused. Showing the last observation." });
                }
            } while (await timer.WaitForNextTickAsync(stop));
        } catch (OperationCanceledException) when (stop.IsCancellationRequested) { }
    }

    public ComputerSnapshot Read()
    {
        var now = DateTimeOffset.UtcNow;
        // The companion's isolated API fixtures must not collect the user's
        // real window titles or query interactive Windows state.
        if (!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("WEBTOOLS_COMPANION_DATA")))
            return new(1, Environment.MachineName, now, null, "unknown", null, null, null, null, null, null, null, null, [], "No interactive window collection in an isolated fixture.");
        var (state, remote) = Session();
        var previous = Latest;
        List<ComputerApplication> apps = previous?.Applications ?? [];
        var windowsAt = previous?.WindowsObservedAt;
        string? notice = null;
        if (state != "unlocked") {
            notice = state == "locked" ? "Computer locked. Showing the last observed windows." : state == "disconnected" ? "Windows session disconnected. Showing the last observed windows." : "Windows session status unavailable. Showing the last observed windows.";
        } else {
            try { apps = Windows(); windowsAt = now; }
            catch { notice = "Window list unavailable. Showing the last observation."; }
        }
        double? cpu = null;
        if (GetSystemTimes(out var idle, out var kernel, out var user)) {
            var total = kernel + user;
            var oldTotal = previousKernel + previousUser;
            if (oldTotal > 0 && total > oldTotal && idle >= previousIdle)
                cpu = Math.Round(Math.Clamp(100d * (1 - (double)(idle - previousIdle) / (total - oldTotal)), 0, 100), 1);
            (previousIdle, previousKernel, previousUser) = (idle, kernel, user);
        }
        var memory = new MemoryStatus { Length = (uint)Marshal.SizeOf<MemoryStatus>() };
        var hasMemory = GlobalMemoryStatusEx(ref memory) && memory.TotalPhysical > 0;
        var hasPower = GetSystemPowerStatus(out var power);
        var battery = hasPower && power.BatteryFlag != 255 && (power.BatteryFlag & 128) == 0;
        return new(1, Environment.MachineName, now, windowsAt, state, remote, cpu,
            hasMemory ? Math.Round(100d * (memory.TotalPhysical - memory.AvailablePhysical) / memory.TotalPhysical, 1) : null,
            hasMemory ? Math.Round((memory.TotalPhysical - memory.AvailablePhysical) / 1073741824d, 1) : null,
            hasMemory ? Math.Round(memory.TotalPhysical / 1073741824d, 1) : null,
            battery && power.BatteryPercent <= 100 ? power.BatteryPercent : null,
            hasPower && power.AcLineStatus != 255 ? power.AcLineStatus == 1 : null,
            battery ? (power.BatteryFlag & 8) != 0 : null, apps, notice);
    }

    private List<ComputerApplication> Windows()
    {
        using var own = Process.GetCurrentProcess();
        var session = own.SessionId;
        var foreground = GetForegroundWindow();
        var rows = new Dictionary<string, ComputerApplication>();
        var count = 0;
        if (!EnumWindows((window, _) => {
            if (count >= 256 || !IsWindowVisible(window) || window == GetShellWindow()) return true;
            var style = GetWindowLongW(window, -20);
            var appWindow = (style & 0x40000) != 0;
            if (!appWindow && ((style & 0x08000080) != 0 || GetWindow(window, 4) != IntPtr.Zero)) return true;
            if (DwmGetWindowAttribute(window, 14, out var cloaked, sizeof(int)) == 0 && cloaked != 0) return true;
            var text = new StringBuilder(512);
            if (GetWindowTextW(window, text, text.Capacity) == 0) return true;
            GetWindowThreadProcessId(window, out var pid);
            try {
                using var process = Process.GetProcessById((int)pid);
                if (process.SessionId != session || process.ProcessName is "TextInputHost" or "ShellExperienceHost" or "SearchHost" or "StartMenuExperienceHost") return true;
                // A UWP frame may wrap a child process. Resolve the actual app
                // identity instead of showing Application Frame Host as an app.
                var actualPid = pid;
                if (process.ProcessName == "ApplicationFrameHost") EnumChildWindows(window, (child, _) => {
                    GetWindowThreadProcessId(child, out var childPid);
                    if (childPid != pid && childPid != 0) { actualPid = childPid; return false; }
                    return true;
                }, IntPtr.Zero);
                using var actual = Process.GetProcessById((int)actualPid);
                if (actual.SessionId != session) return true;
                string? path = null;
                try { path = actual.MainModule?.FileName; } catch { }
                var identity = path ?? actual.ProcessName;
                if (!identities.TryGetValue(identity, out var metadata)) {
                    var name = actual.ProcessName;
                    try { name = actual.MainModule?.FileVersionInfo.ProductName?.Trim() is { Length: > 0 } product ? product : name; } catch { }
                    name = actual.ProcessName.ToLowerInvariant() switch {
                        "explorer" => "File Explorer", "chrome" => "Chrome", "msedge" => "Edge",
                        "windowsterminal" => "Windows Terminal", "applicationframehost" => "Windows app", _ => name
                    };
                    string? icon = null;
                    try {
                        if (path is not null) {
                            using var native = Icon.ExtractAssociatedIcon(path);
                            using var bitmap = native?.ToBitmap();
                            if (bitmap is not null) {
                                using var small = new Bitmap(bitmap, new Size(24, 24));
                                using var stream = new MemoryStream();
                                small.Save(stream, ImageFormat.Png);
                                icon = "data:image/png;base64," + Convert.ToBase64String(stream.ToArray());
                            }
                        }
                    } catch { }
                    metadata = (name[..Math.Min(name.Length, 80)], icon);
                    if (identities.Count > 128) identities.Clear();
                    identities[identity] = metadata;
                }
                var key = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(identity.ToLowerInvariant())))[..16];
                if (!rows.TryGetValue(key, out var app)) rows[key] = app = new(key, metadata.Name, metadata.Icon, []);
                app.Windows.Add(new(window.ToInt64().ToString("X"), text.ToString().Trim(), IsIconic(window), foreground == window));
                count++;
            } catch { /* A process may close or deny metadata between calls. */ }
            return true;
        }, IntPtr.Zero)) throw new InvalidOperationException("Window enumeration unavailable.");
        return rows.Values.OrderBy(a => a.Name, StringComparer.OrdinalIgnoreCase).ToList();
    }

    private static (string State, bool? Remote) Session()
    {
        using var own = Process.GetCurrentProcess();
        var state = "unknown";
        bool? remote = null;
        // WTSINFOEX has DWORD Level, 4 bytes alignment, then LEVEL1's
        // SessionId, SessionState and SessionFlags. Never read user/domain data.
        if (WTSQuerySessionInformationW(IntPtr.Zero, own.SessionId, 25, out var info, out var size)) {
            try {
                if (size >= 20 && Marshal.ReadInt32(info) == 1) {
                    var connection = Marshal.ReadInt32(info, 12);
                    var flags = Marshal.ReadInt32(info, 16);
                    state = connection == 4 ? "disconnected" : flags == 0 ? "locked" : flags == 1 ? "unlocked" : "unknown";
                }
            } finally { WTSFreeMemory(info); }
        }
        if (WTSQuerySessionInformationW(IntPtr.Zero, own.SessionId, 16, out var protocol, out var bytes)) {
            try { if (bytes >= 2) remote = Marshal.ReadInt16(protocol) != 0; }
            finally { WTSFreeMemory(protocol); }
        }
        return (state, remote);
    }

    private delegate bool WindowCallback(IntPtr window, IntPtr parameter);
    [DllImport("user32.dll")] private static extern bool EnumWindows(WindowCallback callback, IntPtr parameter);
    [DllImport("user32.dll")] private static extern bool EnumChildWindows(IntPtr parent, WindowCallback callback, IntPtr parameter);
    [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr window);
    [DllImport("user32.dll")] private static extern bool IsIconic(IntPtr window);
    [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] private static extern IntPtr GetShellWindow();
    [DllImport("user32.dll")] private static extern IntPtr GetWindow(IntPtr window, uint command);
    [DllImport("user32.dll")] private static extern int GetWindowLongW(IntPtr window, int index);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetWindowTextW(IntPtr window, StringBuilder text, int count);
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr window, out uint process);
    [DllImport("dwmapi.dll")] private static extern int DwmGetWindowAttribute(IntPtr window, int attribute, out int value, int size);
    [DllImport("wtsapi32.dll", CharSet = CharSet.Unicode)] private static extern bool WTSQuerySessionInformationW(IntPtr server, int session, int field, out IntPtr buffer, out int bytes);
    [DllImport("wtsapi32.dll")] private static extern void WTSFreeMemory(IntPtr buffer);
    [DllImport("kernel32.dll")] private static extern bool GetSystemTimes(out ulong idle, out ulong kernel, out ulong user);
    [DllImport("kernel32.dll")] private static extern bool GlobalMemoryStatusEx(ref MemoryStatus status);
    [DllImport("kernel32.dll")] private static extern bool GetSystemPowerStatus(out PowerStatus status);
    [StructLayout(LayoutKind.Sequential)] private struct MemoryStatus {
        public uint Length, Load;
        public ulong TotalPhysical, AvailablePhysical, TotalPageFile, AvailablePageFile, TotalVirtual, AvailableVirtual, AvailableExtendedVirtual;
    }
    [StructLayout(LayoutKind.Sequential)] private struct PowerStatus {
        public byte AcLineStatus, BatteryFlag, BatteryPercent, SystemStatus;
        public uint BatteryLifeTime, BatteryFullLifeTime;
    }
}
