"""Read account allowances without starting conversations or copying credentials.

Codex owns its app-server authentication. Gemini is read from the existing local
worker. Claude can supply its documented statusline JSON through --capture.
Only normalized quotas and bounded observations leave this process.
"""
import argparse
import ast
from datetime import datetime, timezone
import json
import math
import os
from pathlib import Path
import queue
import shutil
import subprocess
import threading
import time
import urllib.request

NO_WINDOW = getattr(subprocess, 'CREATE_NO_WINDOW', 0)


def instant(value):
    try:
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return datetime.fromtimestamp(value, timezone.utc).isoformat()
        return datetime.fromisoformat(str(value).replace('Z', '+00:00')).astimezone(timezone.utc).isoformat()
    except (ValueError, TypeError, OverflowError, OSError):
        return None


def number(value, maximum=100):
    return value if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and 0 <= value <= maximum else None


def label(value, fallback):
    return ' '.join(str(value or fallback).split())[:100]


def window(key, name, used, reset, minutes=None, models=None):
    used = number(used)
    reset = instant(reset)
    if used is None or reset is None:
        return None
    return dict(id=key, label=name, usedPercent=round(used, 2), resetsAt=reset,
                durationMinutes=minutes, models=models or [], history=[])


def codex_windows(data):
    result = []
    limits = data.get('rateLimitsByLimitId')
    if not isinstance(limits, dict) or not limits:
        single = data.get('rateLimits')
        limits = {single.get('limitId') or 'codex': single} if isinstance(single, dict) else {}
    for key, limit in limits.items():
        if not isinstance(limit, dict):
            continue
        for period in ('primary', 'secondary'):
            row = limit.get(period)
            if not isinstance(row, dict):
                continue
            minutes = number(row.get('windowDurationMins'), 525600)
            minutes = minutes if minutes and minutes > 0 else None
            name = label(limit.get('limitName'), key)
            value = window(str(key) + ':' + period, name, row.get('usedPercent'), row.get('resetsAt'), minutes)
            if value:
                result.append(value)
    return result


def codex_read():
    binary = shutil.which('codex')
    if not binary:
        folder = Path(os.environ.get('LOCALAPPDATA', '')) / 'OpenAI' / 'Codex' / 'bin'
        files = list(folder.glob('*/codex.exe')) if folder.is_dir() else []
        if files:
            binary = str(max(files, key=lambda p: p.stat().st_mtime))
    if not binary:
        raise RuntimeError('missing codex')
    messages = queue.Queue()
    process = subprocess.Popen([binary, 'app-server', '--stdio'], stdin=subprocess.PIPE,
                               stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True,
                               encoding='utf-8', creationflags=NO_WINDOW)

    def receive():
        try:
            for line in process.stdout:
                if len(line) > 262144:
                    continue
                try:
                    messages.put(json.loads(line))
                except ValueError:
                    pass
        finally:
            messages.put(None)

    threading.Thread(target=receive, daemon=True).start()

    def send(value):
        process.stdin.write(json.dumps(value) + '\n')
        process.stdin.flush()

    def response(ident):
        deadline = time.monotonic() + 15
        while time.monotonic() < deadline:
            value = messages.get(timeout=max(.1, deadline - time.monotonic()))
            if value is None:
                raise RuntimeError('server closed')
            if value.get('id') == ident:
                if 'error' in value:
                    raise RuntimeError('quota unavailable')
                return value.get('result', {})
        raise TimeoutError()

    try:
        send(dict(id=1, method='initialize', params=dict(clientInfo=dict(
            name='web_tools_now', title='Web Tools Now', version='0.1.0'))))
        response(1)
        send(dict(method='initialized', params={}))
        send(dict(id=2, method='account/rateLimits/read'))
        return codex_windows(response(2))
    finally:
        process.terminate()
        try:
            process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=3)


def gemini_windows(data):
    # The native quota summary names the shared buckets and their actual periods.
    buckets = []
    for group in data.get('response', {}).get('groups', []):
        for quota in group.get('buckets', []):
            ident = str(quota.get('bucketId', ''))
            # Third-party models through Google are not the user's Claude account.
            if not ident.startswith('gemini-') or quota.get('disabled'):
                continue
            remaining = number(quota.get('remainingFraction'), 1)
            minutes = {'weekly': 10080, '5h': 300}.get(quota.get('window'))
            value = window(ident, 'Gemini', None if remaining is None else (1 - remaining) * 100,
                           quota.get('resetTime'), minutes, [label(group.get('displayName'), 'Gemini Models')])
            if value:
                buckets.append(value)
    if buckets:
        return buckets
    configs = data.get('userStatus', {}).get('cascadeModelConfigData', {}).get('clientModelConfigs', [])
    result = []
    for model in configs:
        ident = str(model.get('modelId', ''))
        name = label(model.get('label'), ident)
        # Claude models served by Google do not describe the user's Claude account.
        if not ident.lower().startswith('gemini'):
            continue
        quota = model.get('quotaInfo', {})
        remaining = number(quota.get('remainingFraction'), 1)
        value = window(ident, name, None if remaining is None else (1 - remaining) * 100,
                       quota.get('resetTime'), models=[name])
        if value:
            result.append(value)
    return result


