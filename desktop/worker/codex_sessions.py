"""Read Codex source evidence without changing its stores or guessing authorship."""
from collections import Counter
from contextlib import closing
import hashlib
import json
from pathlib import Path
import sqlite3

import local_sessions as shared


def _fields(conn, table):
    return {row[1] for row in conn.execute('pragma table_info(' + table + ')')}


def _when(value, fallback):
    try:
        return shared.stamp(value if value is not None else fallback)
    except (ValueError, TypeError, OverflowError, OSError):
        return shared.stamp(fallback)


def _object(value):
    if isinstance(value, dict):
        return value
    try:
        result = json.loads(value or '{}')
        return result if isinstance(result, dict) else {}
    except (ValueError, TypeError):
        return {}


def _kind(row, edge):
    source = _object(row.get('source'))
    sub = source.get('subagent') or {}
    spawned = sub.get('thread_spawn') or {}
    kind = row.get('thread_source')
    parent = spawned.get('parent_thread_id') or row.get('attached_thread_parent_id') or edge
    if kind not in ('user', 'subagent', 'guardian_review'):
        if sub.get('other') == 'guardian':
            kind = 'guardian_review'
        elif spawned or parent:
            kind = 'subagent'
        elif row.get('source') in ('vscode', 'cli', 'exec', 'app_server'):
            kind = 'user'
        else:
            kind = 'unknown'
    return kind, parent, spawned


def _text(content):
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        return ''
    parts = [value if isinstance(value, str) else value.get('text', '')
             for value in content if isinstance(value, (str, dict))]
    return '\n'.join(value for value in parts if isinstance(value, str) and value)


def _origin(metadata, kind, projected=False):
    if kind in ('subagent', 'guardian_review'):
        return {'kind': kind, 'basis': 'catalog'}
    metadata = metadata if isinstance(metadata, dict) else {}
    entries = metadata.get('content_item_metadata') or []
    entries = entries if isinstance(entries, list) else []
    origins = {(entry.get('provenance') or {}).get('type') for entry in entries if isinstance(entry, dict)}
    origins.discard(None)
    kinds = metadata.get('content_item_kinds') or []
    kinds = kinds if isinstance(kinds, list) else []
    if origins == {'user'} or (kinds and all(str(k).startswith('user.') for k in kinds)):
        return {'kind': 'user', 'basis': 'provider-provenance'}
    if origins or kinds:
        return {'kind': 'harness', 'basis': 'provider-provenance',
                'provenance': entries, 'content_item_kinds': kinds}
    if projected:
        return {'kind': 'user', 'basis': 'history-userMessage'}
    return {'kind': 'unknown', 'basis': 'missing-provider-provenance'}


def _rollout_path(root, value):
    if not value:
        return None
    path = Path(str(value).removeprefix('\\\\?\\')).resolve()
    if not any(path.is_relative_to((root / folder).resolve()) for folder in ('sessions', 'archived_sessions')):
        return None
    return path if path.is_file() else None


def _name(item):
    kind = item.get('type', 'unknown')
    if kind == 'mcpToolCall':
        return ':'.join(str(v) for v in (item.get('server'), item.get('tool')) if v) or kind
    if kind == 'collabAgentToolCall':
        return 'collaboration:' + str(item.get('tool', 'unknown'))
    return kind


def _body_digest(value):
    """Match the preservation store's canonical JSON body digest."""
    body = (json.dumps(value, ensure_ascii=True, sort_keys=True) + '\n').encode('utf-8')
    return hashlib.sha256(body).hexdigest()


def _display(value):
    return value if isinstance(value, str) else json.dumps(value, ensure_ascii=False, sort_keys=True)


