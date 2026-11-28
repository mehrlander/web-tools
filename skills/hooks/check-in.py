#!/usr/bin/env python3
"""UserPromptSubmit, and PostToolUse on send_later, on update_trigger and on
ReadNotifications: the check-in a session schedules for itself, to run shortly
before its prompt cache lapses.

THE WHY. A session's prompt cache lives one hour from its last model call. The
first call after that hour writes the whole context to the cache again, at
eighty times the read price (docs/environment/container.md, "The prompt
cache"). A session that wakes itself at 55 minutes keeps the cache warm while a
call still costs the read price, and a second wake an hour on writes its recap
and closes its work out. A call of its own to keep the timer current would cost
a model call on every turn, so the hook asks for the move only at a prompt the
owner types, sent beside the turn's first other tool call, and re-arms a
message that still arrives early.

THE MESSAGE is what the session sends itself with send_later. Its id is the UTC
time at which the hook wrote it, so a later id sorts after an earlier one. Two
ids written in one second are told apart by a suffix on the second:

    ⏱ check-in 20261113T221500Z. The check-in hook says what to do with this when it is read; if no such instruction follows, end the turn with no text.

send-later-guard.sh refuses every send_later whose message opens otherwise.

ARMING. On a prompt the owner typed, in a cloud session, when no check-in is
pending and the context is at least FLOOR tokens, the hook asks for the message
to be sent with a delay of DELAY minutes. A cloud session is one whose
environment has CLAUDE_CODE_REMOTE=true, the test .claude/hooks/session-start.sh
makes; send_later is a tool of that session's remote server, so no other
session is asked. FLOOR is the context size above which
lib/kits/session-usage.js counts an idle re-load. The owner's prompt is told
from a wake as session-detail-caption.py tells it, by how the prompt opens, and
the context is read as context-size-hint.py reads it. The hook asks again at
each such prompt until a check-in is pending. The instruction still says to
ignore it where there is no send_later tool: a cloud session whose remote
server did not connect has none.

TRACKING. After a send_later whose message opens with the mark and an id, the
hook records that id as the latest, that a check-in is pending, when it fires
(fire_at in the tool's result, or now plus the delay), and the trigger_id the
result gives. A check-in stays pending until it is read. One that is still
unread GRACE minutes after its time counts as lost, so that a message the
scheduler never delivered does not end the practice for the session.

MOVING IT LATER. A check-in armed at one prompt fires DELAY minutes after it,
however long the owner then keeps the session busy, so a busy session reads it
early. At each later prompt the owner types in a cloud session, while a
check-in is pending, its trigger_id is known and its time is still ahead, the
hook asks for it to be moved to DELAY minutes from the prompt: an
update_trigger call with that trigger_id and a run_once_at the hook writes,
sent in the same response as the turn's first other tool call, so that it
costs no model call of its own. A turn that makes no tool call skips it, and
its check-in may then arrive early and be sent again, as below. After an update_trigger on the pending trigger the
hook records the time it now fires: next_run_at or run_once_at in the tool's
result, or else the run_once_at it was given. A time that names no zone is
passed over, so a local time is never read as UTC.

WHEN A CHECK-IN IS READ, in a ReadNotifications result, the hook prints one of
four instructions. The newest id in the batch is the one judged.

    duplicate   The state holds a later id. The turn ends with no text.
    early       The session's last main-conversation response before the wake
                was under DUE minutes ago, because the owner or an event has
                kept the session busy since the message was armed. The message
                is sent again for the minutes that remain of DELAY, and the
                reply is one line the hook supplies, saying when it now fires.
    first       Due, and no check-in has run since the owner last typed: work
                that needs no decision of the owner's, a second check-in armed,
                and one line the hook supplies as the whole reply, with no
                caption and no closing state.
    second      Due, and the first has run since the owner last typed, so the
                last: a recap for a reader coming back cold, the session closed
                out with no further check-in armed, and the caption.

The lines the hook supplies give times in the owner's zone, by
session-detail-caption.py's clock, which this hook loads from beside it; where
that fails they are in UTC with a Z. The harness asks for visible output after
a turn that ends with no text, so a supplied line takes the place of silence.

The wake is the newest entry in the transcript that opens a turn or was queued
into one: a `user` entry that is not a tool result, or a queued_command
attachment. The last response is the newest main-conversation `assistant` entry
before that wake that used any tokens.

A turn this hook told to end at once, with one line or with no text (early,
duplicate), makes responses of its own: the call that read the check-in and the
call that sent the next one. Counted as the session's last response, they would
make the re-armed check-in early in its turn, and no check-in would ever come
due. So the hook keeps, for SLACK minutes after such an instruction, the time of
the last response before it, and a last response found inside those minutes is
read as that earlier one. Work the same turn does past SLACK counts as a
response, and a prompt the owner types drops the kept time.

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
2026-10-13. The path has run live since 2026-11-14: one session read eighteen
check-ins by 2026-11-16, twelve of them early, four first and two second, and
its send_later results carried fire_at, now and trigger_id as JSON in a text
block. The twelve early reads are why the hook now moves a pending check-in at
the owner's prompts.

THE STATE is one small JSON file per session id under the temp directory, as
session-detail-caption.py keeps its own: `latest`, the id the hook last asked
for or last saw sent; `pending`, `due` and `trigger`, the pending check-in's
time and trigger_id; `ran`, the check-ins run since the owner last typed;
`mark`, the transcript's length when the first one ran; and `quiet`, the kept
time and the minute it holds until. The state is saved before an instruction
is printed. Where the state cannot be saved the hook says nothing, and a
session that reads a check-in with no instruction after it ends the turn, as
the message itself says. A new container starts without the state, so a due
check-in read there runs as a first.

THE OFF SWITCH. Removing this script's four entries from hooks.json ends the
practice. A check-in already armed then arrives with no instruction after it,
and the turn ends with no text. send-later-guard.sh still lets the message
through; restoring its refusal is a separate edit there.

A PROGRAM'S STANDING SESSION is never armed: it is meant to stay open between
the owner's visits, and the second check-in would close it out.
session-detail-caption.py's standing() names such a session, and this hook loads
it from beside it.

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
SLACK = 5        # minutes a turn told to end at once may take to do so
TAIL = 400_000
WAKE_TAIL = 4_000_000
USAGE = ("input_tokens", "cache_read_input_tokens", "cache_creation_input_tokens")
NOT_OWNER = ("<task-notification", "<agent-message", "[SYSTEM", "<system", "Another Claude")

# The message's opening, sent and read: the mark, with the variation selector a
# model may add when it copies the clock, then the id and its full stop.
SENT = re.compile("\\s*\u23f1\ufe0f? check-in ([\\w:-]+)\\.")
READ = re.compile("^[ \\t]*\u23f1\ufe0f? check-in ([\\w:-]+)\\.", re.M)
TRIGGER = re.compile(r"trigger_id\W+(trig_[\w-]+)")

MESSAGE = ("\u23f1 check-in {id}. The check-in hook says what to do with this when it is read; "
           "if no such instruction follows, end the turn with no text.")
ARM = ("No check-in is pending for this session. Before this reply ends, call the send_later "
       "tool with delay_minutes {delay} and exactly this message: \u00ab{msg}\u00bb. Do it once; the "
       "check-in hook tracks it from here. If the session has no send_later tool, ignore this.")
MOVE = ("A check-in is pending for this session, as trigger {trigger}. Move it to {delay} minutes "
        "from now: call the update_trigger tool with trigger_id {trigger} and run_once_at {at}, "
        "sent in the same response as this turn's first other tool call and not in a response "
        "of its own. If the turn makes no tool call, skip it.")
DUPLICATE = "This check-in is a duplicate of one armed later. End the turn with no text."
EARLY = ("This check-in is early: the session's last response was {ago} ago. Call send_later "
         "with delay_minutes {d} and exactly this message: \u00ab{msg}\u00bb. Then reply with exactly "
         "this line, below any reply that other work in this turn calls for, with no caption and "
         "no closing state: \u00abCache check-in fired while we were talking; moved to {at}.\u00bb")
FIRST = "\n".join((
    "Check-in, first of two. The session has been idle for {n} minutes and its prompt cache "
    "lapses at 60. This turn is automatic: the owner has not written. Spend at most four model "
    "calls on it.",
    "1. If the session's work is closed (its last reply closed on \u26ab, \u26aa, \U0001f7e3 or "
    "\U0001f534), close the session out now: unsubscribe from every pull request this session is "
    "subscribed to, arm no further check-in, and reply with one line saying so. Steps 2 to 4 "
    "then do not apply.",
    "2. Do work that needs no directional commitment, meaning no choice that is the owner's to "
    "make, such as the tend skill's Prod list. Hand anything longer than two calls to a "
    "subagent. Where there is no such work, do "
    "none.",
    "3. Arm the second check-in: call send_later with delay_minutes {delay} and exactly this "
    "message: \u00ab{msg}\u00bb.",
    "4. Reply with exactly this line, with no caption and no closing state: \u00abQuiet check-in "
    "at {at}: the cache is warm, and a recap follows at {then} if the session stays idle.\u00bb",
))
SECOND = "\n".join((
    "Check-in, second of two, and the last. The owner has not written since the first. This "
    "turn is automatic. Spend at most four model calls on it.",
    "1. Write a recap for a reader coming back cold: how the session started, what waits on "
    "the owner as one question per decision, and where to pick up.",
    "2. Close the session out: write a pick-up point wherever one is missing, such as an open "
    "pull request's guide; unsubscribe from every pull request this session is subscribed to; "
    "and arm no further check-in.",
    "3. Close with the caption and one closing state, and say that this is the second and last "
    "check-in.",
))


# ── The rules ───────────────────────────────────────────────────────────────

def message(stamp):
    """The message a session sends itself, under the id `stamp`."""
    return MESSAGE.format(id=stamp)


def owner(prompt):
    """Whether a submitted prompt is one the owner typed, not a wake."""
    return isinstance(prompt, str) and not prompt.lstrip().startswith(NOT_OWNER)


def cloud(environ):
    """Whether an environment is a cloud session's, the one kind that has a
    send_later tool."""
    return environ.get("CLAUDE_CODE_REMOTE") == "true"


def owner_clock(at):
    """The time `at` as the owner reads it, as 12:15pm, by
    session-detail-caption.py's clock and zone; in UTC with a Z where that file
    cannot be loaded."""
    try:
        import importlib.util
        spec = importlib.util.spec_from_file_location("session_detail_caption", os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "session-detail-caption.py"))
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module.clock(at).split(" ", 1)[1]
    except Exception:
        utc = time.gmtime(at)
        return f"{utc.tm_hour}:{utc.tm_min:02d}Z"


def program_session(environ):
    """Whether this is a program's standing session, by
    session-detail-caption.py's standing(); False where that file cannot be
    loaded."""
    try:
        import importlib.util
        spec = importlib.util.spec_from_file_location("session_detail_caption", os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "session-detail-caption.py"))
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module.standing(environ) is not None
    except Exception:
        return False


def arming(prompt, remote, pending, context, fresh):
    """The instruction a submitted prompt calls for, or None. `remote` says the
    session is a cloud session, and `fresh` is the id a message armed now would
    carry."""
    if not owner(prompt) or not remote or pending or not context or context < FLOOR:
        return None
    return ARM.format(delay=DELAY, msg=message(fresh))


def moving(trigger, due, now):
    """The instruction that moves a pending check-in to DELAY minutes from now,
    or None when its trigger_id is unknown or its time is not still ahead."""
    if (not isinstance(trigger, str) or not re.fullmatch(r"[\w-]+", trigger)
            or not isinstance(due, (int, float)) or now >= due):
        return None
    at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now + DELAY * 60))
    return MOVE.format(trigger=trigger, delay=DELAY, at=at)


def decide(read, latest, minutes, ran, fresh, now):
    """What a check-in that was just read calls for: its kind and the
    instruction. `read` is its id and `latest` the newest id the state holds;
    `minutes` is how long ago the session last responded before the wake; `ran`
    counts the check-ins run since the owner last typed; `now` is when it was
    read."""
    if latest and read < latest:
        return "duplicate", DUPLICATE
    minutes = max(0, minutes)
    if minutes < DUE:
        ago = "1 minute" if minutes == 1 else f"{minutes} minutes"
        d = max(1, DELAY - minutes)
        return "early", EARLY.format(ago=ago, d=d, msg=message(fresh), at=owner_clock(now + d * 60))
    if not ran:
        return "first", FIRST.format(n=minutes, delay=DELAY, msg=message(fresh),
                                     at=owner_clock(now), then=owner_clock(now + DELAY * 60))
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


def settled(state):
    """Mark the state as holding no pending check-in."""
    state["pending"] = False
    state.pop("due", None)
    state.pop("trigger", None)


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


def stamp_in(value, name, zoned=False):
    """The time a tool's input or result gives under `name`, whatever its shape,
    as seconds since the epoch, or None. `zoned` passes over a time that names
    no zone."""
    zone = r"(?:Z|[+-]\d\d:\d\d)" + ("" if zoned else "?")
    found = re.search(name + r"\W+(\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?" + zone + ")",
                      json.dumps(value))
    return epoch(found.group(1)) if found else None


def failed(result):
    return isinstance(result, dict) and bool(result.get("is_error") or result.get("isError"))


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
    hook told to end at once read as the one before that turn."""
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


