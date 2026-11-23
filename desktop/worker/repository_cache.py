"""Private observation caches. Mutating and inventory discovery never use these.

Discovery identities expire after fifteen minutes and are invalidated by known
filesystem/config inputs. External include inputs remain bounded by that TTL.
Each checkout owns its atomic record so an interrupted or concurrent scan cannot
discard completed work for a different checkout. No URLs or Git diagnostics are
stored here; filesystem paths remain private and never join the phone DTO.
"""
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import stat
import tempfile
import time


TTL_SECONDS = 15 * 60
MAX_RECORD = 65_536
MAX_COMMITS = 2**31 - 1  # RepositoryComparison's nullable Int32 contract.
KEY = re.compile(r'^[0-9a-f]{24}$')
SHA = re.compile(r'^[0-9a-f]{40}(?:[0-9a-f]{24})?$')


def _key(value):
    return hashlib.sha256(value.encode('utf-8')).hexdigest()[:24]


def _normal(path):
    return os.path.normcase(str(Path(path).resolve()))


def _stamp(path):
    try:
        row = Path(path).lstat()
        if stat.S_ISLNK(row.st_mode) or getattr(row, 'st_file_attributes', 0) & 0x400:
            return None
        if stat.S_ISDIR(row.st_mode):
            # Ordinary files, refs and lock churn do not change Git identity.
            # Directory replacement still changes its device/inode/type.
            return [row.st_dev, row.st_ino, stat.S_IFMT(row.st_mode)]
        return [row.st_dev, row.st_ino, row.st_mode, row.st_size, row.st_mtime_ns, row.st_ctime_ns]
    except FileNotFoundError:
        return ['missing']


def _plain(path):
    return Path(path).is_dir() and all(_stamp(parent) is not None for parent in (Path(path), *Path(path).parents))


def _pointer(path):
    if not path.is_file() or _stamp(path) is None or path.stat().st_size > 4096:
        raise ValueError()
    value = path.read_text(encoding='utf-8').strip()
    if not value or '\0' in value or '\n' in value or '\r' in value:
        raise ValueError()
    return value


def _layout(path):
    marker = path / '.git'
    if marker.is_dir():
        gitdir = marker
    else:
        text = _pointer(marker)
        if not text.startswith('gitdir: '):
            raise ValueError()
        gitdir = path / text[8:]
    gitdir = gitdir.resolve()
    common_pointer = gitdir / 'commondir'
    common = (gitdir / _pointer(common_pointer)).resolve() if common_pointer.exists() else gitdir
    if not _plain(gitdir) or not _plain(common):
        raise ValueError()
    return gitdir, common


def _local_directory(base, value):
    """True directory, False proven broken, None unsupported/unreadable alias."""
    if os.name == 'nt' and (value.startswith(('\\\\', '//', '\\', '/')) or re.match(r'^[A-Za-z]:[^\\/]', value)):
        return None
    target = Path(os.path.abspath(base / value))
    try:
        for part in (*reversed(target.parents), target):
            try:
                row = part.lstat()
            except (FileNotFoundError, NotADirectoryError):
                return False
            if stat.S_ISLNK(row.st_mode) or getattr(row, 'st_file_attributes', 0) & 0x400:
                return None
            if not stat.S_ISDIR(row.st_mode):
                return False
        return True
    except OSError:
        return None


def _broken_layout(path):
    """Only prove missing local Git administration, never infer idle or validity."""
    try:
        if not _plain(path):
            return None
        marker = path / '.git'
        signature = _stamp(marker)
        if signature is None:
            return None
        if marker.is_dir():
            gitdir = marker
        elif marker.is_file():
            text = _pointer(marker)
            if not text.startswith('gitdir: '):
                return None
            target = _local_directory(path, text[8:])
            if target is not True:
                return True if target is False else None
            gitdir = Path(os.path.abspath(path / text[8:]))
        else:
            return None
        common_pointer = gitdir / 'commondir'
        if not common_pointer.exists():
            return False
        value = _pointer(common_pointer)
        target = _local_directory(gitdir, value)
        return True if target is False else False if target is True else None
    except (OSError, ValueError, TypeError):
        return None


