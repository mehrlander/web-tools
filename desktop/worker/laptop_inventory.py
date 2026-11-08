"""Names and stat metadata for cloud readers, published without a checkout write."""
from collections import Counter
import os
from pathlib import Path
import re
import stat
import subprocess
import time
from urllib.parse import urlsplit

from local_files import linked

TARGET = 'state/laptop-files.tsv'
INTERVAL = 15 * 60
COLLAPSE = {'node_modules', '.venv', 'venv', '__pycache__', '.pytest_cache'}
HEADER = 'path\tkind\tgit\tfiles\tbytes\tbranch\tcommit\n'


class InventoryError(Exception):
    pass


def git(repository, *args, data=None, allowed=(0,)):
    env = dict(os.environ)
    for name in ('GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR'):
        env.pop(name, None)
    env.update(GIT_OPTIONAL_LOCKS='0', GIT_TERMINAL_PROMPT='0', GIT_NO_LAZY_FETCH='1', GCM_INTERACTIVE='Never')
    result = subprocess.run(['git', '--no-optional-locks', '-c', 'core.fsmonitor=false', '-c', 'core.longpaths=true',
                             '-c', 'maintenance.auto=false', '-C', str(repository), *args],
                            input=data, capture_output=True, env=env, timeout=120)
    if result.returncode not in allowed:
        # Git diagnostics can carry credential-helper details and machine paths.
        raise InventoryError('Git metadata unavailable')
    return result.stdout


def text(repository, *args, **kwargs):
    return git(repository, *args, **kwargs).decode('utf-8').strip()


def ancestors(path):
    parts = path.split('/')
    return ('/'.join(parts[:i]) for i in range(1, len(parts)))


def normalize(path):
    return path.casefold() if os.name == 'nt' else path


def native(path):
    value = str(path)
    if os.name != 'nt' or value.startswith('\\\\?\\'):
        return value
    return '\\\\?\\UNC\\' + value[2:] if value.startswith('\\\\') else '\\\\?\\' + value


def lstat(path):
    return os.stat(native(path), follow_symlinks=False)


def scandir(path):
    return os.scandir(native(path))


class Checkout:
    def __init__(self, path):
        self.path = path
        self.branch = text(path, 'symbolic-ref', '--quiet', '--short', 'HEAD', allowed=(0, 1)) or '(detached)'
        self.commit = text(path, 'rev-parse', '--verify', 'HEAD', allowed=(0, 128))
        names = git(path, 'ls-files', '--cached', '-z').decode('utf-8').split('\0')
        self.tracked = {normalize(n) for n in names if n}
        self.folders = {p for n in self.tracked for p in ancestors(n)}
        ignored = git(path, 'ls-files', '--others', '--ignored', '--exclude-standard',
                      '--directory', '-z').decode('utf-8').split('\0')
        self.ignored_files = {normalize(n) for n in ignored if n and not n.endswith('/')}
        self.ignored_folders = {normalize(n.rstrip('/')) for n in ignored if n.endswith('/')}
        self.empty = []

    def relative(self, path):
        return path.relative_to(self.path).as_posix()

    def ignored(self, relative):
        value = normalize(relative.rstrip('/'))
        return value in self.ignored_files or value in self.ignored_folders or any(
            p in self.ignored_folders for p in ancestors(value))

    def classification(self, path):
        relative = self.relative(path)
        value = normalize(relative)
        if relative == '.':
            return 'tracked' if self.tracked else 'untracked'
        if value in self.tracked or value in self.folders:
            return 'tracked'
        return 'ignored' if self.ignored(relative) else 'untracked'

    def ignored_build(self, path):
        relative = self.relative(path)
        if self.ignored(relative):
            return True
        answer = git(self.path, 'check-ignore', '--stdin', '-z',
                     data=(relative + '/\0').encode('utf-8'), allowed=(0, 1))
        return bool(answer)

    def classify_empty(self):
        if not self.empty:
            return
        names = [(self.relative(path) + '/', row) for path, row in self.empty]
        ignored = git(self.path, 'check-ignore', '--stdin', '-z',
                      data=''.join(name + '\0' for name, _ in names).encode('utf-8'), allowed=(0, 1))
        matches = {normalize(n.rstrip('/')) for n in ignored.decode('utf-8').split('\0') if n}
        for name, row in names:
            if normalize(name.rstrip('/')) in matches:
                row[2] = 'ignored'