# ── The four events ─────────────────────────────────────────────────────────

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
    if cloud(os.environ) and waiting(state, now):
        text = moving(state.get("trigger"), state.get("due"), now)
    elif cloud(os.environ) and not program_session(os.environ):
        transcript = payload.get("transcript_path")
        found = isinstance(transcript, str) and os.path.isfile(transcript)
        fresh = new_id(now, state.get("latest") if isinstance(state.get("latest"), str) else None)
        text = arming(prompt, True, False, context_size(transcript) if found else None, fresh)
        if text:
            settled(state)
            state["latest"] = fresh
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
    if failed(result):
        return None
    due = stamp_in(result, "fire_at")
    if due is None:
        delay = given.get("delay_minutes")
        due = now + 60 * (delay if isinstance(delay, (int, float)) and delay > 0 else DELAY)
    trigger = TRIGGER.search(json.dumps(result))
    state = load(path)
    state.update(latest=mark.group(1), pending=True, due=due)
    if trigger:
        state["trigger"] = trigger.group(1)
    else:
        state.pop("trigger", None)
    save(path, state)
    return None


def on_move(payload, path, now):
    given = payload.get("tool_input")
    trigger = given.get("trigger_id") if isinstance(given, dict) else None
    result = payload.get("tool_response", payload.get("tool_result"))
    if not isinstance(trigger, str) or failed(result):
        return None
    state = load(path)
    if not state.get("pending") or state.get("trigger") != trigger:
        return None
    due = stamp_in(result, "next_run_at", True)
    if due is None:
        due = stamp_in(result, "run_once_at", True)
    if due is None:
        due = stamp_in(given, "run_once_at", True)
    if due is None:
        return None
    state["due"] = due
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
    kind, text = decide(read, latest, minutes, ran, fresh, now)
    if kind in ("duplicate", "early"):
        if last is not None:
            state["quiet"] = {"until": now + SLACK * 60, "since": last}
    else:
        state.pop("quiet", None)
    if kind != "duplicate":  # the later check-in a duplicate gives way to is still to come
        settled(state)
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
    elif event == "PostToolUse" and re.fullmatch(r"mcp__.+__update_trigger", tool):
        text = on_move(payload, path, now)
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
