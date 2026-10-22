#!/usr/bin/env python3
"""Stop hook: sends a reply back, once, when its closing line presents a call
(⚖️) without the recommendation docs/SURFACING.md gives that line, or when this
turn's commits changed a page and the reply gives no render link. Both checks
are code; no model is called.

HISTORY. web-tools #1006 (2026-10-20) ran a prompt hook: Haiku read each reply
against twelve peeves and wrote the send-back, and its limits were
instructions Haiku followed some of the time, so sessions were sent back up to
five times in one turn. #1008 replaced it with this script and kept one Haiku
question, whether a reply that waits on the owner puts a decision to them.
That question went once SURFACING.md gave a call its own closing marker with
a fixed recommendation clause, which code can check.

THE MARKERS. ⚖️ Choice needed presents a call and carries the clause. 🪧
Direction needed names an open question and carries none: it exists so a reply
can say next steps are unclear without putting a decision to the owner, and a
required recommendation would push it back toward one. 🆚, which ⚖️ replaced
on 2026-10-20, is checked as a call, for a session on the earlier conventions.

THE TWO CHECKS.
  Recommendation: the reply's last line starts with ⚖️ or 🆚 and has no
  "Recommended:" clause.
  Render link: a commit made since the owner's last message, on the current
  branch of the working directory's checkout or of a checkout one level below
  it, added or changed an .html file, and the reply has none of 🥏, ⭐, 📦,
  👁️‍🗨️ (a look link, which SURFACING.md marks in place of 🥏), "No render link".

WHAT PASSES. A reply this hook already sent back in the same turn
(stop_hook_active), and any run where something fails.
"""
import json
import os
import re
import subprocess
import sys
from pathlib import Path

RECOMMENDED = re.compile(r'\bRecommended:', re.I)
CALLS = ('⚖', '🆚')
RENDER = ('🥏', '⭐', '📦', '👁', 'No render link')


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


def main():
    hook = json.load(sys.stdin)
    reply = hook.get('last_assistant_message') or ''
    lines = [l for l in reply.splitlines() if l.strip()]
    if hook.get('stop_hook_active') or not lines:
        return
    reasons = []
    since = hook.get('transcript_path') and turn_start(hook['transcript_path'])
    if since and not any(m in reply for m in RENDER):
        pages = pages_changed(hook.get('cwd') or os.getcwd(), since)
        if pages:
            reasons.append(f'Commits since the owner\'s last message changed {", ".join(pages)}, and the reply has '
                           'no render link. Give the render line for them, or a "No render link:" line saying why '
                           'none reaches them.')
    last = lines[-1].lstrip()
    if last.startswith(CALLS) and not RECOMMENDED.search(last.replace('*', '')):
        reasons.append(f'The closing {last[0]} call has no "Recommended:" clause. If the question has been '
                       'assessed, give that line again with `Recommended: <answer>, because <reason>.`; '
                       'if not, close on 🪧 Direction needed instead, naming the open question.')
    if reasons:
        print(json.dumps({'decision': 'block', 'reason': 'Reply check. ' + ' '.join(reasons) +
                          ' Write only that, ending with the closing-state line; do not repeat the rest of the reply.'}))


if __name__ == '__main__':
    try:
        main()
    except Exception:
        pass
