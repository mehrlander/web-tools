"""Project aggregate usage stores into the private companion's runtime archive.

Stores are read-only. Session metadata comes from one already-fetched origin/main
tree; no repository fetch, checkout, transcript read or provider request occurs.
"""
import argparse
from collections import Counter
from datetime import datetime, timezone
import json
import math
import os
from pathlib import Path
import re
import sqlite3
import tempfile
import time

from daily_allowance import build_daily, instant
from allowance_events import detect_decreases
from session_usage import collect as collect_session_usage

MAX_ARCHIVE_BYTES = 8 * 1024 * 1024
MAX_PERIODS = 10000
MAX_OBSERVATIONS = 250000
MAX_TOKEN_DAYS = 10000
MAX_SOURCES = 8
MAX_COUNTER = 2 ** 53 - 1
PROVIDERS = ('codex', 'gemini', 'claude')
BUCKET = re.compile(r'[A-Za-z0-9_.:-]{1,160}')


def state_directory():
    base = os.environ.get('LOCALAPPDATA')
    if not base:
        raise ValueError('The local application data directory is unavailable')
    return Path(base) / 'WebToolsDesktop'


def stamp(value):
    result = instant(value)
    return result if result is not None and math.isfinite(result) else -math.inf


def number(value, maximum=MAX_COUNTER, integer=False):
    return (not isinstance(value, bool) and isinstance(value, (int, float))
            and math.isfinite(value) and 0 <= value <= maximum
            and (not integer or int(value) == value))


def text(value, limit=100):
    # Labels are metadata, never diagnostic messages or local source paths.
    return (isinstance(value, str) and 0 < len(value) <= limit
            and not any(ord(char) < 32 for char in value)
            and not re.search(r'(?:(?<![A-Za-z])[A-Za-z]:[\\/]|\\\\|/Users/|/home/)', value))


def identity(row):
    return row.get('provider') in PROVIDERS and isinstance(row.get('bucket'), str) and BUCKET.fullmatch(row['bucket'])


def period(row):
    if (not identity(row) or not all(stamp(row.get(field)) != -math.inf for field in ('reset', 'first_at', 'last_at'))
            or stamp(row['first_at']) > stamp(row['last_at']) or stamp(row['last_at']) > stamp(row['reset'])
            or not all(number(row.get(field), 100) for field in ('peak', 'last_used'))
            or not number(row.get('samples'), integer=True)):
        return None
    minutes = row.get('minutes')
    if minutes is not None and (not number(minutes, 525600) or minutes <= 0):
        return None
    return {**{field: row[field] for field in ('provider', 'bucket', 'reset', 'first_at', 'last_at', 'peak', 'last_used', 'samples')},
            'minutes': minutes, 'label': row['label'] if text(row.get('label')) else row['bucket']}


def observation(row):
    if (not identity(row) or stamp(row.get('at')) == -math.inf or stamp(row.get('reset')) == -math.inf
            or stamp(row['at']) > stamp(row['reset']) or not number(row.get('used'), 100)):
        return None
    minutes = row.get('minutes')
    if minutes is not None and (not number(minutes, 525600) or minutes <= 0):
        return None
    return {**{field: row[field] for field in ('provider', 'bucket', 'at', 'reset', 'used')},
            'minutes': minutes, 'label': row['label'] if text(row.get('label')) else row['bucket']}


def token_day(row):
    day = row.get('day')
    try:
        valid_day = isinstance(day, str) and datetime.strptime(day, '%Y-%m-%d').strftime('%Y-%m-%d') == day
    except ValueError:
        valid_day = False
    if row.get('provider') not in PROVIDERS or not valid_day or stamp(row.get('observed_at')) == -math.inf or not number(row.get('tokens'), integer=True):
        return None
    return {field: row[field] for field in ('provider', 'day', 'tokens', 'observed_at')}


def key(row, *fields):
    return tuple(stamp(row[field]) if field in ('at', 'reset') else row.get(field) for field in fields)


