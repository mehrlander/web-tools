"""Preserve captured evidence across shortened sources and publication races.

The source record is authoritative for speaker classification. Older prose
without provenance is retained as unclassified legacy evidence, rather than
silently promoted to an owner prompt. A provider's full identity pins the
existing archive path. The same merge runs against local staged evidence and
the fetched publication tip; neither path changes a repository checkout.
"""
from collections import Counter
from contextlib import closing
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import re
import sqlite3

import local_sessions

ROW_LISTS = ('prompts', 'replies', 'calls', 'injected', 'thinking', 'responses',
             'attachments', 'events', 'usage_ledger', 'tool_results', 'turns',
             'source_revisions', 'legacy_entries', 'outcomes')
RECORD_PATH = re.compile(r'^sessions/\d{4}/\d{2}/\d{4}-\d{2}-\d{2}-([0-9a-f]{16})\.json$')


def encode(value):
    return (json.dumps(value, ensure_ascii=True, sort_keys=True) + '\n').encode('utf-8')


def digest(value):
    return hashlib.sha256(encode(value)).hexdigest()


def identity(record):
    return record.get('assistant') or record.get('engine'), record.get('session_id')


def row_key(row, collection=''):
    if not isinstance(row, dict):
        return ('value', digest(row))
    if collection in ('attachments', 'thinking', 'relationships', 'outcomes'):
        return ('value', digest(row))
    for key in ('id', 'item_id', 'response_id'):
        if row.get(key):
            return (key, str(row[key]))
    for key in ('source_item', 'source_id'):
        if row.get(key):
            return (key, str(row[key]), str(row.get('name', '')), str(row.get('type', '')))
    return ('value', digest(row))


def order(row):
    if not isinstance(row, dict):
        return (float('-inf'), -1, digest(row))
    at = local_sessions.time_key(row.get('at'))
    ordinal = row.get('ordinal')
    return (at, ordinal if isinstance(ordinal, (int, float)) else -1, str(row_key(row)))


def union(prior, current, collection=''):
    rows = {row_key(row, collection): deepcopy(row) for row in prior or []}
    carried = len(set(rows) - {row_key(row, collection) for row in current or []})
    rows.update({row_key(row, collection): deepcopy(row) for row in current or []})
    return sorted(rows.values(), key=order), carried


