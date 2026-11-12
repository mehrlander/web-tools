"""Capture conversation prose from local stores without modifying their databases."""
from collections import Counter
from contextlib import closing
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import sqlite3
from urllib.parse import unquote, urlsplit

IDENT = re.compile(r'^[A-Za-z0-9_-]{8,96}$')


def stamp(value=None):
    if isinstance(value, (int, float)):
        date = datetime.fromtimestamp(value / 1000 if value > 1e11 else value, timezone.utc)
    elif value:
        date = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
        if date.tzinfo is None: date = date.replace(tzinfo=timezone.utc)
    else:
        date = datetime.now(timezone.utc)
    return date.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')


def database(path):
    return sqlite3.connect(Path(path).resolve().as_uri() + '?mode=ro', uri=True, timeout=3)


def latest(root, pattern):
    return max(root.glob(pattern), key=lambda p: int(re.search(r'_(\d+)\.', p.name)[1]), default=None)


def repo_paths(cwd, touched, checkouts):
    """Path evidence links a session to checkouts, without asserting authorship."""
    found = []
    paths = [str(p).replace('\\', '/').casefold().rstrip('/') for p in [cwd, *touched] if p]
    for co in checkouts:
        root = str(co['path']).replace('\\', '/').casefold().rstrip('/')
        if any(p == root or p.startswith(root + '/') for p in paths):
            found.append({'name': co.get('repo') or co['path'].name, 'checkout': co['id'],
                          'basis': 'observed-path', 'lines': 0})
    return found


def record(provider, identity, title, started, ended, prompts, replies, tools, cwd, touched, checkouts, source, partial=False):
    # The existing session filename grammar accepts hex ids. Namespace the full
    # provider id before deriving the public join key, retaining the original.
    short = hashlib.sha256((provider + ':' + identity).encode()).hexdigest()[:16]
    day = stamp(started)[:10]
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', day):
        raise ValueError('Session date unavailable')
    rec = {'schema': 5, 'format': 'local-conversation/1', 'session_id': identity, 'short': short,
           'assistant': provider, 'engine': 'codex' if provider == 'codex' else 'antigravity',
           'venue': 'laptop', 'title': title, 'day': day, 'started': stamp(started), 'ended': stamp(ended),
           'opening_ask': prompts[0]['text'] if prompts else '', 'prompts': prompts, 'replies': replies,
           'exchanges': len(prompts), 'prompts_stored': len(prompts), 'replies_total': len(replies),
           'replies_stored': len(replies), 'assistant_messages': len(replies), 'tools': dict(tools),
           'repos': repo_paths(cwd, touched, checkouts),
           'capture': {'source': source, 'state': 'partial' if partial else 'prose',
                       'scope': 'user and assistant prose; reasoning and tool output excluded'}}
    return f'sessions/{day[:4]}/{day[5:7]}/{day}-{short}.json', rec


def codex(profile, checkouts, limit=256):
    root = Path(profile) / '.codex'
    catalog = latest(root, 'state_*.sqlite')
    coverage = {'provider': 'codex', 'catalog': 0, 'examined': 0, 'captured': 0, 'unavailable': 0, 'partial': 0}
    if not catalog:
        return [], {**coverage, 'state': 'unavailable'}
    records = []
    with closing(database(catalog)) as conn:
        fields = {r[1] for r in conn.execute('pragma table_info(threads)')}
        title = "COALESCE(NULLIF(name,''),title,'Codex session')" if 'name' in fields else "COALESCE(title,'Codex session')"
        coverage['catalog'] = conn.execute('select count(*) from threads').fetchone()[0]
        rows = conn.execute(f'select id,{title},cwd,rollout_path,created_at,updated_at from threads order by updated_at desc limit ?', (limit,)).fetchall()
    history = latest(root, 'thread_history_*.sqlite')
    hist = database(history) if history else None
    try:
        for identity, title, cwd, rollout, started, ended in rows:
            coverage['examined'] += 1
            if not IDENT.fullmatch(identity):
                coverage['unavailable'] += 1
                continue
            prompts, replies, tools, touched = [], [], Counter(), []
            source, partial = 'history-database', False
            items = []
            if hist:
                try:
                    items = hist.execute("select item_json,item_type,created_at_ms from thread_items where thread_id=? and item_type in ('userMessage','agentMessage','fileChange') order by rollout_ordinal limit 10001", (identity,)).fetchall()
                except sqlite3.Error:
                    pass
            if items:
                partial = len(items) > 10000
                for raw, kind, at in items[:10000]:
                    try:
                        item = json.loads(raw)
                    except (ValueError, TypeError):
                        partial = True
                        continue
                    if kind == 'userMessage':
                        text = '\n'.join(c.get('text', '') for c in item.get('content', []) if isinstance(c, dict) and c.get('type') in ('text', 'input_text'))
                        if text: prompts.append({'at': stamp(at), 'text': text})
                    elif kind == 'agentMessage' and item.get('text'):
                        replies.append({'at': stamp(at), 'text': item['text']})
                    elif kind == 'fileChange':
                        touched.extend(x.get('path', '') for x in item.get('changes', []) if isinstance(x, dict))
                        tools['fileChange'] += 1
            else:
                source = 'rollout'
                # Never follow a catalog pointer outside the known transcript roots.
                path = Path(str(rollout or '').removeprefix('\\\\?\\'))
                if not any(path.is_relative_to(root / folder) for folder in ('sessions', 'archived_sessions')) or not path.is_file():
                    coverage['unavailable'] += 1
                    continue
                with path.open(encoding='utf-8') as stream:
                    for index, line in enumerate(stream):
                        if index >= 100000:
                            partial = True
                            break
                        try: item = json.loads(line)
                        except ValueError:
                            partial = True
                            continue
                        payload = item.get('payload') or {}
                        if item.get('type') != 'response_item' or payload.get('type') != 'message': continue
                        role = payload.get('role')
                        text = '\n'.join(x.get('text', '') for x in payload.get('content', []) if isinstance(x, dict) and x.get('type') in ('input_text', 'output_text'))
                        if role in ('user', 'assistant') and text:
                            (prompts if role == 'user' else replies).append({'at': item.get('timestamp', stamp(ended)), 'text': text})
            if not prompts and not replies:
                coverage['unavailable'] += 1
                continue
            records.append(record('codex', identity, title, started, ended, prompts, replies, tools, cwd, touched, checkouts, source, partial))
            coverage['captured'] += 1
            coverage['partial'] += partial
    finally:
        if hist: hist.close()
    return records, {**coverage, 'state': 'ready', 'limited': len(rows) < coverage['catalog']}