def _call_projection(item, base):
    """Project known native call fields without guessing an unknown outcome."""
    kind, status = item.get('type'), item.get('status')
    call = {**base, 'name': _name(item), 'status': status}
    if item.get('durationMs') is not None:
        call['duration_ms'] = item['durationMs']
    if item.get('exitCode') is not None:
        call['exit_code'] = item['exitCode']
    if kind == 'commandExecution':
        if 'command' in item:
            call['input'] = shared.clean_payload({'command': item['command'], 'cwd': item.get('cwd')})
            call['arg'] = _display(item['command'])
        if isinstance(item.get('aggregatedOutput'), str):
            call['body'] = item['aggregatedOutput']
        if isinstance(item.get('exitCode'), int) and not isinstance(item['exitCode'], bool):
            call['ok'] = item['exitCode'] == 0
    elif kind == 'mcpToolCall':
        if 'arguments' in item:
            call['input'] = shared.clean_payload(item['arguments'])
            call['arg'] = _display(call['input'])
        result, error = item.get('result'), item.get('error')
        if error:
            call['body'] = _display(shared.clean_payload({'result': result, 'error': error}))
            call['ok'] = False
        elif result is not None:
            call['body'] = _display(shared.clean_payload(result))
            if isinstance(result, dict) and isinstance(result.get('isError'), bool):
                call['ok'] = not result['isError']
            elif status == 'completed':
                call['ok'] = True
    else:
        if kind == 'collabAgentToolCall':
            call['input'] = shared.clean_payload({key: item[key] for key in ('prompt', 'receiverThreadIds', 'model', 'reasoningEffort') if key in item})
            call['arg'] = _display(call['input'])
            if 'agentsStates' in item:
                call['body'] = _display(shared.clean_payload(item['agentsStates']))
        elif kind == 'fileChange':
            call['input'] = shared.clean_payload({'changes': item.get('changes') or []})
            call['arg'] = _display(call['input'])
        else:
            for key in ('arguments', 'input', 'query', 'path'):
                if key in item:
                    call['input'] = shared.clean_payload(item[key])
                    call['arg'] = _display(call['input'])
                    break
            for key in ('result', 'output', 'response'):
                if item.get(key) is not None:
                    call['body'] = _display(shared.clean_payload(item[key]))
                    break
        if status == 'completed' and kind in ('collabAgentToolCall', 'fileChange'):
            call['ok'] = True
    if status in ('failed', 'error', 'cancelled', 'canceled', 'denied'):
        call['ok'] = False
    if 'body' in call:
        call['bytes'] = len(call['body'].encode('utf-8'))
    else:
        call['output_unprojected'] = True
    return call


