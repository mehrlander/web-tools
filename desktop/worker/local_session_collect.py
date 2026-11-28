"""Stream local source records and rotate a bounded durable collection pass."""
from contextlib import closing
import json
from pathlib import Path
import sqlite3
import time

import local_session_store as store
import local_sessions

PROVIDERS = ('codex', 'gemini')
RECENT = 8


def catalog(profile, provider):
    """Freeze source identities without loading conversation payloads."""
    profile = Path(profile)
    if provider == 'codex':
        path = local_sessions.latest(profile / '.codex', 'state_*.sqlite')
        table, identity, updated = 'threads', 'id', 'updated_at'
    elif provider == 'gemini':
        path = profile / '.gemini/antigravity/conversation_summaries.db'
        table, identity, updated = 'conversation_summaries', 'conversation_id', 'last_modified_time'
    else:
        raise ValueError('Unknown local session provider')
    coverage = {'provider': provider, 'catalog': 0, 'state': 'unavailable'}
    if not path or not path.is_file():
        return [], coverage
    with closing(local_sessions.database(path)) as conn:
        fields = {row[1] for row in conn.execute('pragma table_info(' + table + ')')}
        if identity not in fields:
            return [], {**coverage, 'error': 'catalog identity column unavailable'}
        order = updated + ' desc,' + identity if updated in fields else identity
        identities = [row[0] for row in conn.execute('select ' + identity + ' from ' + table + ' order by ' + order)
                      if isinstance(row[0], str)]
    return identities, {**coverage, 'catalog': len(identities), 'state': 'ready'}


def _reader(provider):
    if provider == 'codex':
        from codex_sessions import capture
    elif provider == 'gemini':
        from gemini_sessions import capture
    else:
        raise ValueError('Unknown local session provider')
    return capture


def iter_records(profile, checkouts, providers=PROVIDERS, limit=None, identities=None):
    """Yield one parsed thread at a time from a frozen identity inventory."""
    for provider in providers:
        selected = identities.get(provider, []) if isinstance(identities, dict) else identities
        if selected is None:
            selected, _ = catalog(profile, provider)
        selected = list(dict.fromkeys(selected))
        if limit is not None:
            selected = selected[:max(0, int(limit))]
        reader = _reader(provider)
        for identity in selected:
            records, _ = reader(profile, checkouts, limit=None, identities=[identity])
            for path, record in records:
                yield path, record


def _next(values, previous, attempted):
    if not values:
        return None
    start = values.index(previous) + 1 if previous in values else 0
    for offset in range(len(values)):
        value = values[(start + offset) % len(values)]
        if value not in attempted:
            return value
    return None


def collect(profile, checkouts, state, limit=32, budget_seconds=60):
    """Stage one thread at a time; check the cooperative budget between threads.

    A separate collector-owned SQLite transaction serializes cursor movement
    while source parsing and the durable evidence store use other connections.
    An interrupted pass can repeat work, but cannot advance past an unattempted
    source. Recent and older lanes alternate so frequent new work does not
    indefinitely exclude the older catalog.
    """
    started = time.monotonic()
    state = Path(state)
    state.mkdir(parents=True, exist_ok=True)
    report = {'state': 'ready', 'providers': [], 'examined': 0, 'captured': 0,
              'errors': [], 'budget_exhausted': False, 'limit_reached': False}
    inventories = {}
    for provider in PROVIDERS:
        try:
            inventories[provider], status = catalog(profile, provider)
        except (OSError, sqlite3.Error, ValueError) as exc:
            inventories[provider], status = [], {'provider': provider, 'state': 'unavailable', 'error': type(exc).__name__}
        report['providers'].append({**status, 'examined': 0, 'captured': 0,
                                    'unavailable': 0, 'partial': 0})
    provider_reports = {row['provider']: row for row in report['providers']}
    attempted = {provider: set() for provider in PROVIDERS}
    # Keeping the cursor lock outside captured.sqlite avoids holding its writer
    # lock while stage() saves source evidence in that database.
    with closing(sqlite3.connect(state / 'local-session-cursors.sqlite', timeout=3)) as conn:
        conn.execute('create table if not exists cursors(name text primary key, value text not null)')
        try:
            conn.execute('begin immediate')
        except sqlite3.OperationalError:
            return store.summaries(state), {**report, 'state': 'collector busy'}
        with conn:
            existing = {name: json.loads(value) for name, value in conn.execute('select name,value from cursors')}
            cycle = int(existing.get('provider-cycle', 0))
            cursors = {provider: existing.get(provider, {'recent': None, 'rotation': None, 'phase': 0})
                       for provider in PROVIDERS}
            maximum = max(0, int(limit))
            while report['examined'] < maximum:
                if time.monotonic() - started >= budget_seconds:
                    report['budget_exhausted'] = True
                    break
                selected = None
                for offset in range(len(PROVIDERS)):
                    index = (cycle + offset) % len(PROVIDERS)
                    provider = PROVIDERS[index]
                    values = inventories[provider]
                    cursor = cursors[provider]
                    recent, rest = values[:RECENT], values[RECENT:]
                    lanes = [('recent', recent), ('rotation', rest)]
                    if cursor['phase'] % 2:
                        lanes.reverse()
                    for lane, candidates in lanes:
                        identity = _next(candidates, cursor.get(lane), attempted[provider])
                        if identity is not None:
                            selected = (index, provider, lane, identity)
                            break
                    if selected:
                        break
                if selected is None:
                    break
                index, provider, lane, identity = selected
                try:
                    records, status = _reader(provider)(profile, checkouts, limit=None, identities=[identity])
                    if any(record.get('session_id') != identity for _, record in records):
                        raise ValueError('Source reader returned a different identity')
                except (OSError, sqlite3.Error, ValueError, TypeError) as exc:
                    records, status = [], {'state': 'unavailable', 'error': type(exc).__name__}
                    report['errors'].append({'provider': provider, 'id': identity, 'phase': 'capture', 'error': type(exc).__name__})
                try:
                    for path, record in records:
                        store.stage([(path, record)], state)
                        report['captured'] += 1
                        provider_reports[provider]['captured'] += 1
                        provider_reports[provider]['partial'] += int((record.get('capture') or {}).get('state') == 'partial')
                except (OSError, sqlite3.Error, ValueError, TypeError) as exc:
                    # The source was read, but durable staging failed. Leave this
                    # cursor unadvanced so the next pass retries the same thread.
                    report['errors'].append({'provider': provider, 'id': identity, 'phase': 'stage', 'error': type(exc).__name__})
                    break
                attempted[provider].add(identity)
                report['examined'] += 1
                provider_reports[provider]['examined'] += 1
                provider_reports[provider]['unavailable'] += int(not records)
                cursor = cursors[provider]
                cursor[lane], cursor['phase'] = identity, cursor['phase'] + 1
                cycle = (index + 1) % len(PROVIDERS)
                for name, value in ((provider, cursor), ('provider-cycle', cycle)):
                    conn.execute('insert or replace into cursors values(?,?)', (name, json.dumps(value, sort_keys=True)))
            report['limit_reached'] = report['examined'] == maximum and bool(maximum)
    report['seconds'] = round(time.monotonic() - started, 3)
    # summaries() returns metadata only; source bodies stay in the durable store.
    return store.summaries(state), report
