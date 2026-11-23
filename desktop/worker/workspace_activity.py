"""Conservative, read-only workspace activity evidence for unattended updates.

These provider stores are observations, not a lease held by editors. Missing,
unreadable or incomplete installed-provider evidence never proves a folder idle.
Only lifecycle metadata is inspected; messages are neither returned nor saved.
"""
from datetime import datetime, timezone
from contextlib import closing
import json
import hashlib
import math
import ntpath
import os
from pathlib import Path
import re
import sqlite3
import stat
import subprocess
from urllib.parse import unquote, urlsplit

from repository_process import run_bounded


MAX_ROWS = 1024
MAX_FILES = 1024
MAX_TAIL = 64 * 1024
MAX_TOTAL_READ = 16 * 1024 * 1024
QUIET_SECONDS = 60
CONFIRMATION_FILE = 'owner-confirmed-idle.json'
MAX_CONFIRMATIONS = 64
MAX_CONFIRMATION_BYTES = 65_536
REASONS = frozenset(('active-session', 'activity-unavailable', 'activity-uncertain'))


class EvidenceError(Exception):
    pass


def _result(reason=None):
    return {'allow': reason is None, 'reason': reason}


def _path(value):
    if not isinstance(value, (str, Path)) or not str(value).strip():
        return None
    value = str(value)
    if value.startswith('\\\\?\\UNC\\'):
        value = '\\\\' + value[8:]
    elif value.startswith('\\\\?\\'):
        value = value[4:]
    if value.startswith('file:'):
        try:
            uri = urlsplit(value)
            if uri.scheme != 'file' or uri.query or uri.fragment:
                return None
            value = ('//' + uri.netloc if uri.netloc else '') + unquote(uri.path)
            if re.match(r'^/[A-Za-z]:/', value):
                value = value[1:]
        except ValueError:
            return None
    if '\x00' in value:
        return None
    if re.match(r'^[A-Za-z]:[\\/]', value) or value.startswith(('\\\\', '//')):
        return ntpath.normpath(value).replace('\\', '/').rstrip('/').casefold()
    if not os.path.isabs(value):
        return None
    return os.path.normcase(os.path.abspath(value)).replace('\\', '/').rstrip('/') or '/'


def _overlap(left, right):
    return left == right or left.startswith(right.rstrip('/') + '/') or right.startswith(left.rstrip('/') + '/')


def _scope(target, scopes):
    normalized = [_path(value) for value in scopes]
    if not normalized or any(value is None for value in normalized):
        return None
    return any(_overlap(target, value) for value in normalized)


def _safe_file(path, root):
    path, root = Path(path), Path(root)
    try:
        if not path.is_file() or _reparse(path) or not _inside(path, root):
            raise EvidenceError()
        # A linked provider directory could point outside the supported store.
        for parent in path.parents:
            if parent == root.parent:
                break
            if _reparse(parent):
                raise EvidenceError()
        return path
    except (OSError, ValueError):
        raise EvidenceError() from None


def _reparse(path):
    return path.is_symlink() or bool(getattr(path.lstat(), 'st_file_attributes', 0) & getattr(stat, 'FILE_ATTRIBUTE_REPARSE_POINT', 0x400))


def _inside(path, root):
    left, right = _path(path.resolve()), _path(root.resolve())
    return left is not None and right is not None and (left == right or left.startswith(right.rstrip('/') + '/'))


def _connection(path):
    try:
        conn = sqlite3.connect(Path(path).resolve().as_uri() + '?mode=ro', uri=True, timeout=1)
        conn.execute('PRAGMA query_only=ON')
        return conn
    except (OSError, sqlite3.Error):
        raise EvidenceError() from None


def _rows(path, table, columns, where='1=1'):
    try:
        with closing(_connection(path)) as conn:
            known = {row[1] for row in conn.execute('PRAGMA table_info(' + table + ')')}
            if not set(columns).issubset(known):
                raise EvidenceError()
            rows = conn.execute('SELECT ' + ','.join(columns) + ' FROM ' + table + ' WHERE ' + where + ' LIMIT ?', (MAX_ROWS + 1,)).fetchall()
            if len(rows) > MAX_ROWS:
                raise EvidenceError()
            return rows
    except sqlite3.Error:
        raise EvidenceError() from None