def totals(directory):
    """Measure a collapsed subtree using enumeration and lstat only."""
    files, size, complete = 0, 0, True
    stack = [directory]
    while stack:
        path = stack.pop()
        try:
            if linked(lstat(path)):
                complete = False
                continue
            with scandir(path) as entries:
                for entry in entries:
                    if entry.name.casefold() == '.git':
                        continue
                    try:
                        info = entry.stat(follow_symlinks=False)
                        if stat.S_ISDIR(info.st_mode):
                            if linked(info):
                                complete = False
                            else:
                                stack.append(path / entry.name)
                        else:
                            files += 1
                            size += info.st_size
                    except OSError:
                        complete = False
        except OSError:
            complete = False
    return (files, size) if complete else (None, None)


def field(value):
    return '' if value is None else str(value).replace('\\', '\\\\').replace('\t', '\\t').replace('\r', '\\r').replace('\n', '\\n')


def collect(root):
    root = Path(root).resolve(strict=True)
    if not root.is_dir():
        raise InventoryError('Repositories root unavailable')
    rows, checkouts = [], []

    def walk(path, checkout):
        info = lstat(path)
        relative = path.relative_to(root).as_posix()
        directory = stat.S_ISDIR(info.st_mode)
        if directory and linked(info):
            rows.append([relative, 'collapsed', checkout.classification(path) if checkout else 'none', None, None, '', ''])
            return None, None
        if directory and ((path / '.git').is_dir() or (path / '.git').is_file()):
            checkout = Checkout(path)
            checkouts.append(checkout)
        kind = 'checkout' if directory and checkout and checkout.path == path else 'folder' if directory else 'file'
        state = checkout.classification(path) if checkout else 'none'
        branch, commit = (checkout.branch, checkout.commit) if kind == 'checkout' else ('', '')
        if not directory:
            if state != 'tracked':
                rows.append([relative, 'file', state, 1, info.st_size, '', ''])
            return 1, info.st_size
        ignored_build = path.name.casefold() in {'bin', 'obj'} and checkout and checkout.ignored_build(path)
        if ignored_build and state == 'untracked':
            state = 'ignored'
        if path.name.casefold() in COLLAPSE or ignored_build:
            count, size = totals(path)
            rows.append([relative, 'collapsed', state, count, size, '', ''])
            return count, size
        row = [relative, kind, state, 0, 0, branch, commit]
        rows.append(row)
        complete = True
        try:
            # Recheck before enumeration, including after any Git metadata calls.
            if linked(lstat(path)):
                raise OSError()
            with scandir(path) as entries:
                children = [path / e.name for e in entries if e.name.casefold() != '.git']
            for child in children:
                try:
                    count, size = walk(child, checkout)
                    if count is None or size is None:
                        complete = False
                    else:
                        row[3] += count
                        row[4] += size
                except OSError:
                    complete = False
        except OSError:
            if path == root:
                raise InventoryError('Repositories root unavailable')
            complete = False
        if not complete:
            row[3] = row[4] = None
        if row[3] == 0 and state == 'untracked' and checkout and kind != 'checkout':
            checkout.empty.append((path, row))
        return row[3], row[4]

    walk(root, None)
    for checkout in checkouts:
        checkout.classify_empty()
    rows.sort(key=lambda row: field(row[0]))
    body = (HEADER + ''.join('\t'.join(field(value) for value in row) + '\n' for row in rows)).encode('utf-8')
    counts = Counter('/'.join(row[0].split('/')[:3]) for row in rows if row[0] != '.')
    return body, {'lineCount': len(rows) + 1, 'bytes': len(body),
                  'unavailableTotals': sum(row[3] is None for row in rows),
                  'dominantPrefixes': [{'path': path, 'lines': count} for path, count in counts.most_common(10)]}