def merge(prior, current):
    """Union durable evidence, keeping current source classifications intact."""
    if not prior:
        return deepcopy(current)
    if identity(prior) != identity(current) or prior.get('short') != current.get('short'):
        raise ValueError('Captured session identity does not match the existing record')
    if prior.get('format') == local_sessions.FORMAT and current.get('format') != local_sessions.FORMAT:
        raise ValueError('A prose-only capture cannot replace an evidence record')
    def freshness(record):
        metadata = (record.get('source_metadata') or {}).get('catalog') or record.get('source_catalog') or {}
        updated = metadata.get('updated_at_ms') or metadata.get('updated_at') or metadata.get('last_modified_time')
        return (local_sessions.time_key(updated or record.get('ended')),
                local_sessions.time_key((record.get('capture') or {}).get('captured_at')))
    if prior.get('format') == current.get('format') == local_sessions.FORMAT and freshness(prior) > freshness(current):
        result = merge(current, prior)
        result['day'] = prior['day']
        result.setdefault('capture', {})['captured_at'] = prior.get('capture', {}).get('captured_at')
        return result
    result = deepcopy(current)
    result['day'] = prior['day']
    result['started'] = min(prior.get('started') or current['started'], current['started'], key=local_sessions.time_key)
    result['ended'] = max(prior.get('ended') or current['ended'], current['ended'], key=local_sessions.time_key)
    carried = {}
    revisions = list(prior.get('source_revisions') or [])
    fresh_items = {row_key(row): row for row in current.get('source_items') or []}
    for row in prior.get('source_items') or []:
        fresh = fresh_items.get(row_key(row))
        if fresh is not None and digest(row.get('data')) != digest(fresh.get('data')):
            revision = deepcopy(row)
            revision['item_id'] = row.get('id')
            revision['id'] = str(row.get('id') or 'source') + ':prior:' + digest(row)[:16]
            revisions.append(revision)
    result['source_items'], count = union(prior.get('source_items'), current.get('source_items'))
    if count:
        carried['source_items'] = count
    old_format = prior.get('format') != local_sessions.FORMAT
    obsolete = {str(row['id']) for row in current.get('source_items') or []
                if row.get('latest') is False}
    obsolete.update(str(row['supersedes']) for row in current.get('source_items') or [] if row.get('supersedes'))
    candidate_sources = {str(r.get(k)) for field in ROW_LISTS for r in current.get(field) or []
                         if isinstance(r, dict) for k in ('item_id', 'source_item', 'source_id') if r.get(k)}
    legacy = list(prior.get('legacy_entries') or [])
    for field in ROW_LISTS:
        previous = prior.get(field) or []
        if field == 'source_revisions':
            previous = revisions
        if old_format and field in ('prompts', 'replies'):
            # A legacy text reader did not establish origin or inherited context.
            # Retain unmatched prose without making it an owner exchange.
            known = {(r.get('at'), r.get('text')) for name in ('prompts', 'replies', 'injected')
                     for r in current.get(name) or [] if isinstance(r, dict)}
            compatible = prior.get('capture', {}).get('source') == 'history-database' and result.get('kind') == 'user'
            restored = []
            for row in previous:
                if (row.get('at'), row.get('text')) not in known:
                    if compatible:
                        restored.append({**row, 'source_legacy': True,
                                         'provenance': {'basis': 'prior-history-projection',
                                                        'kind': 'user' if field == 'prompts' else 'assistant'}})
                    else:
                        legacy.append({'collection': field, 'classification': 'unverified', **row})
            previous = restored
        elif field in ('prompts', 'replies', 'injected'):
            # Reclassification of an existing item supersedes its old projection.
            own = {str(r.get(k)) for r in current.get(field) or [] if isinstance(r, dict)
                   for k in ('item_id', 'source_item', 'source_id') if r.get(k)}
            previous = [r for r in previous if not isinstance(r, dict) or not any(
                str(r.get(k)) in candidate_sources - own for k in ('item_id', 'source_item', 'source_id') if r.get(k))]
        if field != 'source_revisions':
            previous = [r for r in previous if not isinstance(r, dict) or not any(
                str(r.get(key)) in obsolete for key in ('id', 'source_item', 'source_id') if r.get(key))]
        if field in ('prompts', 'replies'):
            exact = {(local_sessions.time_key(r.get('at')), r.get('text')) for r in current.get(field) or []}
            previous = [r for r in previous if not r.get('source_legacy') or
                        (local_sessions.time_key(r.get('at')), r.get('text')) not in exact]
        merged, count = union(previous, current.get(field), field)
        if merged or field in current or field in prior:
            result[field] = merged
        if count:
            carried[field] = count
    if legacy:
        result['legacy_entries'], _ = union(legacy, result.get('legacy_entries'))
    result['repos'], _ = union(prior.get('repos'), current.get('repos'))
    result['relationships'], _ = union(prior.get('relationships'), current.get('relationships'), 'relationships')
    result['models'] = sorted(set(prior.get('models') or []) | set(current.get('models') or []))
    for key in ('parent',):
        if not result.get(key) and prior.get(key):
            result[key] = deepcopy(prior[key])
    if result.get('kind') == 'unknown' and prior.get('kind'):
        result['kind'] = prior['kind']
    result['files'] = deepcopy(prior.get('files') or {})
    for path, facts in (current.get('files') or {}).items():
        if isinstance(facts, dict):
            old = result['files'].get(path) or {}
            result['files'][path] = {key: max(old.get(key, 0), value) for key, value in {**old, **facts}.items()}
        else:
            result['files'][path] = facts
    capture = result.setdefault('capture', {})
    if carried:
        capture['retained_from_prior'] = carried
    if carried.get('source_items'):
        capture['state'] = 'partial'
        capture['gaps'], _ = union(capture.get('gaps'),
                                  ['Earlier source items retained from a prior capture'])
    recalculate(result)
    # Polling an unchanged source does not create one commit per observation.
    def content(record):
        value = deepcopy(record)
        cap = value.get('capture') or {}
        cap.pop('captured_at', None)
        cap.pop('retained_from_prior', None)
        return value
    if content(result) == content(prior):
        return deepcopy(prior)
    return result


