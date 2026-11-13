#!/usr/bin/env python3
"""UserPromptSubmit, and PostToolUse on send_later and on ReadNotifications: the
check-in a session schedules for itself, to run shortly before its prompt cache
lapses.

THE WHY. A session's prompt cache lives one hour from its last model call. The
first call after that hour writes the whole context to the cache again, at
eighty times the read price (docs/environment/container.md, "The prompt
cache"). A session that wakes itself at 55 minutes can write its recap and close
its work out while a call still costs the read price. Keeping a timer current
would cost a tool call on every turn, so this hook is lazy: a session arms one
message, and re-arms it only when the message arrives early.

THE MESSAGE is what the session sends itself with send_later. Its id is the UTC
time at which the hook wrote it, so a later id sorts after an earlier one. Two
ids written in one second are told apart by a suffix on the second:

    ⏱ check-in 20261113T221500Z. The check-in hook says what to do with this when it is read; if no such instruction follows, end the turn with no text.

send-later-guard.sh refuses every send_later whose message opens otherwise.

ARMING. On a prompt the owner typed, when no check-in is pending and the
context is at least FLOOR tokens, the hook asks for the message to be sent with
a delay of DELAY minutes. FLOOR is the context size above which
lib/kits/session-usage.js counts an idle re-load. The owner's prompt is told
from a wake as session-detail-caption.py tells it, by how the prompt opens, and
the context is read as context-size-hint.py reads it. The hook asks again at
each such prompt until a check-in is pending. A session without a send_later
tool is asked every time, and the instruction says to ignore it there.

TRACKING. After a send_later whose message opens with the mark and an id, the
hook records that id as the latest, that a check-in is pending, and when it
fires (fire_at in the tool's result, or now plus the delay). A check-in stays
pending until it is read. One that is still unread GRACE minutes after its time
counts as lost, so that a message the scheduler never delivered does not end
the practice for the session.

WHEN A CHECK-IN IS READ, in a ReadNotifications result, the hook prints one of
four instructions. The newest id in the batch is the one judged.

    duplicate   The state holds a later id. The turn ends with no text.
    early       The session's last main-conversation response before the wake
                was under DUE minutes ago, because the owner or an event has
                kept the session busy since the message was armed. The message
                is sent again for the minutes that remain of DELAY.
    first       Due, and no check-in has run since the owner last typed: a
                recap, work that needs no decision of the owner's, and a second
                check-in armed.
    second      Due, and the first has run since the owner last typed: the
                session is closed out and nothing further is armed.

The wake is the newest entry in the transcript that opens a turn or was queued
into one: a `user` entry that is not a tool result, or a queued_command
attachment. The last response is the newest main-conversation `assistant` entry
before that wake that used any tokens.

A turn this hook told to end with no text (early, duplicate) makes responses of
its own: the call that read the check-in and the call that sent the next one.
Counted as the session's last response, they would make the re-armed check-in
early in its turn, and no check-in would ever come due. So the hook keeps, for
SLACK minutes after such an instruction, the time of the last response before
it, and a last response found inside those minutes is read as that earlier one.
Work the same turn does past SLACK counts as a response, and a prompt the owner
types drops the kept time.

A prompt the owner types also sets the count of check-ins run back to zero. A
message the owner sends mid-turn fires no UserPromptSubmit, so at a check-in the
hook reads the transcript from where it ended when the first check-in ran, and
a message of the owner's found there sets the count back too.

HOW A SCHEDULED MESSAGE ARRIVES, read on 2026-11-13 from the session archive
(web-tools-private, sessions/). The session is woken by a task notification
whose prompt is only an envelope, so UserPromptSubmit sees a prompt opening
`<task-notification>`. The message's text arrives in the ReadNotifications
result, at the start of the line under a `--- Notification` header whose origin
reads "scheduled trigger". The archive holds six such reads, the last on
2026-10-13. The read path here is held by tests over that recorded shape; no
session has yet run it live.

THE STATE is one small JSON file per session id under the temp directory, as
session-detail-caption.py keeps its own: `latest`, the id the hook last asked
for or last saw sent; `pending` and `due`; `ran`, the check-ins run since the
owner last typed; `mark`, the transcript's length when the first one ran; and
`quiet`, the kept time and the minute it holds until. The state is saved before
an instruction is printed. Where the state cannot be saved the hook says
nothing, and a session that reads a check-in with no instruction after it ends
the turn, as the message itself says. A new container starts without the state,
so a due check-in read there runs as a first.

THE OFF SWITCH. Removing this script's three entries from hooks.json ends the
practice. A check-in already armed then arrives with no instruction after it,
and the turn ends with no text. send-later-guard.sh still lets the message
through; restoring its refusal is a separate edit there.

A subagent's prompt or tool call is passed over. Silent and exit 0 on anything
else: another event or tool, an unparseable payload, no session id, a transcript
that shows no response before the wake, or any failure along the way. It never
blocks a prompt or a tool.
"""
import json
import os
import re
import sys
import time

