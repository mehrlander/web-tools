"""Observe checkouts, fetch explicit GitHub refs, and guard default-folder updates."""
import argparse
import base64
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import re
import shutil
import subprocess
import time
from urllib.parse import urlsplit

from repository_process import run_bounded
from repository_cache import discover_cached, load_comparisons, save_comparisons, load_legacy, MAX_COMMITS


def stamp():
    return datetime.now(timezone.utc).isoformat()


def key(value):
    return hashlib.sha256(value.encode('utf-8')).hexdigest()[:24]


def git(path, *args, timeout=20, strip=True):
    redirects = {'GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR', 'GIT_OBJECT_DIRECTORY',
                 'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_CEILING_DIRECTORIES', 'GIT_NAMESPACE',
                 'GIT_PREFIX', 'GIT_SUPER_PREFIX', 'GIT_REPLACE_REF_BASE', 'GIT_EXEC_PATH'}
    auth_name = 'WEBTOOLS_GITHUB_AUTH'
    env = {name: value for name, value in os.environ.items()
           if name.upper() not in redirects | {auth_name, 'GIT_CURL_VERBOSE'}
           and not name.upper().startswith(('GIT_CONFIG', 'GIT_TRACE'))}
    env.update(GIT_OPTIONAL_LOCKS='0', GIT_NO_LAZY_FETCH='1', GIT_TERMINAL_PROMPT='0',
               GCM_INTERACTIVE='Never', GH_PROMPT_DISABLED='1')
    try:
        seconds = float(timeout)
        if not math.isfinite(seconds) or seconds <= 0:
            return None
        deadline = time.monotonic() + seconds
        authentication = []
        network = any(command in args for command in ('ls-remote', 'fetch'))
        github_urls = {arg for arg in args if isinstance(arg, str) and arg.startswith('https://github.com/')}
        gh = shutil.which('gh') if network and github_urls else None
        if gh:
            # Avoid Git's shell + gh credential-helper chain on every HTTP
            # challenge. The credential exists only in this call's child env.
            credential = run_bounded([gh, 'auth', 'token', '--hostname', 'github.com'], env=env,
                                     timeout=deadline - time.monotonic(), max_output=4096)
            token = credential.stdout if credential is not None and credential.returncode == 0 else ''
            if not re.fullmatch(r'[!-~]{1,1024}(?:\r?\n)?', token):
                return None
            token = token.rstrip('\r\n')
            env[auth_name] = 'Authorization: Basic ' + base64.b64encode(('x-access-token:' + token).encode('ascii')).decode('ascii')
            # Trace2 ignores command-line config. Child target overrides prevent
            # system/global tracing from recording this environment.
            env.update(GIT_TRACE2='0', GIT_TRACE2_EVENT='0', GIT_TRACE2_PERF='0')
            authentication = ['-c', 'credential.helper=', '-c', 'http.followRedirects=false',
                              *[part for url in sorted(github_urls) for part in ('-c', 'http.' + url + '.followRedirects=false')],
                              '-c', 'http.https://github.com/.extraheader=',
                              '--config-env=http.https://github.com/.extraheader=' + auth_name]
        result = run_bounded(['git', '--no-optional-locks', '-c', 'core.fsmonitor=false',
                                 '-c', 'credential.interactive=never', *authentication, '-C', str(path), *args],
                                env=env, timeout=deadline - time.monotonic())
        return (result.stdout.strip() if strip else result.stdout) if result is not None and result.returncode == 0 else None
    except (OSError, ValueError, TypeError, subprocess.TimeoutExpired):
        return None
    finally:
        env.pop(auth_name, None)


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


def discover(root, folders=None):
    try:
        candidates = root.iterdir() if folders is None else (root / name for name in folders if Path(name).name == name and name not in ('.', '..'))
        paths = sorted(p for p in candidates if p.is_dir() and not p.is_symlink() and p.resolve().parent == root.resolve() and (p / '.git').exists())[:256]
    except OSError:
        return []
    def identify(path):
        name = github_name(git(path, 'config', '--get', 'remote.origin.url'))
        layout = git(path, 'rev-parse', '--path-format=absolute', '--git-common-dir', '--absolute-git-dir')
        parts = layout.splitlines() if layout else []
        common = parts[0] if parts else str(path)
        return {'path': path, 'repo': name, 'common': common, 'gitdir': parts[1] if len(parts) == 2 else None,
                'key': key(name.lower() if name else str(path.resolve()).lower())}
    with ThreadPoolExecutor(max_workers=4) as pool:
        return list(pool.map(identify, paths))