def bounded_rows(db, table, fields, maximum, project):
    rows = db.execute(f'SELECT {fields} FROM {table} LIMIT ?', (maximum + 1,)).fetchall()
    if len(rows) > maximum:
        raise ValueError('The usage source exceeds the aggregate read budget')
    return [value for row in rows if (value := project(dict(row))) is not None]


def read_source(path):
    db = sqlite3.connect(path.as_uri() + '?mode=ro', uri=True, timeout=3)
    try:
        # Aggregate records are small. Bound each SQLite value/row as well as
        # row counts, and stop work on a pathological source without exporting
        # only a subset of a previously complete archive.
        db.setlimit(sqlite3.SQLITE_LIMIT_LENGTH, 8192)
        deadline = time.monotonic() + 5
        db.set_progress_handler(lambda: int(time.monotonic() > deadline), 10000)
        db.row_factory = sqlite3.Row
        db.execute('PRAGMA query_only=ON')
        db.execute('BEGIN')
        metadata = dict(db.execute("SELECT key,value FROM metadata WHERE key IN ('updatedAt','codexTokenStatus','codexTokenAttempt')"))
        return metadata, bounded_rows(db, 'reset_readings', 'provider,bucket,reset,minutes,label,first_at,last_at,peak,last_used,samples', MAX_PERIODS, period), \
            bounded_rows(db, 'observations', 'provider,bucket,at,reset,used,minutes,label', MAX_OBSERVATIONS, observation), \
            bounded_rows(db, 'token_days', 'provider,day,tokens,observed_at', MAX_TOKEN_DAYS, token_day)
    finally:
        db.close()


def configured_sources(state=None, history_state=None):
    directory = Path(state) if state is not None else state_directory()
    current = directory / 'usage-history.sqlite3'
    historical = history_state or os.environ.get('WEBTOOLS_HISTORY_STATE')
    if historical:
        previous = Path(historical) / 'usage-history.sqlite3'
        # A configured historical side is required, even if the current store
        # exists. Its disappearance must not silently trim the saved history.
        if not previous.is_file():
            raise FileNotFoundError('The configured historical usage store is unavailable')
        return [previous, current]
    # Installations can retain an immutable SQLite backup of a previous app-data
    # store here. The current collector keeps writing only its ordinary store.
    # Read the retained side first so current readings win overlapping revisions.
    previous = directory / 'usage-history-legacy.sqlite3'
    if previous.exists():
        return [previous, current]
    return [current]


def confirmations(events, path=None):
    if path is None:
        return []
    source = Path(path)
    if source.stat().st_size > 1024 * 1024:
        raise ValueError('The confirmation record exceeds the read budget')
    records = json.loads(source.read_text(encoding='utf-8'))
    if not isinstance(records, list) or len(records) > 10000:
        raise ValueError('Invalid confirmation record')
    known = {row['id']: row for row in records if isinstance(row, dict) and isinstance(row.get('id'), str)
             and row.get('basis') == 'owner-report' and row.get('kind') in ('Fable', 'Manual')}
    result = []
    for event in events:
        record = known.get(event['id'])
        if (record and all(record.get(field) == event.get(field) for field in ('provider', 'bucket', 'minutes', 'before', 'after'))
                and all(stamp(record.get(field)) != -math.inf and stamp(record.get(field)) == stamp(event.get(field))
                        for field in ('before_at', 'at', 'before_reset', 'reset'))):
            event.update(confirmed_restore=True, restore_label=record['kind'], confirmation='owner-report')
            result.append(event)
    return result