def _tail(path, root, budget):
    path = _safe_file(path, root)
    try:
        size = path.stat().st_size
        budget[0] += min(size, MAX_TAIL)
        if budget[0] > MAX_TOTAL_READ:
            raise EvidenceError()
        with path.open('rb') as stream:
            if size > MAX_TAIL:
                stream.seek(size - MAX_TAIL)
                stream.readline()  # The initial partial JSON line is not evidence.
            data = stream.read(MAX_TAIL + 1)
        if len(data) > MAX_TAIL or data and not data.endswith(b'\n'):
            raise EvidenceError()
        return data.decode('utf-8').splitlines()
    except (OSError, UnicodeError):
        raise EvidenceError() from None


def _json(line):
    try:
        row = json.loads(line)
        if not isinstance(row, dict):
            raise EvidenceError()
        return row
    except (ValueError, TypeError):
        raise EvidenceError() from None


def _history(root, identifiers):
    databases = list(root.glob('thread_history_*.sqlite'))
    versions = [(int(m.group(1)), path) for path in databases if (m := re.fullmatch(r'thread_history_(\d+)\.sqlite', path.name))]
    if not versions:
        return {}
    if len(databases) > 32:
        raise EvidenceError()
    path = _safe_file(max(versions)[1], root)
    result = {}
    try:
        with closing(_connection(path)) as conn:
            columns = {row[1] for row in conn.execute('PRAGMA table_info(thread_turns)')}
            required = {'thread_id', 'status', 'started_at', 'completed_at', 'rollout_ordinal', 'rollout_end_byte_offset', 'rollout_end_ordinal'}
            if not required.issubset(columns):
                raise EvidenceError()
            for offset in range(0, len(identifiers), 400):
                chunk = identifiers[offset:offset + 400]
                identity_columns = ',turn_id,root_turn_id' if {'turn_id', 'root_turn_id'}.issubset(columns) else ',NULL,NULL'
                sql = ('SELECT thread_id,status,started_at,completed_at,rollout_ordinal,rollout_end_byte_offset,rollout_end_ordinal' + identity_columns + ' FROM thread_turns t '
                       'WHERE thread_id IN (' + ','.join('?' for _ in chunk) + ') AND '
                       "(status='inProgress' OR rollout_ordinal=(SELECT MAX(rollout_ordinal) FROM thread_turns latest WHERE latest.thread_id=t.thread_id)) LIMIT ?")
                rows = conn.execute(sql, (*chunk, MAX_ROWS * 2 + 1)).fetchall()
                if len(rows) > MAX_ROWS * 2:
                    raise EvidenceError()
                for identifier, status, started, completed, ordinal, end, end_ordinal, turn_id, root_turn in rows:
                    previous = result.get(identifier)
                    if status == 'inProgress' or previous is None or previous['status'] != 'inProgress' and ordinal > previous['ordinal']:
                        result[identifier] = {'status': status, 'started': started, 'completed': completed, 'ordinal': ordinal,
                                              'end': end, 'endOrdinal': end_ordinal, 'covered': False,
                                              'nextByte': None, 'nextOrdinal': None, 'turnId': turn_id, 'rootTurnId': root_turn}
                projection = {row[1] for row in conn.execute('PRAGMA table_info(thread_history_projection_state)')}
                if {'thread_id', 'next_rollout_byte_offset', 'next_rollout_ordinal'}.issubset(projection):
                    rows = conn.execute('SELECT thread_id,next_rollout_byte_offset,next_rollout_ordinal FROM thread_history_projection_state WHERE thread_id IN (' + ','.join('?' for _ in chunk) + ') LIMIT ?', (*chunk, MAX_ROWS + 1)).fetchall()
                    if len(rows) > MAX_ROWS:
                        raise EvidenceError()
                    for identifier, next_byte, next_ordinal in rows:
                        terminal = result.get(identifier)
                        values = (next_byte, next_ordinal, terminal['end'], terminal['endOrdinal']) if terminal else ()
                        if terminal and all(isinstance(value, int) and not isinstance(value, bool) and value >= 0 for value in values):
                            terminal['covered'] = next_byte >= terminal['end'] and next_ordinal > terminal['endOrdinal']
                            terminal['nextByte'] = next_byte
                            terminal['nextOrdinal'] = next_ordinal
    except sqlite3.Error:
        raise EvidenceError() from None
    return result


