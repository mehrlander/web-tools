"""Derive observed allowance counter decreases without assigning a cause."""
from datetime import datetime, timezone
import hashlib
import json
import math
import re

RESET_JITTER = 120


def _instant(value):
    if not isinstance(value, str) or not re.fullmatch(
            r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})', value):
        return None
    try:
        result = datetime.fromisoformat(value.replace('Z', '+00:00'))
        return result.astimezone(timezone.utc) if result.tzinfo is not None else None
    except (ValueError, OverflowError):
        return None


def _number(value):
    return (isinstance(value, int) and not isinstance(value, bool)
            or isinstance(value, float) and math.isfinite(value))


def detect_decreases(observations):
    """Return decreases bracketed by adjacent readings in an unchanged window.

    The observation interval is retained because the time or cause of a counter
    change is not supplied. Scheduled rollovers and conflicting simultaneous
    readings do not establish an event.
    """
    samples, conflicts = {}, set()
    for source in observations:
        if not isinstance(source, dict):
            continue
        provider, bucket = source.get('provider'), source.get('bucket')
        at, reset = _instant(source.get('at')), _instant(source.get('reset'))
        used, minutes = source.get('used'), source.get('minutes')
        if (not isinstance(provider, str) or not provider.strip()
                or not isinstance(bucket, str) or not bucket.strip()
                or at is None or reset is None or at > reset
                or not _number(used) or not 0 <= used <= 100
                or not _number(minutes) or not 0 < minutes <= 525600):
            continue
        if (reset - at).total_seconds() > minutes * 60 + RESET_JITTER:
            continue
        label = source.get('label')
        label = label if isinstance(label, str) and label.strip() else bucket
        row = dict(provider=provider, bucket=bucket, at=at, reset=reset,
                   used=used, minutes=minutes, label=label)
        key = (provider, bucket, at, reset)
        prior = samples.get(key)
        if prior is not None and (prior['used'], prior['minutes']) != (used, minutes):
            conflicts.add(key)
        elif prior is None:
            samples[key] = row
        else:
            prior['label'] = min(prior['label'], label)

    # Different windows reported at one instant have no supplied ordering.
    simultaneous = {}
    for key in samples:
        if key not in conflicts:
            simultaneous.setdefault(key[:3], []).append(key)
    rows = [samples[key] for keys in simultaneous.values() if len(keys) == 1 for key in keys]
    rows.sort(key=lambda row: (row['provider'], row['bucket'], row['at']))
    previous, events = {}, []
    for row in rows:
        key = (row['provider'], row['bucket'])
        before = previous.get(key)
        previous[key] = row
        if (before is None or before['at'] >= row['at'] or before['minutes'] != row['minutes']
                or before['used'] <= row['used']):
            continue
        same_reset = before['reset'] == row['reset']
        reset_jitter = abs((before['reset'] - row['reset']).total_seconds()) <= RESET_JITTER
        if not (same_reset or reset_jitter and row['at'] < min(before['reset'], row['reset'])):
            continue
        at, reset = row['at'].isoformat(), row['reset'].isoformat()
        identity = json.dumps([row['provider'], row['bucket'], at, reset], separators=(',', ':'))
        events.append(dict(id='allowance-decrease:' + hashlib.sha256(identity.encode('utf-8')).hexdigest()[:24],
                           before_at=before['at'].isoformat(), at=at,
                           before_reset=before['reset'].isoformat(), reset=reset,
                           before=before['used'], after=row['used'], drop=round(before['used'] - row['used'], 10),
                           provider=row['provider'], bucket=row['bucket'], label=row['label'], minutes=row['minutes']))
    return sorted(events, key=lambda row: (row['at'], row['provider'], row['bucket'], row['id']))
