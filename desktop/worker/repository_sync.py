"""Fast-forward one clean, idle default-branch folder after a verified fetch.

The OS lock serializes companion updaters, not uncooperative editors. Every
mutation is preceded by fresh identity, ref, operation, clean and activity checks.
"""
from contextlib import contextmanager
from bisect import bisect_left
from datetime import datetime, timezone
import hashlib
import os
from pathlib import Path
import re
import stat
from urllib.parse import urlsplit

import workspace_activity


REASONS = frozenset((
    'fetch-failed', 'update-unavailable', 'fetch-stale', 'invalid-source',
    'no-default-worktree', 'ambiguous-default-worktree', 'identity-changed',
    'refs-changed', 'git-unavailable', 'git-operation', 'updater-busy',
    'local-changes', 'index-flags', 'sparse-checkout', 'local-commits',
    'history-unavailable', 'active-session', 'activity-unavailable',
    'activity-uncertain', 'merge-failed', 'verification-failed',
    'post-update-changes', 'ignored-collision'))
MAX_ENTRIES = 256
FETCH_SECONDS = 300
SHA = re.compile(r'^[0-9a-f]{40}(?:[0-9a-f]{24})?$')


class Blocked(Exception):
    def __init__(self, reason):
        self.reason = reason


def _stamp():
    return datetime.now(timezone.utc).isoformat()


def _date(value):
    try:
        date = datetime.fromisoformat(value.replace('Z', '+00:00')) if isinstance(value, str) else None
        return date.astimezone(timezone.utc) if date and date.tzinfo else None
    except (ValueError, OverflowError):
        return None


def _name(remote):
    if not isinstance(remote, str):
        return None
    if remote.startswith('git@github.com:'):
        name = remote[len('git@github.com:'):]
    else:
        try:
            uri = urlsplit(remote)
            if uri.scheme not in ('https', 'ssh') or uri.hostname != 'github.com' or uri.query or uri.fragment:
                return None
            name = uri.path.lstrip('/')
        except ValueError:
            return None
    name = name.rstrip('/').removesuffix('.git')
    return name.casefold() if re.fullmatch(r'[A-Za-z0-9_.-]{1,100}/[A-Za-z0-9_.-]{1,100}', name) else None


def _plain(path):
    path = Path(path)
    try:
        if not path.is_dir():
            return False
        # Junctions and symlinks also require an explicit operator decision.
        return not any(_reparse(parent) for parent in (path, *path.parents))
    except OSError:
        return False


def _reparse(path):
    return path.is_symlink() or bool(getattr(path.lstat(), 'st_file_attributes', 0) & getattr(stat, 'FILE_ATTRIBUTE_REPARSE_POINT', 0x400))


def _file_id(path):
    row = Path(path).stat()
    if not row.st_ino:
        raise Blocked('identity-changed')
    return (row.st_dev, row.st_ino)


def _same(left, right):
    try:
        return os.path.normcase(str(Path(left).resolve())) == os.path.normcase(str(Path(right).resolve()))
    except (OSError, ValueError, TypeError):
        return False