def _events(lines, state=None):
    turn = None
    for line in lines:
        if not line.strip():
            continue
        row = _json(line)
        if row.get('type') != 'event_msg':
            if state != 'working':
                state = None
            continue
        payload = row.get('payload')
        if not isinstance(payload, dict):
            raise EvidenceError()
        kind = payload.get('type')
        key = payload.get('root_turn_id') or payload.get('turn_id')
        if kind == 'task_started':
            state, turn = 'working', key
        elif kind in ('task_complete', 'turn_aborted'):
            if state == 'working' and turn and key and turn != key:
                continue
            state, turn = 'finished', key
        elif kind != 'token_count' and state != 'working':
            state = None
    return state


def _since(path, root, offset, budget):
    path = _safe_file(path, root)
    size = path.stat().st_size
    if not isinstance(offset, int) or isinstance(offset, bool) or not 0 <= offset <= size or size - offset > MAX_TAIL:
        raise EvidenceError()
    if offset == size:
        return []
    # The projection's next offset is the first unconsumed record. Do not read
    # a preceding terminal event and mistake that old event for new proof.
    budget[0] += size - offset
    if budget[0] > MAX_TOTAL_READ:
        raise EvidenceError()
    with path.open('rb') as stream:
        stream.seek(offset)
        data = stream.read(MAX_TAIL + 1)
    if len(data) > MAX_TAIL or data and not data.endswith(b'\n'):
        raise EvidenceError()
    try:
        return data.decode('utf-8').splitlines()
    except UnicodeError:
        raise EvidenceError() from None


def _catalog(root):
    databases = list(root.glob('state_*.sqlite'))
    if len(databases) > 32:
        raise EvidenceError()
    versions = [(int(m.group(1)), path) for path in databases if (m := re.fullmatch(r'state_(\d+)\.sqlite', path.name))]
    if not versions:
        raise EvidenceError()
    database = _safe_file(max(versions)[1], root)
    with closing(_connection(database)) as conn:
        columns = {row[1] for row in conn.execute('PRAGMA table_info(threads)')}
    modified = 'updated_at_ms' if 'updated_at_ms' in columns else 'updated_at' if 'updated_at' in columns else 'NULL'
    requested = ['id', 'cwd', 'rollout_path', 'archived']
    if modified != 'NULL':
        requested.append(modified)
    if {'source', 'thread_source'}.issubset(columns):
        requested.extend(('source', 'thread_source'))
    rows = _rows(database, 'threads', requested, 'archived=0')
    records = []
    for values in rows:
        row = dict(zip(requested, values))
        row['_modified'] = row.get(modified)
        records.append(row)
    return records


def _guardian(row):
    if row.get('thread_source') == 'guardian_review':
        try:
            return json.loads(row.get('source')) == {'subagent': {'other': 'guardian'}}
        except (ValueError, TypeError):
            pass
    return False


def _rollout(root, value):
    if not isinstance(value, str):
        raise EvidenceError()
    if value.startswith('\\\\?\\UNC\\'):
        value = '\\\\' + value[8:]
    elif value.startswith('\\\\?\\'):
        value = value[4:]
    path = Path(value)
    if not path.is_absolute():
        path = root / path
    if not any(_inside(path, root / directory) for directory in ('sessions', 'archived_sessions')):
        raise EvidenceError()
    for parent in (path, *path.parents):
        if parent == root.parent:
            break
        try:
            if _reparse(parent):
                raise EvidenceError()
        except FileNotFoundError:
            pass
    return path


