using System.Runtime.CompilerServices;

[assembly: InternalsVisibleTo("FileRootsChecks")]

namespace WebTools.Desktop;

public sealed record FileRoot(string Id, string FullPath);

public static class FileRoots
{
    public static string OutputsDirectory => Path.Combine(UserSettings.DataDirectory, "outputs");

    public static bool TryGet(string id, out FileRoot root) => TryGet(id, KnownFolders.DownloadsPath, out root);

    internal static bool TryGet(string id, Func<string?> downloadsPath, out FileRoot root)
    {
        root = null!;
        var path = id switch {
            "gh" => UserSettings.Load().RepositoriesRoot,
            "outputs" => OutputsDirectory,
            "downloads" => downloadsPath(),
            _ => null
        };
        if (string.IsNullOrWhiteSpace(path)) return false;
        try {
            if (id == "downloads" && !Path.IsPathFullyQualified(path)) return false;
            root = new(id, Path.GetFullPath(path));
            return true;
        }
        catch (Exception e) when (e is ArgumentException or NotSupportedException or PathTooLongException) { return false; }
    }

    public static bool ValidPath(string path, bool allowEmpty = true)
    {
        if (path.Length == 0) return allowEmpty;
        if (path.Length > 1024 || path.Contains('\\') || path.Split('/').Length > 32) return false;
        foreach (var part in path.Split('/')) {
            if (part.Length == 0 || part != part.TrimEnd(' ', '.') || part is "." or ".."
                || part.Equals(".git", StringComparison.OrdinalIgnoreCase)
                || part.Any(c => char.IsControl(c) || c is ':' or '<' or '>' or '"' or '|' or '?' or '*')) return false;
            // Win32 device names remain devices with an extension or an alias.
            var stem = part.Split('.')[0].TrimEnd(' ').ToUpperInvariant();
            if (stem is "CON" or "PRN" or "AUX" or "NUL" or "CONIN$" or "CONOUT$"
                || stem.Length == 4 && (stem.StartsWith("COM", StringComparison.Ordinal) || stem.StartsWith("LPT", StringComparison.Ordinal))
                    && (stem[3] is >= '1' and <= '9' or '¹' or '²' or '³')) return false;
        }
        return true;
    }

    public static bool Contains(string root, string path, bool allowRoot = false)
    {
        var relative = Path.GetRelativePath(root, path);
        return (allowRoot || relative != ".") && !Path.IsPathRooted(relative)
            && relative != ".." && !relative.StartsWith(".." + Path.DirectorySeparatorChar, StringComparison.Ordinal)
            && !relative.Split(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)
                .Any(p => p.Equals(".git", StringComparison.OrdinalIgnoreCase));
    }

    public static int Resolve(FileRoot root, string relative, bool file, out string target)
    {
        target = "";
        if (!ValidPath(relative, !file)) return 400;
        try {
            target = Path.GetFullPath(Path.Combine(root.FullPath, relative.Replace('/', Path.DirectorySeparatorChar)));
            if (!Contains(root.FullPath, target, allowRoot: !file)) return 403;
            var current = root.FullPath;
            var parts = relative.Length == 0 ? Array.Empty<string>() : relative.Split('/');
            for (var index = -1; index < parts.Length; index++) {
                if (index >= 0) current = Path.Combine(current, parts[index]);
                var attributes = File.GetAttributes(current);
                if ((attributes & (FileAttributes.ReparsePoint | FileAttributes.Device)) != 0) return 403;
                var directory = (attributes & FileAttributes.Directory) != 0;
                if (index < parts.Length - 1 && !directory || index == parts.Length - 1 && directory == file) return 404;
            }
            return 200;
        } catch (Exception e) when (e is FileNotFoundException or DirectoryNotFoundException) { return 404; }
        catch (UnauthorizedAccessException) { return 403; }
        catch (Exception e) when (e is IOException or ArgumentException or NotSupportedException) { return 503; }
    }
}