def build_archive(sources=None, now=None, zone=None, state=None, history_state=None, confirmation_file=None):
    paths = configured_sources(state, history_state) if sources is None else list(sources)
    if len(paths) > MAX_SOURCES:
        raise ValueError('Too many aggregate sources')
    loaded, identities = [], set()
    for source in paths:
        path = Path(source).resolve()
        if not path.exists():
            continue
        stat = path.stat()
        identity_key = (stat.st_dev, stat.st_ino)
        if identity_key in identities:
            continue
        loaded.append(read_source(path))
        identities.add(identity_key)
    if not loaded:
        raise FileNotFoundError('No usage history store is available')
    periods, observations, tokens = {}, {}, {}
    for metadata, source_periods, source_observations, source_tokens in loaded:
        for row in source_observations:
            ident = key(row, 'provider', 'bucket', 'at', 'reset')
            prior = observations.get(ident)
            if prior and row.get('minutes') is None:
                row = dict(row, minutes=prior.get('minutes'))
            observations[ident] = row
        for row in source_periods:
            ident = key(row, 'provider', 'bucket', 'reset')
            prior = periods.get(ident)
            if prior is None:
                periods[ident] = row
                continue
            newest, older = (row, prior) if stamp(row['last_at']) >= stamp(prior['last_at']) else (prior, row)
            merged = dict(newest)
            merged.update(first_at=min((prior['first_at'], row['first_at']), key=stamp),
                          minutes=newest['minutes'] if newest['minutes'] is not None else older['minutes'],
                          peak=max(prior['peak'], row['peak']), samples=max(prior['samples'], row['samples']))
            periods[ident] = merged
        for row in source_tokens:
            ident = key(row, 'provider', 'day')
            prior = tokens.get(ident)
            if prior is None or stamp(row['observed_at']) >= stamp(prior['observed_at']):
                tokens[ident] = row
    samples = Counter(key(row, 'provider', 'bucket', 'reset') for row in observations.values())
    for ident, row in periods.items():
        row['samples'] = max(row['samples'], samples[ident])
    latest = max((part[0] for part in loaded), key=lambda metadata: stamp(metadata.get('updatedAt')))
    if stamp(latest.get('updatedAt')) == -math.inf:
        raise ValueError('Usage history has no valid update timestamp')
    token_status = [part[0] for part in loaded if 'codexTokenStatus' in part[0]]
    token_metadata = max(token_status, key=lambda metadata: stamp(metadata.get('codexTokenAttempt') or metadata.get('updatedAt'))) if token_status else {}
    period_rows = sorted(periods.values(), key=lambda row: (row['reset'], row['provider'], row['bucket']))
    observation_rows = sorted(observations.values(), key=lambda row: (stamp(row['at']), row['provider'], row['bucket']))
    adjustments = detect_decreases(observation_rows)
    if len(periods) > MAX_PERIODS or len(tokens) > MAX_TOKEN_DAYS or len(adjustments) > MAX_PERIODS:
        raise ValueError('The merged usage archive exceeds its aggregate budget')
    restores = confirmations(adjustments, confirmation_file)
    status = token_metadata.get('codexTokenStatus')
    return dict(schemaVersion=1, updatedAt=latest['updatedAt'], periods=period_rows,
                tokenDays=sorted(tokens.values(), key=lambda row: (row['day'], row['provider'])),
                codexTokenStatus=status if status in ('available', 'unavailable') else 'unavailable',
                dailyAllowance=build_daily(observation_rows, period_rows, now=now, zone=zone, confirmed_restores=restores),
                adjustments=adjustments, sourceCount=len(loaded))


def project_sessions(value):
    if not isinstance(value, dict):
        value = {}
    rows = []
    counters = ('contextTokens', 'cacheReadTokens', 'cacheWriteTokens', 'inputTokens', 'outputTokens', 'measuredSteps', 'reloads')
    for row in value.get('sessions', [])[:512] if isinstance(value.get('sessions'), list) else ():
        if (not isinstance(row, dict) or row.get('provider') != 'claude'
                or not isinstance(row.get('id'), str) or not re.fullmatch(r'(?:\d{4}-\d{2}-\d{2}-)?[a-f0-9]{8}', row['id'])
                or stamp(row.get('usageAt')) == -math.inf
                or not all(number(row.get(field), integer=True) for field in counters)):
            continue
        agent, link = row.get('agentSessionId'), row.get('sessionUrl')
        if agent is not None and (not isinstance(agent, str) or len(agent) > 150 or not re.fullmatch(r'session_[A-Za-z0-9_-]+', agent)):
            continue
        if link is not None and link != 'https://claude.ai/code/' + str(agent):
            continue
        title = row.get('title')
        rows.append(dict(id=row['id'], agentSessionId=agent, provider='claude',
                         title=title if text(title, 180) else 'Claude session ' + row['id'],
                         sessionUrl=link, usageAt=row['usageAt'], **{field: row[field] for field in counters}))
    revision, notice = value.get('revision'), value.get('notice')
    return dict(schemaVersion=1, observedAt=value.get('observedAt') if stamp(value.get('observedAt')) != -math.inf else None,
                revision=revision if isinstance(revision, str) and re.fullmatch(r'[a-f0-9]{40,64}', revision) else None,
                available=value.get('available') is True, partial=value.get('partial') is True,
                source='Recorded Claude Code usage extracts', lookbackHours=24, fallbackDays=62,
                indexGeneratedAt=value.get('indexGeneratedAt') if stamp(value.get('indexGeneratedAt')) != -math.inf else None,
                sessions=rows, notice=notice if text(notice, 300) else None)