def _terminal(row, now):
    if not row or row.get('status') not in ('completed', 'failed', 'interrupted'):
        return False
    completed, started = _time(row.get('completed')), _time(row.get('started'))
    return completed is not None and started is not None and started <= completed <= now


def _pin(identifier, modified, path, history):
    changed = _time(modified)
    turn = history.get('turnId') if history else None
    if changed is None or not isinstance(turn, str) or not turn or len(turn) > 256 or not history.get('covered'):
        return None
    fields = ('status', 'started', 'completed', 'ordinal', 'end', 'endOrdinal', 'nextByte', 'nextOrdinal', 'turnId', 'rootTurnId')
    fingerprint = hashlib.sha256(json.dumps({key: history.get(key) for key in fields}, sort_keys=True, separators=(',', ':')).encode('utf-8')).hexdigest()
    return {'threadId': identifier, 'catalogUpdatedAt': round(changed * 1000),
            'rolloutIdentity': hashlib.sha256(_path(path).encode('utf-8')).hexdigest(), 'terminalFingerprint': fingerprint}


def _confirmed_file(state, now):
    if state is None:
        return None
    path = Path(state) / CONFIRMATION_FILE
    try:
        if not path.exists() or path.stat().st_size > MAX_CONFIRMATION_BYTES:
            return None
        _safe_file(path, Path(state))
        with path.open('rb') as stream:
            data = stream.read(MAX_CONFIRMATION_BYTES + 1)
        if len(data) > MAX_CONFIRMATION_BYTES:
            return None
        record = json.loads(data.decode('utf-8'))
        if not isinstance(record, dict) or set(record) - {'version', 'confirmedAt', 'proposedAt', 'entries'} or type(record.get('version')) is not int or record['version'] != 1:
            return None
        at = record.get('confirmedAt')
        confirmed = datetime.fromisoformat(at.replace('Z', '+00:00')) if isinstance(at, str) else None
        if confirmed is None or confirmed.tzinfo is None or not 0 < confirmed.timestamp() <= now:
            return None
        if 'proposedAt' in record:
            if not isinstance(record['proposedAt'], str):
                return None
            proposed = datetime.fromisoformat(record['proposedAt'].replace('Z', '+00:00'))
            if proposed.tzinfo is None or not 0 < proposed.timestamp() <= confirmed.timestamp():
                return None
        entries = record.get('entries')
        if not isinstance(entries, list) or len(entries) > MAX_CONFIRMATIONS:
            return None
        indexed = {}
        keys = {'threadId', 'catalogUpdatedAt', 'rolloutIdentity', 'terminalFingerprint'}
        for row in entries:
            if not isinstance(row, dict) or set(row) != keys:
                return None
            identifier, catalog = row['threadId'], row['catalogUpdatedAt']
            if not isinstance(identifier, str) or not identifier or len(identifier) > 256 or identifier in indexed:
                return None
            if not isinstance(catalog, int) or isinstance(catalog, bool) or not 0 < catalog <= confirmed.timestamp() * 1000:
                return None
            if any(not isinstance(row[key], str) or not re.fullmatch(r'[0-9a-f]{64}', row[key]) for key in ('rolloutIdentity', 'terminalFingerprint')):
                return None
            indexed[identifier] = row
        return {'confirmed': confirmed.timestamp(), 'entries': indexed}
    except (EvidenceError, OSError, ValueError, TypeError, OverflowError, UnicodeError):
        return None


def _confirmed(record, pin, history):
    return bool(record and pin and record['entries'].get(pin['threadId']) == pin
                and record['confirmed'] >= _time(history['completed']))


