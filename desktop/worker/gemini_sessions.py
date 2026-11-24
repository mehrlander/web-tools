"""Read Antigravity source evidence and project the visible conversation."""
from collections import Counter
from contextlib import closing
from datetime import datetime
import hashlib
import json
from pathlib import Path
import sqlite3
from urllib.parse import unquote, urlsplit

import local_sessions as shared


USAGE_FIELDS = ('input_tokens', 'output_tokens', 'cache_read_tokens', 'cache_write_tokens',
                'total_tokens', 'cost', 'cost_usd')
PATH_FIELDS = ('Path', 'TargetFile', 'AbsolutePath', 'DirectoryPath', 'FilePath', 'path')


def _time(value):
    if value in (None, ''):
        return None
    try:
        return shared.stamp(value)
    except (ValueError, TypeError, OverflowError, OSError):
        return None


def _text(value):
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return '\n'.join(_text(v) for v in value if isinstance(v, (str, dict)))
    if isinstance(value, dict):
        return value.get('text', '') if isinstance(value.get('text'), str) else ''
    return ''


def _workspace_paths(value):
    try:
        values = json.loads(value or '[]') if isinstance(value, str) else value
    except (ValueError, TypeError):
        values = [value] if value else []
    if isinstance(values, str):
        values = [values]
    out = []
    for uri in values if isinstance(values, list) else []:
        if not isinstance(uri, str):
            continue
        path = unquote(urlsplit(uri).path) if uri.startswith('file:') else uri
        if len(path) > 2 and path[0] == '/' and path[2] == ':':
            path = path[1:]
        out.append(path)
    return out


def _parents(conn):
    """Keep the additional parent relation independently of catalog parentage."""
    fields = {r[1] for r in conn.execute('pragma table_info(conversation_parents)')}
    if not {'conversation_id', 'parent_id'} <= fields:
        return {}
    result = {}
    for identity, parent in conn.execute('select conversation_id,parent_id from conversation_parents'):
        if parent:
            result.setdefault(identity, []).append(parent)
    return result


def _source_steps(path, omissions):
    """Stream the entire trajectory, retaining substantive step revisions."""
    items, latest, revisions, previous = [], {}, Counter(), {}
    malformed = 0
    with path.open('rb') as stream:
        for ordinal, raw_line in enumerate(stream):
            try:
                line = raw_line.decode('utf-8')
                native = json.loads(line)
            except (ValueError, TypeError, UnicodeError):
                malformed += 1
                continue
            if not isinstance(native, dict):
                malformed += 1
                continue
            step = native.get('step_index', ordinal)
            # A malformed step key must not collapse otherwise unrelated rows.
            key = json.dumps(step, sort_keys=True, ensure_ascii=True)
            data = shared.clean_payload(native, omissions)
            digest = hashlib.sha256(json.dumps(data, sort_keys=True, ensure_ascii=True,
                                               separators=(',', ':')).encode()).hexdigest()[:20]
            if previous.get(key) == digest:
                continue
            revisions[key] += 1
            identity = 'step:' + key + ':revision:' + str(revisions[key]) + ':' + digest
            entry = {'id': identity, 'ordinal': ordinal, 'at': _time(native.get('created_at')),
                     'type': native.get('type', 'unknown'), 'data': data,
                     'step_index': step, 'revision': revisions[key], 'latest': True}
            if key in latest:
                latest[key]['latest'] = False
                entry['supersedes'] = latest[key]['id']
            items.append(entry)
            latest[key] = entry
            previous[key] = digest
    def ordering(entry):
        step = entry['step_index']
        return (0, step) if isinstance(step, (int, float)) else (1, str(step))
    return items, sorted(latest.values(), key=ordering), malformed


