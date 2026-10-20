#!/usr/bin/env python3
"""Stop hook: sends a reply back, once, when it puts a decision to the owner
without a recommendation, or when this turn's commits changed a page and the
reply gives no render link.

WHY A SCRIPT. web-tools #1006 ran this as a prompt hook: Haiku read the reply
against twelve peeves and wrote the send-back itself, and its limits (one
send-back a turn, one-line replies pass) were instructions in its prompt. Haiku
followed them some of the time, and on 2026-10-20 sessions were sent back up to
five times in one turn. Here every limit is code, Haiku answers one question in
a fixed JSON shape, and the session receives only text this script wrote.

THE TWO CHECKS.
  Render link (code only): a commit made since the owner's last message, on the
  current branch of the working directory's checkout or of a checkout one level
  below it, added or changed an .html file, and the reply has none of 🥏, ⭐,
  📦, "No render link".
  Call (Haiku, then code): the reply's last line is a closing state that waits
  on the owner (🟡, 🆚 or ✴️); Haiku answers that the reply asks the owner for
  a decision, and quotes the sentence that asks, which must be in the reply
  word for word; and the reply has no word starting "recommend". Haiku judges
  only whether a decision is asked. When it also judged whether the reply
  recommended, three of 48 replies from one session got a different answer on
  a second run; asked the one question, none did.

WHAT PASSES. A reply this hook already sent back in the same turn
(stop_hook_active), a one-line reply (the shape docs/SURFACING.md gives a reply
to a wake), and any run where something fails: no claude on PATH, a timeout,
an answer that does not parse. The inner claude runs with every hook disabled
and REPLY_CHECK_INNER set, so it cannot start this hook again.
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

MODEL = 'claude-haiku-5-5'
WAITING = ('🟡', '🆚', '✴')
RENDER = ('🥏', '⭐', '📦', 'No render link')

QUESTION = """You read one reply that an AI coding session wrote to its owner, and answer in the JSON shape you are given.
asks_decision: true when the reply asks the owner to make a decision: to choose between options, to approve or reject a proposal, or to say yes or no to a course of action. A request for a fact, an observation or a tap is not a decision.
quote: when asks_decision is true, the sentence of the reply that asks for the decision, copied exactly. Otherwise an empty string."""

SCHEMA = {'type': 'object', 'required': ['asks_decision', 'quote'],
          'properties': {'asks_decision': {'type': 'boolean'}, 'quote': {'type': 'string'}}}


def flat(s):
    return ' '.join(s.replace('*', '').replace('`', '').split())


def turn_start(transcript):
    """The timestamp of the owner's last message: a user entry that is not a
    tool result, an injected note or a compaction summary."""
    last = None
    with open(transcript, encoding='utf-8') as f:
        for line in f:
            try:
                r = json.loads(line)
            except ValueError:
                continue
            if r.get('type') != 'user' or r.get('isMeta') or r.get('isCompactSummary'):
                continue
            if (r.get('origin') or {}).get('kind', 'human') != 'human':
                continue
            c = (r.get('message') or {}).get('content')
            if isinstance(c, list) and any(isinstance(b, dict) and b.get('type') == 'tool_result' for b in c):
                continue
            last = r.get('timestamp') or last
    return last


def checkouts(cwd):
    root = Path(cwd)
    top = subprocess.run(['git', '-C', cwd, 'rev-parse', '--show-toplevel'],
                         capture_output=True, text=True, timeout=10).stdout.strip()
    found = [Path(top)] if top else []
    found += [p for p in sorted(root.iterdir()) if (p / '.git').exists()]
    return list(dict.fromkeys(found))


def pages_changed(cwd, since):
    pages = []
    for repo in checkouts(cwd):
        out = subprocess.run(['git', '-C', str(repo), 'log', '--first-parent', '--no-merges', '--diff-filter=d',
                              f'--since={since}', '--name-only', '--format=', 'HEAD'],
                             capture_output=True, text=True, timeout=10).stdout
        pages += [f'{repo.name}/{p}' for p in out.splitlines() if p.endswith('.html')]
    return sorted(set(pages))


def unrecommended_call(reply):
    """The sentence that puts a decision to the owner, when the reply has no
    word starting "recommend"; otherwise None."""
    claude = shutil.which('claude')
    if not claude or re.search(r'recommend', reply, re.I):
        return None
    p = subprocess.run([claude, '-p', '--model', MODEL, '--settings', '{"disableAllHooks":true}',
                        '--setting-sources', '', '--strict-mcp-config', '--tools', '', '--no-session-persistence',
                        '--system-prompt', QUESTION, '--output-format', 'json', '--json-schema', json.dumps(SCHEMA)],
                       input=reply, capture_output=True, text=True, timeout=45, cwd=tempfile.gettempdir(),
                       env={**os.environ, 'REPLY_CHECK_INNER': '1'})
    a = json.loads(p.stdout).get('structured_output') or {}
    quote = flat(a.get('quote') or '')
    if a.get('asks_decision') is True and quote and quote in flat(reply):
        return a['quote'].strip()
    return None


def main():
    if os.environ.get('REPLY_CHECK_INNER'):
        return
    hook = json.load(sys.stdin)
    reply = hook.get('last_assistant_message') or ''
    lines = [l for l in reply.splitlines() if l.strip()]
    if hook.get('stop_hook_active') or len(lines) <= 1:
        return
    reasons = []
    since = hook.get('transcript_path') and turn_start(hook['transcript_path'])
    if since and not any(m in reply for m in RENDER):
        pages = pages_changed(hook.get('cwd') or os.getcwd(), since)
        if pages:
            reasons.append(f'Commits since the owner\'s last message changed {", ".join(pages)}, and the reply has '
                           'no render link. Give the render line for them, or a "No render link:" line saying why '
                           'none reaches them.')
    if lines[-1].lstrip().startswith(WAITING):
        quote = unrecommended_call(reply)
        if quote:
            reasons.append(f'The reply asks the owner to decide without saying which option you recommend: "{quote}" '
                           'Give the option you recommend and why, in one sentence.')
    if reasons:
        print(json.dumps({'decision': 'block', 'reason': 'Reply check. ' + ' '.join(reasons) +
                          ' Write only that, then the closing-state line; do not repeat the rest of the reply.'}))


if __name__ == '__main__':
    try:
        main()
    except Exception:
        pass
