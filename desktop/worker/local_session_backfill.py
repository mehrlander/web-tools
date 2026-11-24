"""Prepare a local-session backfill and a content-free reconciliation report.

The default writes candidate session files under --out and reads prior records
at one immutable revision of --store. It never publishes by default. --publish
uses the collector's identity-checked, race-aware publisher after writing the
preview. Provider stores remain read-only in both modes.
"""
import argparse
from collections import Counter
import json
from pathlib import Path

import lenovo_inventory as inventory
import local_activity
import local_session_collect as collector
import local_session_store as store
import local_sessions
import repositories


def collect(root, profile, providers=('codex', 'gemini'), limit=None, legacy=True):
    roots = [('repositories', Path(root), 4), ('code', Path(profile) / 'Code', 2)]
    if legacy:
        roots.append(('threads', Path(profile) / 'Documents/Codex', 5))
    checkouts, _, complete = local_activity.discover(roots)
    for checkout in checkouts:
        checkout['repo'] = repositories.github_name(repositories.git(checkout['path'], 'config', '--get', 'remote.origin.url'))
    identities, coverage, hints = {}, [], []
    for provider in providers:
        found, status = collector.catalog(profile, provider)
        identities[provider] = found[:limit] if limit is not None else found
        hints.extend(('', {'assistant': provider, 'session_id': identity,
                           'short': local_sessions.short_id(provider, identity)})
                     for identity in identities[provider])
        coverage.append(status)
    return (collector.iter_records(profile, checkouts, providers, identities=identities),
            {'checkouts_complete': complete, 'providers': coverage, 'selected': len(hints)}, hints)


class PriorRecords:
    """Index one frozen tree, loading only the prior body being reconciled.

    The index contains object IDs and paths, never parsed conversation bodies.
    Reading each blob by its indexed object ID also avoids following a branch
    that moved after the tree inventory was taken.
    """
    def __init__(self, repository, revision, hints=None, git=None):
        self.repository = repository
        self.git = git or inventory.git
        self.expected = None
        if hints is not None:
            self.expected = {}
            for _, hint in hints:
                short, key = hint['short'], store.identity(hint)
                if short in self.expected and self.expected[short] != key:
                    raise ValueError('Captured join keys collide across session identities')
                self.expected[short] = key
        self.objects = {}
        tree = self.git(repository, 'ls-tree', '-rz', revision, '--', 'sessions')
        for line in tree.split(b'\0'):
            if not line:
                continue
            meta, path_bytes = line.split(b'\t', 1)
            path = path_bytes.decode('utf-8')
            match = store.RECORD_PATH.fullmatch(path)
            if not match or (self.expected is not None and match[1] not in self.expected):
                continue
            parts = meta.split()
            if len(parts) != 3 or parts[1] != b'blob':
                raise ValueError('Session path does not name a blob')
            self.objects.setdefault(match[1], []).append((parts[2].decode(), path))

    def read(self, candidate):
        short, key = candidate['short'], store.identity(candidate)
        if self.expected is not None and self.expected.get(short) != key:
            raise ValueError('Candidate join key belongs to another selected session identity')
        objects = self.objects.get(short, [])
        if not objects:
            return None
        if len(objects) != 1:
            raise ValueError('Session identity has multiple existing archive paths')
        oid, path = objects[0]
        value = json.loads(self.git(self.repository, 'cat-file', 'blob', oid))
        if not isinstance(value, dict) or local_sessions.record_path(value) != path:
            raise ValueError('Existing archive path does not match its record identity')
        if value.get('short') != short or store.identity(value) != key:
            raise ValueError('Captured join key belongs to another session identity')
        return path, value


