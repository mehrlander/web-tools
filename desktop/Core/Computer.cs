namespace WebTools.Desktop;

// An interactive Windows desktop, rather than a process inventory. Executable
// paths and command lines stay in the collector and never enter this projection.
public record ComputerWindow(string Key, string Title, bool Minimized, bool InFront);
public record ComputerApplication(string Key, string Name, string? Icon, List<ComputerWindow> Windows);
public record ComputerSnapshot(int SchemaVersion, string MachineName, DateTimeOffset ObservedAt,
    DateTimeOffset? WindowsObservedAt, string SessionState, bool? RemoteSession,
    double? CpuPercent, double? MemoryPercent, double? MemoryUsedGb, double? MemoryTotalGb,
    int? BatteryPercent, bool? PluggedIn, bool? Charging,
    List<ComputerApplication> Applications, string? Notice = null);
