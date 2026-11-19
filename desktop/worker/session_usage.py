"""Project recorded Claude usage metadata without reading session transcripts."""
from datetime import datetime, timedelta, timezone
from pathlib import Path
import json
import math
import re
import subprocess

MAX_INDEX_BYTES = 16 * 1024 * 1024
MAX_TREE_BYTES = 4 * 1024 * 1024
MAX_EXTRACT_BYTES = 2 * 1024 * 1024
MAX_TOTAL_BYTES = 32 * 1024 * 1024
MAX_EXTRACTS = 512
FALLBACK_DAYS = 62
MAX_COUNTER = 2 ** 53 - 1
EXTRACT = re.compile(r'^sessions/usage/(\d{4})/(\d{2})/(\d{4}-\d{2}-\d{2})-([a-f0-9]{8})\.json$')
AGENT = re.compile(r'^https://claude\.ai/code/(session_[A-Za-z0-9_-]+)$')


class _Unavailable(Exception):
    pass


def _instant(value):
    try:
        if isinstance(value, datetime):
            result = value
        elif isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value):
            return datetime.fromtimestamp(value, timezone.utc)
        elif isinstance(value, str):
            result = datetime.fromisoformat(value.replace('Z', '+00:00'))
        else:
            return None
        return result.astimezone(timezone.utc) if result.tzinfo is not None else None
    except (ValueError, OverflowError, OSError):
        return None


def _iso(value):
    return value.isoformat().replace('+00:00', 'Z')


def _day(value):
    try:
        return value if isinstance(value, str) and datetime.strptime(value, '%Y-%m-%d').strftime('%Y-%m-%d') == value else None
    except ValueError:
        return None


def _agent(value):
    match = AGENT.fullmatch(value) if isinstance(value, str) else None
    return match[1] if match else None


def _count(value=0):
    if (isinstance(value, bool) or not isinstance(value, (int, float))
            or not 0 <= value <= MAX_COUNTER or int(value) != value):
        raise ValueError('Invalid counter')
    return int(value)