@contextmanager
def _lock(state, common):
    state = Path(state)
    state.mkdir(parents=True, exist_ok=True)
    if not _plain(state):
        raise Blocked('update-unavailable')
    digest = hashlib.sha256(os.path.normcase(str(Path(common).resolve())).encode('utf-8')).hexdigest()[:32]
    path = state / ('main-update-' + digest + '.lock')
    if path.exists() and _reparse(path):
        raise Blocked('update-unavailable')
    flags = os.O_CREAT | os.O_RDWR | getattr(os, 'O_NOFOLLOW', 0)
    descriptor = os.open(path, flags, 0o600)
    stream = os.fdopen(descriptor, 'r+b')
    acquired = False
    try:
        # A retained one-byte file avoids unlink/recreate races between updaters.
        if os.fstat(stream.fileno()).st_size == 0:
            stream.write(b'0')
            stream.flush()
        stream.seek(0)
        try:
            if os.name == 'nt':
                import msvcrt
                msvcrt.locking(stream.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(stream.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            acquired = True
        except (OSError, BlockingIOError):
            raise Blocked('updater-busy') from None
        yield
    finally:
        if acquired:
            stream.seek(0)
            if os.name == 'nt':
                import msvcrt
                msvcrt.locking(stream.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                import fcntl
                fcntl.flock(stream.fileno(), fcntl.LOCK_UN)
        stream.close()


def _identity(entry, branch, git):
    path = Path(entry['path'])
    dotgit = path / '.git'
    if not _plain(path) or not dotgit.exists() or _reparse(dotgit):
        raise Blocked('identity-changed')
    metadata = git(path, 'rev-parse', '--show-toplevel', '--path-format=absolute', '--git-common-dir', '--absolute-git-dir', '--abbrev-ref', 'HEAD')
    values = metadata.splitlines() if isinstance(metadata, str) else []
    if len(values) != 4:
        raise Blocked('git-unavailable')
    root, common, gitdir, current = values
    head = git(path, 'rev-parse', '--verify', 'HEAD^{commit}')
    origin = git(path, 'config', '--get', 'remote.origin.url')
    if any(value is None for value in (head, origin)):
        raise Blocked('git-unavailable')
    expected_repo = _name('https://github.com/' + str(entry.get('repo')))
    if not expected_repo or not _plain(common) or not _plain(gitdir) or not _same(root, path) or not _same(common, entry.get('common')) or current != branch or _name(origin) != expected_repo:
        raise Blocked('identity-changed')
    if not SHA.fullmatch(head):
        raise Blocked('git-unavailable')
    return {'head': head, 'common': common, 'gitdir': gitdir, 'origin': origin,
            'files': tuple(_file_id(item) for item in (path, dotgit, Path(common), Path(gitdir)))}


def _operations(identity, branch):
    common, gitdir = Path(identity['common']), Path(identity['gitdir'])
    markers = ('index.lock', 'HEAD.lock', 'MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD',
               'BISECT_LOG', 'rebase-merge', 'rebase-apply', 'sequencer', 'locked')
    if any((gitdir / marker).exists() for marker in markers):
        raise Blocked('git-operation')
    markers = ('packed-refs.lock', 'config.lock', 'shallow.lock', 'refs/heads/' + branch + '.lock', 'refs/remotes/origin/' + branch + '.lock')
    if any((common / marker).exists() for marker in markers):
        raise Blocked('git-operation')


def _clean(path, git):
    status = git(path, 'status', '--porcelain=v2', '--untracked-files=all', '--ignore-submodules=none', timeout=20)
    if status is None:
        raise Blocked('git-unavailable')
    if status:
        raise Blocked('local-changes')
    flags = git(path, 'ls-files', '-v', '-z', strip=False, timeout=20)
    if flags is None:
        raise Blocked('git-unavailable')
    if any(row and (row[0] == 'S' or row[0].islower()) for row in flags.split('\x00')):
        raise Blocked('index-flags')
    sparse = git(path, 'config', '--bool', 'core.sparseCheckout')
    if sparse == 'true':
        raise Blocked('sparse-checkout')


def _activity(path, profile, activity_probe, state=None):
    try:
        result = activity_probe(path, profile) if activity_probe is not None else workspace_activity.probe(path, profile, state=state)
    except Exception:
        raise Blocked('activity-unavailable') from None
    if not isinstance(result, dict) or result.get('allow') is not True:
        reason = result.get('reason') if isinstance(result, dict) else None
        raise Blocked(reason if reason in workspace_activity.REASONS else 'activity-uncertain')


def _ignored(path, head, target, git):
    incoming = git(path, 'diff', '--name-only', '-z', '--diff-filter=ACRT', head, target, '--', strip=False, timeout=20)
    ignored = git(path, 'ls-files', '--others', '--ignored', '--exclude-standard', '--directory', '-z', strip=False, timeout=20)
    if incoming is None or ignored is None:
        raise Blocked('git-unavailable')
    # File names only. Account for both file/directory replacement directions.
    names = sorted({(name.casefold() if os.name == 'nt' else name).rstrip('/') for name in ignored.split('\x00') if name})
    known = set(names)
    for name in incoming.split('\x00'):
        name = name.casefold() if os.name == 'nt' else name
        parts = name.split('/')
        prefixes = ('/'.join(parts[:index]) for index in range(1, len(parts) + 1))
        index = bisect_left(names, name + '/')
        if name and (any(prefix in known for prefix in prefixes) or index < len(names) and names[index].startswith(name + '/')):
            raise Blocked('ignored-collision')


def sync_default(entries, source, state, git, *, profile=None, activity_probe=None):
    """Return safe status metadata. The caller must have just fetched source refs."""
    now = datetime.now(timezone.utc)
    previous = source.get('mainSync', {}) if isinstance(source, dict) else {}
    previous_date = _date(previous.get('updatedAt')) if isinstance(previous, dict) else None
    updated = previous_date.isoformat() if previous_date and previous_date <= now else None
    result = {'state': 'blocked', 'reason': None, 'folder': None, 'checkedAt': now.isoformat(), 'updatedAt': updated}
    mutation_started = False
    try:
        redirects = ('GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR',
                     'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES',
                     'GIT_CEILING_DIRECTORIES', 'GIT_NAMESPACE', 'GIT_PREFIX',
                     'GIT_SUPER_PREFIX', 'GIT_REPLACE_REF_BASE', 'GIT_EXEC_PATH')
        if any(name.upper() in redirects or name.upper().startswith('GIT_CONFIG') for name in os.environ):
            raise Blocked('update-unavailable')
        if not isinstance(source, dict) or not isinstance(entries, (list, tuple)) or not entries or len(entries) > MAX_ENTRIES:
            raise Blocked('invalid-source')
        checked = _date(source.get('checkedAt'))
        if checked is None or not -30 <= (now - checked).total_seconds() <= FETCH_SECONDS:
            raise Blocked('fetch-stale')
        branch = source.get('defaultBranch')
        tips = source.get('tips')
        target = tips.get(branch) if isinstance(tips, dict) and isinstance(branch, str) else None
        if not isinstance(branch, str) or not branch or len(branch) > 256 or branch.startswith('-') or not isinstance(target, str) or not SHA.fullmatch(target):
            raise Blocked('invalid-source')
        candidates = []
        for entry in entries:
            if not isinstance(entry, dict) or not _plain(entry.get('path', '')):
                raise Blocked('identity-changed')
            current = git(entry['path'], 'rev-parse', '--abbrev-ref', 'HEAD')
            if current is None:
                raise Blocked('git-unavailable')
            if current == branch:
                candidates.append(entry)
        if len(candidates) != 1:
            raise Blocked('no-default-worktree' if not candidates else 'ambiguous-default-worktree')
        entry = candidates[0]
        path = Path(entry['path'])
        result['folder'] = path.name[:256]
        if git(path, 'check-ref-format', 'refs/heads/' + branch) is None:
            raise Blocked('invalid-source')
        initial = _identity(entry, branch, git)
        with _lock(state, initial['common']):
            _operations(initial, branch)
            if git(path, 'rev-parse', '--verify', 'refs/remotes/origin/' + branch + '^{commit}') != target:
                raise Blocked('refs-changed')
            _clean(path, git)
            if initial['head'] == target:
                result.update(state='current', reason=None)
                return result
            if git(path, 'rev-parse', '--is-shallow-repository') != 'false':
                raise Blocked('history-unavailable')
            if git(path, 'merge-base', '--is-ancestor', initial['head'], target) is None:
                counts = git(path, 'rev-list', '--left-right', '--count', initial['head'] + '...' + target)
                raise Blocked('local-commits' if counts and re.fullmatch(r'\d+\s+\d+', counts) and int(counts.split()[0]) else 'history-unavailable')
            _activity(path, profile, activity_probe, state)
            # Revalidate after provider reads, which can take longer than Git reads.
            latest = _identity(entry, branch, git)
            if latest != initial:
                raise Blocked('identity-changed')
            if git(path, 'rev-parse', '--verify', 'refs/remotes/origin/' + branch + '^{commit}') != target:
                raise Blocked('refs-changed')
            _operations(latest, branch)
            _clean(path, git)
            _ignored(path, initial['head'], target, git)
            _activity(path, profile, activity_probe, state)
            if (datetime.now(timezone.utc) - checked).total_seconds() > FETCH_SECONDS:
                raise Blocked('fetch-stale')
            # Status and ignored-path enumeration can be slow. A branch switch
            # during those reads must not redirect the merge into another branch.
            final = _identity(entry, branch, git)
            if final != initial:
                raise Blocked('identity-changed')
            if git(path, 'rev-parse', '--verify', 'refs/remotes/origin/' + branch + '^{commit}') != target:
                raise Blocked('refs-changed')
            _operations(final, branch)
            mutation_started = True
            merged = git(path, '-c', 'merge.autoStash=false', '-c', 'submodule.recurse=false', 'merge',
                         '--ff-only', '--no-autostash', '--no-overwrite-ignore', target, timeout=90)
            after = _identity(entry, branch, git)
            if any(after[key] != initial[key] for key in ('common', 'gitdir', 'origin', 'files')):
                result.update(state='failed', reason='identity-changed')
                return result
            if after['head'] != target:
                result.update(state='failed', reason='merge-failed' if merged is None and after['head'] == initial['head'] else 'verification-failed')
                return result
            result.update(state='updated', reason=None, updatedAt=_stamp())
            try:
                _operations(after, branch)
                _clean(path, git)
            except Blocked:
                result.update(state='blocked', reason='post-update-changes')
            if merged is None and result['state'] == 'updated':
                result.update(state='failed', reason='merge-failed')
    except Blocked as error:
        result.update(state='failed' if mutation_started else 'blocked', reason=error.reason)
    except (OSError, ValueError, TypeError, KeyError):
        result.update(state='failed', reason='update-unavailable')
    result['checkedAt'] = _stamp()
    return result