def prepare(records, repository, revision, output, coverage=None, prior=None, retain=True, on_record=None):
    if prior is None:
        prior = PriorRecords(repository, revision) if repository else {}
    output = Path(output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    report = {'format': 'local-backfill/1', 'source_revision': revision,
              'coverage': coverage or {}, 'records': 0, 'new': 0,
              'changed': 0, 'unchanged': 0, 'bytes': 0,
              'providers': {}, 'kinds': {}, 'gaps': {}, 'omissions': {}}
    kinds, providers, gaps, omissions = Counter(), Counter(), Counter(), Counter()
    prepared, paths, joins = [], {}, {}
    for path, candidate in records:
        if path != local_sessions.record_path(candidate):
            raise ValueError('Candidate path does not match its session identity')
        key = store.identity(candidate)
        if candidate['short'] in joins and joins[candidate['short']] != key:
            raise ValueError('Candidate join keys collide across identities')
        joins[candidate['short']] = key
        previous = prior.read(candidate) if isinstance(prior, PriorRecords) else prior.get(store.identity(candidate))
        if previous:
            path, old = previous
            candidate = store.merge(old, candidate)
            store.recalculate(candidate)
            report['unchanged' if candidate == old else 'changed'] += 1
        else:
            store.recalculate(candidate)
            report['new'] += 1
        if not store.RECORD_PATH.fullmatch(path):
            raise ValueError('Unapproved candidate path')
        if path in paths:
            raise ValueError('Multiple candidates name the same archive path')
        paths[path] = key
        target = (output / path).resolve()
        if not target.is_relative_to(output):
            raise ValueError('Candidate path leaves the output directory')
        target.parent.mkdir(parents=True, exist_ok=True)
        body = store.encode(candidate)
        target.write_bytes(body)
        report['records'] += 1
        report['bytes'] += len(body)
        providers[candidate['assistant']] += 1
        kinds[candidate['kind']] += 1
        capture = candidate.get('capture') or {}
        gaps.update(gap if isinstance(gap, str) else json.dumps(gap, sort_keys=True)
                    for gap in capture.get('gaps') or [])
        omissions.update(capture.get('omissions') or {})
        if retain:
            prepared.append((path, candidate))
        if on_record:
            on_record(path, candidate)
    report.update(providers=dict(providers), kinds=dict(kinds), gaps=dict(gaps), omissions=dict(omissions))
    report['not_produced'] = max(0, report['coverage'].get('selected', report['records']) - report['records'])
    (output / 'report.json').write_bytes(store.encode(report))
    return prepared, report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, required=True, help='GitHub checkout estate')
    parser.add_argument('--profile', type=Path, default=Path.home())
    parser.add_argument('--store', type=Path, help='Existing captured-session checkout; read through Git objects')
    parser.add_argument('--revision', default='origin/main', help='Prior record revision, frozen once at startup')
    parser.add_argument('--out', type=Path, required=True, help='Private candidate directory outside the provider stores')
    parser.add_argument('--provider', choices=('all', 'codex', 'gemini'), default='all')
    parser.add_argument('--limit', type=int, help='Optional newest-thread sample; omitted means full reconciliation')
    parser.add_argument('--no-legacy', action='store_true', help='Exclude old Documents/Codex checkout associations')
    parser.add_argument('--publish', action='store_true', help='Explicitly publish after preparing the preview; requires --store')
    args = parser.parse_args()
    if args.publish and not args.store:
        parser.error('--publish requires --store')
    if args.limit is not None and args.limit < 1:
        parser.error('--limit must be positive')
    output = args.out.resolve()
    for folder in (args.profile / '.codex', args.profile / '.gemini'):
        if output == folder.resolve() or output.is_relative_to(folder.resolve()):
            parser.error('--out must be outside provider stores')
    revision = inventory.text(args.store, 'rev-parse', args.revision) if args.store else None
    providers = ('codex', 'gemini') if args.provider == 'all' else (args.provider,)
    records, coverage, hints = collect(args.root, args.profile, providers, args.limit, not args.no_legacy)
    prior = PriorRecords(args.store, revision, hints) if args.store else {}
    def stage(path, record):
        store.stage([(path, record)], args.out / 'publication')
    _, report = prepare(records, args.store, revision, args.out, coverage, prior=prior,
                        retain=False, on_record=stage if args.publish else None)
    if args.publish:
        published = 0
        for batch in store.pending(args.out / 'publication'):
            local_activity.publish(args.store, {p: store.encode(r) for p, r, _ in batch},
                                   'main', 'Backfill local session evidence')
            store.acknowledge(args.out / 'publication', batch)
            published += len(batch)
        report['published'] = published
    print(json.dumps(report, sort_keys=True))


if __name__ == '__main__':
    main()