FLOOR = 150_000  # context tokens below which no check-in is armed
DELAY = 55       # minutes from a session's last response to its check-in
DUE = 50         # minutes of idleness from which a check-in read counts as due
GRACE = 10       # minutes past its time that an unread check-in still counts as pending
SLACK = 5        # minutes a turn told to end with no text may take to do so
TAIL = 400_000
WAKE_TAIL = 4_000_000
USAGE = ("input_tokens", "cache_read_input_tokens", "cache_creation_input_tokens")
NOT_OWNER = ("<task-notification", "<agent-message", "[SYSTEM", "<system", "Another Claude")

# The message's opening, sent and read: the mark, with the variation selector a
# model may add when it copies the clock, then the id and its full stop.
SENT = re.compile("\\s*\u23f1\ufe0f? check-in ([\\w:-]+)\\.")
READ = re.compile("^[ \\t]*\u23f1\ufe0f? check-in ([\\w:-]+)\\.", re.M)

MESSAGE = ("\u23f1 check-in {id}. The check-in hook says what to do with this when it is read; "
           "if no such instruction follows, end the turn with no text.")
ARM = ("No check-in is pending for this session. Before this reply ends, call the send_later "
       "tool with delay_minutes {delay} and exactly this message: \u00ab{msg}\u00bb. Do it once; the "
       "check-in hook tracks it from here. If the session has no send_later tool, ignore this.")
DUPLICATE = "This check-in is a duplicate of one armed later. End the turn with no text."
EARLY = ("This check-in is early: the session's last response was {ago} ago. Call send_later "
         "with delay_minutes {d} and exactly this message: \u00ab{msg}\u00bb. Then end the turn with "
         "no text.")
FIRST = "\n".join((
    "Check-in, first of two. The session has been idle for {n} minutes and its prompt cache "
    "lapses at 60. This turn is automatic: the owner has not written. Spend at most four model "
    "calls on it.",
    "1. If the session's work is closed (its last reply closed on \u26ab, \u26aa, \U0001f7e3 or "
    "\U0001f534), close the session out now: unsubscribe from every pull request this session is "
    "subscribed to, arm nothing, and reply with one line saying so.",
    "2. Otherwise write a recap for a reader coming back cold: what the session is for, what "
    "waits on the owner as one question per decision, and where to pick up.",
    "3. Do work that needs no directional commitment, meaning no choice that is the owner's to "
    "make. Hand anything longer than two calls to a subagent. If there is no such work, say so "
    "in one line.",
    "4. Arm the second check-in: call send_later with delay_minutes {delay} and exactly this "
    "message: \u00ab{msg}\u00bb.",
    "Close with the caption and one closing state, and say that this is the first of two "
    "check-ins.",
))
SECOND = ("Check-in, second of two. The owner has not written since the first. Close the "
          "session out in at most three model calls: write a pick-up point wherever one is "
          "missing (an open pull request's guide, or the recap in the last reply), unsubscribe "
          "from every pull request this session is subscribed to, and arm nothing further. "
          "Reply with one line: that the session is closed out, and where its pick-up point is.")


