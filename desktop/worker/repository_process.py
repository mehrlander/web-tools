"""Deadline and output bounds for one privately owned subprocess scope."""
from collections import namedtuple
import math
import os
import selectors
import signal
import subprocess
import sys
import time


Result = namedtuple('Result', 'returncode stdout')


def run_bounded(argv, *, env=None, cwd=None, timeout=8, input=None, max_output=4194304):
    """Return a small text result, or None; diagnostics never enter the result.

    argv names an executable, without a shell. The scope owns every descendant,
    including a hook that retains stdout after its immediate parent has exited.
    """
    try:
        if isinstance(argv, (str, bytes)):
            return None
        args = [os.fspath(value) for value in argv]
        if not args or any(not isinstance(value, str) or '\0' in value for value in args):
            return None
        seconds = float(timeout)
        if not math.isfinite(seconds) or seconds <= 0 or not isinstance(max_output, int) or max_output < 0:
            return None
        if env is not None and any(not isinstance(key, str) or not key or '=' in key or '\0' in key
                                   or not isinstance(value, str) or '\0' in value for key, value in env.items()):
            return None
        directory = None if cwd is None else os.fspath(cwd)
        if directory is not None and (not isinstance(directory, str) or '\0' in directory):
            return None
        payload = input.encode('utf-8') if isinstance(input, str) else input
        if payload is not None and not isinstance(payload, (bytes, bytearray, memoryview)):
            return None
        payload = bytes(payload) if payload else b''
        deadline = time.monotonic() + seconds
        if os.name == 'nt':
            return _windows(args, env, directory, deadline, payload, max_output)
        if sys.platform.startswith('linux'):
            return _linux(args, env, directory, deadline, payload, max_output)
    except (OSError, ValueError, TypeError, OverflowError, subprocess.SubprocessError):
        return None
    return None


def _linux(argv, env, cwd, deadline, payload, maximum):
    process = None
    selector = selectors.DefaultSelector()
    try:
        process = subprocess.Popen(argv, env=env, cwd=cwd, stdin=subprocess.PIPE if payload else subprocess.DEVNULL,
                                   stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, start_new_session=True)
        os.set_blocking(process.stdout.fileno(), False)
        selector.register(process.stdout, selectors.EVENT_READ, 'output')
        if payload:
            os.set_blocking(process.stdin.fileno(), False)
            selector.register(process.stdin, selectors.EVENT_WRITE, 'input')
        output, offset, eof = bytearray(), 0, False
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                return None
            # WNOWAIT keeps the parent's PID reserved until the owned group has
            # been terminated, including when a descendant is holding a pipe.
            ended = os.waitid(os.P_PID, process.pid, os.WEXITED | os.WNOHANG | os.WNOWAIT)
            if ended is not None and eof:
                code = ended.si_status if ended.si_code == os.CLD_EXITED else -ended.si_status
                return Result(code, output.decode('utf-8', errors='replace'))
            for key, _events in selector.select(min(remaining, .02)):
                if key.data == 'output':
                    try:
                        block = os.read(key.fd, min(65536, maximum - len(output) + 1))
                    except BlockingIOError:
                        continue
                    if not block:
                        selector.unregister(key.fileobj)
                        eof = True
                    elif len(output) + len(block) > maximum:
                        return None
                    else:
                        output.extend(block)
                else:
                    try:
                        offset += os.write(key.fd, payload[offset:offset + 65536])
                    except BlockingIOError:
                        continue
                    except BrokenPipeError:
                        offset = len(payload)
                    if offset >= len(payload):
                        selector.unregister(key.fileobj)
                        key.fileobj.close()
    finally:
        selector.close()
        if process is not None:
            # No PID discovery: this process created this exact new session.
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            for stream in (process.stdin, process.stdout):
                if stream is not None:
                    stream.close()
            try:
                process.wait(timeout=.5)
            except subprocess.TimeoutExpired:
                pass