def gemini(profile, checkouts, limit=256):
    root = Path(profile) / '.gemini/antigravity'
    coverage = {'provider': 'gemini', 'catalog': 0, 'examined': 0, 'captured': 0, 'unavailable': 0, 'partial': 0}
    if not (root / 'conversation_summaries.db').is_file():
        return [], {**coverage, 'state': 'unavailable'}
    with closing(database(root / 'conversation_summaries.db')) as conn:
        coverage['catalog'] = conn.execute("select count(*) from conversation_summaries where killed=0 and title!=''").fetchone()[0]
        rows = conn.execute("select conversation_id,title,workspace_uris from conversation_summaries where killed=0 and title!='' order by last_modified_time desc limit ?", (limit,)).fetchall()
    records = []
    for identity, title, workspace in rows:
        coverage['examined'] += 1
        if not IDENT.fullmatch(identity):
            coverage['unavailable'] += 1
            continue
        path = root / 'brain' / identity / '.system_generated/logs/transcript.jsonl'
        if not path.is_file():
            coverage['unavailable'] += 1
            continue
        steps, partial = {}, False
        with path.open(encoding='utf-8') as stream:
            for index, line in enumerate(stream):
                if index >= 100000:
                    partial = True
                    break
                try: item = json.loads(line)
                except ValueError:
                    partial = True
                    continue
                steps[item.get('step_index', index)] = item
        prompts, replies, tools, touched, times = [], [], Counter(), [], []
        # Workspace URIs are hints only; tool paths establish additional associations.
        try: workspaces = json.loads(workspace or '[]')
        except (ValueError, TypeError): workspaces = [workspace] if workspace else []
        if isinstance(workspaces, str): workspaces = [workspaces]
        if not isinstance(workspaces, list): workspaces = []
        for uri in workspaces:
            if not isinstance(uri, str): continue
            value = unquote(urlsplit(uri).path) if uri.startswith('file:') else uri
            if re.match(r'^/[A-Za-z]:', value): value = value[1:]
            touched.append(value)
        cwd = ''
        for _, item in sorted(steps.items(), key=lambda x: str(x[0]).zfill(12)):
            at, text = item.get('created_at'), item.get('content')
            if at: times.append(at)
            if item.get('source') == 'USER_EXPLICIT' and item.get('type') == 'USER_INPUT' and text:
                prompts.append({'at': at, 'text': text})
            elif item.get('source') == 'MODEL' and item.get('type') == 'PLANNER_RESPONSE':
                if text: replies.append({'at': at, 'text': text})
                for call in item.get('tool_calls', []):
                    tools[call.get('name', 'unknown')] += 1
                    args = call.get('args') or {}
                    if isinstance(args, dict):
                        touched.extend(args[k] for k in ('TargetFile', 'AbsolutePath', 'DirectoryPath') if isinstance(args.get(k), str))
        if not times or not (prompts or replies):
            coverage['unavailable'] += 1
            continue
        records.append(record('gemini', identity, title, min(times), max(times), prompts, replies, tools, cwd, touched, checkouts, 'trajectory', partial))
        coverage['captured'] += 1
        coverage['partial'] += partial
    return records, {**coverage, 'state': 'ready', 'limited': len(rows) < coverage['catalog']}