def local_status(entry, activity=False):
    path = entry['path']
    details = ('--ignored=matching', '--show-stash') if activity else ()
    row = {'key': key(str(path.resolve()).lower()), 'name': path.name[:256], 'branch': '', 'upstream': None,
           'changed': None, 'untracked': None, 'conflicts': None, 'head': None}
    if activity: row.update(ignored=None, stashes=None)
    if entry.get('_snapshotUnavailable') is True:
        return row
    status = git(path, 'status', '--porcelain=v2', '--branch', '--untracked-files=all', *details, timeout=30)
    if status is None:
        return row
    row.update(changed=0, untracked=0, conflicts=0)
    if activity: row.update(ignored=0, stashes=0)
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
        elif activity and line.startswith('! '):
            row['ignored'] += 1
        elif activity and line.startswith('# stash '):
            count = line[8:]
            row['stashes'] = int(count) if count.isdigit() else None
    if not row['upstream'] and row['branch'] and row['branch'] != '(detached)':
        remote = git(path, 'config', '--get', 'branch.' + row['branch'] + '.remote')
        merge = git(path, 'config', '--get', 'branch.' + row['branch'] + '.merge') or ''
        if remote == 'origin' and merge.startswith('refs/heads/'):
            row['upstream'] = 'origin/' + merge[len('refs/heads/'):]
    return row


def status_rows(entries):
    # These observations never authorize mutation. The updater still makes its
    # own fresh identity, clean-tree and activity checks before merging.
    with ThreadPoolExecutor(max_workers=4) as pool:
        return list(pool.map(local_status, entries))


def tracking_branch(row, source):
    if row['branch'] in source.get('tips', {}):
        return row['branch']
    if row['branch'] == '(detached)' and source.get('defaultBranch') in source.get('tips', {}):
        return source['defaultBranch']
    upstream = row['upstream'] or ''
    return upstream[7:] if upstream.startswith('origin/') else None


def pull_requests(repo, branches):
    gh = shutil.which('gh')
    if not gh or not branches:
        return None
    owner, name = repo.split('/')
    names = sorted(branches)[:128]
    fields = ['b' + str(i) + ': pullRequests(headRefName:' + json.dumps(branch)
              + ',first:10,states:[OPEN,CLOSED,MERGED],orderBy:{field:UPDATED_AT,direction:DESC})'
              + '{nodes{number title url state headRefName headRefOid headRepository{nameWithOwner}}}'
              for i, branch in enumerate(names)]
    query = 'query{repository(owner:' + json.dumps(owner) + ',name:' + json.dumps(name) + '){' + ' '.join(fields) + '}}'
    try:
        result = subprocess.run([gh, 'api', 'graphql', '--input', '-'], input=json.dumps({'query': query}),
                                capture_output=True, encoding='utf-8', errors='replace', timeout=25,
                                env={**os.environ, 'GH_PROMPT_DISABLED': '1', 'GIT_TERMINAL_PROMPT': '0'})
        if result.returncode or len(result.stdout) > 1_048_576:
            return None
        value = json.loads(result.stdout)
        if value.get('errors'):
            return None
        rows = value['data']['repository']
        found = {}
        for i, branch in enumerate(names):
            matches = [p for p in rows['b' + str(i)]['nodes'] if p.get('headRefName') == branch
                       and (p.get('headRepository') or {}).get('nameWithOwner', '').lower() == repo.lower()]
            pr = matches[0] if matches else None
            found[branch] = None if pr is None else {
                'number': pr['number'], 'title': pr['title'][:256], 'url': pr['url'],
                'state': pr['state'].lower(), 'head': pr['headRefOid']}
        return found
    except (OSError, ValueError, KeyError, TypeError, subprocess.TimeoutExpired):
        return None


