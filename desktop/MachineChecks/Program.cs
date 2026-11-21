using WebTools.Desktop;

var checks = 0;
void Check(bool condition, string description)
{
    if (!condition) throw new InvalidOperationException(description);
    checks++;
}

var redirected = Path.Combine(Path.GetTempPath(), "redirected downloads", "résult with spaces");
Check(FileRoots.TryGet("downloads", () => redirected, out var root)
    && root.Id == "downloads" && root.FullPath == Path.GetFullPath(redirected),
    "Downloads uses the current known-folder location, including redirection and Unicode.");

foreach (var invalid in new string?[] { null, "", "  ", "relative/downloads", @"C:downloads", @"\downloads", redirected + '\0' })
    Check(!FileRoots.TryGet("downloads", () => invalid, out _),
        "An unavailable or invalid known-folder path cannot become a Downloads root.");

foreach (var id in new[] { "", "unknown", "Downloads", "downloads/.." })
    Check(!FileRoots.TryGet(id, () => throw new InvalidOperationException("Unexpected Downloads lookup."), out _),
        "Only a fixed known root ID can request a Downloads lookup.");

Check(FileRoots.TryGet("outputs", () => throw new InvalidOperationException("Unexpected Downloads lookup."), out var outputs)
    && outputs.FullPath == Path.GetFullPath(FileRoots.OutputsDirectory),
    "The outputs root remains independent of the Downloads resolver.");

foreach (var path in new[] { "../outside.txt", "folder/.git/config", "file.txt:stream", @"folder\file.txt" })
    Check(FileRoots.Resolve(root, path, file: true, out _) == 400,
        "Downloads retains traversal, Git administrative, stream and separator checks.");

if (OperatingSystem.IsWindows()) {
    var native = KnownFolders.DownloadsPath();
    Check(native is not null && Path.IsPathFullyQualified(native)
        && FileRoots.TryGet("downloads", out var current)
        && current.FullPath == Path.GetFullPath(native),
        "The production resolver reads the Windows Downloads location without creating or reading its files.");
}

Console.WriteLine($"{checks} file root checks passed.");
