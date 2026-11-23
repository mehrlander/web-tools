"""Exercise bounded commands and owned descendants with disposable Python fixtures."""
import ctypes
import os
from pathlib import Path
import sys
import tempfile
import threading
import time
import unittest

sys.path.insert(0, str(Path(__file__).parents[1] / 'worker'))
from repository_process import run_bounded


class RepositoryProcessChecks(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='web-tools-command-check-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def script(self, name, source):
        script = self.root / name
        script.write_text(source, encoding='utf-8')
        return [sys.executable, '-I', '-S', str(script)]

    def test_success_and_nonzero_preserve_stdout(self):
        for code in (0, 23):
            with self.subTest(code=code):
                argv = self.script('status.py',
                    f'import sys\nsys.stdout.buffer.write(b"fixture output\\n")\nsys.exit({code})\n')
                result = run_bounded(argv)
                self.assertIsNotNone(result)
                self.assertEqual(result.returncode, code)
                self.assertEqual(result.stdout, 'fixture output\n')

    def test_stderr_is_discarded(self):
        argv = self.script('stderr.py',
            'import sys\nsys.stderr.write("fixture stderr must not escape\\n" * 8192)\n'
            'sys.stdout.buffer.write(b"stdout only\\n")\n')
        result = run_bounded(argv)
        self.assertIsNotNone(result)
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, 'stdout only\n')
        self.assertIn(getattr(result, 'stderr', None), (None, '', b''))

    def test_input_echo_and_working_directory(self):
        (self.root / 'sentinel.txt').write_text('fixture', encoding='utf-8')
        argv = self.script('echo.py',
            'from pathlib import Path\nimport sys\n'
            'assert Path("sentinel.txt").read_text() == "fixture"\n'
            'sys.stdout.buffer.write(sys.stdin.buffer.read())\n')
        text = 'line one\ncaf\u00e9\n'
        for label, payload in (('Unicode', text), ('128KiB bytes', b'x' * (128 * 1024))):
            with self.subTest(input=label):
                result = run_bounded(argv, input=payload, cwd=str(self.root))
                self.assertIsNotNone(result)
                self.assertEqual(result.returncode, 0)
                self.assertEqual(result.stdout, payload.decode('utf-8') if isinstance(payload, bytes) else payload)

    def test_start_failure_returns_none(self):
        self.assertIsNone(run_bounded([str(self.root / 'missing-executable')], timeout=1))

    def test_output_limit_accepts_boundary_and_rejects_overflow(self):
        for length in (1024, 1025):
            with self.subTest(length=length):
                argv = self.script('output.py',
                    f'import sys\nsys.stdout.buffer.write(b"x" * {length})\n')
                result = run_bounded(argv, max_output=1024)
                if length == 1024:
                    self.assertIsNotNone(result)
                    self.assertEqual(result.returncode, 0)
                    self.assertEqual(result.stdout, 'x' * length)
                else:
                    self.assertIsNone(result)

    def fixture_handle(self, pid):
        if os.name != 'nt':
            return None
        from ctypes import wintypes
        kernel = ctypes.WinDLL('kernel32', use_last_error=True)
        kernel.OpenProcess.argtypes = (wintypes.DWORD, wintypes.BOOL, wintypes.DWORD)
        kernel.OpenProcess.restype = wintypes.HANDLE
        kernel.WaitForSingleObject.argtypes = (wintypes.HANDLE, wintypes.DWORD)
        kernel.WaitForSingleObject.restype = wintypes.DWORD
        kernel.CloseHandle.argtypes = (wintypes.HANDLE,)
        kernel.CloseHandle.restype = wintypes.BOOL
        handle = kernel.OpenProcess(0x00100000, False, pid)
        if not handle and ctypes.get_last_error() != 87:
            self.fail('Could not open the fixture process for a read-only wait')
        return kernel, handle

    def assert_fixture_exited(self, pid, handle):
        if os.name == 'nt':
            kernel, value = handle
            if value:
                self.assertEqual(kernel.WaitForSingleObject(value, 2000), 0,
                                 'The owned fixture process remained alive')
        elif sys.platform.startswith('linux'):
            stat = Path('/proc') / str(pid) / 'stat'
            deadline = time.monotonic() + 2
            while time.monotonic() < deadline:
                try:
                    state = stat.read_text().rsplit(')', 1)[1].split()[0]
                except FileNotFoundError:
                    return
                if state == 'Z':
                    return
                time.sleep(0.02)
            self.fail('The owned fixture process remained alive')

    def check_descendant_cleanup(self, parent_exits):
        child_pid, parent_pid, marker = [self.root / name for name in ('child.pid', 'parent.pid', 'marker')]
        child = self.script('descendant.py',
            'import os, sys, time\n'
            'pid, marker = sys.argv[1:]\n'
            'with open(pid, "w") as out:\n'
            '    out.write(str(os.getpid()))\n'
            'end = time.monotonic() + 60\n'
            'while time.monotonic() < end:\n'
            '    with open(marker, "w") as out:\n'
            '        out.write(str(time.monotonic_ns()))\n'
            '    time.sleep(0.025)\n')
        parent = self.script('parent.py',
            'import os, sys, time\n'
            'child, child_pid, parent_pid, marker, exits = sys.argv[1:]\n'
            'with open(parent_pid, "w") as out:\n'
            '    out.write(str(os.getpid()))\n'
            'import subprocess\n'
            'subprocess.Popen([sys.executable, "-I", "-S", child, child_pid, marker])\n'
            'end = time.monotonic() + 60\n'
            'while time.monotonic() < end:\n'
            '    if exits == "yes" and os.path.exists(child_pid) and os.path.exists(marker):\n'
            '        break\n'
            '    time.sleep(0.025)\n')
        outcome = {}

        def invoke():
            try:
                outcome['result'] = run_bounded(parent + [child[-1], str(child_pid), str(parent_pid),
                    str(marker), 'yes' if parent_exits else 'no'], timeout=20)
            except BaseException as error:
                outcome['error'] = error
            finally:
                outcome['elapsed'] = time.monotonic() - started

        started = time.monotonic()
        thread = threading.Thread(target=invoke, name='bounded-command-fixture', daemon=True)
        thread.start()
        handles = []
        try:
            deadline = started + 19
            while time.monotonic() < deadline:
                if all(p.exists() and p.stat().st_size for p in (child_pid, parent_pid, marker)):
                    break
                time.sleep(0.01)
            ready = {p.name: bool(p.exists() and p.stat().st_size) for p in (child_pid, parent_pid, marker)}
            self.assertTrue(all(ready.values()),
                'The descendant fixture did not reach its handshake: '
                f'{ready}; finished={"elapsed" in outcome}; elapsed={outcome.get("elapsed")}; '
                f'exception={type(outcome["error"]).__name__ if "error" in outcome else None}; '
                f'returncode={getattr(outcome.get("result"), "returncode", None)}; '
                f'stdout_length={len(outcome["result"].stdout) if outcome.get("result") is not None else None}')
            pids = [int(p.read_text()) for p in (parent_pid, child_pid)]
            for pid in pids:
                handles.append((pid, self.fixture_handle(pid)))
            thread.join(max(0, started + 25 - time.monotonic()))
            self.assertFalse(thread.is_alive(), 'The bounded call did not finish')
            if 'error' in outcome:
                raise outcome['error']
            self.assertIsNone(outcome['result'])
            self.assertLess(time.monotonic() - started, 25,
                            'Cleanup waited for the fixture lifetime instead of the deadline')
            for pid, handle in handles:
                self.assert_fixture_exited(pid, handle)
            stopped = marker.read_text()
            time.sleep(0.2)
            self.assertEqual(marker.read_text(), stopped, 'The descendant continued writing after return')
        finally:
            for _, handle in handles:
                if handle and handle[1]:
                    handle[0].CloseHandle(handle[1])
            thread.join(5)

    def test_timeout_kills_hung_parent_and_descendant(self):
        self.check_descendant_cleanup(parent_exits=False)

    def test_exited_parent_cannot_leave_descendant_holding_stdout(self):
        self.check_descendant_cleanup(parent_exits=True)

    def test_unread_large_input_remains_bounded(self):
        argv = self.script('unread.py', 'import time\ntime.sleep(15)\n')
        started = time.monotonic()
        self.assertIsNone(run_bounded(argv, input=b'x' * (128 * 1024), timeout=6))
        self.assertLess(time.monotonic() - started, 10,
                        'Unread input prevented bounded deadline cleanup')

    def resource_count(self):
        if os.name == 'nt':
            from ctypes import wintypes
            kernel = ctypes.WinDLL('kernel32', use_last_error=True)
            kernel.GetCurrentProcess.restype = wintypes.HANDLE
            kernel.GetProcessHandleCount.argtypes = (wintypes.HANDLE, ctypes.POINTER(wintypes.DWORD))
            kernel.GetProcessHandleCount.restype = wintypes.BOOL
            count = wintypes.DWORD()
            self.assertTrue(kernel.GetProcessHandleCount(kernel.GetCurrentProcess(), ctypes.byref(count)))
            return count.value
        if sys.platform.startswith('linux'):
            return len(list(Path('/proc/self/fd').iterdir()))
        return None

    def test_repeated_calls_release_handles_fds_and_threads(self):
        success = self.script('short.py', 'print("ok")\n')
        overflow = self.script('large.py', 'import sys\nsys.stdout.buffer.write(b"x" * 8192)\n')
        timeout = self.script('wait.py', 'import time\ntime.sleep(1)\n')
        for _ in range(2):
            self.assertIsNotNone(run_bounded(success, timeout=20))
        before = self.resource_count()
        threads = set(threading.enumerate())
        for _ in range(8):
            self.assertIsNotNone(run_bounded(success, timeout=20))
            self.assertIsNone(run_bounded([str(self.root / 'missing')], timeout=1))
            self.assertIsNone(run_bounded(overflow, max_output=1024, timeout=20))
            self.assertIsNone(run_bounded(timeout, timeout=0.1))
        deadline = time.monotonic() + 2
        while time.monotonic() < deadline and any(t.is_alive() for t in set(threading.enumerate()) - threads):
            time.sleep(0.02)
        self.assertFalse([t.name for t in set(threading.enumerate()) - threads if t.is_alive()],
                         'Bounded calls left reader threads alive')
        if before is not None:
            self.assertLessEqual(self.resource_count(), before + (4 if os.name == 'nt' else 2),
                                 'Bounded calls leaked process or pipe resources')


if __name__ == '__main__':
    unittest.main()
