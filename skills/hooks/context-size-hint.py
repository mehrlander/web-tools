#!/usr/bin/env python3
"""UserPromptSubmit: say when the session's context has grown large, so the
owner can type /compact himself.

THE WHY. A session's cost per model step follows its context size, and nothing
tells the owner that size while he works. This hook has the assistant say it in
its reply when the context first passes a threshold, and again as it keeps
growing.

THE SIZE. The harness writes each model response into the transcript as an
assistant entry whose message carries a usage object. The context that response
was given is input_tokens + cache_read_input_tokens +
cache_creation_input_tokens. The hook takes the last such entry in the main
conversation, skipping a subagent's (isSidechain), and reads only the tail of
the file: transcripts run to hundreds of megabytes.

THE BANDS. CONTEXT_HINT_TOKENS (default 400000) is the threshold and
CONTEXT_HINT_STEP (default 200000) the step. Band 0 starts at the threshold,
band 1 at threshold plus one step, and so on. The hook speaks when the context
enters a band it has not yet announced for this session, and keeps the last band
announced in a small file keyed by session id under the temp directory, where
program-files.sh keeps its marks. When the context falls back below the
threshold (after a compaction) the file goes, so the next crossing is announced
again.

Silent and exit 0 on anything else: no transcript, no usage entry in its tail,
an unreadable line, or an unparseable payload.
"""
import json
import os
import re
import sys
import tempfile
from pathlib import Path

TAIL = 400_000
DEFAULT_THRESHOLD = 400_000
DEFAULT_STEP = 200_000


def setting(name, default):
    try:
        value = int(os.environ.get(name, ""))
    except ValueError:
        return default
    return value if value > 0 else default


def context_size(transcript):
    """Context tokens of the last main-conversation model response, or None."""
    with open(transcript, "rb") as fh:
        fh.seek(0, os.SEEK_END)
        size = fh.tell()
        start = max(0, size - TAIL)
        fh.seek(start)
        data = fh.read()
    lines = data.split(b"\n")
    if start:
        lines = lines[1:]  # the first line is cut partway
    for raw in reversed(lines):
        if b'"usage"' not in raw:
            continue
        try:
            entry = json.loads(raw)
        except ValueError:
            continue
        if not isinstance(entry, dict) or entry.get("type") != "assistant" or entry.get("isSidechain"):
            continue
        message = entry.get("message")
        usage = message.get("usage") if isinstance(message, dict) else None
        if not isinstance(usage, dict):
            continue
        return sum(int(usage.get(k) or 0) for k in
                   ("input_tokens", "cache_read_input_tokens", "cache_creation_input_tokens"))
    return None


def main():
    try:
        payload = json.loads(sys.stdin.read() or "{}")
    except ValueError:
        return
    if not isinstance(payload, dict):
        return
    transcript = payload.get("transcript_path") or ""
    session = str(payload.get("session_id") or "")
    if not transcript or not os.path.isfile(transcript) or not re.fullmatch(r"[\w.-]+", session):
        return
    tokens = context_size(transcript)
    if tokens is None:
        return
    threshold = setting("CONTEXT_HINT_TOKENS", DEFAULT_THRESHOLD)
    step = setting("CONTEXT_HINT_STEP", DEFAULT_STEP)
    mark = Path(tempfile.gettempdir()) / "context-size-hint" / session
    if tokens < threshold:
        if mark.exists():
            mark.unlink()
        return
    band = (tokens - threshold) // step
    try:
        announced = int(mark.read_text().strip())
    except (OSError, ValueError):
        announced = -1
    if band <= announced:
        return
    mark.parent.mkdir(parents=True, exist_ok=True)
    mark.write_text(str(band))
    rounded = (tokens + 500) // 1000 * 1000
    msg = (f"This session's context is now about {rounded:,} tokens. Say so in one line of "
           "this reply, and that typing /compact would shrink it. Do not compact or change "
           "anything yourself.")
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