def approved_origin(repository):
    origin = text(repository, 'config', '--get', 'remote.origin.url')
    if origin.startswith('git@github.com:'):
        name = origin[len('git@github.com:'):]
    else:
        address = urlsplit(origin)
        if address.scheme not in ('https', 'ssh') or address.hostname != 'github.com' or address.password:
            return False
        name = address.path.lstrip('/')
    return name.rstrip('/').removesuffix('.git').casefold() == 'mehrlander/web-tools-private'


def tree(repository, revision):
    raw = git(repository, 'ls-tree', '-z', revision)
    return {entry.split(b'\t', 1)[1]: entry for entry in raw.split(b'\0') if entry}


def replace_file(repository, base, blob):
    root = tree(repository, base)
    state = root.get(b'state')
    if state and state.split(b' ', 2)[1] != b'tree':
        raise InventoryError('Inventory parent is not a tree')
    entries = tree(repository, state.split(b'\t', 1)[0].split(b' ')[2].decode()) if state else {}
    previous = entries.get(b'laptop-files.tsv')
    if previous and not previous.startswith(b'100644 blob '):
        raise InventoryError('Inventory destination is not a regular file')
    entries[b'laptop-files.tsv'] = b'100644 blob ' + blob.encode() + b'\tlaptop-files.tsv'
    state_tree = text(repository, 'mktree', '-z', data=b'\0'.join(entries.values()) + b'\0')
    root[b'state'] = b'040000 tree ' + state_tree.encode() + b'\tstate'
    return text(repository, 'mktree', '-z', data=b'\0'.join(root.values()) + b'\0')


def publish(root, repository=None, build=collect, clock=time.time):
    repository = Path(repository) if repository else Path(root) / 'web-tools-private'
    if not approved_origin(repository):
        raise InventoryError('Private inventory destination unavailable')
    body = summary = None
    for attempt in range(4):
        try:
            git(repository, 'fetch', '--quiet', '--no-tags', '--no-recurse-submodules', '--no-auto-maintenance',
                '--no-write-fetch-head', 'origin', '+refs/heads/background:refs/remotes/origin/background')
        except InventoryError:
            time.sleep(0.25 * (attempt + 1))
            continue
        base = text(repository, 'rev-parse', '--verify', 'refs/remotes/origin/background^{commit}')
        old = text(repository, 'rev-parse', '--verify', base + ':' + TARGET, allowed=(0, 128))
        if old:
            changed = text(repository, 'log', '-1', '--format=%ct', base, '--', TARGET)
            if changed and clock() < int(changed) + INTERVAL:
                return {'state': 'throttled', 'path': TARGET, 'retryAt': int(changed) + INTERVAL}
        if body is None:
            body, summary = build(root)
        blob = text(repository, 'hash-object', '--stdin', data=body)
        if blob == old:
            return {**summary, 'state': 'unchanged', 'path': TARGET}
        blob = text(repository, 'hash-object', '-w', '--stdin', data=body)
        new_tree = replace_file(repository, base, blob)
        commit = text(repository, 'commit-tree', new_tree, '-p', base,
                      data=b'Update laptop folder inventory\n\nCo-Authored-By: Codex <codex@openai.com>\n')
        if not re.fullmatch('[0-9a-f]{40}|[0-9a-f]{64}', commit):
            raise InventoryError('Inventory commit unavailable')
        try:
            git(repository, 'push', '--quiet', 'origin', commit + ':refs/heads/background')
            return {**summary, 'state': 'published', 'path': TARGET, 'commit': commit}
        except InventoryError:
            # Rebuild on the new parent without force-pushing or resetting a working branch.
            continue
    return {**(summary or {}), 'state': 'unavailable', 'path': TARGET}
