using System.Diagnostics;
using System.Text;

namespace WebTools.Desktop;

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
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(timeoutSeconds));
        process.Start();
        using var output = new MemoryStream();
        var read = process.StandardOutput.BaseStream.CopyToAsync(output, timeout.Token);
        var errors = process.StandardError.ReadToEndAsync(timeout.Token);
        try {
            if (input is not null) {
                await process.StandardInput.BaseStream.WriteAsync(input, timeout.Token);
                process.StandardInput.Close();
            }
            await Task.WhenAll(read, process.WaitForExitAsync(timeout.Token));
            var error = await errors;
            if (process.ExitCode != 0) throw new IOException($"{executable} exited with code {process.ExitCode}: {error.Trim()}");
            return output.ToArray();
        } catch {
            try { if (!process.HasExited) process.Kill(entireProcessTree: true); } catch { }
            throw;
        }
    }

    public static async Task<string> Text(string executable, IEnumerable<string> arguments,
        string? directory = null, int timeoutSeconds = 25) =>
        Encoding.UTF8.GetString(await Run(executable, arguments, directory, timeoutSeconds: timeoutSeconds)).Trim();
}
