using System.Runtime.InteropServices;

namespace WebTools.Desktop;

internal static class KnownFolders
{
    internal static string? DownloadsPath()
    {
        if (!OperatingSystem.IsWindows()) return null;
        var initialized = CoInitializeEx(IntPtr.Zero, 0);
        var path = IntPtr.Zero;
        try {
            // A different existing COM apartment is already initialized too.
            if (initialized < 0 && initialized != unchecked((int)0x80010106)) return null;
            var downloads = new Guid("374DE290-123F-4565-9164-39C4925E467B");
            // Retrieve the current redirected location without creating or
            // probing the folder. FileRoots checks access when it is used.
            var result = SHGetKnownFolderPath(ref downloads, 0x4000, IntPtr.Zero, out path);
            return result >= 0 ? Marshal.PtrToStringUni(path) : null;
        } finally {
            Marshal.FreeCoTaskMem(path);
            if (initialized >= 0) CoUninitialize();
        }
    }

    [DllImport("ole32.dll", ExactSpelling = true)]
    private static extern int CoInitializeEx(IntPtr reserved, uint flags);
    [DllImport("ole32.dll", ExactSpelling = true)]
    private static extern void CoUninitialize();
    [DllImport("shell32.dll", ExactSpelling = true)]
    private static extern int SHGetKnownFolderPath(ref Guid folder, uint flags, IntPtr token, out IntPtr path);
}