def recalculate(record):
    prompts, replies = record.get('prompts') or [], record.get('replies') or []
    record.update(opening_ask=prompts[0].get('text', '') if prompts else '',
                  exchanges=len(prompts), prompts_stored=len(prompts),
                  replies_total=len(replies), replies_stored=len(replies),
                  assistant_messages=len(replies))
    if record.get('calls'):
        record['tools'] = dict(Counter(row.get('name', 'unknown') for row in record['calls']))
    if 'calls' in record:
        record['failures'] = sum(row.get('ok') is False for row in record['calls'])
    for field, counter in (('calls', 'calls_total'), ('injected', 'injected_total'),
                           ('thinking', 'thinking_total'), ('attachments', 'attachments_total')):
        if field in record:
            record[counter] = len(record[field])
    if isinstance(record.get('usage'), dict) and 'ledger_records' in record['usage']:
        record['usage']['ledger_records'] = len(record.get('usage_ledger') or [])
    omissions = Counter()
    def notes(value):
        if isinstance(value, list):
            for child in value:
                notes(child)
        elif isinstance(value, dict):
            if value.get('omitted') in ('media_bytes', 'encrypted_content'):
                omissions[value['omitted']] += 1
            else:
                for child in value.values():
                    notes(child)
    for field in ('source_items', 'source_revisions', 'source_catalog', 'source_metadata'):
        notes(record.get(field))
    capture = record.setdefault('capture', {})
    capture['omissions'] = {**capture.get('omissions', {}), **dict(omissions)}


def connect(state):
    folder = Path(state) / 'local-sessions'
    folder.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(folder / 'captured.sqlite', timeout=30)
    with conn:
        conn.execute('begin immediate')
        conn.execute('create table if not exists captured(provider text, session_id text, body blob, primary key(provider,session_id))')
        fields = {row[1] for row in conn.execute('pragma table_info(captured)')}
        for field in ('body_digest', 'published_digest', 'summary'):
            if field not in fields:
                conn.execute('alter table captured add column ' + field + ' ' + ('blob' if field == 'summary' else 'text'))
    return conn


def summary(path, record):
    return {'id': record['short'], 'provider': record['assistant'], 'title': record['title'],
            'ended': record['ended'], 'capture': record['capture'], 'kind': record.get('kind'),
            'parent': record.get('parent'), 'path': path, 'repos': record.get('repos') or []}


def stage(records, state):
    """Save evidence outside the checkout before attempting publication."""
    found = []
    # This database belongs to the collector, separate from provider stores.
    # BEGIN IMMEDIATE serializes the read/union/write across worker processes.
    with closing(connect(state)) as conn:
        for path, current in records:
            if path != local_sessions.record_path(current):
                raise ValueError('Candidate path does not match its session identity')
            with conn:
                conn.execute('begin immediate')
                collision = conn.execute('select provider,session_id from captured where json_extract(cast(summary as text),\'$.id\')=?',
                                         (current['short'],)).fetchone()
                if collision and tuple(collision) != identity(current):
                    raise ValueError('Captured join key belongs to another staged session')
                previous = conn.execute('select body,body_digest from captured where provider=? and session_id=?', identity(current)).fetchone()
                record = merge(json.loads(previous[0]) if previous else None, current)
                recalculate(record)
                body = encode(record)
                if not previous or previous[0] != body or not previous[1]:
                    conn.execute('insert into captured(provider,session_id,body,body_digest,summary) values(?,?,?,?,?) '
                                 'on conflict(provider,session_id) do update set body=excluded.body, '
                                 'body_digest=excluded.body_digest,summary=excluded.summary',
                                 (*identity(current), body, hashlib.sha256(body).hexdigest(),
                                  encode(summary(local_sessions.record_path(record), record))))
            found.append((local_sessions.record_path(record), record))
    return found


