"""Publish observed local work and captured prose through named Git objects.

Working files and indexes are never staged, switched, reset, moved or deleted.
"""
import argparse
import base64
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
import shutil
import subprocess
import tempfile
import time

import lenovo_inventory as inventory
import local_sessions
import repositories

TARGET = 'state/local-work.json'
SKIP = {'.git', 'node_modules', '.pnpm-store', '.venv', 'venv', '__pycache__', 'test-temp', 'browser-temp', 'bin', 'obj'}


def stamp():
    return datetime.now(timezone.utc).isoformat()


def discover(roots, budget=15000):
    """Bounded walk includes old thread checkouts without following links."""
    entries, loose, remaining = [], [], budget
    for label, root, depth in roots:
        if not root.is_dir():
            loose.append({'scope': label, 'state': 'unavailable'})
            continue
        stack = [(root, 0)]
        while stack and remaining > 0:
            path, level = stack.pop()
            remaining -= 1
            try:
                if path.is_symlink() or inventory.linked(path.lstat()): continue
                if (path / '.git').exists():
                    entries.append({'id': repositories.key(str(path.resolve()).casefold()), 'path': path,
                                    'scope': label, 'relative': path.relative_to(root).as_posix()})
                    continue
                children = list(path.iterdir())
                # Code projects and legacy thread folders are useful units even
                # when no Git metadata was ever created for their work.
                if (label == 'code' and level == 1) or (label == 'threads' and level == 2):
                    files = [p for p in children if p.is_file() and not p.is_symlink()]
                    if files:
                        loose.append({'scope': label, 'path': path.relative_to(root).as_posix(),
                                      'state': 'observed', 'files': len(files),
                                      'examples': sorted(p.name for p in files)[:12], 'coverage': 'immediate files'})
                if level < depth:
                    stack.extend((p, level + 1) for p in sorted(children, reverse=True) if p.name not in SKIP and p.is_dir())
            except OSError:
                loose.append({'scope': label, 'path': path.relative_to(root).as_posix(), 'state': 'unavailable'})
    return entries, loose, remaining > 0


def common_directory(path):
    """Read standard worktree pointers, falling back to Git for other layouts."""
    if any(os.environ.get(name) for name in ('GIT_DIR', 'GIT_COMMON_DIR', 'GIT_WORK_TREE')): return None
    try:
        directory = path / '.git'
        if directory.is_file():
            if directory.stat().st_size > 32768: return None
            pointer = directory.read_text(encoding='utf-8').rstrip('\r\n')
            if not pointer.startswith('gitdir: '): return None
            directory = path / pointer[8:]
        common = directory / 'commondir'
        if common.is_file():
            if common.stat().st_size > 32768: return None
            directory = directory / common.read_text(encoding='utf-8').rstrip('\r\n')
        return directory.resolve().as_posix() if directory.is_dir() else None
    except (OSError, ValueError, UnicodeError): return None


def observe(entry, state, comparisons=None):
    path = entry['path']
    entry['repo'] = repositories.github_name(repositories.git(path, 'config', '--get', 'remote.origin.url'))
    common = common_directory(path) or repositories.git(path, 'rev-parse', '--path-format=absolute', '--git-common-dir')
    entry['common'] = repositories.key(str(common or path).casefold())
    row = repositories.local_status(entry, activity=True)
    source = repositories.read_source(state, repositories.key(entry['repo'].lower() if entry['repo'] else str(path.resolve()).lower()))
    cache = dict(comparisons or {})
    tracked = repositories.compare(entry, row, repositories.tracking_branch(row, source), source, cache)
    main = repositories.compare(entry, row, source.get('defaultBranch'), source, cache)
    online = 'unknown'
    tips = source.get('tips', {}) if source.get('checkedAt') else {}
    contained = None
    if row['head'] and tips and row['head'] not in tips.values():
        contained = repositories.git(path, 'for-each-ref', '--contains', row['head'], '--format=%(objectname)')
    if row['head'] and (row['head'] in tips.values() or contained is not None and any(oid in tips.values() for oid in contained.splitlines())):
        online = 'pushed'
    elif tracked['ahead'] is not None and tracked['ahead'] > 0:
        online = 'local-commits'
    return {'id': entry['id'], 'scope': entry['scope'], 'path': entry['relative'], 'repo': entry['repo'],
            'store': entry['common'], 'branch': row['branch'], 'head': row['head'],
            'changed': row['changed'], 'untracked': row['untracked'], 'conflicts': row['conflicts'],
            'ignored': row['ignored'],
            'publication': online, 'integration': 'incorporated' if main['ahead'] == 0 else 'unknown',
            'tracked': tracked, 'main': main, 'checkedAt': source.get('checkedAt'),
            'stashes': row['stashes'],
            'notice': source.get('notice'), 'state': 'ready' if row['changed'] is not None else 'unavailable'}