def _global_inputs():
    profile = Path.home()
    home = Path(os.environ.get('HOME') or profile)
    xdg = Path(os.environ.get('XDG_CONFIG_HOME') or home / '.config')
    paths = {profile / '.gitconfig', home / '.gitconfig', xdg / 'git' / 'config'}
    if os.name == 'nt':
        paths.add(Path(os.environ.get('PROGRAMDATA') or 'C:/ProgramData') / 'Git' / 'config')
        executable = shutil.which('git')
        if executable:
            prefix = Path(executable).parent.parent
            if prefix.name.lower() in ('usr', 'mingw64', 'mingw32'):
                prefix = prefix.parent
            paths.add(prefix / 'etc' / 'gitconfig')
    else:
        paths.add(Path('/etc/gitconfig'))
    return paths


def _basis(root, path):
    if not _plain(root) or not _plain(path) or path.resolve().parent != root.resolve():
        raise ValueError()
    gitdir, common = _layout(path)
    inputs = {root, path, path / '.git', gitdir, common, gitdir / 'commondir',
              common / 'config', common / 'config.worktree', gitdir / 'config.worktree', *_global_inputs()}
    signatures = [[_normal(item), _stamp(item)] for item in sorted(inputs, key=lambda item: _normal(item))]
    if any(value is None for _name, value in signatures):
        raise ValueError()
    return {'root': _normal(root), 'path': _normal(path), 'gitdir': _normal(gitdir),
            'common': _normal(common), 'inputs': signatures}


def _read(path, limit=MAX_RECORD):
    try:
        if not path.is_file() or _stamp(path) is None or not _plain(path.parent) or path.stat().st_size > limit:
            return None
        with path.open('rb') as stream:
            value = stream.read(limit + 1)
        return json.loads(value.decode('utf-8')) if len(value) <= limit else None
    except (OSError, ValueError, TypeError, UnicodeError):
        return None


def _write(path, value):
    temporary = None
    try:
        data = (json.dumps(value, separators=(',', ':')) + '\n').encode('utf-8')
        if len(data) > MAX_RECORD:
            return False
        path.parent.mkdir(parents=True, exist_ok=True)
        if not _plain(path.parent):
            return False
        with tempfile.NamedTemporaryFile(prefix=path.stem + '.', suffix='.tmp', dir=path.parent, delete=False) as stream:
            temporary = Path(stream.name)
            stream.write(data)
        temporary.replace(path)
        return True
    except (OSError, ValueError, TypeError):
        return False
    finally:
        if temporary is not None:
            try:
                temporary.unlink(missing_ok=True)
            except OSError:
                pass


def discover_cached(root, state, fresh_discover):
    """Only snapshot() calls this. Every miss returns a fresh result, never stale."""
    root, state = Path(root), Path(state)
    try:
        paths = sorted(path for path in root.iterdir() if path.is_dir() and not path.is_symlink()
                       and path.resolve().parent == root.resolve() and (path / '.git').exists())[:256]
    except OSError:
        return []

    def identify(path):
        broken = _broken_layout(path)
        if broken is True:
            return {'path': path, 'repo': None, 'common': str(path), 'gitdir': None,
                    'key': _key(str(path.resolve()).lower()), '_snapshotUnavailable': True}
        if broken is None:
            return next((entry for entry in fresh_discover(root, [path.name]) if Path(entry['path']) == path), None)
        target = state / 'repository-discovery' / (_key(_normal(root) + '\0' + path.name) + '.json')
        now, before = time.time(), None
        try:
            before = _basis(root, path)
            record = _read(target)
            if (isinstance(record, dict) and type(record.get('version')) is int and record['version'] == 1
                    and isinstance(record.get('createdAt'), (int, float)) and not isinstance(record['createdAt'], bool)
                    and 0 < record['createdAt'] <= now and now - record['createdAt'] < TTL_SECONDS and record.get('basis') == before
                    and isinstance(record.get('repo'), str) and re.fullmatch(r'[A-Za-z0-9_.-]{1,100}/[A-Za-z0-9_.-]{1,100}', record['repo'])
                    and record.get('key') == _key(record['repo'].lower())):
                return {'path': path, 'repo': record['repo'], 'common': before['common'],
                        'gitdir': before['gitdir'], 'key': record['key']}
        except (OSError, ValueError, TypeError):
            pass
        entries = fresh_discover(root, [path.name])
        entry = next((entry for entry in entries if Path(entry['path']) == path), None)
        if entry is None:
            return None
        try:
            after = _basis(root, path)
            if (before == after and isinstance(entry.get('repo'), str)
                    and re.fullmatch(r'[A-Za-z0-9_.-]{1,100}/[A-Za-z0-9_.-]{1,100}', entry['repo'])
                    and entry.get('key') == _key(entry['repo'].lower()) and entry.get('gitdir')
                    and _normal(entry['common']) == after['common'] and _normal(entry['gitdir']) == after['gitdir']):
                _write(target, {'version': 1, 'createdAt': time.time(), 'basis': after, 'repo': entry['repo'], 'key': entry['key']})
        except (OSError, ValueError, TypeError, KeyError):
            pass
        return entry

    with ThreadPoolExecutor(max_workers=4) as pool:
        return [entry for entry in pool.map(identify, paths) if entry is not None]