def _project(steps, parented):
    prompts, replies, injected, calls, results, thinking = [], [], [], [], [], []
    attachments, ledger, touched, times, files, unknown = [], [], [], [], {}, Counter()
    tools = Counter()
    turn = None
    for entry in steps:
        item = entry['data']
        kind, source = item.get('type'), item.get('source')
        at, text = entry['at'], _text(item.get('content'))
        if at:
            times.append(at)
        ref = {'at': at, 'source_item': entry['id'], 'ordinal': entry['ordinal']}
        if kind == 'USER_INPUT' and source == 'USER_EXPLICIT' and not parented:
            has_attachments = any(item.get(key) for key in ('media', 'attachments', 'images', 'artifacts'))
            if text or has_attachments:
                turn = entry['id']
                prompts.append({**ref, 'id': entry['id'], 'text': text,
                                'provenance': {'kind': 'human'}, 'has_attachments': has_attachments})
        elif kind == 'PLANNER_RESPONSE' and source == 'MODEL':
            if text:
                replies.append({**ref, 'id': entry['id'], 'text': text, 'turn_id': turn})
        elif kind == 'GENERIC' and source == 'MODEL':
            # These are execution results, despite their MODEL source label.
            # Native trajectories expose no call id to join parallel results.
            results.append({**ref, 'body': text, 'association': 'unresolved',
                            'ok': False if item.get('error') else None})
        elif kind in ('USER_INPUT', 'SYSTEM_MESSAGE', 'CHECKPOINT'):
            injected.append({**ref, 'kind': 'child-input' if kind == 'USER_INPUT' and parented else kind.lower(),
                             'body': text, 'origin': {'kind': 'child' if kind == 'USER_INPUT' and parented else str(source or 'unknown').lower()}})
        else:
            unknown[str(kind or 'unknown')] += 1
        exposed = item.get('thinking')
        if exposed:
            projection = {**ref, 'text': _text(exposed), 'turn_id': turn}
            if not isinstance(exposed, str):
                projection['data'] = exposed
            thinking.append(projection)
        usage = {key: item[key] for key in USAGE_FIELDS if key in item}
        if usage:
            ledger.append({**ref, 'kind': kind, 'data': usage,
                           'accounting': 'native fields; aggregation scope unknown'})
        for key in ('media', 'attachments', 'images', 'artifacts'):
            if item.get(key):
                attachments.append({**ref, 'id': entry['id'] + ':attachment:' + key,
                                    'kind': key, 'data': item[key]})
        for index, call in enumerate(item.get('tool_calls') or []):
            if not isinstance(call, dict):
                continue
            name = str(call.get('name') or 'unknown')
            tools[name] += 1
            args = call.get('args')
            calls.append({**ref, 'id': entry['id'] + ':call:' + str(index), 'name': name,
                          'input': args, 'arg': json.dumps(args, ensure_ascii=True, sort_keys=True),
                          'turn_id': turn})
            if isinstance(args, dict):
                for key in PATH_FIELDS:
                    path = args.get(key)
                    if isinstance(path, str) and path:
                        touched.append(path)
                        counts = files.setdefault(path, {})
                        counts[name] = counts.get(name, 0) + 1
    turns = [{'id': prompt['id'], 'at': prompt['at'], 'prompt': prompt['id']} for prompt in prompts]
    return dict(prompts=prompts, replies=replies, injected=injected, calls=calls,
                tool_results=results, thinking=thinking, attachments=attachments,
                usage_ledger=ledger, touched=touched, times=times, tools=tools, files=files,
                turns=turns, unknown_types=dict(unknown))


