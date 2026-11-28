"""Shared local-session format and read-only provider adapters.

local-conversation/2 has its own schema numbering. Source items retain provider
identities, ordering and payloads; prompts, replies and calls are projections.
Capture gaps describe unavailable evidence. Only media bytes and opaque encrypted
reasoning are replaced by hashed notes. Collection limits select threads, without
imposing a lifetime limit on the evidence within a selected thread.
"""
from datetime import datetime, timezone
import base64
import hashlib
import json
from pathlib import Path
import re
import sqlite3
from urllib.parse import unquote, urlsplit

IDENT = re.compile(r'^[A-Za-z0-9_-]{8,96}$')
FORMAT = 'local-conversation/2'


def stamp(value=None):
    if isinstance(value, (int, float)):
        date = datetime.fromtimestamp(value / 1000 if value > 1e11 else value, timezone.utc)
    elif value:
        date = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
        if date.tzinfo is None:
            date = date.replace(tzinfo=timezone.utc)
    else:
        date = datetime.now(timezone.utc)
    return date.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')


def database(path):
    return sqlite3.connect(Path(path).resolve().as_uri() + '?mode=ro', uri=True, timeout=3)


def latest(root, pattern):
    return max(root.glob(pattern), key=lambda p: int(re.search(r'_(\d+)\.', p.name)[1]), default=None)


def short_id(provider, identity):
    """Keep the existing provider-qualified join key and filename stable."""
    return hashlib.sha256((provider + ':' + identity).encode()).hexdigest()[:16]


def time_key(value):
    """Order UTC timestamps numerically even when their precision differs."""
    if not value:
        return float('-inf')
    try:
        return datetime.fromisoformat(stamp(value).replace('Z', '+00:00')).timestamp()
    except (ValueError, TypeError, OverflowError, OSError):
        return float('-inf')


def path_key(value):
    """Compare observed paths without resolving or traversing the filesystem."""
    value = str(value).replace('\\', '/')
    if value.startswith('file:'):
        value = unquote(urlsplit(value).path)
        if re.match(r'^/[A-Za-z]:', value):
            value = value[1:]
    if value.startswith('//?/UNC/'):
        value = '//' + value[8:]
    elif value.startswith('//?/'):
        value = value[4:]
    return value.casefold().rstrip('/')


def repo_paths(cwd, touched, checkouts):
    """Path evidence links checkouts without asserting commit authorship."""
    found = []
    paths = [path_key(p) for p in [cwd, *touched] if p]
    for co in checkouts:
        root = path_key(co['path'])
        if any(p == root or p.startswith(root + '/') for p in paths):
            found.append({'name': co.get('repo') or Path(co['path']).name,
                          'checkout': co['id'], 'basis': 'observed-path', 'lines': None})
    return found


def clean_payload(value, omissions=None):
    """Keep native evidence except narrowly identified opaque byte fields.

    Text, command output and unknown fields have no size caps or redactor.
    A field called data is treated as bytes only inside a media object.
    Recleaning an existing note leaves the note unchanged.
    """
    def note(item, kind):
        raw = item if isinstance(item, bytes) else str(item).encode('utf-8')
        if omissions is not None:
            omissions[kind] = omissions.get(kind, 0) + 1
        return {'omitted': kind, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}

    def walk(item, media=False):
        if isinstance(item, bytes):
            if media:
                return note(item, 'media_bytes')
            return {'encoding': 'base64', 'data': base64.b64encode(item).decode('ascii'),
                    'bytes': len(item), 'sha256': hashlib.sha256(item).hexdigest()}
        if isinstance(item, list):
            return [walk(x, media) for x in item]
        if not isinstance(item, dict):
            return item
        kind = str(item.get('type') or item.get('kind') or '').lower()
        mime = str(item.get('media_type') or item.get('mime_type') or item.get('mimeType') or '')
        is_media = media or kind in {'image', 'input_image', 'output_image', 'audio', 'input_audio',
                                    'video', 'document', 'image_url'} or mime.startswith(('image/', 'audio/', 'video/'))
        out = {}
        for key, child in item.items():
            if isinstance(child, dict) and child.get('omitted') in {'encrypted_content', 'media_bytes'}:
                out[key] = child
            elif key == 'encrypted_content' and child:
                out[key] = note(child, 'encrypted_content')
            elif isinstance(child, str) and child.startswith('data:') and key in {'url', 'uri', 'image_url', 'data', 'source', 'imageUrl'}:
                out[key] = note(child, 'media_bytes')
            elif is_media and key in {'data', 'base64', 'bytes', 'image_bytes', 'audio_bytes'} and child:
                out[key] = note(child, 'media_bytes')
            else:
                out[key] = walk(child, is_media and key == 'source')
        return out

    return walk(value)


def record(provider, identity, title, started, ended, prompts, replies, tools, cwd, touched,
           checkouts, source, partial=False, **extra):
    prompts = [dict(row) for row in prompts]
    for row in prompts:
        if isinstance(row.get('origin'), dict) and row['origin'].get('kind') in ('human', 'user'):
            row['provenance'] = row.pop('origin')
    short = short_id(provider, identity)
    day = stamp(started)[:10]
    capture = {'source': source, 'state': 'partial' if partial else 'complete',
               'scope': 'source evidence with conversation and activity projections',
               'captured_at': stamp(), 'gaps': [], 'omissions': {}}
    capture.update(extra.pop('capture', {}))
    if partial and capture['state'] == 'complete':
        capture['state'] = 'partial'
    rec = {'schema': 2, 'format': FORMAT, 'session_id': identity, 'short': short,
           'assistant': provider, 'engine': 'codex' if provider == 'codex' else 'antigravity',
           'venue': 'lenovo', 'kind': extra.pop('kind', 'unknown'), 'title': title or '',
           'day': day, 'started': stamp(started), 'ended': stamp(ended),
           'opening_ask': prompts[0].get('text', '') if prompts else '',
           'prompts': prompts, 'replies': replies, 'exchanges': len(prompts),
           'prompts_stored': len(prompts), 'replies_total': len(replies),
           'replies_stored': len(replies), 'assistant_messages': len(replies),
           'tools': dict(tools), 'repos': repo_paths(cwd, touched, checkouts),
           'source_items': [], 'models': [], 'files': {}, 'relationships': [],
           'capture': capture, **extra}
    for field, counter in (('calls', 'calls_total'), ('injected', 'injected_total'),
                           ('thinking', 'thinking_total'), ('attachments', 'attachments_total')):
        if field in rec:
            rec[counter] = len(rec[field])
    if 'calls' in rec:
        rec['failures'] = sum(row.get('ok') is False for row in rec['calls'])
    return record_path(rec), rec


def record_path(rec):
    day = rec['day']
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', day) or not re.fullmatch(r'[0-9a-f]{16}', rec['short']):
        raise ValueError('Session identity unavailable')
    if rec.get('assistant') and rec.get('session_id') and rec['short'] != short_id(rec['assistant'], rec['session_id']):
        raise ValueError('Captured join key does not match its full identity')
    return f'sessions/{day[:4]}/{day[5:7]}/{day}-{rec["short"]}.json'


def codex(profile, checkouts, limit=1024, identities=None):
    from codex_sessions import capture
    return capture(profile, checkouts, limit, identities=identities)


def gemini(profile, checkouts, limit=1024, identities=None):
    from gemini_sessions import capture
    return capture(profile, checkouts, limit, identities=identities)