def saved_sessions(target):
    try:
        if target.stat().st_size > MAX_ARCHIVE_BYTES:
            return None
        saved = json.loads(target.read_text(encoding='utf-8')).get('sessionUsage')
        if not isinstance(saved, dict) or not isinstance(saved.get('sessions'), list) or len(saved['sessions']) > 512:
            return None
        result = project_sessions(saved)
        if not result['sessions']:
            return None
        result.update(available=False, notice='Session usage sync is unavailable. Showing saved measurements.')
        return result
    except (OSError, ValueError, AttributeError):
        return None


def export(sources=None, write=True, target=None, state=None, session_repo=None, now=None, zone=None,
           history_state=None, confirmation_file=None):
    state = Path(state) if state is not None else state_directory()
    target = Path(target) if target is not None else state / 'phone-usage-history.json'
    confirmation_file = confirmation_file or os.environ.get('WEBTOOLS_USAGE_CONFIRMATIONS')
    if confirmation_file is None and (state / 'usage-reset-confirmations.json').is_file():
        confirmation_file = state / 'usage-reset-confirmations.json'
    value = build_archive(sources, now=now, zone=zone, state=state, history_state=history_state, confirmation_file=confirmation_file)
    repo = session_repo or os.environ.get('WEBTOOLS_SESSION_REPO') or Path.home() / 'gh' / 'web-tools-private'
    try:
        session_usage = project_sessions(collect_session_usage(Path(repo), now=now))
    except (OSError, ValueError):
        session_usage = project_sessions(dict(available=False, notice='Session usage sync is unavailable.'))
    if not session_usage.get('available'):
        session_usage = saved_sessions(target) or session_usage
    value['sessionUsage'] = session_usage
    encoded = json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode('utf-8')
    if len(encoded) > MAX_ARCHIVE_BYTES:
        raise ValueError('The derived usage archive exceeds its output budget')
    if write and (not target.exists() or target.read_bytes() != encoded):
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(dir=target.parent, prefix=target.name + '.', suffix='.tmp', delete=False) as stream:
                temporary = Path(stream.name)
                stream.write(encoded)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(temporary, target)
        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)
    return dict(periodGroups=len(value['periods']), tokenDays=len(value['tokenDays']), updatedAt=value['updatedAt'],
                bytes=len(encoded), dailyDays=len(value['dailyAllowance']['days']), historySources=value['sourceCount'],
                sessionReadings=len(session_usage.get('sessions', [])), sessionUsageAvailable=bool(session_usage.get('available')))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--state', type=Path)
    parser.add_argument('--source', type=Path, action='append')
    parser.add_argument('--history-state', type=Path)
    parser.add_argument('--session-repo', type=Path)
    parser.add_argument('--confirmations', type=Path)
    parser.add_argument('--once', action='store_true')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    while True:
        try:
            result = export(args.source, write=not args.dry_run, state=args.state, session_repo=args.session_repo,
                            history_state=args.history_state, confirmation_file=args.confirmations)
            print(json.dumps(result), flush=True)
        except (OSError, ValueError, sqlite3.Error):
            # Paths, database diagnostics and transcript content are never logged.
            print('{"available":false,"notice":"Usage history export is unavailable."}', flush=True)
            if args.once or args.dry_run:
                return 1
        if args.once or args.dry_run:
            return 0
        time.sleep(60)


if __name__ == '__main__':
    raise SystemExit(main())
