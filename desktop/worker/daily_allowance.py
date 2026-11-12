"""Derive bounded daily changes from account-level weekly allowance readings."""
from datetime import datetime, timedelta, timezone, time as day_time
import math
import time

WEEK = 7 * 86400
SHORT_INTERVAL = 30 * 60
RESET_JITTER = 120
EPSILON = .00001
PROVIDERS = ('codex', 'gemini', 'claude')


def instant(value):
    try:
        result = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
        return result.timestamp() if result.tzinfo else None
    except (ValueError, TypeError, OverflowError):
        return None


class Calendar:
    def __init__(self, zone=None):
        self.zone = zone

    def date(self, stamp):
        return datetime.fromtimestamp(stamp, self.zone).date()

    def midnight(self, date):
        # With zone=None, Windows supplies the historical local DST offset.
        return datetime.combine(date, day_time.min, tzinfo=self.zone).timestamp()


def selected(row):
    if row.get('minutes') != 10080:
        return False
    provider, bucket = row.get('provider'), row.get('bucket')
    return (provider == 'codex' and bucket in ('codex:primary', 'codex:secondary')
            or provider == 'gemini' and bucket == 'gemini-weekly'
            or provider == 'claude' and bucket == 'seven_day')


def restore_confirmations(values):
    """Index confirmed transitions while retaining the reported window limits."""
    result = {}
    for event in values or ():
        if not isinstance(event, dict) or not selected(event):
            continue
        before_at, at = instant(event.get('before_at')), instant(event.get('at'))
        before_reset, reset = instant(event.get('before_reset')), instant(event.get('reset'))
        before, after = event.get('before'), event.get('after')
        if (any(value is None for value in (before_at, at, before_reset, reset))
                or any(isinstance(value, bool) or not isinstance(value, (int, float))
                       or not 0 <= value <= 100 or not math.isfinite(value) for value in (before, after))
                or before <= after or before_at >= at
                or at >= min(before_reset, reset) or abs(reset - before_reset) > RESET_JITTER
                or before_at < before_reset - WEEK - RESET_JITTER or at < reset - WEEK - RESET_JITTER):
            continue
        key = (event['provider'], event['bucket'], before_at, at, before, after)
        result.setdefault(key, set()).add((before_reset, reset))
    return result