def capture(profile, checkouts, limit=1024, identities=None):
    """Retain native evidence and derive owner conversation without lifetime caps."""
    if identities is not None:
        if isinstance(identities, (str, bytes)):
            raise TypeError('Thread identities must be a sequence of identifiers')
        identities = list(dict.fromkeys(str(value) for value in identities))
        if len(identities) > 32:
            raise ValueError('Select at most 32 thread identities per capture batch')
    root = Path(profile) / '.codex'
    catalog = shared.latest(root, 'state_*.sqlite')
    coverage = {'provider': 'codex', 'catalog': 0, 'examined': 0, 'captured': 0,
                'unavailable': 0, 'partial': 0, 'metadata_only': 0}
    if not catalog:
        return [], {**coverage, 'state': 'unavailable'}
    try:
        with closing(shared.database(catalog)) as conn:
            conn.row_factory = sqlite3.Row
            fields = _fields(conn, 'threads')
            if 'id' not in fields:
                return [], {**coverage, 'state': 'unavailable', 'reason': 'catalog-schema'}
            coverage['catalog'] = conn.execute('select count(*) from threads').fetchone()[0]
            order = 'updated_at' if 'updated_at' in fields else 'id'
            where, params = '', ()
            if identities is not None:
                where = ' where id in (' + ','.join('?' for _ in identities) + ')' if identities else ' where 0'
                params = tuple(identities)
            selected = conn.execute('select count(*) from threads' + where, params).fetchone()[0]
            coverage['selected'] = selected
            query = 'select * from threads' + where + ' order by ' + order + ' desc'
            rows = [dict(row) for row in conn.execute(query + ' limit ?', (*params, limit))] if limit is not None else [dict(row) for row in conn.execute(query, params)]
            edges = {}
            if {'parent_thread_id', 'child_thread_id'} <= _fields(conn, 'thread_spawn_edges'):
                edges = dict(conn.execute('select child_thread_id,parent_thread_id from thread_spawn_edges'))
    except sqlite3.Error:
        return [], {**coverage, 'state': 'unavailable', 'reason': 'catalog-read'}

    history = shared.latest(root, 'thread_history_*.sqlite')
    hist = None
    history_fields, turn_fields, projection_fields = set(), set(), set()
    if history:
        try:
            hist = shared.database(history)
            hist.row_factory = sqlite3.Row
            history_fields = _fields(hist, 'thread_items')
            turn_fields = _fields(hist, 'thread_turns')
            projection_fields = _fields(hist, 'thread_history_projection_state')
        except sqlite3.Error:
            if hist:
                hist.close()
            hist = None
    records = []
    try:
        for row in rows:
            coverage['examined'] += 1
            identity = str(row['id'])
            if not shared.IDENT.fullmatch(identity):
                coverage['unavailable'] += 1
                continue
            kind, parent, spawned = _kind(row, edges.get(identity))
            started = row.get('created_at_ms') or row.get('created_at') or row.get('updated_at_ms') or row.get('updated_at')
            ended = row.get('updated_at_ms') or row.get('updated_at') or started
            if started is None:
                coverage['unavailable'] += 1
                continue
            title = row.get('name') or row.get('title') or 'Codex session'
            cwd = row.get('cwd') or ''
            prompts, replies, injected, thinking, calls, attachments, turns = [], [], [], [], [], [], []
            source_items, candidates, touched, models = [], [], [], []
            files, tools, omissions = Counter(), Counter(), Counter()
            gaps, provenance, ledger, seen_ledger = [], {}, [], {}
            db_ids, db_data, db_source_ids, db_digests = set(), {}, {}, {}
            sources = {'history': {'state': 'unavailable'}, 'rollout': {'state': 'unavailable'}}
            metadata = {'catalog': shared.clean_payload(row)}
            if row.get('model'):
                models.append(row['model'])

            def native(value, canonical=False):
                return shared.clean_payload(value, omissions if canonical else None)

            def project(item, envelope, projected=False):
                item_type = item.get('type') or envelope.get('type')
                base = {key: envelope[key] for key in ('turn_id', 'ordinal', 'at') if envelope.get(key) is not None}
                base['id'] = str(item.get('id') or envelope.get('native_id') or envelope['id'])
                base['source_id'] = envelope.get('source_id', envelope['id'])
                if item_type in ('userMessage', 'message') and (item_type == 'userMessage' or item.get('role') == 'user'):
                    origin = _origin(provenance.get(str(item.get('id') or envelope.get('native_id') or envelope['id']), {}), kind, projected)
                    text = _text(item.get('content'))
                    message = {**base, 'text': text}
                    message['provenance' if origin['kind'] == 'user' else 'origin'] = native(origin)
                    content = item.get('content') or []
                    media = [native(part) for part in content if isinstance(part, dict) and part.get('type') not in ('text', 'input_text', 'output_text')]
                    if media:
                        message['attachments'] = media
                        attachments.extend({**base, 'data': part} for part in media)
                    # Image-only turns are still owner turns. Technical prompts
                    # remain evidence but do not increment the owner's exchanges.
                    (prompts if origin['kind'] == 'user' else injected).append(message)
                elif item_type in ('agentMessage', 'message') and (item_type == 'agentMessage' or item.get('role') == 'assistant'):
                    text = item.get('text') if item_type == 'agentMessage' else _text(item.get('content'))
                    if text:
                        replies.append({**base, 'text': text, 'phase': item.get('phase'),
                                        'origin': {'kind': 'assistant'}})
                elif item_type == 'reasoning':
                    text = '\n'.join(value for value in (_text(item.get('summary')), _text(item.get('content'))) if value)
                    if text:
                        thinking.append({**base, 'text': text, 'scope': 'provider-exposed'})
                elif item_type in ('commandExecution', 'mcpToolCall', 'collabAgentToolCall', 'fileChange',
                                   'webSearch', 'imageView', 'imageGeneration', 'dynamicToolCall'):
                    name = _name(item)
                    tools[name] += 1
                    calls.append(_call_projection(item, base))
                    if item.get('cwd'):
                        touched.append(item['cwd'])
                    for change in item.get('changes') or []:
                        if isinstance(change, dict) and isinstance(change.get('path'), str):
                            touched.append(change['path'])
                            files[change['path']] += 1

            if hist and {'thread_id', 'item_json'} <= history_fields:
                try:
                    order = 'rollout_ordinal' if 'rollout_ordinal' in history_fields else 'rowid'
                    count = 0
                    for index, stored in enumerate(hist.execute('select * from thread_items where thread_id=? order by ' + order, (identity,))):
                        stored = dict(stored)
                        try:
                            item = json.loads(stored.pop('item_json'))
                            if not isinstance(item, dict):
                                raise ValueError('Item is not an object')
                        except (ValueError, TypeError):
                            gaps.append({'source': 'history', 'reason': 'malformed-item', 'ordinal': stored.get('rollout_ordinal', index)})
                            continue
                        item_id = str(stored.get('item_id') or item.get('id') or 'history:' + str(stored.get('rollout_ordinal', index)))
                        envelope = {'id': 'history:' + item_id, 'native_id': item_id,
                                    'turn_id': stored.get('turn_id'),
                                    'ordinal': stored.get('rollout_ordinal', index),
                                    'at': _when(stored.get('created_at_ms'), ended),
                                    'type': item.get('type') or stored.get('item_type', 'unknown'),
                                    'source': 'history-database', 'data': native(item, canonical=True),
                                    'metadata': native(stored)}
                        item.setdefault('type', envelope['type'])
                        source_items.append(envelope)
                        candidates.append((item, envelope, True))
                        db_ids.add(item_id)
                        db_data[item_id] = item
                        db_source_ids[item_id] = envelope['id']
                        db_digests[item_id] = _body_digest(envelope['data'])
                        count += 1
                    sources['history'] = {'state': 'available', 'items': count}
                    if {'thread_id', 'turn_id'} <= turn_fields:
                        turns = [native(dict(value)) for value in hist.execute('select * from thread_turns where thread_id=? order by rollout_ordinal' if 'rollout_ordinal' in turn_fields else 'select * from thread_turns where thread_id=?', (identity,))]
                    if 'thread_id' in projection_fields:
                        projected = hist.execute('select * from thread_history_projection_state where thread_id=?', (identity,)).fetchone()
                        if projected:
                            sources['history']['projection'] = native(dict(projected))
                except sqlite3.Error:
                    sources['history']['state'] = 'read-error'
                    gaps.append({'source': 'history', 'reason': 'read-error'})

            path = _rollout_path(root, row.get('rollout_path'))
            if path:
                count, malformed, inherited, duplicates = 0, 0, 0, 0
                owned_context = kind not in ('subagent', 'guardian_review')
                context_start = None
                try:
                    observed_bytes = path.stat().st_size
                    with path.open(encoding='utf-8') as stream:
                        for ordinal, line in enumerate(stream):
                            try:
                                raw = json.loads(line)
                                if not isinstance(raw, dict):
                                    raise ValueError('Event is not an object')
                            except (ValueError, TypeError):
                                malformed += 1
                                continue
                            item_type = raw.get('type', 'unknown')
                            payload = raw.get('payload') or {}
                            if not isinstance(payload, dict):
                                payload = {'value': payload}
                            if item_type == 'session_meta':
                                session_identity = payload.get('id') or payload.get('session_id')
                                owned_context = (session_identity == identity if session_identity else kind not in ('subagent', 'guardian_review'))
                                context_start = payload.get('subagent_history_start_ordinal') if owned_context else None
                                metadata.setdefault('session_meta', []).append(native(payload))
                                if owned_context and not parent and payload.get('parent_thread_id'):
                                    parent = payload['parent_thread_id']
                            explicit_identity = payload.get('thread_id') or payload.get('session_id')
                            owned = explicit_identity == identity if explicit_identity else owned_context
                            if not explicit_identity and item_type != 'session_meta' and isinstance(context_start, int) and ordinal < context_start:
                                owned = False
                            event_id = str(payload.get('id') or payload.get('response_id') or 'rollout:' + str(ordinal))
                            digest = hashlib.sha256(json.dumps(raw, ensure_ascii=True, sort_keys=True,
                                                               separators=(',', ':')).encode('utf-8')).hexdigest()[:20]
                            envelope = {'id': 'rollout:' + str(ordinal) + ':' + digest, 'native_id': event_id,
                                        'turn_id': payload.get('turn_id'), 'ordinal': ordinal,
                                        'at': _when(raw.get('timestamp'), ended), 'type': item_type,
                                        'source': 'rollout', 'ownership': 'own' if owned else 'inherited'}
                            if not owned:
                                # A child received this inherited snapshot even
                                # when its parent archive is missing or newer.
                                # Retain the evidence without attributing the
                                # parent's prompts, work or usage to the child.
                                inherited += 1
                                envelope['data'] = native(raw, canonical=True)
                                source_items.append(envelope)
                                count += 1
                                continue
                            if item_type == 'response_item' and payload.get('type') == 'message':
                                meta = _object(payload.get('internal_chat_message_metadata_passthrough'))
                                provenance[event_id] = meta
                                envelope['turn_id'] = meta.get('turn_id') or envelope['turn_id']
                            data = {**raw, 'payload': dict(payload)}
                            # The DB projection has the same item body. Keep the
                            # native event's additional fields and an explicit
                            # reference, rather than a second copy of the body.
                            if item_type == 'response_item' and event_id in db_ids:
                                retained = {k: v for k, v in payload.items()
                                            if k not in db_data[event_id] or v != db_data[event_id][k]}
                                data['payload'] = {**retained, 'source_item_ref': db_source_ids[event_id],
                                                   'source_item_digest': db_digests[event_id]}
                            if item_type == 'event_msg' and payload.get('type') == 'item_completed':
                                completed = payload.get('item') or {}
                                completed_id = str(completed.get('id') or '')
                                if completed_id in db_ids and completed == db_data[completed_id]:
                                    data['payload']['item'] = {'source_item_ref': db_source_ids[completed_id],
                                                               'source_item_digest': db_digests[completed_id]}
                                elif isinstance(completed, dict) and completed:
                                    own_envelope = {**envelope, 'native_id': completed_id or event_id,
                                                    'source_id': envelope['id'],
                                                    'type': completed.get('type', 'unknown')}
                                    candidates.append((completed, own_envelope, True))
                            envelope['data'] = native(data, canonical=True)
                            source_items.append(envelope)
                            count += 1
                            if item_type == 'response_item' and event_id not in db_ids:
                                candidates.append((payload, envelope, False))
                            elif item_type == 'token_usage_record':
                                key = payload.get('response_id')
                                if key and key in seen_ledger:
                                    ledger[seen_ledger[key]] = native(payload)
                                    duplicates += 1
                                else:
                                    if key:
                                        seen_ledger[key] = len(ledger)
                                    ledger.append(native(payload))
                            elif item_type == 'turn_context' and payload.get('model'):
                                models.append(payload['model'])
                    sources['rollout'] = {'state': 'available', 'items': count, 'observed_bytes': observed_bytes,
                                          'inherited_events': inherited, 'own_items': count - inherited,
                                          'malformed_events': malformed,
                                          'usage_duplicates': duplicates}
                    if malformed:
                        gaps.append({'source': 'rollout', 'reason': 'malformed-events', 'count': malformed})
                    if inherited:
                        gaps.append({'source': 'rollout', 'reason': 'inherited-context-retained',
                                     'scope': 'own-item-attribution', 'count': inherited})
                    projection = sources['history'].get('projection') or {}
                    if projection.get('next_rollout_byte_offset') is not None:
                        sources['history']['projection_bytes_behind'] = max(0, observed_bytes - projection['next_rollout_byte_offset'])
                except (OSError, UnicodeError):
                    sources['rollout'] = {'state': 'read-error'}
                    gaps.append({'source': 'rollout', 'reason': 'read-error'})

            # An inherited rollout can contain parent prompts with the same IDs.
            # Only accepted own-source envelopes may supply their provenance.
            projected_ids = set()
            for item, envelope, projected in candidates:
                projection_id = str(item.get('id') or envelope.get('native_id') or envelope['id'])
                if projection_id in projected_ids:
                    continue
                projected_ids.add(projection_id)
                project(item, envelope, projected)
            if not source_items:
                coverage['unavailable'] += 1
                coverage['metadata_only'] += 1
                gaps.append({'source': 'conversation', 'reason': 'source-unavailable', 'scope': 'metadata-only'})
            elif sources['rollout']['state'] != 'available':
                gaps.append({'source': 'rollout', 'reason': 'unavailable', 'scope': 'history-projection-only'})
            partial = bool(gaps)
            capture_info = {'state': 'partial' if partial else 'complete', 'sources': sources,
                            'gaps': gaps, 'omissions': dict(omissions), 'lifetime_limit': None,
                            'own_evidence_state': 'available' if any(item.get('ownership') != 'inherited' for item in source_items) else 'unavailable',
                            'kind_basis': 'catalog' if kind != 'unknown' else 'unknown'}
            extra = {'kind': kind, 'source_items': source_items, 'turns': turns, 'calls': calls,
                     'injected': injected, 'thinking': thinking, 'attachments': attachments,
                     'files': {path: {'fileChange': count} for path, count in files.items()},
                     'models': list(dict.fromkeys(models)), 'source_metadata': metadata,
                     'usage_ledger': ledger,
                     'usage': {'state': 'available' if ledger else 'unavailable', 'scope': 'request-traffic',
                               'source': 'token_usage_record', 'ledger_records': len(ledger),
                               'duplicates': sources['rollout'].get('usage_duplicates', 0)},
                     'capture': capture_info}
            if parent:
                extra['parent'] = {'session_id': parent, 'short': shared.short_id('codex', parent)}
            if spawned:
                extra['lineage'] = native(spawned)
            source = 'history-database' if sources['history'].get('items') else 'rollout' if source_items else 'catalog'
            records.append(shared.record('codex', identity, title, started, ended, prompts, replies,
                                         tools, cwd, touched, checkouts, source, partial, **extra))
            coverage['captured'] += 1
            coverage['partial'] += partial
    finally:
        if hist:
            hist.close()
    return records, {**coverage, 'state': 'ready', 'limited': len(rows) < coverage['selected']}