def branch_status(entry, row, source, cache):
    branch, head = row['branch'], row['head']
    pr = source.get('pullRequests', {}).get(branch)
    reviewed = branch in source.get('pullRequests', {}) and bool(source.get('pullRequestsCheckedAt'))
    main = source.get('tips', {}).get(source.get('defaultBranch'))
    result = {'state': 'unknown', 'url': pr.get('url') if pr else None,
              'number': pr.get('number') if pr else None, 'title': pr.get('title') if pr else None,
              'pullRequestState': pr.get('state') if pr else None,
              'checkedAt': source.get('pullRequestsCheckedAt') if reviewed else None}
    if branch == source.get('defaultBranch'):
        result.update(state='main', checkedAt=source.get('checkedAt'))
        return result
    if pr and pr.get('state') == 'open':
        result['state'] = 'open'
        return result
    signature = [branch, head, main, pr.get('state') if pr else None, pr.get('head') if pr else None,
                 reviewed]
    cache_key = 'branch:' + row['key']
    old = cache.get(cache_key, {})
    if old.get('signature') == signature:
        result['state'] = old['state']
        return result
    in_main = head and main and (head == main or row['main']['ahead'] == 0
              or git(entry['path'], 'merge-base', '--is-ancestor', head, main) is not None)
    if branch == '(detached)' and in_main:
        result.update(state='snapshot', checkedAt=source.get('checkedAt'))
    elif pr and pr.get('state') == 'merged' and head and (in_main or head == pr.get('head')
            or git(entry['path'], 'merge-base', '--is-ancestor', head, pr.get('head', '')) is not None):
        result['state'] = 'merged'
    elif in_main:
        result.update(state='incorporated', checkedAt=source.get('checkedAt'))
    elif reviewed:
        result['state'] = 'review'
    if result['state'] != 'unknown':
        cache[cache_key] = {'signature': signature, 'state': result['state']}
    return result


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


def compare(entry, row, branch, source, cache):
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
    cache_key = row['key'] + ':' + key(branch)
    cached = cache.get(cache_key, {})
    if head and isinstance(cached, dict) and cached.get('head') == head and cached.get('tip') == tip and isinstance(cached.get('result'), dict):
        return cached['result']
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
        if counts and re.fullmatch(r'\d{1,10}\s+\d{1,10}', counts) and all(int(value) <= MAX_COMMITS for value in counts.split()):
            ahead, behind = map(int, counts.split())
            result.update(ahead=ahead, behind=behind, state='diverged' if ahead and behind else 'ahead' if ahead else 'behind' if behind else 'current')
        else:
            result['state'] = 'unavailable'
    if result['ahead'] is not None:
        cache[cache_key] = {'head': head, 'tip': tip, 'result': result}
    return result


def main_sync_observation(source, rows):
    """Project a bounded result only while its observed Git identity still matches."""
    value = source.get('mainSync')
    if not isinstance(value, dict) or value.get('state') not in ('current', 'updated', 'blocked', 'failed'):
        return None
    folder, reason = value.get('folder'), value.get('reason')
    if folder is not None and (not isinstance(folder, str) or not folder or len(folder) > 256
                               or folder in ('.', '..') or any(c in folder for c in '/\\\r\n\0')):
        return None
    if reason is not None and (not isinstance(reason, str) or not re.fullmatch(r'[a-z][a-z0-9-]{0,63}', reason)):
        return None
    def date(raw):
        try:
            parsed = datetime.fromisoformat(raw.replace('Z', '+00:00'))
            return raw if parsed.tzinfo and 2000 <= parsed.year <= 9999 else None
        except (AttributeError, TypeError, ValueError):
            return None
    checked = date(value.get('checkedAt'))
    updated = date(value.get('updatedAt')) if value.get('updatedAt') is not None else None
    if not checked or value.get('updatedAt') is not None and not updated:
        return None
    basis = source.get('mainSyncBasis')
    default = source.get('defaultBranch')
    current = next((row for row in rows if row['name'] == folder), None) if folder else None
    if isinstance(basis, dict):
        if basis.get('defaultBranch') != default or basis.get('target') != source.get('tips', {}).get(default):
            return None
        if folder and (current is None or current.get('branch') != basis.get('branch') or current.get('head') != basis.get('head')):
            return None
        if not folder and basis.get('defaultFolders') != sorted(row['name'] for row in rows if row['branch'] == default):
            return None
    elif value['state'] in ('current', 'updated'):
        return None
    if value['state'] in ('current', 'updated') and (not current or current['branch'] != default
                                                  or current.get('head') != source.get('tips', {}).get(default)):
        return None
    return {'state': value['state'], 'reason': reason, 'folder': folder, 'checkedAt': checked, 'updatedAt': updated}


