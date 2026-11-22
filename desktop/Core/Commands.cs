using System.Diagnostics;
using System.Text;

namespace WebTools.Desktop;

public enum CommandFailureKind { TimedOut, ExitFailure, StartFailure }

public sealed class CommandFailureException : IOException
{
    public CommandFailureKind Kind { get; }
    public int? ExitCode { get; }
    public long ElapsedMilliseconds { get; }
    public int TimeoutSeconds { get; }

    public CommandFailureException(CommandFailureKind kind, int? exitCode, long elapsedMilliseconds, int timeoutSeconds)
        : base(kind switch {
            CommandFailureKind.TimedOut => "Command timed out.",
            CommandFailureKind.StartFailure => "Command could not start.",
            _ => "Command failed."
        })
    {
        Kind = kind;
        ExitCode = exitCode;
        ElapsedMilliseconds = elapsedMilliseconds;
        TimeoutSeconds = timeoutSeconds;
    }
}

public static class Commands
{
    public static async Task<byte[]> Run(string executable, IEnumerable<string> arguments,
        string? directory = null, byte[]? input = null, int timeoutSeconds = 25)
    {
        var info = new ProcessStartInfo(executable) {
            UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true,
            RedirectStandardError = true, RedirectStandardInput = input is not null
        };
        if (directory is not null) info.WorkingDirectory = directory;
        foreach (var arg in arguments) info.ArgumentList.Add(arg);
        using var process = new Process { StartInfo = info };
        var watch = Stopwatch.StartNew();
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(timeoutSeconds));
        using var output = new MemoryStream();
        var started = false;
        Task read = Task.CompletedTask, errors = Task.CompletedTask, wait = Task.CompletedTask;
        CommandFailureException Failure(CommandFailureKind kind, int? exitCode = null) =>
            new(kind, exitCode, watch.ElapsedMilliseconds, timeoutSeconds);
        int? ExitCode() {
            try { return started && process.HasExited ? process.ExitCode : null; }
            catch { return null; }
        }
        try {
            try { started = process.Start(); }
            catch { throw Failure(CommandFailureKind.StartFailure); }
            if (!started) throw Failure(CommandFailureKind.StartFailure);
            read = process.StandardOutput.BaseStream.CopyToAsync(output, timeout.Token);
            // Diagnostics may contain credentials or paths. Drain without retaining them.
            errors = process.StandardError.BaseStream.CopyToAsync(Stream.Null, timeout.Token);
            wait = process.WaitForExitAsync(timeout.Token);
            if (input is not null) {
                await process.StandardInput.BaseStream.WriteAsync(input, timeout.Token);
                process.StandardInput.Close();
            }
            await Task.WhenAll(read, errors, wait);
            if (process.ExitCode != 0) throw Failure(CommandFailureKind.ExitFailure, process.ExitCode);
            return output.ToArray();
        } catch (OperationCanceledException) when (timeout.IsCancellationRequested) {
            throw Failure(CommandFailureKind.TimedOut);
        } catch (CommandFailureException) {
            throw;
        } catch (Exception error) when (error is IOException or InvalidOperationException or System.ComponentModel.Win32Exception or UnauthorizedAccessException) {
            throw Failure(CommandFailureKind.ExitFailure, ExitCode());
        } finally {
            timeout.Cancel();
            try { if (started && !process.HasExited) process.Kill(entireProcessTree: true); } catch { }
            // Observe even late pipe failures, but never wait indefinitely for inherited handles.
            await Task.WhenAny(Task.WhenAll(Observe(read), Observe(errors), Observe(wait)), Task.Delay(1000));
        }
    }

    private static async Task Observe(Task task) {
        try { await task; } catch { }
    }

    public static async Task<string> Text(string executable, IEnumerable<string> arguments,
        string? directory = null, int timeoutSeconds = 25) =>
        Encoding.UTF8.GetString(await Run(executable, arguments, directory, timeoutSeconds: timeoutSeconds)).Trim();
}
