"""Keep daily token totals from Claude Code's laptop logs, without copying content.

Counts cover only locally retained Claude Code responses, including subagents.
Days use UTC. Repeated stream entries and copied transcripts share one response
identity. The four top-level usage fields are disjoint; nested breakdowns and
iterations must never be added again.
"""
import hashlib
import json
from pathlib import Path

from usage_history import connect, instant, number, set_meta

FIELDS = ('input_tokens', 'output_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens')
MAX_LINE = 16 * 1024 * 1024


def identity(value):
    return hashlib.sha256(value.encode('utf-8')).hexdigest()


def response(row):
    if not isinstance(row, dict) or row.get('type') != 'assistant':
        return None
    message = row.get('message')
    if not isinstance(message, dict) or not isinstance(message.get('usage'), dict):
        return None
    ident = message.get('id')
    at = instant(row.get('timestamp'))
    if not isinstance(ident, str) or not 0 < len(ident) <= 300 or not at:
        return None
    values = []
    for field in FIELDS:
        value = number(message['usage'].get(field, 0) if field not in FIELDS[:2] else message['usage'].get(field), 9_000_000_000_000)
        if value is None or value != int(value):
            return None
        values.append(int(value))
    return identity(ident), at, values


def collect(state, root, at):
    """Scan new complete lines; retain totals when a source log disappears."""
    root = Path(root)
    with connect(state) as db:
        db.executescript('''
            CREATE TABLE IF NOT EXISTS claude_token_responses (
                id TEXT PRIMARY KEY, day TEXT, at TEXT,
                input INTEGER, output INTEGER, cache_read INTEGER, cache_creation INTEGER);
            CREATE TABLE IF NOT EXISTS claude_token_files (
                id TEXT PRIMARY KEY, inode TEXT, offset INTEGER, size INTEGER, modified INTEGER);
        ''')
        changed = set()
        files, failures = 0, 0
        for path in root.rglob('*.jsonl') if root.is_dir() else ():
            try:
                stat = path.stat()
                key = identity(str(path.resolve()))
                previous = db.execute('SELECT inode,offset,size,modified FROM claude_token_files WHERE id=?', (key,)).fetchone()
                if previous and previous[2:] == (stat.st_size, stat.st_mtime_ns):
                    files += 1
                    continue
                offset = previous[1] if previous and previous[0] == str(stat.st_ino) and stat.st_size > previous[2] else 0
                with path.open('rb') as stream:
                    stream.seek(offset)
                    while True:
                        begin = stream.tell()
                        line = stream.readline(MAX_LINE + 1)
                        if not line:
                            break
                        if len(line) > MAX_LINE:
                            while line and not line.endswith(b'\n'):
                                line = stream.readline(MAX_LINE + 1)
                            if not line:
                                stream.seek(begin)
                                break
                            continue
                        if not line.endswith(b'\n'):
                            stream.seek(begin)  # A writer may still be appending this record.
                            break
                        try:
                            item = response(json.loads(line))
                        except (ValueError, UnicodeError):
                            continue
                        if not item:
                            continue
                        ident, timestamp, values = item
                        old = db.execute('SELECT day,at,input,output,cache_read,cache_creation FROM claude_token_responses WHERE id=?', (ident,)).fetchone()
                        first = min(timestamp, old[1]) if old else timestamp
                        day = first[:10]
                        # Streaming records repeat the request's usage and may later
                        # report larger counters. Keep each counter once per response.
                        values = [max(value, old[n + 2]) if old else value for n, value in enumerate(values)]
                        db.execute('INSERT INTO claude_token_responses VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET day=excluded.day,at=excluded.at,input=excluded.input,output=excluded.output,cache_read=excluded.cache_read,cache_creation=excluded.cache_creation', (ident, day, first, *values))
                        changed.add(day)
                        if old:
                            changed.add(old[0])
                    offset = stream.tell()
                db.execute('INSERT INTO claude_token_files VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET inode=excluded.inode,offset=excluded.offset,size=excluded.size,modified=excluded.modified', (key, str(stat.st_ino), offset, stat.st_size, stat.st_mtime_ns))
                files += 1
            except OSError:
                failures += 1
        for day in changed:
            tokens = db.execute('SELECT COALESCE(SUM(input+output+cache_read+cache_creation),0) FROM claude_token_responses WHERE day=?', (day,)).fetchone()[0]
            db.execute('INSERT INTO token_days VALUES (?,?,?,?) ON CONFLICT(provider,day) DO UPDATE SET tokens=excluded.tokens,observed_at=excluded.observed_at', ('claude', day, tokens, at))
        set_meta(db, 'claudeTokenStatus', 'partial' if failures else 'available' if files else 'waiting')
        set_meta(db, 'claudeTokenCheckedAt', at)