def summaries(state):
    with closing(connect(state)) as conn:
        return [json.loads(row[0]) for row in conn.execute('select summary from captured where summary is not null')]


def pending(state, max_records=16, max_bytes=32 * 1024 * 1024):
    """Yield bounded publication batches, closing the read before networking.

    A single large record travels alone. Collection limits never discard any
    portion of that record. Unacknowledged entries survive a provider deletion
    or disappearance from the next collection window.
    """
    after = 0
    while True:
        batch, size = [], 0
        with closing(connect(state)) as conn:
            for rowid, body, sha in conn.execute(
                    'select rowid,body,body_digest from captured where rowid>? '
                    'and (published_digest is null or body_digest!=published_digest) order by rowid limit ?',
                    (after, max_records)):
                if batch and size + len(body) > max_bytes:
                    break
                record = json.loads(body)
                batch.append((local_sessions.record_path(record), record, sha or hashlib.sha256(body).hexdigest()))
                size += len(body)
                after = rowid
        if not batch:
            return
        yield batch


def acknowledge(state, batch):
    """A newer staged revision stays pending if an older publish finishes."""
    with closing(connect(state)) as conn, conn:
        for _, record, sha in batch:
            conn.execute('update captured set published_digest=? where provider=? and session_id=? and body_digest=?',
                         (sha, *identity(record), sha))


def prior_records(repository, revision, records, git):
    """Read requested identities at one Git revision through a single batch."""
    wanted = {record['short'] for _, record in records}
    identities = {record['short']: identity(record) for _, record in records}
    if len(identities) != len({identity(record) for _, record in records}):
        raise ValueError('Captured join keys collide across session identities')
    objects = []
    tree = git(repository, 'ls-tree', '-rz', revision, '--', 'sessions')
    for line in tree.split(b'\0'):
        if not line:
            continue
        meta, path_bytes = line.split(b'\t', 1)
        path = path_bytes.decode('utf-8')
        match = RECORD_PATH.fullmatch(path)
        if match and match[1] in wanted:
            parts = meta.split()
            if parts[1] != b'blob':
                raise ValueError('Session path does not name a blob')
            objects.append((parts[2].decode(), path))
    if not objects:
        return {}
    bodies = git(repository, 'cat-file', '--batch', data=''.join(oid + '\n' for oid, _ in objects).encode())
    position, found = 0, {}
    for oid, path in objects:
        end = bodies.index(b'\n', position)
        header = bodies[position:end].split()
        if len(header) != 3 or header[0].decode() != oid or header[1] != b'blob':
            raise ValueError('Captured source blob unavailable')
        size = int(header[2])
        position = end + 1
        value = json.loads(bodies[position:position + size])
        position += size + 1
        key = identity(value)
        if local_sessions.record_path(value) != path:
            raise ValueError('Existing archive path does not match its record identity')
        if identities.get(value.get('short')) != key:
            raise ValueError('Captured join key belongs to another session identity')
        if key in found:
            raise ValueError('Session identity has multiple existing archive paths')
        found[key] = path, value
    return found


def reconcile(repository, revision, records, git):
    if len({path for path, _ in records}) != len(records):
        raise ValueError('Multiple candidates name the same archive path')
    prior = prior_records(repository, revision, records, git)
    found = []
    for path, current in records:
        previous = prior.get(identity(current))
        if previous:
            path, old = previous
            current = merge(old, current)
        found.append((path, current))
    if len({path for path, _ in found}) != len(found):
        raise ValueError('Reconciled sessions name the same archive path')
    return found