def record_main_sync(entries, source, result):
    rows = status_rows(entries)
    current = next((row for row in rows if row['name'] == result.get('folder')), None)
    default = source.get('defaultBranch')
    source['mainSync'] = result
    source['mainSyncBasis'] = {'defaultBranch': default, 'target': source.get('tips', {}).get(default),
                              'branch': current.get('branch') if current else None,
                              'head': current.get('head') if current else None,
                              'defaultFolders': sorted(row['name'] for row in rows if row['branch'] == default)}


def failed_main_sync(entries, source, reason):
    previous = source.get('mainSync')
    previous = previous if isinstance(previous, dict) else {}
    record_main_sync(entries, source, {'state': 'failed', 'reason': reason, 'folder': previous.get('folder'),
                                      'checkedAt': stamp(), 'updatedAt': previous.get('updatedAt')})


def snapshot(root, state):
    entries = discover_cached(root, state, discover)
    legacy = load_legacy(state)
    def observe(entry):
        row = local_status(entry)
        cache = load_comparisons(state, row['key'], legacy)
        source = read_source(state, entry['key'])
        if entry.get('_snapshotUnavailable') is True:
            row['tracked'] = {'branch': None, 'state': 'unavailable', 'ahead': None, 'behind': None}
            row['main'] = {'branch': None, 'state': 'unavailable', 'ahead': None, 'behind': None}
            row['branchStatus'] = {'state': 'unknown', 'url': None, 'number': None, 'title': None,
                                   'pullRequestState': None, 'checkedAt': None}
        else:
            row['tracked'] = compare(entry, row, tracking_branch(row, source), source, cache)
            row['main'] = compare(entry, row, source.get('defaultBranch'), source, cache) if source.get('defaultBranch') else {
                'branch': None, 'state': 'not-checked', 'ahead': None, 'behind': None}
            row['branchStatus'] = branch_status(entry, row, source, cache)
        keys = {'branch:' + row['key'], row['key'] + ':' + key(tracking_branch(row, source) or ''),
                row['key'] + ':' + key(source.get('defaultBranch') or '')}
        save_comparisons(state, row['key'], {name: cache[name] for name in keys if name in cache})
        return entry, row, source
    groups, sources = {}, {}
    with ThreadPoolExecutor(max_workers=4) as pool:
        for entry, row, source in pool.map(observe, entries):
            group = groups.setdefault(entry['key'], {'key': entry['key'], 'name': entry['repo'] or entry['path'].name,
                'url': 'https://github.com/' + entry['repo'] if entry['repo'] else None,
                'checkedAt': source.get('checkedAt'), 'attemptedAt': source.get('attemptedAt'),
                'notice': source.get('notice'), 'checkouts': []})
            sources.setdefault(entry['key'], source)
            group['checkouts'].append(row)
    for repo_key, group in groups.items():
        group['mainSync'] = main_sync_observation(sources[repo_key], group['checkouts'])
        for row in group['checkouts']:
            row.pop('head', None)
    return {'schemaVersion': 1, 'machineName': os.environ.get('COMPUTERNAME', 'Lenovo'), 'observedAt': stamp(),
            'repositories': sorted(groups.values(), key=lambda g: g['name'].lower()), 'refreshing': [],
            'notice': None if root.is_dir() else 'Repositories folder unavailable.'}