def capture(profile, checkouts, limit=1024, identities=None):
    root = Path(profile) / '.gemini/antigravity'
    catalog = root / 'conversation_summaries.db'
    coverage = {'provider': 'gemini', 'catalog': 0, 'examined': 0, 'captured': 0,
                'unavailable': 0, 'partial': 0}
    if not catalog.is_file():
        return [], {**coverage, 'state': 'unavailable'}
    with closing(shared.database(catalog)) as conn:
        conn.row_factory = sqlite3.Row
        fields = {r[1] for r in conn.execute('pragma table_info(conversation_summaries)')}
        order = 'last_modified_time desc' if 'last_modified_time' in fields else 'conversation_id'
        coverage['catalog'] = conn.execute('select count(*) from conversation_summaries').fetchone()[0]
        query = 'select * from conversation_summaries'
        arguments = ()
        if identities is not None:
            identities = list(dict.fromkeys(identities))
            if not identities:
                return [], {**coverage, 'state': 'ready', 'limited': bool(coverage['catalog'])}
            query += ' where conversation_id in (' + ','.join('?' for _ in identities) + ')'
            arguments = tuple(identities)
        query += ' order by ' + order
        arguments += () if limit is None else (max(1, int(limit)),)
        rows = [dict(r) for r in conn.execute(query + ('' if limit is None else ' limit ?'), arguments)]
        parents = _parents(conn)
    records = []
    for native_catalog in rows:
        coverage['examined'] += 1
        identity = native_catalog.get('conversation_id')
        if not isinstance(identity, str) or not shared.IDENT.fullmatch(identity):
            coverage['unavailable'] += 1
            continue
        omissions = Counter()
        metadata = shared.clean_payload(native_catalog, omissions)
        parent_ids = list(dict.fromkeys(value for value in
                                       [native_catalog.get('parent_conversation_id'), *parents.get(identity, [])]
                                       if isinstance(value, str) and value))
        parent = {'session_id': parent_ids[0], 'short': shared.short_id('gemini', parent_ids[0])} if parent_ids else None
        path = root / 'brain' / identity / '.system_generated/logs/transcript.jsonl'
        gaps, source_items, steps, malformed = [], [], [], 0
        try:
            source_items, steps, malformed = _source_steps(path, omissions)
        except (OSError, UnicodeError):
            gaps.append('trajectory unavailable')
        if malformed:
            gaps.append(str(malformed) + ' malformed trajectory rows')
        data = _project(steps, bool(parent))
        times = data.pop('times')
        modified = _time(native_catalog.get('last_modified_time'))
        started = min(times, key=lambda value: datetime.fromisoformat(value.replace('Z', '+00:00'))) if times else modified
        ended = max(times, key=lambda value: datetime.fromisoformat(value.replace('Z', '+00:00'))) if times else modified
        if not started:
            coverage['unavailable'] += 1
            continue
        if not times:
            gaps.append('conversation start unavailable; storage partition uses catalog modified time')
        if data['unknown_types']:
            gaps.append('unknown trajectory types preserved without conversation projection')
        if any(item['data'].get('truncated_fields') for item in source_items):
            gaps.append('source reports truncated fields')
        if data['tool_results']:
            gaps.append('tool result call associations unavailable in trajectory')
        if data['usage_ledger']:
            gaps.append('native usage aggregation scope unknown; totals not synthesized')
        else:
            gaps.append('usage unavailable in captured trajectory')
        partial = bool(gaps)
        prompts, replies, tools, touched = (data.pop(key) for key in ('prompts', 'replies', 'tools', 'touched'))
        kind = 'subagent' if parent else 'user' if prompts else 'unknown'
        source = 'trajectory' if source_items else 'catalog'
        capture_info = {'source': source, 'state': 'partial' if partial else 'complete',
                        'gaps': gaps, 'omissions': dict(omissions),
                        'start_basis': 'trajectory' if times else 'catalog-last-modified',
                        'capabilities': {'prose': bool(source_items), 'source_items': bool(source_items),
                                         'tool_call_associations': False, 'usage_totals': False}}
        extras = {**data, 'source_items': source_items, 'source_catalog': metadata,
                  'kind': kind, 'parent': parent,
                  'relationships': [{'kind': 'parent', 'session_id': value,
                                     'short': shared.short_id('gemini', value)} for value in parent_ids],
                  'calls_total': len(data['calls']), 'injected_total': len(data['injected']),
                  'capture': capture_info,
                  'lifecycle': {key: metadata[key] for key in ('killed', 'status', 'not_fully_idle') if key in metadata}}
        records.append(shared.record('gemini', identity, native_catalog.get('title') or '', started, ended,
                                     prompts, replies, tools, '', [*_workspace_paths(native_catalog.get('workspace_uris')), *touched],
                                     checkouts, source, partial, **extras))
        coverage['captured'] += 1
        coverage['partial'] += int(partial)
    return records, {**coverage, 'state': 'ready', 'limited': len(rows) < coverage['catalog']}