def propose_idle_confirmations(thread_ids, profile=None):
    """Build private proposals only. This helper never confirms or writes them."""
    if not isinstance(thread_ids, (tuple, list)) or len(thread_ids) > MAX_CONFIRMATIONS or any(not isinstance(value, str) or not value or len(value) > 256 for value in thread_ids) or len(set(thread_ids)) != len(thread_ids):
        raise ValueError('Invalid thread selection')
    profile = Path(profile) if profile is not None else Path.home()
    root, now = profile / '.codex', datetime.now(timezone.utc)
    selected = set(thread_ids)
    rows = [row for row in _catalog(root) if row['id'] in selected and not _guardian(row)]
    history = _history(root, [row['id'] for row in rows])
    entries = []
    for row in rows:
        persisted = history.get(row['id'])
        if not _terminal(persisted, now.timestamp()) or now.timestamp() - _time(persisted['completed']) < QUIET_SECONDS:
            continue
        changed = _time(row['_modified'])
        if changed is None or changed > now.timestamp():
            continue
        path = _rollout(root, row['rollout_path'])
        if path.exists():
            continue
        pin = _pin(row['id'], row['_modified'], path, persisted)
        if pin:
            entries.append(pin)
    return {'version': 1, 'proposedAt': now.isoformat(), 'entries': sorted(entries, key=lambda row: row['threadId'])}


def _codex(profile, target, budget, state=None):
    root = profile / '.codex'
    if not root.exists():
        return None
    relevant_rows = []
    for row in _catalog(root):
        # Exclude only the exact read-only internal approval role.
        if _guardian(row):
            continue
        identifier, cwd, rollout = row['id'], row['cwd'], row['rollout_path']
        relevant = _scope(target, [cwd])
        if relevant is False:
            continue
        if relevant is None:
            return 'activity-uncertain'
        if not isinstance(identifier, str) or not identifier or len(identifier) > 256:
            raise EvidenceError()
        relevant_rows.append((identifier, rollout, row['_modified']))
    history = _history(root, [row[0] for row in relevant_rows])
    if any(row['status'] == 'inProgress' for row in history.values()):
        return 'active-session'
    confirmations = _confirmed_file(state, datetime.now(timezone.utc).timestamp())
    for identifier, rollout, modified in relevant_rows:
        persisted = history.get(identifier)
        if persisted and persisted['status'] == 'inProgress':
            return 'active-session'
        terminal = _terminal(persisted, datetime.now(timezone.utc).timestamp())
        completed = _time(persisted['completed']) if terminal else None
        started = _time(persisted['started']) if terminal else None
        changed = _time(modified)
        now = datetime.now(timezone.utc).timestamp()
        if persisted and not terminal:
            return 'activity-uncertain'
        path = _rollout(root, rollout)
        if not path.exists():
            pin = _pin(identifier, modified, path, persisted) if terminal else None
            allowed = bool(terminal and changed is not None and changed <= now and (changed <= completed + 1 or _confirmed(confirmations, pin, persisted)))
            if terminal and persisted['covered'] and allowed and now - completed >= QUIET_SECONDS:
                continue
            return 'activity-uncertain'
        if terminal and persisted['covered'] and isinstance(persisted['end'], int):
            _safe_file(path, root)
            if path.stat().st_size == persisted['nextByte']:
                state = 'finished'
            else:
                state = _events(_since(path, root, persisted['nextByte'], budget))
        else:
            state = _events(_tail(path, root, budget))
        if state == 'working':
            return 'active-session'
        if state != 'finished':
            return 'activity-uncertain'
    return None


def _time(value):
    try:
        if isinstance(value, bool):
            return None
        if isinstance(value, str) and not value.replace('.', '', 1).isdigit():
            return datetime.fromisoformat(value.replace('Z', '+00:00')).astimezone(timezone.utc).timestamp()
        value = float(value)
        if not math.isfinite(value):
            return None
        for _ in range(4):
            if value <= 100_000_000_000:
                break
            value /= 1000
        return value if 0 < value <= 100_000_000_000 else None
    except (ValueError, TypeError, OverflowError):
        return None


