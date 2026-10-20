using System.IO;
using System.Text.Json;

namespace WebTools.Desktop;

public sealed class UserSettings
{
    public string RepositoriesRoot { get; set; } = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "gh");
    public string WebUrl { get; set; } = NavigationPolicy.AppUrl;
    public DateTimeOffset SeenThrough { get; set; } = DateTimeOffset.UtcNow.AddDays(-1);
    public double Width { get; set; } = 1440;
    public double Height { get; set; } = 940;
    public bool Maximized { get; set; }

    public static readonly string DataDirectory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "WebToolsDesktop");
    private static readonly string FilePath = Path.Combine(DataDirectory, "settings.json");

    public static UserSettings Load()
    {
        try { return JsonSerializer.Deserialize<UserSettings>(File.ReadAllText(FilePath)) ?? new(); }
        catch { return new(); }
    }

    public void Save()
    {
        Directory.CreateDirectory(DataDirectory);
        var temporary = FilePath + ".tmp";
        File.WriteAllText(temporary, JsonSerializer.Serialize(this, new JsonSerializerOptions { WriteIndented = true }));
        File.Move(temporary, FilePath, overwrite: true);
    }
}