def build_daily(observations, periods=(), now=None, zone=None, confirmed_restores=()):
    now = datetime.now(timezone.utc).timestamp() if now is None else now
    calendar = Calendar(zone)
    today = calendar.date(now)
    points = {}
    candidates = list(observations) + [dict(row, at=row.get('last_at'), used=row.get('last_used')) for row in periods]
    for row in candidates:
        if not selected(row):
            continue
        at, reset, used = instant(row.get('at')), instant(row.get('reset')), row.get('used')
        if at is None or reset is None or at > now or at > reset or at < reset - WEEK - RESET_JITTER:
            continue
        if isinstance(used, bool) or not isinstance(used, (int, float)) or not math.isfinite(used) or not 0 <= used <= 100:
            continue
        key = (row['provider'], row['bucket'], at, reset)
        points[key] = dict(provider=row['provider'], bucket=row['bucket'], at=at, reset=reset, used=float(used))
    earliest = min((calendar.date(row['at']) for row in points.values()), default=today)
    first = max(today - timedelta(days=89), min(earliest, today - timedelta(days=6)))
    dates = [first + timedelta(days=i) for i in range((today - first).days + 1)]
    start, end = calendar.midnight(first), now
    providers = []
    restores = restore_confirmations(confirmed_restores)

    for provider in PROVIDERS:
        rows = sorted((row for row in points.values() if row['provider'] == provider), key=lambda row: (row['at'], row['bucket'], row['reset']))
        # If a provider exposes two weekly windows simultaneously, prefer primary.
        by_time = {}
        for row in rows:
            prior = by_time.get(row['at'])
            if prior is None or row['bucket'] == 'codex:primary':
                by_time[row['at']] = row
        rows = list(by_time.values())
        days = {date: dict(points=0., covered=0., valid=False, estimated=False, reasons=set(), resets=0,
                           restores=0, restored_points=0., unallocated=0.) for date in dates}

        def chunks(a, b):
            a, b = max(a, start), min(b, end)
            while b > a:
                date = calendar.date(a)
                stop = min(b, calendar.midnight(date + timedelta(days=1)))
                if stop <= a:
                    break
                if date in days:
                    yield date, stop - a
                a = stop

        def interval(a, b, delta=0., reason=None, valid=True):
            if b <= a:
                return
            pieces = list(chunks(a, b))
            across_dates = calendar.date(a) != calendar.date(max(a, b - .0001))
            if valid and across_dates and b - a > SHORT_INTERVAL:
                valid, reason = False, 'overnight-gap'
                for date, _ in pieces:
                    days[date]['unallocated'] += delta
            for date, seconds in pieces:
                item = days[date]
                if valid:
                    item['points'] += delta * seconds / (b - a)
                    item['covered'] += seconds
                    item['valid'] = True
                    item['estimated'] |= across_dates and delta > 0
                if reason:
                    item['reasons'].add(reason)

        if rows:
            first_point = rows[0]
            cycle_start = first_point['reset'] - WEEK
            if calendar.date(cycle_start) == calendar.date(first_point['at']):
                interval(cycle_start, first_point['at'], first_point['used'])
            high = first_point['used']
            for a, b in zip(rows, rows[1:]):
                if b['at'] <= a['at']:
                    continue
                same_bucket = a['bucket'] == b['bucket']
                reset_change = abs(b['reset'] - a['reset'])
                same_cycle = same_bucket and (a['reset'] == b['reset'] or reset_change <= RESET_JITTER and b['at'] < min(a['reset'], b['reset']))
                if same_cycle:
                    confirmation_key = (provider, b['bucket'], a['at'], b['at'], a['used'], b['used'])
                    confirmed_restore = any(abs(a['reset'] - before_reset) <= RESET_JITTER
                                            and abs(b['reset'] - reset) <= RESET_JITTER
                                            for before_reset, reset in restores.get(confirmation_key, ()))
                    if confirmed_restore:
                        # The drop interval has unknown consumption. The next
                        # observed value, rather than an assumed zero, anchors use.
                        interval(a['at'], b['at'], reason='allowance-restored', valid=False)
                        date = calendar.date(b['at'])
                        if date in days:
                            days[date]['restores'] += 1
                            days[date]['restored_points'] += a['used'] - b['used']
                            days[date]['reasons'].add('allowance-restored')
                        high = b['used']
                        continue
                    recovering = a['used'] < high - EPSILON
                    if b['used'] < high - EPSILON:
                        interval(a['at'], b['at'], reason='reported-decrease', valid=False)
                    else:
                        interval(a['at'], b['at'], max(0., b['used'] - high), reason='correction-recovery' if recovering else None)
                        high = max(high, b['used'])
                elif same_bucket and a['reset'] <= b['at'] and abs(b['reset'] - a['reset'] - WEEK) <= RESET_JITTER:
                    # The old cycle's unobserved tail is not guessed. The new
                    # cycle has a known zero baseline at its reported start.
                    cycle_start = b['reset'] - WEEK
                    interval(a['at'], cycle_start, reason='reset-tail', valid=False)
                    interval(cycle_start, b['at'], b['used'])
                    date = calendar.date(cycle_start)
                    if date in days:
                        days[date]['resets'] += 1
                    high = b['used']
                else:
                    interval(a['at'], b['at'], reason='period-change' if same_bucket else 'bucket-change', valid=False)
                    # The changed period supplies a new baseline. Carrying an
                    # old cycle's high-water mark would erase future activity.
                    high = b['used']
        daily = []
        for date, item in days.items():
            expected = max(0., min(now, calendar.midnight(date + timedelta(days=1))) - calendar.midnight(date))
            coverage = min(1., item['covered'] / expected) if expected else 0.
            partial = coverage < .9 or bool(item['reasons'])
            daily.append(dict(day=date.isoformat(), points=round(item['points'], 4) if item['valid'] else None,
                              state='missing' if not item['valid'] else 'partial' if partial else 'observed',
                              coverage=round(coverage, 4), estimated=item['estimated'], today=date == today,
                              reasons=sorted(item['reasons']), resets=item['resets'],
                              restores=item['restores'], restoredPoints=round(item['restored_points'], 4),
                              unallocated=round(item['unallocated'], 4), seconds=round(item['covered']), expectedSeconds=round(expected)))
        providers.append(dict(provider=provider, firstAt=datetime.fromtimestamp(rows[0]['at'], timezone.utc).isoformat() if rows else None,
                              lastAt=datetime.fromtimestamp(rows[-1]['at'], timezone.utc).isoformat() if rows else None, days=daily))
    local_name = time.tzname[0].replace(' Standard Time', ' time').replace(' Daylight Time', ' time')
    return dict(schemaVersion=1, timezone='UTC' if zone == timezone.utc else local_name,
                updatedAt=datetime.fromtimestamp(now, timezone.utc).isoformat(), days=[date.isoformat() for date in dates], providers=providers)
