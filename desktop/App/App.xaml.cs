using System.Windows;
using System.Diagnostics;
using System.Runtime.InteropServices;

namespace WebTools.Desktop;

public partial class App : Application
{
    private Mutex? instance;
    [DllImport("user32.dll")] private static extern bool SetForegroundWindow(IntPtr window);
    [DllImport("user32.dll")] private static extern bool ShowWindow(IntPtr window, int command);

    protected override void OnStartup(StartupEventArgs e)
    {
        instance = new Mutex(true, "Local\\WebTools.Desktop", out var first);
        if (!first) {
            foreach (var other in Process.GetProcessesByName("WebTools.Desktop")) {
                using (other) {
                    if (other.Id == Environment.ProcessId || other.MainWindowHandle == IntPtr.Zero) continue;
                    ShowWindow(other.MainWindowHandle, 9);
                    SetForegroundWindow(other.MainWindowHandle);
                    break;
                }
            }
            Shutdown();
            return;
        }
        base.OnStartup(e);
    }

    protected override void OnExit(ExitEventArgs e) { instance?.Dispose(); base.OnExit(e); }
}
