using System.Text.RegularExpressions;

namespace WebTools.Desktop;

public static class SessionLinks
{
    private const string Uuid = "[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}";
    public static string? Safe(string? address)
    {
        if (!Uri.TryCreate(address, UriKind.Absolute, out var uri) || uri.UserInfo.Length > 0
            || !uri.IsDefaultPort || uri.Fragment.Length > 0) return null;
        if (uri.Scheme == "codex" && uri.Host == "threads" && uri.Query.Length == 0
            && Regex.IsMatch(uri.AbsolutePath, "^/" + Uuid + "$")) return uri.AbsoluteUri;
        if (uri.Scheme != "https") return null;
        if (uri.Host == "claude.ai" && uri.Query.Length == 0
            && Regex.IsMatch(uri.AbsolutePath, "^/code/session_[A-Za-z0-9_-]{1,160}$")) return uri.AbsoluteUri;
        if (uri.Host == "antigravity.google.com" && Regex.IsMatch(uri.AbsolutePath, "^/r/" + Uuid + "(?:-v[0-9]{1,2})?$")
            && Regex.IsMatch(uri.Query, "^\\?p=c%2[fF]" + Uuid + "$")) return uri.AbsoluteUri;
        return null;
    }

    public static string? For(string provider, string id, string? source = null, string? geminiInstance = null) =>
        provider == "Codex" && Guid.TryParseExact(id, "D", out _) ? Safe("codex://threads/" + id)
        : provider == "Gemini" && geminiInstance is not null ? Safe("https://antigravity.google.com/r/" + geminiInstance + "?p=c%2F" + id)
        : provider == "Claude" && source?.StartsWith("https://claude.ai/code/",StringComparison.Ordinal) == true ? Safe(source) : null;
}