def gemini_read(repo):
    # Read two literal connection constants; never import or start the worker.
    source = (repo / 'sessions' / 'tools' / 'gemini_followup.py').read_text(encoding='utf-8')
    values = {}
    for node in ast.parse(source).body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id in ('WORKER_PORT', 'WORKER_CSRF_TOKEN'):
                    try:
                        values[target.id] = ast.literal_eval(node.value)
                    except (ValueError, TypeError):
                        pass
    port = values.get('WORKER_PORT')
    csrf = values.get('WORKER_CSRF_TOKEN')
    if not isinstance(port, int) or not 1 <= port <= 65535 or not isinstance(csrf, str):
        raise RuntimeError('worker endpoint unavailable')
    # Ignore system HTTP proxies for this loopback-only interface.
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    for method in ('RetrieveUserQuotaSummary', 'GetUserStatus'):
        request = urllib.request.Request(
            f'http://127.0.0.1:{port}/exa.language_server_pb.LanguageServerService/{method}',
            data=b'{}', headers={'Content-Type': 'application/json', 'Connect-Protocol-Version': '1',
                                'X-Codeium-Csrf-Token': csrf})
        try:
            with opener.open(request, timeout=5) as response:
                windows = gemini_windows(json.loads(response.read(1048576)))
            if windows:
                return windows
        except Exception:
            if method == 'GetUserStatus':
                raise
    return []


def claude_windows(data):
    result = []
    for key, name, minutes in [('five_hour', 'All models', 300), ('seven_day', 'All models', 10080),
                               ('seven_day_sonnet', 'Sonnet', 10080), ('seven_day_opus', 'Opus', 10080),
                               ('seven_day_fable', 'Fable', 10080), ('seven_day_cowork', 'Cowork', 10080)]:
        row = data.get('rate_limits', {}).get(key)
        if not isinstance(row, dict):
            continue
        value = window(key, name, row.get('used_percentage'), row.get('resets_at'), minutes)
        if value:
            result.append(value)
    return result


def read_json(path):
    try:
        return json.loads(path.read_text(encoding='utf-8')) if path.stat().st_size < 8_000_000 else {}
    except (OSError, ValueError):
        return {}


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(data, separators=(',', ':')), encoding='utf-8')
    temporary.replace(path)


def keep_history(windows, previous, at):
    old = {w['id']: w for w in previous if isinstance(w, dict) and 'id' in w}
    cutoff = datetime.fromisoformat(at).timestamp() - 8 * 86400
    for row in windows:
        history = old.get(row['id'], {}).get('history', [])
        history = [p for p in history if instant(p.get('at')) and datetime.fromisoformat(instant(p['at'])).timestamp() >= cutoff]
        if not history or history[-1].get('resetsAt') != row['resetsAt'] or datetime.fromisoformat(at).timestamp() - datetime.fromisoformat(history[-1]['at']).timestamp() >= 300:
            history.append(dict(at=at, usedPercent=row['usedPercent'], resetsAt=row['resetsAt']))
        row['history'] = history[-2500:]
    return windows


def collect(state, repo):
    at = datetime.now(timezone.utc).isoformat()
    previous = read_json(state / 'usage.json')
    old = {p['provider']: p for p in previous.get('providers', [])}
    providers = []
    claude_input = read_json(state / 'usage-inputs' / 'claude.json')
    claude_status = read_json(state / 'usage-inputs' / 'claude-status.json')
    sources = [('codex', 'Codex account', codex_read, 'Codex account limits are unavailable.'),
               ('gemini', 'Antigravity worker status', lambda: gemini_read(repo), 'Gemini worker quota is unavailable.'),
               ('claude', 'Claude account' if claude_input.get('source') == 'Claude account' or not claude_input and claude_status else 'Claude Code statusline',
                lambda: claude_windows(claude_input), claude_status.get('notice') or 'Claude usage is not connected yet.')]
    for provider, source, read, unavailable in sources:
        entry = dict(provider=provider, source=source, observedAt=None, checkedAt=at, status='unavailable', notice=unavailable, windows=[])
        try:
            windows = read()
            observed = at
            if provider == 'claude':
                observed = instant(claude_input.get('capturedAt'))
                if not observed:
                    windows = []
            if windows:
                entry.update(status='available', notice='', observedAt=observed,
                             windows=keep_history(windows, old.get(provider, {}).get('windows', []), observed))
                if provider == 'claude' and entry['source'] == 'Claude account' and claude_status.get('status') != 'available':
                    entry.update(status='stale', notice=unavailable)
            elif provider == 'claude' and observed and claude_status.get('status') == 'available':
                entry.update(status='available', observedAt=observed)
        except Exception:
            # Provider errors can contain credentials; return only fixed notices.
            pass
        if entry['status'] == 'unavailable' and old.get(provider, {}).get('windows'):
            entry.update(status='stale', observedAt=old[provider].get('observedAt'), windows=old[provider]['windows'])
        providers.append(entry)
    write_json(state / 'usage.json', dict(schemaVersion=1, providers=providers))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--state', type=Path, required=True)
    parser.add_argument('--repo', type=Path)
    parser.add_argument('--capture', choices=['claude'])
    args = parser.parse_args()
    if args.capture:
        import sys
        data = json.loads(sys.stdin.read(262144))
        # Discard prompts, paths, account identities and all unrelated fields.
        normalized = {w['id']: dict(used_percentage=w['usedPercent'], resets_at=datetime.fromisoformat(w['resetsAt']).timestamp()) for w in claude_windows(data)}
        if normalized:
            write_json(args.state / 'usage-inputs' / 'claude.json', dict(
                capturedAt=datetime.now(timezone.utc).isoformat(), rate_limits=normalized))
    elif args.repo:
        collect(args.state, args.repo)


if __name__ == '__main__':
    main()