def _git(repo, args, limit, data=None):
    try:
        result = subprocess.run(['git', '-C', str(repo), *args], input=data,
                                stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=15, check=False,
                                creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    except (OSError, subprocess.SubprocessError):
        raise _Unavailable() from None
    if result.returncode or len(result.stdout) > limit:
        raise _Unavailable()
    return result.stdout


def _tree(repo, revision):
    result = {}
    raw = _git(repo, ['ls-tree', '-r', '-l', '-z', revision, '--', 'state/sessions.json', 'sessions/usage'], MAX_TREE_BYTES)
    try:
        for entry in raw.split(b'\0'):
            if not entry:
                continue
            metadata, path = entry.split(b'\t', 1)
            mode, kind, sha, size = metadata.split()
            path = path.decode('utf-8')
            if kind == b'blob' and (path == 'state/sessions.json' or EXTRACT.fullmatch(path)):
                result[path] = (sha.decode('ascii'), int(size))
    except (ValueError, UnicodeError):
        raise _Unavailable() from None
    return result


def _extracts(repo, entries):
    # Immutable tree sizes bound the batch before any extract body is read.
    expected = sum(size + 128 for _, (_, size) in entries)
    raw = _git(repo, ['cat-file', '--batch'], expected, ''.join(sha + '\n' for _, (sha, _) in entries).encode('ascii'))
    offset = 0
    for path, (sha, size) in entries:
        end = raw.find(b'\n', offset)
        header = raw[offset:end].split() if end >= 0 else []
        if header != [sha.encode('ascii'), b'blob', str(size).encode('ascii')]:
            raise _Unavailable()
        start = end + 1
        if start + size >= len(raw) or raw[start + size:start + size + 1] != b'\n':
            raise _Unavailable()
        yield path, raw[start:start + size]
        offset = start + size + 1
    if offset != len(raw):
        raise _Unavailable()


def _project(extract, path, index, now):
    match = EXTRACT.fullmatch(path)
    year, month, day, short = match.groups()
    if (not isinstance(extract, dict) or extract.get('schema') != 'usage/1' or not _day(day)
            or day[:4] != year or day[5:7] != month or extract.get('short') != short or extract.get('day') != day):
        raise ValueError('Invalid usage metadata')
    at = _instant(extract.get('last_step_at'))
    if at is None:
        raise ValueError('Missing usage timestamp')
    if not now - timedelta(hours=24) <= at <= now:
        return None
    context = _count(extract.get('context_now'))
    if not context:
        raise ValueError('Missing context measurement')
    prompts = extract.get('prompts')
    if not isinstance(prompts, list):
        raise ValueError('Invalid usage buckets')
    buckets = list(prompts)
    if extract.get('unowned') is not None:
        buckets.append(extract['unowned'])
    totals = dict(cacheReadTokens=0, cacheWriteTokens=0, inputTokens=0, outputTokens=0, measuredSteps=0, reloads=0)
    for bucket in buckets:
        if not isinstance(bucket, dict) or not isinstance(bucket.get('models', {}), dict):
            raise ValueError('Invalid usage bucket')
        totals['measuredSteps'] += _count(bucket.get('steps', 0))
        totals['reloads'] += _count(bucket.get('reloads', 0))
        for model in bucket.get('models', {}).values():
            if not isinstance(model, dict):
                raise ValueError('Invalid model counters')
            for source, target in (('input', 'inputTokens'), ('output', 'outputTokens'), ('cache_read', 'cacheReadTokens'),
                                   ('cache_write_1h', 'cacheWriteTokens'), ('cache_write_5m', 'cacheWriteTokens')):
                totals[target] += _count(model.get(source, 0))
    for value in totals.values():
        _count(value)
    row = index.get((day, short), {})
    captured_agent, indexed_agent = _agent(extract.get('agent_session')), _agent(row.get('agent'))
    if captured_agent and indexed_agent and captured_agent != indexed_agent:
        raise ValueError('Conflicting session identifiers')
    ident, agent = row.get('id') or f'{day}-{short}', captured_agent or indexed_agent
    title = row.get('title')
    title = title.strip()[:180] if isinstance(title, str) and title.strip() else 'Claude session ' + ident
    return dict(id=ident, agentSessionId=agent, provider='claude', title=title,
                sessionUrl='https://claude.ai/code/' + agent if agent else None,
                contextTokens=context, usageAt=_iso(at), **totals)


def collect(repo, now=None):
    """Read one origin/main snapshot; counts are session-to-date, not live cache state.

    A recent index entry includes sessions started in any month. The bounded
    62-day fallback also finds extracts published before the index catches up.
    No fetch or checkout occurs. Session records and transcripts are never
    opened; opening_ask and prompt text are never accessed or projected.
    """
    at = datetime.now(timezone.utc) if now is None else _instant(now)
    output = dict(schemaVersion=1, observedAt=_iso(at) if at else None, revision=None, available=False,
                  partial=False, source='Recorded Claude Code usage extracts', lookbackHours=24,
                  fallbackDays=FALLBACK_DAYS, indexGeneratedAt=None, sessions=[], notice=None)
    if at is None:
        output['notice'] = 'A valid collection time is required.'
        return output
    try:
        revision = _git(repo, ['rev-parse', '--verify', 'refs/remotes/origin/main^{commit}'], 256).decode('ascii').strip()
        if not re.fullmatch(r'[a-f0-9]{40,64}', revision):
            raise _Unavailable()
        output['revision'] = revision
        tree = _tree(repo, revision)
        index_entry = tree.get('state/sessions.json')
        if not index_entry or not 0 < index_entry[1] <= MAX_INDEX_BYTES:
            raise _Unavailable()
        # The immutable tree's known size bounds this show before its body is read.
        document = json.loads(_git(repo, ['show', '--no-textconv', revision + ':state/sessions.json'], index_entry[1]))
        if not isinstance(document, dict) or not isinstance(document.get('rows'), list):
            raise _Unavailable()
        generated = _instant(document.get('generatedAt'))
        output['indexGeneratedAt'] = _iso(generated) if generated else None
        index, activity = {}, {}
        for row in document['rows']:
            if not isinstance(row, dict):
                continue
            day, ident = _day(row.get('day')), row.get('id')
            if not day or not isinstance(ident, str) or not re.fullmatch(r'(?:\d{4}-\d{2}-\d{2}-)?[a-f0-9]{8}', ident):
                continue
            key = (day, ident[-8:])
            ended = _instant(row.get('ended')) or _instant(row.get('started'))
            if key not in index or ended and (activity[key] is None or ended > activity[key]):
                index[key] = {name: row.get(name) for name in ('id', 'agent', 'title')}
                activity[key] = ended
        candidates = []
        for path, entry in tree.items():
            match = EXTRACT.fullmatch(path)
            if not match or not _day(match[3]):
                continue
            day, short = match[3], match[4]
            ended = activity.get((day, short))
            recent = ended is not None and at - timedelta(hours=24) <= ended <= at
            if recent or day >= (at - timedelta(days=FALLBACK_DAYS)).date().isoformat():
                candidates.append((path, entry, recent, ended))
        candidates.sort(key=lambda item: (item[2], item[3] or datetime.min.replace(tzinfo=timezone.utc), item[0]), reverse=True)
        selected, skipped, total = [], 0, 0
        for path, entry, _, _ in candidates:
            size = entry[1]
            if size > MAX_EXTRACT_BYTES or len(selected) >= MAX_EXTRACTS or total + size > MAX_TOTAL_BYTES:
                skipped += 1
                continue
            selected.append((path, entry))
            total += size
        sessions = {}
        for path, raw in _extracts(repo, selected) if selected else ():
            try:
                row = _project(json.loads(raw), path, index, at)
            except (ValueError, TypeError, UnicodeError, OverflowError):
                skipped += 1
                continue
            if row is None:
                continue
            identity = row['agentSessionId'] or row['id']
            prior = sessions.get(identity)
            if prior is None or (_instant(row['usageAt']), row['id']) > (_instant(prior['usageAt']), prior['id']):
                sessions[identity] = row
        output.update(available=True, partial=bool(skipped), sessions=sorted(sessions.values(),
                      key=lambda row: (-row['contextTokens'], -_instant(row['usageAt']).timestamp(), row['id'])))
        if skipped:
            output['notice'] = f'{skipped} usage extracts were unavailable, invalid or outside the read budget.'
    except (_Unavailable, ValueError, TypeError, UnicodeError):
        output['sessions'] = []
        output['notice'] = 'Recorded session usage is unavailable; retain the previous observation.'
    return output