# ── The two rules ───────────────────────────────────────────────────────────

def message(stamp):
    """The message a session sends itself, under the id `stamp`."""
    return MESSAGE.format(id=stamp)


def owner(prompt):
    """Whether a submitted prompt is one the owner typed, not a wake."""
    return isinstance(prompt, str) and not prompt.lstrip().startswith(NOT_OWNER)


def arming(prompt, pending, context, fresh):
    """The instruction a submitted prompt calls for, or None. `fresh` is the id
    a message armed now would carry."""
    if not owner(prompt) or pending or not context or context < FLOOR:
        return None
    return ARM.format(delay=DELAY, msg=message(fresh))


def decide(read, latest, minutes, ran, fresh):
    """What a check-in that was just read calls for: its kind and the
    instruction. `read` is its id and `latest` the newest id the state holds;
    `minutes` is how long ago the session last responded before the wake; `ran`
    counts the check-ins run since the owner last typed."""
    if latest and read < latest:
        return "duplicate", DUPLICATE
    minutes = max(0, minutes)
    if minutes < DUE:
        ago = "1 minute" if minutes == 1 else f"{minutes} minutes"
        return "early", EARLY.format(ago=ago, d=max(1, DELAY - minutes), msg=message(fresh))
    if not ran:
        return "first", FIRST.format(n=minutes, delay=DELAY, msg=message(fresh))
    return "second", SECOND


# ── The state ───────────────────────────────────────────────────────────────

def temp_dir():
    """tempfile.gettempdir()'s answer without importing tempfile, whose import
    would be paid at every prompt."""
    for name in ("TMPDIR", "TEMP", "TMP"):
        path = os.environ.get(name)
        if path and os.path.isdir(path):
            return path
    if os.path.isdir("/tmp"):
        return "/tmp"
    import tempfile
    return tempfile.gettempdir()


def load(path):
    try:
        with open(path, encoding="utf-8") as fh:
            state = json.load(fh)
        return state if isinstance(state, dict) else {}
    except (OSError, ValueError):
        return {}


def save(path, state):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    scratch = f"{path}.{os.getpid()}"
    with open(scratch, "w", encoding="utf-8") as fh:
        json.dump(state, fh)
    os.replace(scratch, path)


def waiting(state, now):
    """Whether an armed check-in is still to come: sent, not yet read, and not
    more than GRACE minutes past its time."""
    if not state.get("pending"):
        return False
    due = state.get("due")
    return not isinstance(due, (int, float)) or now < due + GRACE * 60


def new_id(now, after=None):
    """The id of a message written now: the UTC time, and should that not sort
    after the id `after`, that id with a suffix that does."""
    stamp = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime(now))
    return stamp if not after or stamp > after else after + "-1"


def epoch(stamp):
    """An ISO timestamp as seconds since the epoch, or None."""
    from datetime import datetime, timezone
    try:
        at = datetime.fromisoformat(stamp.replace("Z", "+00:00"))
    except (AttributeError, TypeError, ValueError):
        return None
    return (at if at.tzinfo else at.replace(tzinfo=timezone.utc)).timestamp()


# ── The transcript ──────────────────────────────────────────────────────────

def tail(transcript, size):
    """The whole lines in the last `size` bytes of the transcript."""
    with open(transcript, "rb") as fh:
        fh.seek(0, os.SEEK_END)
        start = max(0, fh.tell() - size)
        fh.seek(start)
        lines = fh.read().split(b"\n")
    return lines[1:] if start else lines  # the first line is cut partway