def build(root, state, profile, legacy=True, limit=1024):
    roots = [('repositories', Path(root), 4), ('code', Path(profile) / 'Code', 2)]
    if legacy: roots.append(('threads', Path(profile) / 'Documents/Codex', 5))
    entries, loose, complete = discover(roots)
    try:
        comparisons = json.loads((Path(state) / 'repository-comparisons.json').read_text(encoding='utf-8'))
        if not isinstance(comparisons, dict): comparisons = {}
    except (OSError, ValueError): comparisons = {}
    with ThreadPoolExecutor(max_workers=8) as pool:
        rows = list(pool.map(lambda e: observe(e, state, comparisons), entries))
    records, coverage = [], []
    for reader in (local_sessions.codex, local_sessions.gemini):
        try:
            found, status = reader(profile, entries, limit)
            records.extend(found)
            coverage.append(status)
        except (sqlite3.Error, OSError, ValueError, TypeError):
            coverage.append({'provider': reader.__name__, 'state': 'unavailable'})
    for row in rows:
        row['sessions'] = [{'id': r['short'], 'provider': r['assistant'], 'title': r['title'], 'ended': r['ended']}
                           for _, r in records if any(p['checkout'] == row['id'] for p in r['repos'])]
    # Stashes belong to the shared Git store, not each worktree.
    stores = {}
    for row in rows:
        if row['store'] not in stores or stores[row['store']]['stashes'] is None:
            stores[row['store']] = {'id': row['store'], 'repo': row['repo'], 'stashes': row.pop('stashes')}
        else: row.pop('stashes')
    return {'schema': 1, 'observedAt': stamp(), 'machine': os.environ.get('COMPUTERNAME', 'Lenovo'),
            'coverage': {'complete': complete, 'roots': [r[0] for r in roots], 'sessions': coverage},
            'checkouts': rows, 'stores': list(stores.values()), 'standalone': loose,
            'sessions': [{'id': r['short'], 'provider': r['assistant'], 'title': r['title'],
                          'ended': r['ended'], 'capture': r['capture'], 'path': p} for p, r in records]}, records


def replace_files(repository, base, files):
    """Rewrite only named leaves, preserving all other tree entries."""
    changes = {}
    for path, body in files.items():
        if not re.fullmatch(r'(?:state/local-work\.json|sessions/\d{4}/\d{2}/\d{4}-\d{2}-\d{2}-[0-9a-f]+\.json)', path):
            raise ValueError('Unapproved capture destination')
        branch = changes
        parts = path.split('/')
        for part in parts[:-1]: branch = branch.setdefault(part, {})
        branch[parts[-1]] = path
    # One process writes the batch, including unchanged records. Temporary files
    # contain only the captured bytes and never enter the repository checkout.
    with tempfile.TemporaryDirectory(prefix='local-conversation-') as scratch:
        paths = []
        for index, body in enumerate(files.values()):
            path = Path(scratch) / str(index)
            path.write_bytes(body)
            paths.append(path.as_posix())
        hashes = inventory.text(repository, 'hash-object', '-w', '--no-filters', '--stdin-paths',
                                data=('\n'.join(paths) + '\n').encode('utf-8')).splitlines() if paths else []
        if len(hashes) != len(files) or any(not re.fullmatch(r'[0-9a-f]{40,64}', oid) for oid in hashes):
            raise inventory.InventoryError('Captured object batch unavailable')
        blobs = dict(zip(files, hashes))
    def rewrite(revision, additions):
        existing = inventory.tree(repository, revision) if revision else {}
        for name, value in additions.items():
            key = name.encode()
            old = existing.get(key)
            if isinstance(value, dict):
                if old and b' tree ' not in old: raise ValueError('Capture parent is not a tree')
                oid = old.split(b'\t')[0].split()[2].decode() if old else None
                sha = rewrite(oid, value)
                existing[key] = b'040000 tree ' + sha.encode() + b'\t' + key
            else:
                if old and not old.startswith(b'100644 blob '): raise ValueError('Capture destination is not a file')
                existing[key] = b'100644 blob ' + blobs[value].encode() + b'\t' + key
        return inventory.text(repository, 'mktree', '-z', data=b'\0'.join(existing.values()) + b'\0')
    return rewrite(base, changes)


