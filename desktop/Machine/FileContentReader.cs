using Microsoft.Win32.SafeHandles;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;

namespace WebTools.Desktop;

public sealed record FileContent(FileStream Stream, string ContentType, string? DownloadName);

public sealed class FileContentReader
{
    public const int TextLimit = 1024 * 1024;
    private static readonly HashSet<string> TextExtensions = new(StringComparer.OrdinalIgnoreCase) {
        ".txt", ".md", ".csv", ".json", ".log", ".yaml", ".yml"
    };

    public async Task<(int Status, FileContent? Value)> Open(string rootId, string path, bool download, CancellationToken stop)
    {
        if (!FileRoots.TryGet(rootId, out var root)) return (400, null);
        var status = FileRoots.Resolve(root, path, file: true, out var target);
        if (status != 200) return (status, null);
        FileStream? stream = null;
        try {
            stop.ThrowIfCancellationRequested();
            // Open the root itself without following a replacement junction.
            using var rootHandle = CreateFileW(root.FullPath, 0x80, 7, IntPtr.Zero, 3, 0x02200000, IntPtr.Zero);
            if (rootHandle.IsInvalid) throw new Win32Exception(Marshal.GetLastWin32Error());
            if (!Attributes(rootHandle, out var rootAttributes) || (rootAttributes & FileAttributes.ReparsePoint) != 0
                || (rootAttributes & FileAttributes.Directory) == 0) return (403, null);
            // Sharing permits atomic replacement of a source, while withholding
            // write sharing keeps this opened file's preview length stable.
            stream = new FileStream(target, FileMode.Open, FileAccess.Read, FileShare.Read | FileShare.Delete,
                65536, FileOptions.Asynchronous | FileOptions.SequentialScan);
            if (GetFileType(stream.SafeFileHandle) != 1 || !Attributes(stream.SafeFileHandle, out var attributes)
                || (attributes & (FileAttributes.Directory | FileAttributes.ReparsePoint | FileAttributes.Device)) != 0
                || !FileRoots.Contains(FinalPath(rootHandle), FinalPath(stream.SafeFileHandle))) return (403, null);
            // Check the named components again after opening. Bytes come only
            // from the verified handle, never from a second path-based open.
            status = FileRoots.Resolve(root, path, file: true, out _);
            if (status != 200) return (status, null);
            var type = "application/octet-stream";
            if (!download) {
                var prefix = new byte[12];
                var count = (int)Math.Min(prefix.Length, stream.Length);
                await stream.ReadExactlyAsync(prefix.AsMemory(0, count), stop);
                var extension = Path.GetExtension(path);
                type = ImageType(extension, prefix.AsSpan(0, count)) ?? type;
                if (type == "application/octet-stream" && TextExtensions.Contains(extension) && stream.Length <= TextLimit) {
                    stream.Position = 0;
                    var text = new byte[(int)stream.Length];
                    await stream.ReadExactlyAsync(text, stop);
                    try {
                        _ = new UTF8Encoding(false, true).GetCharCount(text);
                        if (!text.Contains((byte)0)) type = "text/plain; charset=utf-8";
                    } catch (DecoderFallbackException) { }
                }
                stream.Position = 0;
            }
            var value = new FileContent(stream, type, type == "application/octet-stream" ? Path.GetFileName(path) : null);
            stream = null;
            return (200, value);
        } catch (Exception e) when (e is FileNotFoundException or DirectoryNotFoundException) { return (404, null); }
        catch (UnauthorizedAccessException) { return (403, null); }
        catch (Win32Exception e) { return (e.NativeErrorCode is 2 or 3 ? 404 : e.NativeErrorCode is 5 or 32 or 33 ? 403 : 503, null); }
        catch (IOException) { return (503, null); }
        finally { if (stream is not null) await stream.DisposeAsync(); }
    }

    private static string? ImageType(string extension, ReadOnlySpan<byte> bytes)
    {
        if (extension.Equals(".png", StringComparison.OrdinalIgnoreCase) && bytes.StartsWith(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 })) return "image/png";
        if ((extension.Equals(".jpg", StringComparison.OrdinalIgnoreCase) || extension.Equals(".jpeg", StringComparison.OrdinalIgnoreCase))
            && bytes.StartsWith(new byte[] { 255, 216, 255 })) return "image/jpeg";
        if (extension.Equals(".gif", StringComparison.OrdinalIgnoreCase) && (bytes.StartsWith("GIF87a"u8) || bytes.StartsWith("GIF89a"u8))) return "image/gif";
        if (extension.Equals(".webp", StringComparison.OrdinalIgnoreCase) && bytes.Length >= 12
            && bytes[..4].SequenceEqual("RIFF"u8) && bytes.Slice(8, 4).SequenceEqual("WEBP"u8)) return "image/webp";
        return null;
    }

    private static bool Attributes(SafeFileHandle handle, out FileAttributes attributes)
    {
        var ok = GetFileInformationByHandleEx(handle, 9, out var info, 8);
        attributes = (FileAttributes)info.Attributes;
        return ok;
    }

    private static string FinalPath(SafeFileHandle handle)
    {
        var buffer = new StringBuilder(1024);
        var count = GetFinalPathNameByHandleW(handle, buffer, (uint)buffer.Capacity, 0);
        if (count >= buffer.Capacity) {
            buffer = new StringBuilder(checked((int)count + 1));
            count = GetFinalPathNameByHandleW(handle, buffer, (uint)buffer.Capacity, 0);
        }
        if (count == 0 || count >= buffer.Capacity) throw new Win32Exception(Marshal.GetLastWin32Error());
        var path = buffer.ToString();
        return path.StartsWith(@"\\?\UNC\", StringComparison.OrdinalIgnoreCase) ? @"\\" + path[8..]
            : path.StartsWith(@"\\?\", StringComparison.Ordinal) ? path[4..] : path;
    }

    [StructLayout(LayoutKind.Sequential)] private struct AttributeTagInfo { public uint Attributes; public uint ReparseTag; }
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, ExactSpelling = true, SetLastError = true)]
    private static extern SafeFileHandle CreateFileW(string name, uint access, uint share, IntPtr security, uint creation, uint flags, IntPtr template);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern uint GetFileType(SafeFileHandle handle);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GetFileInformationByHandleEx(SafeFileHandle handle, int infoClass, out AttributeTagInfo info, uint size);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, ExactSpelling = true, SetLastError = true)]
    private static extern uint GetFinalPathNameByHandleW(SafeFileHandle handle, StringBuilder path, uint length, uint flags);
}