def _windows(argv, env, cwd, deadline, payload, maximum):
    import ctypes
    from ctypes import wintypes as w

    class Security(ctypes.Structure):
        _fields_ = [('length', w.DWORD), ('descriptor', w.LPVOID), ('inherit', w.BOOL)]

    class Startup(ctypes.Structure):
        _fields_ = [('cb', w.DWORD), ('reserved', w.LPWSTR), ('desktop', w.LPWSTR), ('title', w.LPWSTR),
                    ('x', w.DWORD), ('y', w.DWORD), ('width', w.DWORD), ('height', w.DWORD),
                    ('xchars', w.DWORD), ('ychars', w.DWORD), ('fill', w.DWORD), ('flags', w.DWORD),
                    ('show', w.WORD), ('reserved_size', w.WORD), ('reserved_bytes', w.LPBYTE),
                    ('stdin', w.HANDLE), ('stdout', w.HANDLE), ('stderr', w.HANDLE)]

    class StartupEx(ctypes.Structure):
        _fields_ = [('startup', Startup), ('attributes', w.LPVOID)]

    class Process(ctypes.Structure):
        _fields_ = [('process', w.HANDLE), ('thread', w.HANDLE), ('pid', w.DWORD), ('tid', w.DWORD)]

    class Limits(ctypes.Structure):
        _fields_ = [('process_time', ctypes.c_longlong), ('job_time', ctypes.c_longlong), ('flags', w.DWORD),
                    ('minimum_working_set', ctypes.c_size_t), ('maximum_working_set', ctypes.c_size_t),
                    ('active_process_limit', w.DWORD), ('affinity', ctypes.c_size_t),
                    ('priority', w.DWORD), ('scheduling', w.DWORD)]

    class Counters(ctypes.Structure):
        _fields_ = [(name, ctypes.c_ulonglong) for name in ('reads', 'writes', 'others', 'read_bytes', 'write_bytes', 'other_bytes')]

    class JobLimits(ctypes.Structure):
        _fields_ = [('basic', Limits), ('io', Counters), ('process_memory', ctypes.c_size_t),
                    ('job_memory', ctypes.c_size_t), ('peak_process_memory', ctypes.c_size_t), ('peak_job_memory', ctypes.c_size_t)]

    class Accounting(ctypes.Structure):
        _fields_ = [(name, ctypes.c_longlong) for name in ('user', 'kernel', 'period_user', 'period_kernel')] + [
            (name, w.DWORD) for name in ('page_faults', 'total_processes', 'active_processes', 'terminated_processes')]

    kernel = ctypes.WinDLL('kernel32', use_last_error=True)

    def api(name, arguments, result=w.BOOL):
        function = getattr(kernel, name)
        function.argtypes, function.restype = arguments, result
        return function

    close = api('CloseHandle', [w.HANDLE])
    create_job = api('CreateJobObjectW', [w.LPVOID, w.LPCWSTR], w.HANDLE)
    set_job = api('SetInformationJobObject', [w.HANDLE, ctypes.c_int, w.LPVOID, w.DWORD])
    query_job = api('QueryInformationJobObject', [w.HANDLE, ctypes.c_int, w.LPVOID, w.DWORD, w.LPVOID])
    kill_job = api('TerminateJobObject', [w.HANDLE, w.UINT])
    assign = api('AssignProcessToJobObject', [w.HANDLE, w.HANDLE])
    create_pipe = api('CreatePipe', [ctypes.POINTER(w.HANDLE), ctypes.POINTER(w.HANDLE), ctypes.POINTER(Security), w.DWORD])
    handle_flags = api('SetHandleInformation', [w.HANDLE, w.DWORD, w.DWORD])
    pipe_mode = api('SetNamedPipeHandleState', [w.HANDLE, ctypes.POINTER(w.DWORD), w.LPVOID, w.LPVOID])
    read = api('ReadFile', [w.HANDLE, w.LPVOID, w.DWORD, ctypes.POINTER(w.DWORD), w.LPVOID])
    write = api('WriteFile', [w.HANDLE, w.LPVOID, w.DWORD, ctypes.POINTER(w.DWORD), w.LPVOID])
    open_file = api('CreateFileW', [w.LPCWSTR, w.DWORD, w.DWORD, ctypes.POINTER(Security), w.DWORD, w.DWORD, w.HANDLE], w.HANDLE)
    init_attributes = api('InitializeProcThreadAttributeList', [w.LPVOID, w.DWORD, w.DWORD, ctypes.POINTER(ctypes.c_size_t)])
    set_attribute = api('UpdateProcThreadAttribute', [w.LPVOID, w.DWORD, ctypes.c_size_t, w.LPVOID, ctypes.c_size_t, w.LPVOID, w.LPVOID])
    delete_attributes = api('DeleteProcThreadAttributeList', [w.LPVOID], None)
    create_process = api('CreateProcessW', [w.LPCWSTR, w.LPWSTR, w.LPVOID, w.LPVOID, w.BOOL, w.DWORD, w.LPVOID, w.LPCWSTR, w.LPVOID, ctypes.POINTER(Process)])
    resume = api('ResumeThread', [w.HANDLE], w.DWORD)
    wait = api('WaitForSingleObject', [w.HANDLE, w.DWORD], w.DWORD)
    exit_code = api('GetExitCodeProcess', [w.HANDLE, ctypes.POINTER(w.DWORD)])
    kill_process = api('TerminateProcess', [w.HANDLE, w.UINT])

    handles, attributes, info, assigned = set(), None, Process(), False
    invalid = ctypes.c_void_p(-1).value

    def own(handle):
        if not handle or handle == invalid:
            raise OSError()
        handles.add(handle)
        return handle

    def release(handle):
        if handle in handles:
            handles.remove(handle)
            close(handle)

    security = Security(ctypes.sizeof(Security), None, True)

    def pipe(parent_reads):
        reader, writer = w.HANDLE(), w.HANDLE()
        if not create_pipe(ctypes.byref(reader), ctypes.byref(writer), ctypes.byref(security), 65536):
            raise OSError()
        reader, writer = own(reader.value), own(writer.value)
        parent = reader if parent_reads else writer
        mode = w.DWORD(1)  # PIPE_NOWAIT; only our endpoint, not the child's.
        if not handle_flags(parent, 1, 0) or not pipe_mode(parent, ctypes.byref(mode), None, None):
            raise OSError()
        return reader, writer

    try:
        job = own(create_job(None, None))
        limits = JobLimits()
        limits.basic.flags = 0x2000  # JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE, no breakaway.
        if not set_job(job, 9, ctypes.byref(limits), ctypes.sizeof(limits)):
            return None
        output_read, output_write = pipe(True)
        if payload:
            input_read, input_write = pipe(False)
        else:
            input_read = own(open_file('NUL', 0x80000000, 3, ctypes.byref(security), 3, 0x80, None))
            input_write = None
        error_write = own(open_file('NUL', 0x40000000, 3, ctypes.byref(security), 3, 0x80, None))
        size = ctypes.c_size_t()
        init_attributes(None, 1, 0, ctypes.byref(size))
        if not size.value:
            return None
        attribute_buffer = ctypes.create_string_buffer(size.value)
        attributes = ctypes.cast(attribute_buffer, w.LPVOID)
        if not init_attributes(attributes, 1, 0, ctypes.byref(size)):
            attributes = None
            return None
        inherited = (w.HANDLE * 3)(input_read, output_write, error_write)
        if not set_attribute(attributes, 0, 0x20002, inherited, ctypes.sizeof(inherited), None, None):
            return None
        startup = StartupEx()
        startup.startup.cb = ctypes.sizeof(StartupEx)
        startup.startup.flags = 0x101  # STARTF_USESTDHANDLES | STARTF_USESHOWWINDOW (hidden).
        startup.startup.stdin, startup.startup.stdout, startup.startup.stderr = input_read, output_write, error_write
        startup.attributes = attributes
        environment = None if env is None else ctypes.create_unicode_buffer(
            '\0'.join(key + '=' + value for key, value in sorted(env.items(), key=lambda item: item[0].upper())) + '\0\0')
        command = ctypes.create_unicode_buffer(subprocess.list2cmdline(argv))
        # Every child starts suspended. Failure to establish our Job is a closed
        # failure: the child is terminated before any executable code resumes.
        if not create_process(None, command, None, None, True, 0x08080404,
                              environment, cwd, ctypes.byref(startup), ctypes.byref(info)):
            return None
        own(info.process)
        own(info.thread)
        if not assign(job, info.process):
            return None
        assigned = True
        if resume(info.thread) == 0xffffffff:
            return None
        release(info.thread)
        release(input_read)
        release(output_write)
        release(error_write)
        output, offset, eof = bytearray(), 0, False
        while time.monotonic() < deadline:
            progress = False
            if not eof:
                buffer = ctypes.create_string_buffer(min(65536, maximum - len(output) + 1))
                count = w.DWORD()
                if read(output_read, buffer, len(buffer), ctypes.byref(count), None):
                    if count.value:
                        if len(output) + count.value > maximum:
                            return None
                        output.extend(buffer.raw[:count.value])
                        progress = True
                    else:
                        eof = True
                else:
                    error = ctypes.get_last_error()
                    if error == 109:  # ERROR_BROKEN_PIPE: every writer closed.
                        eof = True
                    elif error != 232:  # ERROR_NO_DATA: nonblocking, still open.
                        return None
            if input_write is not None:
                block = payload[offset:offset + 65536]
                count = w.DWORD()
                if write(input_write, block, len(block), ctypes.byref(count), None):
                    offset += count.value
                    progress = progress or bool(count.value)
                    if offset >= len(payload):
                        release(input_write)
                        input_write = None
                else:
                    error = ctypes.get_last_error()
                    if error == 109:
                        release(input_write)
                        input_write = None
                    elif error != 232:  # A full nonblocking input pipe retries.
                        return None
            status = wait(info.process, 0)
            if status == 0 and eof:
                code = w.DWORD()
                if not exit_code(info.process, ctypes.byref(code)):
                    return None
                return Result(code.value, output.decode('utf-8', errors='replace'))
            if status == 0xffffffff:
                return None
            if not progress:
                time.sleep(min(.01, max(0, deadline - time.monotonic())))
        return None
    finally:
        if info.process:
            if assigned:
                kill_job(job, 1)
                finish = time.monotonic() + .5
                accounting = Accounting()
                while time.monotonic() < finish:
                    if not query_job(job, 1, ctypes.byref(accounting), ctypes.sizeof(accounting), None) or not accounting.active_processes:
                        break
                    time.sleep(.005)
            else:
                kill_process(info.process, 1)
            wait(info.process, 500)
        if attributes is not None:
            delete_attributes(attributes)
        for handle in list(handles):
            release(handle)