def _gemini(profile, target, _budget):
    marker = profile / '.gemini'
    if not marker.exists():
        return None
    root = marker / 'antigravity'
    database = root / 'conversation_summaries.db'
    if not database.exists():
        raise EvidenceError()
    _safe_file(database, root)
    rows = _rows(database, 'conversation_summaries', ('workspace_uris', 'status', 'not_fully_idle', 'killed', 'last_modified_time'))
    now = datetime.now(timezone.utc).timestamp()
    for workspaces, status, busy, killed, modified in rows:
        if killed in (1, True):
            continue
        # A durable terminal/idle record need not have a usable historical
        # workspace serialization. Unknown scope still blocks unfinished work.
        at = _time(modified)
        if status == 'CASCADE_RUN_STATUS_IDLE' and busy in (0, False) and killed in (0, False) and at is not None and QUIET_SECONDS <= now - at:
            continue
        try:
            scopes = json.loads(workspaces) if isinstance(workspaces, str) else workspaces
        except ValueError:
            scopes = None
        if isinstance(scopes, str):
            scopes = [scopes]
        relevant = _scope(target, scopes) if isinstance(scopes, list) else None
        if relevant is False:
            continue
        if relevant is None or busy not in (0, 1, False, True) or killed not in (0, False):
            return 'activity-uncertain'
        if status == 'CASCADE_RUN_STATUS_RUNNING' or busy:
            return 'active-session'
        if status != 'CASCADE_RUN_STATUS_IDLE':
            return 'activity-uncertain'
        if at is None or now - at < QUIET_SECONDS:
            return 'activity-uncertain'
    return None


def _files(root, pattern):
    files, pending, examined = [], [root], 0
    import fnmatch
    while pending:
        directory = pending.pop()
        with os.scandir(directory) as entries:
            for entry in entries:
                examined += 1
                if examined > MAX_FILES * 4 or _reparse(Path(entry.path)):
                    raise EvidenceError()
                path = Path(entry.path)
                if entry.is_dir(follow_symlinks=False):
                    pending.append(path)
                elif entry.is_file(follow_symlinks=False) and fnmatch.fnmatch(entry.name, pattern):
                    files.append(path)
                    if len(files) > MAX_FILES:
                        raise EvidenceError()
    return files


def _claude(profile, target, budget):
    desktop = profile / 'AppData' / 'Roaming' / 'Claude'
    sessions = desktop / 'claude-code-sessions'
    cli = profile / '.claude'
    if not desktop.exists() and not cli.exists():
        return None
    supported = False
    if sessions.is_dir():
        supported = True
        for path in _files(sessions, 'local_*.json'):
            _safe_file(path, sessions)
            if path.stat().st_size > 1_048_576:
                raise EvidenceError()
            budget[0] += path.stat().st_size
            if budget[0] > MAX_TOTAL_READ:
                raise EvidenceError()
            row = _json(path.read_text(encoding='utf-8'))
            if row.get('isArchived') is True:
                continue
            relevant = _scope(target, [row.get('cwd')])
            if relevant is False:
                continue
            # Desktop metadata has no durable terminal-turn field. Age is not
            # proof of inactivity, so an unarchived matching record stays blocked.
            return 'activity-uncertain'
    projects = cli / 'projects'
    if projects.is_dir():
        supported = True
        for path in _files(projects, '*.jsonl'):
            lines = _tail(path, projects, budget)
            cwd, terminal, seen = None, False, False
            for line in lines:
                if not line.strip():
                    continue
                row = _json(line)
                cwd = row.get('cwd') or cwd
                if row.get('type') == 'user':
                    terminal, seen = False, True
                elif row.get('type') == 'assistant':
                    message = row.get('message')
                    terminal = isinstance(message, dict) and message.get('stop_reason') in ('end_turn', 'stop_sequence')
                    seen = True
            relevant = _scope(target, [cwd])
            if relevant is False:
                continue
            if relevant is None or not seen or not terminal:
                return 'activity-uncertain'
            if datetime.now(timezone.utc).timestamp() - path.stat().st_mtime < QUIET_SECONDS:
                return 'activity-uncertain'
    if not supported:
        raise EvidenceError()
    return None