def _branch(value):
    return isinstance(value, str) and 0 < len(value) <= 256 and not value.startswith(('/', '\\')) and ':' not in value and '\0' not in value


def _comparisons(owner, values):
    if not isinstance(values, dict) or len(values) > 16:
        return {}
    result = {}
    for key, row in values.items():
        if not isinstance(row, dict):
            continue
        if key == 'branch:' + owner:
            signature = row.get('signature')
            if (set(row) == {'signature', 'state'} and row['state'] in ('snapshot', 'incorporated', 'merged', 'review')
                    and isinstance(signature, list) and len(signature) == 6 and _branch(signature[0])
                    and all(value is None or isinstance(value, str) and SHA.fullmatch(value) for value in (signature[1], signature[2], signature[4]))
                    and signature[3] in (None, 'open', 'closed', 'merged') and isinstance(signature[5], bool)):
                result[key] = row
        elif key.startswith(owner + ':') and KEY.fullmatch(key[len(owner) + 1:]):
            value = row.get('result')
            if (set(row) == {'head', 'tip', 'result'} and all(isinstance(row.get(name), str) and SHA.fullmatch(row[name]) for name in ('head', 'tip'))
                    and isinstance(value, dict) and set(value) == {'branch', 'state', 'ahead', 'behind'} and _branch(value['branch'])
                    and key == owner + ':' + _key(value['branch']) and value['state'] in ('current', 'ahead', 'behind', 'diverged')
                    and all(type(value[name]) is int and 0 <= value[name] <= MAX_COMMITS for name in ('ahead', 'behind'))):
                expected = 'diverged' if value['ahead'] and value['behind'] else 'ahead' if value['ahead'] else 'behind' if value['behind'] else 'current'
                if value['state'] == expected:
                    result[key] = row
    return result


def load_comparisons(state, owner, legacy=None):
    if not isinstance(owner, str) or not KEY.fullmatch(owner):
        return {}
    result = _comparisons(owner, {key: value for key, value in (legacy or {}).items() if key == 'branch:' + owner or key.startswith(owner + ':')})
    value = _read(Path(state) / 'repository-observations' / (owner + '.json'))
    if isinstance(value, dict) and type(value.get('version')) is int and value['version'] == 1 and value.get('key') == owner and 'entries' in value:
        result.update(_comparisons(owner, value['entries']))
    return result


def save_comparisons(state, owner, values):
    if not isinstance(owner, str) or not KEY.fullmatch(owner):
        return False
    return _write(Path(state) / 'repository-observations' / (owner + '.json'),
                  {'version': 1, 'key': owner, 'entries': _comparisons(owner, values)})


def load_legacy(state):
    value = _read(Path(state) / 'repository-comparisons.json', limit=2_097_152)
    return value if isinstance(value, dict) and len(value) <= 1024 else {}