def github_api(gh, endpoint, method='GET', payload=None):
    command = [gh, 'api', endpoint, '--method', method, '--include', '-H', 'Accept: application/vnd.github+json']
    if payload is not None: command.extend(['--input', '-'])
    response = subprocess.run(command, input=json.dumps(payload).encode() if payload is not None else None,
                              capture_output=True, timeout=90, env={**os.environ, 'GH_PROMPT_DISABLED': '1'})
    status = re.match(rb'HTTP/\S+\s+(\d+)', response.stdout)
    separator = re.search(rb'\r?\n\r?\n', response.stdout)
    if not status or not separator: raise inventory.InventoryError('Snapshot response unavailable')
    return int(status[1]), json.loads(response.stdout[separator.end():])


def publish_snapshot(gh, body, subject):
    endpoint = 'repos/mehrlander/web-tools-private/contents/' + TARGET
    for attempt in range(4):
        status, current = github_api(gh, endpoint + '?ref=background')
        if status not in (200, 404): break
        payload = {'branch': 'background', 'content': base64.b64encode(body).decode(),
                   'message': subject + '\n\nCo-Authored-By: Codex <codex@openai.com>\n'}
        if status == 200:
            if current.get('type') != 'file' or current.get('path') != TARGET:
                raise inventory.InventoryError('Snapshot destination is not a file')
            payload['sha'] = current['sha']
            if current.get('encoding') == 'base64':
                previous = base64.b64decode(current.get('content', ''))
                if previous == body: return 'unchanged'
                try:
                    before = datetime.fromisoformat(json.loads(previous)['observedAt'])
                    candidate = datetime.fromisoformat(json.loads(body)['observedAt'])
                    if before > candidate: return 'superseded'
                except (ValueError, KeyError, TypeError): pass
        status, _ = github_api(gh, endpoint, 'PUT', payload)
        if status in (200, 201): return 'published'
        if status not in (409, 422): break
        time.sleep(.25 * (attempt + 1))
    raise inventory.InventoryError('Snapshot publication unavailable; no working files changed')


def publish(repository, files, branch, subject):
    if branch not in ('main', 'background') or not inventory.approved_origin(repository):
        raise ValueError('Private capture destination unavailable')
    gh = shutil.which('gh')
    if branch == 'background' and set(files) == {TARGET} and gh:
        return publish_snapshot(gh, files[TARGET], subject)
    for attempt in range(4):
        inventory.git(repository, 'fetch', '--quiet', '--no-tags', '--no-prune', '--no-prune-tags', '--no-recurse-submodules', '--no-auto-maintenance',
                      '--no-write-fetch-head', '--refmap=', 'origin', f'+refs/heads/{branch}:refs/remotes/origin/{branch}')
        base = inventory.text(repository, 'rev-parse', f'refs/remotes/origin/{branch}')
        tree = replace_files(repository, base, files)
        if tree == inventory.text(repository, 'rev-parse', base + '^{tree}'): return 'unchanged'
        commit = inventory.text(repository, 'commit-tree', tree, '-p', base,
                                data=(subject + '\n\nCo-Authored-By: Codex <codex@openai.com>\n').encode())
        try:
            inventory.git(repository, 'push', '--quiet', 'origin', f'{commit}:refs/heads/{branch}')
            return 'published'
        except inventory.InventoryError:
            time.sleep(.25 * (attempt + 1))
    raise inventory.InventoryError('Publication unavailable; no working files changed')


def run(root, state, profile, push=False, legacy=True, limit=1024):
    snapshot, records = build(root, state, profile, legacy, limit)
    encode = lambda obj: (json.dumps(obj, ensure_ascii=True, sort_keys=True) + '\n').encode()
    # Persist locally before any network operation, so a failed publish can retry.
    state.mkdir(parents=True, exist_ok=True)
    temporary = state / 'local-work.next'
    temporary.write_bytes(encode(snapshot))
    temporary.replace(state / 'local-work.json')
    result = {'checkouts': len(snapshot['checkouts']), 'sessions': len(records), 'observedAt': snapshot['observedAt']}
    if push:
        repository = root / 'web-tools-private'
        # Conversations go to the captured store's main, consumed by Sessions.
        # Observation metadata stays with the existing background inventory.
        if records: result['records'] = publish(repository, {p: encode(r) for p, r in records}, 'main', 'Capture local conversations')
        result['snapshot'] = publish(repository, {TARGET: encode(snapshot)}, 'background', 'Observe local work')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--state', type=Path, required=True)
    parser.add_argument('--profile', type=Path, default=Path.home())
    parser.add_argument('--publish', action='store_true')
    parser.add_argument('--no-legacy', action='store_true')
    parser.add_argument('--limit', type=int, default=1024)
    args = parser.parse_args()
    print(json.dumps(run(args.root, args.state, args.profile, args.publish, not args.no_legacy, max(1, min(args.limit, 1024)))))


if __name__ == '__main__': main()