def _cli_processes():
    if os.name != 'nt':
        # The installed companion is Windows-only. Do not silently infer idle on
        # an unsupported host; portable tests inject this boundary explicitly.
        return 'activity-unavailable'
    script = r'''
$ErrorActionPreference='Stop'
try {
  if(-not ('CompanionArgv' -as [type])) { Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class CompanionArgv {
  [DllImport("shell32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
  static extern IntPtr CommandLineToArgvW(string line, out int count);
  [DllImport("kernel32.dll")] static extern IntPtr LocalFree(IntPtr pointer);
  public static string[] Parse(string line) {
    int count; IntPtr pointer=CommandLineToArgvW(line,out count);
    if(pointer==IntPtr.Zero || count<1 || count>4096) throw new Exception();
    try {
      var result=new string[count];
      for(int i=0;i<count;i++) result[i]=Marshal.PtrToStringUni(Marshal.ReadIntPtr(pointer,i*IntPtr.Size));
      return result;
    } finally { LocalFree(pointer); }
  }
}
'@
  }
  $unknown=$false; $cli=$false
  $rows=Get-CimInstance Win32_Process -Filter "Name='node.exe' OR Name='bun.exe' OR Name='codex.exe' OR Name='gemini.exe' OR Name='claude.exe'" -OperationTimeoutSec 3
  foreach($row in $rows) {
    $name=$row.Name.ToLowerInvariant(); $line=$row.CommandLine; $exe=$row.ExecutablePath
    if($name -eq 'codex.exe') {
      if(-not $line) { $unknown=$true }
      else {
        $tokens=[CompanionArgv]::Parse($line); $i=1
        while($i -lt $tokens.Count) {
          if($tokens[$i] -eq '-c' -or $tokens[$i] -eq '--config') {
            if($i+1 -ge $tokens.Count) { $unknown=$true; break }; $i+=2
          } elseif($tokens[$i].StartsWith('--config=')) { $i++ }
          else { break }
        }
        if($i -ge $tokens.Count -or $tokens[$i].StartsWith('-')) { $unknown=$true }
        elseif($tokens[$i] -notin @('app-server','mcp-server','exec-server')) { $cli=$true }
      }
    } elseif($name -eq 'gemini.exe') {
      if(-not $line) { $unknown=$true } else { $cli=$true }
    } elseif($name -eq 'claude.exe') {
      if(-not $exe -or -not $line) { $unknown=$true }
      elseif($exe -match '[\\/](?:\.local[\\/]bin|@anthropic-ai[\\/]claude-code)[\\/]') { $cli=$true }
    } elseif($line) {
      # Restrict inspection to initial executable/script arguments, not a prompt
      # that merely mentions an installed package.
      $tokens=[CompanionArgv]::Parse($line)
      for($i=1; $i -lt [Math]::Min($tokens.Count,8); $i++) {
        $token=$tokens[$i]
        if($token -match '(?:^|[\\/])(?:@google[\\/]gemini-cli|@anthropic-ai[\\/]claude-code)[\\/].*\.(?:js|mjs|cjs)$') { $cli=$true; break }
        if(-not $token.StartsWith('-')) { break }
      }
    } else { $unknown=$true }
  }
  if($cli) {'cli'} elseif($unknown) {'unknown'} else {'idle'}
} catch { 'unknown' }
'''
    try:
        result = run_bounded(['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', script],
                             timeout=8, max_output=4096)
        if result is None or result.returncode != 0 or result.stdout.strip() not in ('idle', 'cli', 'unknown'):
            return 'activity-unavailable'
        return {'idle': None, 'cli': 'activity-uncertain', 'unknown': 'activity-unavailable'}[result.stdout.strip()]
    except (OSError, subprocess.TimeoutExpired):
        return 'activity-unavailable'


def probe(path, profile=None, *, state=None):
    """Return a small allow/blocked result, with no captured content or paths."""
    target = _path(path)
    if target is None:
        return _result('activity-uncertain')
    profile = Path(profile) if profile is not None else Path.home()
    try:
        if not profile.is_dir():
            return _result('activity-unavailable')
        reason = _cli_processes()
        if reason:
            return _result(reason)
        budget = [0]
        for provider in (_codex, _gemini, _claude):
            reason = provider(profile, target, budget, state) if provider is _codex else provider(profile, target, budget)
            if reason:
                return _result(reason)
    except (EvidenceError, OSError, ValueError, TypeError, sqlite3.Error):
        return _result('activity-unavailable')
    return _result()
