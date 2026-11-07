#!/usr/bin/env python3
"""UserPromptSubmit: say when the default skill files changed since the session
last read them, so it reviews them before it answers.

THE FILES. skills/default/ holds SKILL.md and two of the documents it tells the
session to read, CONVERSATION.md and QUALIFIED-WRITING.md (copies of docs/,
rewritten by the commit hook); the third, doc-craft/SKILL.md, sits beside the
folder. A session takes them in once, at start or after a compaction, and keeps
that copy for the rest of its life.

THE GAP. The plugin moves to main at every start and resume (refresh-plugin.sh),
but invoke-default.sh's instruction reaches a session at startup and compaction
and never at resume: across six sessions' records on 2026-10-28 it arrived at
every startup and every compaction and at none of 71 resumes. So a resumed
session answers from the copy it read days ago. Measured over 72 sessions from
2026-10-14 to 2026-10-28: 550 of 1,880 owner prompts were answered while the
session's CONVERSATION.md lagged main.

THE TEST. The harness writes "Base directory for this skill: <dir>" into the
transcript each time it loads a skill, and for the plugin that directory names
the commit: .../portable/<commit>/default. The last such entry is the copy the
session holds. Only the harness's own entries count (isMeta, and the text opens
with the phrase): a session that reads other sessions' records prints the same
phrase in tool output, and a reply can quote it. This hook's own plugin root is
the copy the plugin carries now.
Old copies stay on disk beside the new one, so the two folders are compared
file by file: no git, no network, no state.

IT CLEARS ITSELF. Invoking /portable:default again writes a new base-directory
line naming the current copy, and the next check finds nothing to say. When the
copy the session read is no longer on disk (a fresh container), the files cannot
be compared, so it says they may have changed; one re-read settles that too.

Silent and exit 0 on anything else: no transcript, no load of the default skill
in it, a plugin root it cannot read, or an unparseable payload.
"""
import json
import os
import re
import sys
from pathlib import Path

MARK = "Base directory for this skill: "
LOAD = re.compile(re.escape(MARK) + r"(\S+?/portable/([0-9a-f]{7,40})/default)(?![\w/.-])")


def last_load(transcript):
    """The default skill's folder and commit at its last load, or None."""
    found = None
    with open(transcript, encoding="utf-8", errors="replace") as fh:
        for line in fh:
            if MARK not in line:
                continue
            try:
                entry = json.loads(line)
            except ValueError:
                continue
            if not entry.get("isMeta"):
                continue
            content = (entry.get("message") or {}).get("content")
            parts = content if isinstance(content, list) else [{"type": "text", "text": content}]
            for part in parts:
                text = part.get("text") if isinstance(part, dict) else None
                m = LOAD.match(text) if isinstance(text, str) else None
                if m:
                    found = (Path(m.group(1)), m.group(2))
    return found


def files(folder):
    return {p.relative_to(folder).as_posix(): p for p in folder.rglob("*") if p.is_file()}


def changed(read, now):
    """Names of the files that differ between two copies of the folder, with
    doc-craft/SKILL.md from beside each."""
    a, b = files(read), files(now)
    for side, folder in ((a, read), (b, now)):
        craft = folder.parent / "doc-craft" / "SKILL.md"
        if craft.is_file():
            side["doc-craft/SKILL.md"] = craft
    return sorted(n for n in a.keys() | b.keys()
                  if n not in a or n not in b or a[n].read_bytes() != b[n].read_bytes())


def main():
    try:
        payload = json.loads(sys.stdin.read() or "{}")
    except ValueError:
        return
    transcript = payload.get("transcript_path") or ""
    root = os.environ.get("CLAUDE_PLUGIN_ROOT") or ""
    if not transcript or not root or not os.path.isfile(transcript):
        return
    now = Path(root) / "default"
    if not now.is_dir():
        return
    load = last_load(transcript)
    if not load:
        return
    read, commit = load
    if read == now:
        return
    current = Path(root).name[:7]
    if read.is_dir():
        names = changed(read, now)
        if not names:
            return
        msg = (f"You last read the default skill files at commit {commit[:7]}. The plugin now "
               f"carries {current}, and {', '.join(names)} changed since. Invoke "
               "/portable:default and review them before your next response.")
    else:
        msg = (f"You last read the default skill files at commit {commit[:7]}. The plugin now "
               f"carries {current}, and the copy you read is no longer on disk, so they may have "
               "changed. Invoke /portable:default and review them before your next response.")
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "UserPromptSubmit",
        "additionalContext": msg,
    }}))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
    sys.exit(0)