def tokens(entry):
    """The context tokens of a main-conversation response, or 0 for any other
    entry. A notice the harness writes in the model's place counts none."""
    if not isinstance(entry, dict) or entry.get("type") != "assistant" or entry.get("isSidechain"):
        return 0
    reply = entry.get("message")
    usage = reply.get("usage") if isinstance(reply, dict) else None
    return sum(int(usage.get(k) or 0) for k in USAGE) if isinstance(usage, dict) else 0


def context_size(transcript):
    """Context tokens of the last main-conversation response, or None."""
    for raw in reversed(tail(transcript, TAIL)):
        if b'"usage"' not in raw:
            continue
        try:
            used = tokens(json.loads(raw))
        except ValueError:
            continue
        if used:
            return used
    return None


def tool_result(entry):
    if "toolUseResult" in entry:
        return True
    sent = entry.get("message")
    content = sent.get("content") if isinstance(sent, dict) else None
    return isinstance(content, list) and any(
        isinstance(block, dict) and block.get("type") == "tool_result" for block in content)


def opens_wake(entry):
    """Whether an entry opens a turn or was queued into one."""
    if entry.get("type") == "user":
        return not tool_result(entry)
    if entry.get("type") == "attachment":
        sent = entry.get("attachment")
        return isinstance(sent, dict) and sent.get("type") == "queued_command"
    return False


def last_response(transcript):
    """When the last main-conversation response before the newest wake was
    written, as seconds since the epoch, or None when the transcript's tail
    shows no such response."""
    woke = False
    for raw in reversed(tail(transcript, WAKE_TAIL)):
        if woke and b'"usage"' not in raw:
            continue
        try:
            entry = json.loads(raw)
        except ValueError:
            continue
        if not isinstance(entry, dict) or entry.get("isSidechain"):
            continue
        if not woke:
            woke = opens_wake(entry)
        elif tokens(entry):
            at = epoch(entry.get("timestamp"))
            if at is not None:
                return at
    return None


def before_quiet(last, quiet):
    """The session's last response, with a response made inside a turn this
    hook told to end with no text read as the one before that turn."""
    if (last is not None and isinstance(quiet, dict)
            and isinstance(quiet.get("until"), (int, float))
            and isinstance(quiet.get("since"), (int, float)) and last <= quiet["until"]):
        return min(last, quiet["since"])
    return last


def human(origin):
    return isinstance(origin, dict) and origin.get("kind") == "human"


def owner_entry(entry):
    """Whether a transcript entry is a message the owner typed, by
    session-detail-caption.py's test: between turns or mid-turn."""
    if not isinstance(entry, dict) or entry.get("isSidechain"):
        return False
    if entry.get("type") == "user":
        return (human(entry.get("origin")) and not entry.get("isMeta")
                and not entry.get("isCompactSummary") and not tool_result(entry))
    if entry.get("type") == "attachment":
        sent = entry.get("attachment")
        return isinstance(sent, dict) and sent.get("type") == "queued_command" and human(sent.get("origin"))
    return False


def owner_since(transcript, mark):
    """Whether the owner has typed since the transcript was `mark` bytes long."""
    if not isinstance(mark, int) or not 0 <= mark <= os.path.getsize(transcript):
        return False
    with open(transcript, "rb") as fh:
        fh.seek(mark)
        for raw in fh:
            if b'"human"' not in raw:
                continue
            try:
                if owner_entry(json.loads(raw)):
                    return True
            except ValueError:
                continue
    return False


def strings(value):
    """Every string in a tool's response, whose shape is not guaranteed."""
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for item in value.values():
            yield from strings(item)
    elif isinstance(value, list):
        for item in value:
            yield from strings(item)


# ── The three events ────────────────────────────────────────────────────────