def fetch_repository(root, state, repo_key, folders=None, *, update_main=False):
    if not isinstance(repo_key, str) or not re.fullmatch(r'[0-9a-f]{24}', repo_key):
        return False
    entries = [entry for entry in discover(root, folders) if entry['key'] == repo_key and entry['repo']]
    if not entries:
        if update_main:
            source = read_source(state, repo_key)
            previous = source.get('mainSync')
            previous = previous if isinstance(previous, dict) else {}
            at = stamp()
            source['attemptedAt'] = at
            source['mainSync'] = {'state': 'failed', 'reason': 'git-unavailable', 'folder': None,
                                  'checkedAt': at, 'updatedAt': previous.get('updatedAt')}
            source.pop('mainSyncBasis', None)
            write_source(state, repo_key, source)
        return False
    source = read_source(state, repo_key)
    source['attemptedAt'] = stamp()
    repo = entries[0]['repo']
    # Reconstruct a GitHub URL: credentials and arbitrary configured URLs cannot
    # become a phone-supplied command or appear in API output.
    url = 'https://github.com/' + repo + '.git'
    branches = set()
    for status in status_rows(entries):
        if status['branch'] and status['branch'] != '(detached)':
            branches.add(status['branch'])
        upstream = status['upstream'] or ''
        if upstream.startswith('origin/'):
            branches.add(upstream[7:])
    refs = git(entries[0]['path'], 'ls-remote', '--symref', url, 'HEAD', *['refs/heads/' + b for b in sorted(branches)], timeout=25)
    if refs is None:
        source['notice'] = 'GitHub check failed. Showing the last successful comparison.'
        if update_main: failed_main_sync(entries, source, 'fetch-failed')
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
        if update_main: failed_main_sync(entries, source, 'fetch-failed')
        write_source(state, repo_key, source)
        return False
    tips[default] = head
    def validate_tip(item):
        branch, _sha = item
        return item if git(entries[0]['path'], 'check-ref-format', 'refs/heads/' + branch) is not None else None
    with ThreadPoolExecutor(max_workers=4) as pool:
        safe = dict(item for item in pool.map(validate_tip, tips.items()) if item is not None)
    if default not in safe:
        source['notice'] = 'GitHub default branch could not be validated.'
        if update_main: failed_main_sync(entries, source, 'fetch-failed')
        write_source(state, repo_key, source)
        return False
    success, seen = True, set()
    for entry in entries:
        if entry['common'] in seen:
            continue
        seen.add(entry['common'])
        # Explicit destinations are remote-tracking refs only. Configured
        # fetch refspecs, tags, submodules, pruning and maintenance are excluded.
        result = git(entry['path'], 'fetch', '--no-tags', '--no-prune', '--no-prune-tags', '--no-write-fetch-head', '--no-recurse-submodules',
                     '--no-auto-maintenance', '--refmap=', url,
                     *['+refs/heads/' + b + ':refs/remotes/origin/' + b for b in sorted(safe)], timeout=60)
        success = success and result is not None
    source.update(checkedAt=stamp(), defaultBranch=default, tips=safe,
                  notice=None if success else 'GitHub checked; some Git data could not be fetched. Counts may be unavailable.')
    if update_main:
        if success:
            try:
                from repository_sync import sync_default
                record_main_sync(entries, source, sync_default(entries, source, state, git))
            except (ImportError, OSError, ValueError, TypeError, subprocess.TimeoutExpired):
                failed_main_sync(entries, source, 'update-unavailable')
        else:
            failed_main_sync(entries, source, 'fetch-failed')
    reviews = pull_requests(repo, branches - {default})
    if reviews is not None:
        source.update(pullRequests=reviews, pullRequestsCheckedAt=stamp())
    write_source(state, repo_key, source)
    return success


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--state', type=Path, required=True)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--fetch', dest='fetch_key')
    parser.add_argument('--checkout', action='append')
    parser.add_argument('--update-main', action='store_true')
    mode.add_argument('--local-files', action='store_true')
    mode.add_argument('--publish-lenovo-files', '--publish-laptop-files', dest='publish_lenovo_files', action='store_true')
    args = parser.parse_args()
    if args.update_main and not args.fetch_key:
        parser.error('--update-main requires --fetch')
    if args.publish_lenovo_files:
        from lenovo_inventory import InventoryError, publish
        # Preserve Activity within the worker budget before the slower file walk.
        try:
            from local_activity import run
            activity = run(args.root, args.state, Path.home(), push=True)
        except (InventoryError, OSError, ValueError, subprocess.TimeoutExpired):
            activity = {'state': 'unavailable'}
        try:
            value = publish(args.root)
        except (InventoryError, OSError, ValueError, subprocess.TimeoutExpired):
            value = {'state': 'unavailable', 'path': 'state/lenovo-files.tsv'}
        value['activity'] = activity
        print(json.dumps(value))
        return
    if args.local_files:
        from local_files import inventories
        print(json.dumps(inventories(discover(args.root), git, key)))
    elif args.fetch_key:
        if not re.fullmatch(r'[a-f0-9]{24}', args.fetch_key):
            raise SystemExit(2)
        success = fetch_repository(args.root, args.state, args.fetch_key, args.checkout, update_main=args.update_main)
        print(json.dumps({'fetched': success, 'automaticMain': args.update_main}))
    else:
        print(json.dumps(snapshot(args.root, args.state)))


if __name__ == '__main__':
    main()
