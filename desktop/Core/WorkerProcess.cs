using System.Text;
using System.Text.RegularExpressions;

namespace WebTools.Desktop;

// Match an interpreter invocation, not a script name mentioned in another command.
public static class WorkerProcess
{
    public static bool IsCandidate(string? name) => name is not null && name.Length <= 64
        && Regex.IsMatch(name, @"^(?:pythonw?(?:[0-9]{1,3}(?:\.[0-9]{1,2}){0,2})?|pyw?)\.exe$",
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    public static string State(IEnumerable<(string Name, string? CommandLine)> processes)
    {
        var uncertain = false;
        foreach (var (name, command) in processes) {
            if (!IsCandidate(name)) continue;
            var args = Arguments(command);
            if (args is null) { uncertain = true; continue; }
            if (IsDaemon(args)) return "detected";
        }
        return uncertain ? "unknown" : "absent";
    }

    private static bool IsDaemon(List<string> args)
    {
        if (args.Count < 3 || !IsCandidate(Leaf(args[0]))) return false;
        var launcher = Leaf(args[0]).Equals("py.exe", StringComparison.OrdinalIgnoreCase)
            || Leaf(args[0]).Equals("pyw.exe", StringComparison.OrdinalIgnoreCase);
        var index = 1;
        var module = false;
        while (index < args.Count) {
            var option = args[index];
            if (option == "--") { index++; break; }
            if (option == "-m") { module = true; index++; break; }
            if (option is "-W" or "-X") { index += 2; continue; }
            if (Regex.IsMatch(option, @"^-[bBdEiIOPqRsSuvx]+$")
                || option.Length > 2 && (option.StartsWith("-W", StringComparison.Ordinal) || option.StartsWith("-X", StringComparison.Ordinal))
                || launcher && Regex.IsMatch(option, @"^-(?:[23](?:\.[0-9]{1,2})?(?:-32|-64)?|V:[0-9.]+)$")) {
                index++; continue;
            }
            // -c payloads, wrapper strings and unknown interpreter options never select a script.
            break;
        }
        if (index >= args.Count) return false;
        var target = args[index++];
        if (module ? target is not ("poll_followup" or "sessions.tools.poll_followup")
            : !Leaf(target).Equals("poll_followup.py", StringComparison.OrdinalIgnoreCase)) return false;
        var daemon = false;
        for (; index < args.Count; index++) {
            if (args[index] == "--") break;
            if (args[index] == "--once") return false;
            if (args[index] == "--daemon") daemon = true;
        }
        return daemon;
    }

    private static string Leaf(string path) => path.Replace('\\', '/').Split('/')[^1];

    // Windows argv quoting, including escaped quotes and backslashes before quotes.
    // Bounds also keep a malformed/unreadable candidate from becoming a confident absence.
    private static List<string>? Arguments(string? command)
    {
        if (string.IsNullOrWhiteSpace(command) || command.Length > 32768 || command.Contains('\0')) return null;
        var args = new List<string>();
        var index = 0;
        while (index < command.Length) {
            while (index < command.Length && char.IsWhiteSpace(command[index])) index++;
            if (index == command.Length) break;
            if (args.Count == 256) return null;
            var value = new StringBuilder();
            var quoted = false;
            while (index < command.Length && (quoted || !char.IsWhiteSpace(command[index]))) {
                if (command[index] == '\\') {
                    var first = index;
                    while (index < command.Length && command[index] == '\\') index++;
                    var slashes = index - first;
                    if (index < command.Length && command[index] == '"') {
                        value.Append('\\', slashes / 2);
                        if (slashes % 2 != 0) value.Append('"');
                        else quoted = !quoted;
                        index++;
                    } else value.Append('\\', slashes);
                } else if (command[index] == '"') { quoted = !quoted; index++; }
                else value.Append(command[index++]);
            }
            if (quoted) return null;
            args.Add(value.ToString());
        }
        return args;
    }
}
