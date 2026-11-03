"""Bounded metadata inventory of material excluded from a checkout's Git index."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import os
from pathlib import PurePosixPath
import stat
import time


def stamp(value=None):
    return datetime.now(timezone.utc).isoformat() if value is None else datetime.fromtimestamp(value, timezone.utc).isoformat()


def linked(info):
    return stat.S_ISLNK(info.st_mode) or bool(getattr(info, 'st_file_attributes', 0) & 0x400)


def target(checkout, relative):
    """Validate every component without resolving through symlinks or junctions."""
    if not relative or '\\' in relative or len(relative) > 512:
        return None
    path = PurePosixPath(relative.rstrip('/'))
    if path.is_absolute() or any(p in ('.', '..', '.git') or ':' in p for p in path.parts):
        return None
    current = checkout
    try:
        for part in path.parts:
            current = current / part
            info = current.lstat()
            if linked(info):
                return None
        return (current, info) if path.parts else None
    except (OSError, ValueError):
        return None


def role(relative):
    parts = set(PurePosixPath(relative).parts)
    if parts & {'node_modules', '.venv', 'venv'}:
        return 'Dependencies'
    if parts & {'.cache', '__pycache__', '.pytest_cache', '.mypy_cache', '.ruff_cache'}:
        return 'Cache'
    if parts & {'bin', 'obj'}:
        return 'Build output'
    if '.playwright-cli' in parts:
        return 'Automation'
    return None


def measure(path, info, budget):
    if stat.S_ISREG(info.st_mode):
        return info.st_size, 1, info.st_mtime, False
    if not stat.S_ISDIR(info.st_mode):
        return None, None, None, True
    total, files, latest, partial = 0, 0, info.st_mtime, False
    stack = [path]
    while stack:
        if budget['nodes'] >= budget['limit'] or time.monotonic() >= budget['end']:
            partial = True
            break
        directory = stack.pop()
        try:
            # Check again before opening a queued directory. Never traverse a
            # symlink, Windows junction or Git administrative directory.
            if linked(directory.lstat()):
                partial = True
                continue
            with os.scandir(directory) as children:
                for child in children:
                    if budget['nodes'] >= budget['limit'] or time.monotonic() >= budget['end']:
                        partial = True
                        break
                    budget['nodes'] += 1
                    if child.name == '.git':
                        partial = True
                        continue
                    try:
                        detail = child.stat(follow_symlinks=False)
                        if linked(detail):
                            partial = True
                        elif stat.S_ISDIR(detail.st_mode):
                            stack.append(directory / child.name)
                        elif stat.S_ISREG(detail.st_mode):
                            total += detail.st_size
                            files += 1
                            latest = max(latest, detail.st_mtime)
                    except OSError:
                        partial = True
        except OSError:
            partial = True
    return (None, None, latest, True) if partial and not files else (total, files, latest, partial)


def collect(checkout, checkout_key, git, max_entries=96, max_nodes=30000, seconds=2.5):
    value = {'key': checkout_key, 'name': checkout.name, 'observedAt': stamp(),
             'state': 'ready', 'entries': [], 'partial': False, 'notice': None}
    try:
        if linked(checkout.lstat()):
            value.update(state='unavailable', notice='Linked checkout inventory unavailable.')
            return value
    except OSError:
        value.update(state='unavailable', notice='Local file inventory unavailable.')
        return value
    candidates = []
    for state, flags in [('ignored', ['--ignored']), ('untracked', [])]:
        raw = git(checkout, 'ls-files', '--others', *flags, '--exclude-standard',
                  '--directory', '--no-empty-directory', '-z', timeout=6, strip=False)
        if raw is None:
            value.update(state='unavailable', notice='Local file inventory unavailable.')
            return value
        candidates.extend((name, state) for name in raw.split('\0') if name)
    # Useful names stay visible before large dependency/cache trees consume a
    # measurement budget. Classification still comes entirely from Git.
    order = {None: 0, 'Dependencies': 1, 'Cache': 2, 'Automation': 3, 'Build output': 4}
    candidates = sorted(set(candidates), key=lambda c: (order[role(c[0])], not c[0].endswith('/'), c[0].casefold(), c[1]))
    value['partial'] = len(candidates) > max_entries
    budget = {'nodes': 0, 'limit': max_nodes, 'end': time.monotonic() + seconds}
    for relative, state in candidates[:max_entries]:
        safe = target(checkout, relative)
        if safe is None:
            value['partial'] = True
            continue
        path, info = safe
        size, count, modified, partial = measure(path, info, budget)
        kind = 'folder' if stat.S_ISDIR(info.st_mode) else 'file'
        try:
            modified_at = stamp(modified) if modified is not None else None
        except (OSError, ValueError, OverflowError):
            modified_at = None
        value['entries'].append({'key': hashlib.sha256((state + ':' + relative).encode('utf-8')).hexdigest()[:24],
            'path': relative, 'kind': kind, 'gitState': state, 'bytes': size, 'files': count,
            'modifiedAt': modified_at, 'partial': partial, 'role': role(relative) if kind == 'folder' else None})
        value['partial'] = value['partial'] or partial
    if value['partial']:
        value['notice'] = 'Some entries or measurements are incomplete; linked content is not followed.'
    value['observedAt'] = stamp()
    return value


def inventories(entries, git, checkout_key):
    per_checkout = min(96, max(1, 2048 // max(1, len(entries))))
    with ThreadPoolExecutor(max_workers=4) as pool:
        rows = list(pool.map(lambda e: collect(e['path'], checkout_key(str(e['path'].resolve()).lower()), git,
                                              max_entries=per_checkout), entries))
    return {'schemaVersion': 1, 'machineName': os.environ.get('COMPUTERNAME', 'Laptop'),
            'observedAt': stamp(), 'checkouts': rows}
