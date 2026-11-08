"""Read one directory beneath the configured repository root, without file contents."""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import stat
import time

from local_files import linked, role
from repositories import git


def valid_path(relative):
    return (isinstance(relative, str) and len(relative) <= 1024 and '\\' not in relative
            and (not relative or len(relative.split('/')) <= 32
                 and all(p and p == p.rstrip(' .') and p not in ('.', '..') and p.casefold() != '.git'
                         and ':' not in p and not any(ord(c) < 32 for c in p)
                         for p in relative.split('/'))))


def directory(root, relative):
    if not valid_path(relative):
        return None, 'invalid'
    current = root
    try:
        for part in [None, *relative.split('/')] if relative else [None]:
            if part is not None:
                current = current / part
            info = current.lstat()
            if linked(info):
                return None, 'blocked'
            if not stat.S_ISDIR(info.st_mode):
                return None, 'missing'
        resolved = current.resolve().relative_to(root.resolve())
        if any(p.casefold() == '.git' for p in resolved.parts):
            return None, 'blocked'
        return current, None
    except (OSError, ValueError):
        return None, 'missing'


def classify(root, path, entries):
    checkout = path
    while not (checkout / '.git').exists():
        if checkout == root:
            return
        checkout = checkout.parent
    prefix = path.relative_to(checkout).as_posix()
    prefix = '' if prefix == '.' else prefix + '/'
    # Git pathspecs are literal: folder names may contain wildcard characters.
    raw = git(checkout, 'ls-files', '--cached', '-z', '--', ':(literal)' + prefix,
              timeout=4, strip=False)
    names = {(name[len(prefix):].split('/')[0]) for name in (raw or '').split('\0')
             if name and name.startswith(prefix)} if raw is not None else None
    for entry in entries:
        if names is not None and entry['name'] in names:
            entry['gitState'] = 'tracked'
        elif raw is not None:
            entry['gitState'] = 'untracked'
    # One check per directory, including ignored parents; no content is read.
    candidates = [prefix + e['name'] for e in entries if e['gitState'] != 'tracked']
    if candidates:
        import subprocess
        env = {**os.environ, 'GIT_OPTIONAL_LOCKS': '0', 'GIT_TERMINAL_PROMPT': '0'}
        try:
            result = subprocess.run(['git', '--no-optional-locks', '-c', 'core.fsmonitor=false',
                                     '-C', str(checkout), 'check-ignore', '--stdin', '-z'],
                                    input='\0'.join(candidates) + '\0', capture_output=True,
                                    encoding='utf-8', errors='replace', timeout=4, env=env)
            if result.returncode not in (0, 1) or len(result.stdout) > 2_097_152:
                raise OSError()
            ignored = set(result.stdout.split('\0'))
            for entry in entries:
                if prefix + entry['name'] in ignored:
                    entry['gitState'] = 'ignored'
        except (OSError, subprocess.TimeoutExpired):
            for entry in entries:
                if entry['gitState'] == 'untracked':
                    entry['gitState'] = None


def browse(root, relative, limit=2000, seconds=2):
    value = {'schemaVersion': 1, 'rootName': root.name, 'path': relative,
             'observedAt': datetime.now(timezone.utc).isoformat(), 'state': 'ready',
             'entries': [], 'partial': False, 'notice': None}
    path, error = directory(root, relative)
    if error:
        value.update(state=error)
        return value
    end = time.monotonic() + seconds
    try:
        with os.scandir(path) as children:
            for child in children:
                if len(value['entries']) >= limit or time.monotonic() >= end:
                    value['partial'] = True
                    break
                if child.name.casefold() == '.git':
                    continue
                try:
                    info = child.stat(follow_symlinks=False)
                    if linked(info) or not (stat.S_ISDIR(info.st_mode) or stat.S_ISREG(info.st_mode)):
                        continue
                    folder = stat.S_ISDIR(info.st_mode)
                    value['entries'].append({'name': child.name, 'kind': 'folder' if folder else 'file',
                        'gitState': None, 'bytes': None if folder else info.st_size,
                        'modifiedAt': datetime.fromtimestamp(info.st_mtime, timezone.utc).isoformat(),
                        'role': role(child.name) if folder else None})
                except OSError:
                    value['partial'] = True
    except OSError:
        value.update(state='unavailable')
        return value
    classify(root, path, value['entries'])
    value['entries'].sort(key=lambda e: (e['kind'] != 'folder', e['name'].casefold(), e['name']))
    if value['partial']:
        value['notice'] = 'Folder listing incomplete.'
    return value


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--path', default='')
    args = parser.parse_args()
    print(json.dumps(browse(args.root.absolute(), args.path), ensure_ascii=True))
