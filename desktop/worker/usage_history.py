from contextlib import contextmanager
import math
import sqlite3
from datetime import datetime, timezone
from pathlib import Path


def instant(value):
    try:
        return datetime.fromisoformat(str(value).replace('Z', '+00:00')).astimezone(timezone.utc).isoformat()
    except (TypeError, ValueError, OverflowError):
        return None


def number(value, maximum=100):
    return value if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and 0 <= value <= maximum else None


@contextmanager
def connect(state):
    Path(state).mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(Path(state) / 'usage-history.sqlite3', timeout=2)
    db.executescript('''
        CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS observations (
            provider TEXT, bucket TEXT, at TEXT, reset TEXT, used REAL, minutes REAL, label TEXT,
            PRIMARY KEY (provider,bucket,at,reset));
        CREATE TABLE IF NOT EXISTS reset_readings (
            provider TEXT, bucket TEXT, reset TEXT, minutes REAL, label TEXT,
            first_at TEXT, last_at TEXT, peak REAL, last_used REAL, samples INTEGER,
            PRIMARY KEY (provider,bucket,reset));
        CREATE TABLE IF NOT EXISTS token_days (
            provider TEXT, day TEXT, tokens INTEGER, observed_at TEXT,
            PRIMARY KEY (provider,day));
    ''')
    try:
        with db:
            yield db
    finally:
        db.close()


def meta(db, key, default=None):
    row = db.execute('SELECT value FROM metadata WHERE key=?', (key,)).fetchone()
    return row[0] if row else default


def set_meta(db, key, value):
    db.execute('INSERT INTO metadata VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', (key, str(value)))


def record(db, provider, window, point, legacy=False):
    key, label = window.get('id'), window.get('label')
    at, reset, used = instant(point.get('at')), instant(point.get('resetsAt')), number(point.get('usedPercent'))
    if not isinstance(key, str) or not 0 < len(key) <= 160 or not at or not reset or used is None or at > reset:
        return
    label = label[:100] if isinstance(label, str) else 'Limit'
    minutes = number(window.get('durationMinutes'), 525600)
    if legacy and reset != instant(window.get('resetsAt')):
        fixed = {'gemini-weekly': 10080, 'gemini-5h': 300} if provider == 'gemini' else {
            'five_hour': 300, 'seven_day': 10080, 'seven_day_sonnet': 10080,
            'seven_day_opus': 10080, 'seven_day_fable': 10080, 'seven_day_cowork': 10080} if provider == 'claude' else {}
        minutes = fixed.get(key)
    minutes = minutes if minutes and minutes > 0 else None
    if not legacy:
        latest = db.execute('SELECT at,reset FROM observations WHERE provider=? AND bucket=? ORDER BY at DESC LIMIT 1', (provider, key)).fetchone()
        if latest and latest[1] == reset and datetime.fromisoformat(at).timestamp() - datetime.fromisoformat(latest[0]).timestamp() < 300:
            db.execute('''UPDATE reset_readings SET peak=MAX(peak,?),last_used=CASE WHEN last_at<=? THEN ? ELSE last_used END,
                last_at=MAX(last_at,?) WHERE provider=? AND bucket=? AND reset=?''', (used, at, used, at, provider, key, reset))
            return
    inserted = db.execute('INSERT OR IGNORE INTO observations VALUES (?,?,?,?,?,?,?)', (provider, key, at, reset, used, minutes, label)).rowcount
    if not inserted:
        return
    db.execute('''INSERT INTO reset_readings VALUES (?,?,?,?,?,?,?,?,?,1)
        ON CONFLICT(provider,bucket,reset) DO UPDATE SET
        minutes=COALESCE(excluded.minutes,reset_readings.minutes),label=excluded.label,
        first_at=MIN(first_at,excluded.first_at),last_at=MAX(last_at,excluded.last_at),
        peak=MAX(peak,excluded.peak),last_used=CASE WHEN last_at<=excluded.last_at THEN excluded.last_used ELSE last_used END,
        samples=samples+1''', (provider, key, reset, minutes, label, at, at, used, used))


def store(state, providers, previous=(), token_reader=None, at=None):
    at = instant(at) or datetime.now(timezone.utc).isoformat()
    with connect(state) as db:
        if not meta(db, 'legacyImported'):
            for provider in previous or providers:
                key = provider.get('provider')
                if key not in ('codex', 'gemini', 'claude'):
                    continue
                for window in provider.get('windows') or []:
                    for point in window.get('history') or []:
                        record(db, key, window, point, legacy=True)
            set_meta(db, 'legacyImported', at)
        for provider in providers:
            key = provider.get('provider')
            observed = instant(provider.get('observedAt'))
            if key not in ('codex', 'gemini', 'claude') or provider.get('status') != 'available' or not observed:
                continue
            for window in provider.get('windows') or []:
                record(db, key, window, {'at': observed, 'usedPercent': window.get('usedPercent'), 'resetsAt': window.get('resetsAt')})
        set_meta(db, 'updatedAt', at)
        db.commit()
        last = instant(meta(db, 'codexTokenAttempt'))
        if token_reader and (not last or datetime.fromisoformat(at).timestamp() - datetime.fromisoformat(last).timestamp() >= 21600):
            set_meta(db, 'codexTokenAttempt', at)
            db.commit()
            try:
                payload = token_reader()
                rows = payload.get('dailyUsageBuckets')
                if not isinstance(rows, list):
                    raise ValueError('unavailable')
                for row in rows:
                    day, tokens = row.get('startDate'), number(row.get('tokens'), 9_000_000_000_000_000)
                    if not isinstance(day, str) or len(day) != 10 or tokens is None or int(tokens) != tokens:
                        continue
                    try:
                        datetime.strptime(day, '%Y-%m-%d')
                    except ValueError:
                        continue
                    db.execute('INSERT INTO token_days VALUES (?,?,?,?) ON CONFLICT(provider,day) DO UPDATE SET tokens=excluded.tokens,observed_at=excluded.observed_at', ('codex', day, int(tokens), at))
                set_meta(db, 'codexTokenStatus', 'available')
            except Exception:
                set_meta(db, 'codexTokenStatus', 'unavailable')


def read(state):
    with connect(state) as db:
        db.row_factory = sqlite3.Row
        periods = [dict(r) for r in db.execute('SELECT * FROM reset_readings ORDER BY reset,provider,bucket')]
        days = [dict(r) for r in db.execute('SELECT * FROM token_days ORDER BY day,provider')]
        return {'schemaVersion': 1, 'updatedAt': meta(db, 'updatedAt'), 'periods': periods, 'tokenDays': days,
                'codexTokenStatus': meta(db, 'codexTokenStatus', 'unavailable'),
                'claudeTokenStatus': meta(db, 'claudeTokenStatus', 'waiting'),
                'tokenSources': {'codex': 'Account-reported dates', 'claude': 'Laptop Claude Code logs, UTC dates, partial account coverage'}}
