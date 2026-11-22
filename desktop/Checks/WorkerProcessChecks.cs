using WebTools.Desktop;

static class WorkerProcessChecks
{
    public static void Run(Action<bool, string> check)
    {
        string State(string name, string? command) => WorkerProcess.State([(name, command)]);
        foreach (var name in new[] { "python.exe", "pythonw.exe", "python3.exe", "python3.11.exe", "pythonw3.11.exe", "PYTHONW3.13.EXE", "python311.exe" })
            check(State(name, $"\"C:\\Python Tools\\{name}\" \"C:\\private work\\sessions\\tools\\poll_followup.py\" --daemon --log poller.log") == "detected",
                name + " detects the exact daemon invocation, including quoted interpreter and script paths.");
        check(State("pythonw3.11.exe", "pythonw.exe -u -X utf8 -W ignore poll_followup.py --daemon") == "detected"
            && State("py.exe", "py.exe -3.11 poll_followup.py --daemon") == "detected",
            "Interpreter flags and a Python launcher preserve the actual daemon target.");
        check(State("python.exe", "python.exe -m sessions.tools.poll_followup --daemon") == "detected"
            && State("python.exe", "python.exe -m poll_followup --daemon") == "detected",
            "The exact known poller module invocations are recognized.");
        foreach (var command in new[] {
            "pythonw3.11.exe poll_followup.py --once", "python.exe poll_followup.py --daemon-alerts",
            "python.exe poll_followup.py --daemon=true", "python.exe poll_followup.py -- --daemon",
            "python.exe poll_followup.py --daemon --once", "python.exe unrelated.py poll_followup.py --daemon",
            "python.exe unrelated.py --note \"poll_followup.py --daemon\"", "python.exe not_poll_followup.py --daemon",
            "python.exe -c \"print('poll_followup.py --daemon')\"", "python.exe -m unrelated.poll_followup --daemon",
            "python.exe -m unrelated poll_followup.py --daemon", "python.exe -X poll_followup.py --daemon"
        }) check(State("pythonw3.11.exe", command) == "absent", "A non-daemon or unrelated invocation stays absent: " + command);
        check(State("cmd.exe", "python.exe poll_followup.py --daemon") == "absent"
            && State("python-helper.exe", "python.exe poll_followup.py --daemon") == "absent"
            && State("notpythonw3.11.exe", "python.exe poll_followup.py --daemon") == "absent"
            && State("python.exe", "cmd.exe /c python.exe poll_followup.py --daemon") == "absent",
            "Process-name and argv interpreter boundaries reject wrapper command strings and lookalike executables.");
        check(State("pythonw3.11.exe", null) == "unknown" && State("python.exe", " ") == "unknown"
            && State("python.exe", "python.exe \"poll_followup.py --daemon") == "unknown"
            && State("python.exe", new string('x', 32769)) == "unknown",
            "Unreadable, malformed and over-bound Python command lines never become a confident absence.");
        check(WorkerProcess.State([("python.exe", null), ("pythonw3.11.exe", "pythonw3.11.exe poll_followup.py --daemon")]) == "detected"
            && WorkerProcess.State([("pythonw3.11.exe", "pythonw3.11.exe poll_followup.py --daemon"), ("python.exe", null)]) == "detected",
            "A verified daemon takes precedence over an unreadable interpreter regardless of process order.");
        check(WorkerProcess.State([("cmd.exe", null), ("python.exe", "python.exe unrelated.py")]) == "absent"
            && WorkerProcess.State([]) == "absent",
            "Unreadable unrelated processes and an empty process list do not invent worker uncertainty.");
    }
}
