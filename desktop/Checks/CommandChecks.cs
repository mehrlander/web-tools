using System.Diagnostics;
using System.Text;
using WebTools.Desktop;

static class CommandChecks
{
    private const string FixtureFlag = "--command-fixture";
    private const string Secret = "fixture-stderr-secret-do-not-copy";
    private const string Argument = "fixture-argument-do-not-copy";
    private const string MissingPath = "fixture-missing-path-do-not-copy";

    // Program dispatches this before ordinary checks, so subprocesses never run Git fixtures.
    public static bool RunFixture(string[] args)
    {
        if (args.Length < 2 || args[0] != FixtureFlag) return false;
        switch (args[1]) {
            case "echo":
                Console.OpenStandardInput().CopyTo(Console.OpenStandardOutput());
                break;
            case "text":
                Console.Write("  ready \r\n");
                break;
            case "fail":
                Console.Error.Write(Secret);
                Environment.ExitCode = 7;
                break;
            case "sleep":
                Console.Error.Write(Secret);
                Thread.Sleep(30000);
                break;
            default:
                Environment.ExitCode = 2;
                break;
        }
        return true;
    }

    private static (string Executable, string[] Arguments) Fixture(string mode)
    {
        var executable = Environment.ProcessPath ?? throw new InvalidOperationException("The command fixture needs its test executable.");
        string[] prefix = Path.GetFileNameWithoutExtension(executable).Equals("dotnet", StringComparison.OrdinalIgnoreCase)
            ? new[] { typeof(CommandChecks).Assembly.Location } : [];
        return (executable, [.. prefix, FixtureFlag, mode, Argument]);
    }

    private static async Task<CommandFailureException> Failure(string executable, string[] arguments, int timeoutSeconds = 25)
    {
        try { await Commands.Run(executable, arguments, timeoutSeconds: timeoutSeconds); }
        catch (CommandFailureException failure) { return failure; }
        throw new Exception("The synthetic command was expected to fail safely.");
    }

    private static bool Safe(CommandFailureException failure, string message) =>
        failure.Message == message && failure.InnerException is null && failure.Data.Count == 0
        && !new[] { Secret, Argument, MissingPath }.Any(failure.ToString().Contains);

    public static async Task Run(Action<bool, string> check)
    {
        var echo = Fixture("echo");
        var input = Encoding.UTF8.GetBytes("  fixture input \0 π\n");
        check((await Commands.Run(echo.Executable, echo.Arguments, input: input)).SequenceEqual(input),
            "Successful commands preserve stdin and stdout bytes, including whitespace and non-ASCII text.");
        var text = Fixture("text");
        check(await Commands.Text(text.Executable, text.Arguments) == "ready",
            "Command text retains its existing UTF-8 decoding and trimming behavior.");

        var fail = Fixture("fail");
        var exited = await Failure(fail.Executable, fail.Arguments);
        check(exited.Kind == CommandFailureKind.ExitFailure && exited.ExitCode == 7
            && exited.ElapsedMilliseconds >= 0 && exited.TimeoutSeconds == 25,
            "A nonzero command exit has a typed exit code and retains the default deadline.");
        check(Safe(exited, "Command failed."),
            "Exit failures retain no secret stderr, command arguments or raw inner exception.");

        var missing = await Failure(Path.Combine(Path.GetTempPath(), MissingPath + "-" + Guid.NewGuid().ToString("N")), [Argument]);
        check(missing.Kind == CommandFailureKind.StartFailure && missing.ExitCode is null
            && missing.ElapsedMilliseconds >= 0 && missing.TimeoutSeconds == 25,
            "A missing executable becomes a typed startup failure without an invented exit code.");
        check(Safe(missing, "Command could not start."),
            "Startup failures omit the executable path and operating-system exception details.");

        var sleep = Fixture("sleep");
        var watch = Stopwatch.StartNew();
        var timedOut = await Failure(sleep.Executable, sleep.Arguments, timeoutSeconds: 1);
        check(timedOut.Kind == CommandFailureKind.TimedOut && timedOut.ExitCode is null
            && timedOut.TimeoutSeconds == 1 && timedOut.ElapsedMilliseconds >= 500,
            "The runner's own one-second deadline becomes a typed timeout rather than an exit failure.");
        check(watch.Elapsed < TimeSpan.FromSeconds(10),
            "Timeout cleanup is bounded instead of waiting for the thirty-second fixture.");
        check(Safe(timedOut, "Command timed out."),
            "Timeout failures expose safe metadata without retaining stderr or command arguments.");
    }
}
