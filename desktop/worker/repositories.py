"""Observe local checkouts; fetch only explicit GitHub remote-tracking refs."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
from urllib.parse import urlsplit


def stamp():
    return datetime.now(timezone.utc).isoformat()


def key(value):
    return hashlib.sha256(value.encode('utf-8')).hexdigest()[:24]


def git(path, *args, timeout=8):
    env = {**os.environ, 'GIT_OPTIONAL_LOCKS': '0', 'GIT_TERMINAL_PROMPT': '0', 'GCM_INTERACTIVE': 'Never'}
    try:
        result = subprocess.run(['git', '--no-optional-locks', '-c', 'core.fsmonitor=false',
                                 '-c', 'credential.interactive=never', '-C', str(path), *args],
                                env=env, capture_output=True, encoding='utf-8', errors='replace', timeout=timeout)
        return result.stdout.strip() if result.returncode == 0 and len(result.stdout) <= 4_194_304 else None
    except (OSError, subprocess.TimeoutExpired):
        return None


def github_name(remote):
    if not remote:
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
    return name if re.fullmatch(r'[A-Za-z0-9_.-]{1,100}/[A-Za-z0-9_.-]{1,100}', name) else None


def discover(root):
    try:
        paths = sorted(p for p in root.iterdir() if p.is_dir() and not p.is_symlink() and (p / '.git').exists())[:256]
    except OSError:
        return []
    def identify(path):
        name = github_name(git(path, 'config', '--get', 'remote.origin.url'))
        common = git(path, 'rev-parse', '--path-format=absolute', '--git-common-dir')
        return {'path': path, 'repo': name, 'common': common or str(path), 'key': key(name.lower() if name else str(path.resolve()).lower())}
    with ThreadPoolExecutor(max_workers=4) as pool:
        return list(pool.map(identify, paths))


def local_status(entry):
    path = entry['path']
    status = git(path, 'status', '--porcelain=v2', '--branch', '--untracked-files=all', timeout=12)
    row = {'key': key(str(path.resolve()).lower()), 'name': path.name[:128], 'branch': '', 'upstream': None,
           'changed': None, 'untracked': None, 'conflicts': None, 'head': None}
    if status is None:
        return row
    row.update(changed=0, untracked=0, conflicts=0)
    for line in status.splitlines():
        if line.startswith('# branch.oid '):
            row['head'] = line[13:]
        elif line.startswith('# branch.head '):
            row['branch'] = line[14:][:256]
        elif line.startswith('# branch.upstream '):
            row['upstream'] = line[18:][:256]
        elif line.startswith(('1 ', '2 ', 'u ')):
            row['changed'] += 1
            row['conflicts'] += line.startswith('u ')
        elif line.startswith('? '):
            row['untracked'] += 1
    return row


def read_source(state, repo_key):
    try:
        value = json.loads((state / 'repository-sources' / (repo_key + '.json')).read_text(encoding='utf-8'))
        return value if isinstance(value, dict) else {}
    except (OSError, ValueError):
        return {}


def write_source(state, repo_key, value):
    target = state / 'repository-sources' / (repo_key + '.json')
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix('.tmp')
    temporary.write_text(json.dumps(value) + '\n', encoding='utf-8')
    temporary.replace(target)


def compare(entry, row, branch, source):
    result = {'branch': branch, 'state': 'not-checked', 'ahead': None, 'behind': None}
    if not branch:
        result['state'] = 'no-upstream'
        return result
    if not source.get('checkedAt'):
        return result
    tip = source.get('tips', {}).get(branch)
    if not tip:
        result['state'] = 'remote-missing'
        return result
    head = row['head']
    if not head or not re.fullmatch(r'[a-f0-9]{40,64}', head) or not re.fullmatch(r'[a-f0-9]{40,64}', tip):
        result['state'] = 'unavailable'
    elif head == tip:
        result.update(state='current', ahead=0, behind=0)
    elif git(entry['path'], 'rev-parse', '--is-shallow-repository') == 'true':
        result['state'] = 'incomplete-history'
    elif git(entry['path'], 'cat-file', '-e', tip + '^{commit}') is None:
        result['state'] = 'fetch-needed'
    elif git(entry['path'], 'merge-base', head, tip) is None:
        result['state'] = 'incomplete-history' if git(entry['path'], 'rev-parse', '--is-shallow-repository') == 'true' else 'unrelated-history'
    else:
        counts = git(entry['path'], 'rev-list', '--left-right', '--count', head + '...' + tip)
        if counts and re.fullmatch(r'\d+\s+\d+', counts):
            ahead, behind = map(int, counts.split())
            result.update(ahead=ahead, behind=behind, state='diverged' if ahead and behind else 'ahead' if ahead else 'behind' if behind else 'current')
        else:
            result['state'] = 'unavailable'
    return result


def snapshot(root, state):
    entries = discover(root)
    def observe(entry):
        row = local_status(entry)
        source = read_source(state, entry['key'])
        upstream = row['upstream'] or ''
        row['tracked'] = compare(entry, row, upstream[7:] if upstream.startswith('origin/') else None, source)
        row['main'] = compare(entry, row, source.get('defaultBranch'), source)
        row.pop('head')
        return entry, row, source
    groups = {}
    with ThreadPoolExecutor(max_workers=4) as pool:
        for entry, row, source in pool.map(observe, entries):
            group = groups.setdefault(entry['key'], {'key': entry['key'], 'name': entry['repo'] or entry['path'].name,
                'url': 'https://github.com/' + entry['repo'] if entry['repo'] else None,
                'checkedAt': source.get('checkedAt'), 'attemptedAt': source.get('attemptedAt'),
                'notice': source.get('notice'), 'checkouts': []})
            group['checkouts'].append(row)
    return {'schemaVersion': 1, 'machineName': os.environ.get('COMPUTERNAME', 'Laptop'), 'observedAt': stamp(),
            'repositories': sorted(groups.values(), key=lambda g: g['name'].lower()), 'refreshing': [],
            'notice': None if root.is_dir() else 'Repositories folder unavailable.'}


def fetch_repository(root, state, repo_key):
    entries = [entry for entry in discover(root) if entry['key'] == repo_key and entry['repo']]
    if not entries:
        return False
    source = read_source(state, repo_key)
    source['attemptedAt'] = stamp()
    repo = entries[0]['repo']
    # Reconstruct a GitHub URL: credentials and arbitrary configured URLs cannot
    # become a phone-supplied command or appear in API output.
    url = 'https://github.com/' + repo + '.git'
    branches = set()
    for entry in entries:
        upstream = local_status(entry)['upstream'] or ''
        if upstream.startswith('origin/'):
            branches.add(upstream[7:])
    refs = git(entries[0]['path'], 'ls-remote', '--symref', url, 'HEAD', *['refs/heads/' + b for b in sorted(branches)], timeout=25)
    if refs is None:
        source['notice'] = 'GitHub check failed. Showing the last successful comparison.'
        write_source(state, repo_key, source)
        return False
    default, head, tips = None, None, {}
    for line in refs.splitlines():
        if '\t' not in line:
            continue
        value, name = line.split('\t', 1)
        if name == 'HEAD' and value.startswith('ref: refs/heads/'):
            default = value[len('ref: refs/heads/'):]
        elif re.fullmatch(r'[a-f0-9]{40,64}', value):
            if name == 'HEAD':
                head = value
            elif name.startswith('refs/heads/'):
                tips[name[len('refs/heads/'):]] = value
    if not default or not head:
        source['notice'] = 'GitHub default branch unavailable. Showing the last comparison.'
        write_source(state, repo_key, source)
        return False
    tips[default] = head
    safe = {b: sha for b, sha in tips.items() if git(entries[0]['path'], 'check-ref-format', 'refs/heads/' + b) is not None}
    success, seen = True, set()
    for entry in entries:
        if entry['common'] in seen:
            continue
        seen.add(entry['common'])
        # Explicit destinations are remote-tracking refs only. Configured
        # fetch refspecs, tags, submodules, pruning and maintenance are excluded.
        result = git(entry['path'], 'fetch', '--no-tags', '--no-write-fetch-head', '--no-recurse-submodules',
                     '--no-auto-maintenance', '--refmap=', url,
                     *['+refs/heads/' + b + ':refs/remotes/origin/' + b for b in sorted(safe)], timeout=60)
        success = success and result is not None
    source.update(checkedAt=stamp(), defaultBranch=default, tips=safe,
                  notice=None if success else 'GitHub checked; some Git data could not be fetched. Counts may be unavailable.')
    write_source(state, repo_key, source)
    return success


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--state', type=Path, required=True)
    parser.add_argument('--fetch', dest='fetch_key')
    args = parser.parse_args()
    if args.fetch_key:
        if not re.fullmatch(r'[a-f0-9]{24}', args.fetch_key):
            raise SystemExit(2)
        fetch_repository(args.root, args.state, args.fetch_key)
    else:
        print(json.dumps(snapshot(args.root, args.state)))


if __name__ == '__main__':
    main()