def on_prompt(payload, path, now):
    prompt = payload.get("prompt")
    if not owner(prompt):
        return None
    state = load(path)
    was = dict(state)
    if state.get("ran"):
        state["ran"] = 0
        state.pop("mark", None)
    state.pop("quiet", None)
    text = None
    if not waiting(state, now):
        transcript = payload.get("transcript_path")
        found = isinstance(transcript, str) and os.path.isfile(transcript)
        fresh = new_id(now, state.get("latest") if isinstance(state.get("latest"), str) else None)
        text = arming(prompt, False, context_size(transcript) if found else None, fresh)
        if text:
            state.update(latest=fresh, pending=False)
            state.pop("due", None)
    if state != was:
        save(path, state)
    return text


def on_send(payload, path, now):
    given = payload.get("tool_input")
    sent = given.get("message") if isinstance(given, dict) else None
    mark = SENT.match(sent) if isinstance(sent, str) else None
    if not mark:
        return None
    result = payload.get("tool_response", payload.get("tool_result"))
    if isinstance(result, dict) and (result.get("is_error") or result.get("isError")):
        return None
    fires = re.search(r"fire_at\W+(\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?(?:Z|[+-]\d\d:\d\d)?)",
                      json.dumps(result))
    due = epoch(fires.group(1)) if fires else None
    if due is None:
        delay = given.get("delay_minutes")
        due = now + 60 * (delay if isinstance(delay, (int, float)) and delay > 0 else DELAY)
    state = load(path)
    state.update(latest=mark.group(1), pending=True, due=due)
    save(path, state)
    return None


def on_read(payload, path, now):
    body = "\n".join(strings(payload.get("tool_response", payload.get("tool_result"))))
    if "check-in" not in body:
        return None
    ids = READ.findall(body)
    if not ids:
        return None
    read = max(ids)
    state = load(path)
    latest = state.get("latest") if isinstance(state.get("latest"), str) else None
    duplicate = bool(latest and read < latest)
    transcript = payload.get("transcript_path")
    found = isinstance(transcript, str) and os.path.isfile(transcript)
    last = before_quiet(last_response(transcript) if found else None, state.get("quiet"))
    if last is None and not duplicate:
        return None
    minutes = 0 if last is None else max(0, int(now - last)) // 60
    ran = state.get("ran") if isinstance(state.get("ran"), int) else 0
    if ran and found and owner_since(transcript, state.get("mark")):
        ran = 0
    fresh = new_id(now, max(read, latest or ""))
    kind, text = decide(read, latest, minutes, ran, fresh)
    if kind in ("duplicate", "early"):
        if last is not None:
            state["quiet"] = {"until": now + SLACK * 60, "since": last}
    else:
        state.pop("quiet", None)
    if kind != "duplicate":  # the later check-in a duplicate gives way to is still to come
        state["pending"] = False
        state.pop("due", None)
    if kind == "early":
        state["latest"] = fresh
    elif kind == "first":
        state.update(latest=fresh, ran=1, mark=os.path.getsize(transcript))
    elif kind == "second":
        state["ran"] = ran + 1
    save(path, state)
    return text


def main():
    try:
        payload = json.loads(sys.stdin.buffer.read().decode("utf-8", "replace") or "{}")
    except ValueError:
        return
    if not isinstance(payload, dict) or payload.get("agent_id"):
        return
    session = str(payload.get("session_id") or "")
    if not re.fullmatch(r"[\w.-]+", session):
        return
    event = payload.get("hook_event_name")
    tool = str(payload.get("tool_name") or "")
    path = os.path.join(temp_dir(), "check-in", session)
    now = time.time()
    if event == "UserPromptSubmit":
        text = on_prompt(payload, path, now)
    elif event == "PostToolUse" and re.fullmatch(r"mcp__.+__send_later", tool):
        text = on_send(payload, path, now)
    elif event == "PostToolUse" and tool == "ReadNotifications":
        text = on_read(payload, path, now)
    else:
        return
    if text:
        print(json.dumps({"hookSpecificOutput": {"hookEventName": event, "additionalContext": text}}))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
    sys.exit(0)
