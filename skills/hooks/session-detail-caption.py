#!/usr/bin/env python3
"""UserPromptSubmit, and PostToolUse on Bash: print the session detail caption,
the line a reply closes with (docs/CONVERSATION.md, "Session detail caption"),
so that no session works it out by hand.

    `11/14 10:14am` 💬[22](https://mehrlander.github.io/web-tools/pages/session.html#id=f701fa79) `816k` `1d 2h` [✍️1](https://mehrlander.github.io/web-tools/pages/session.html#id=f701fa79) [`‹⋯›`](https://mehrlander.github.io/web-tools/app/?view=program&program=sessions)
    `11/14 11:12am` 💬[22](https://mehrlander.github.io/web-tools/pages/session.html#id=f701fa79) scheduled task `816k` `1d 3h` [`‹⋯›`](https://mehrlander.github.io/web-tools/app/?view=program&program=sessions)

THE PARTS. The line opens with when this run printed it, as a code span, in
the owner's time zone (OWNER_TZ below): month/day, then 12-hour time with a
plain am or pm. One space separates the parts, and PILL_GAP below, a space and
a no-break space, separates two code spans. In the Claude app on an iPhone,
each single space tried between two code spans (ordinary, no-break, en, em and
thin) drew them touching, while a code span beside plain text kept its gap (the
owner's screenshots, 2026-11-21). 22 counts the messages the owner has typed, and is the link to the session page, named by the session id's
first eight characters. A turn the
owner did not start names what started it next (WHAT STARTED THE TURN, below),
as the second line does. 816k is the
context in thousands of tokens, read the way context-size-hint.py reads it:
input_tokens + cache_read_input_tokens + cache_creation_input_tokens of the
last main-conversation response in the transcript's tail. The context and the
age are each a code span of their own, with plain unit letters. A zone that
cannot be loaded gives UTC in 24-hour time and a plain Z, as 11/14 18:14Z.
1d 2h is the time since the first of the owner's messages: 45m under an hour,
7h under a day, 1d 2h after. ✍️1 counts the documents whose wording waits on
the owner's sign-off (THE SIGN-OFF, below), linked to the session page's deck
of calls. The changed ones are the files changed against main
(`git diff origin/main...HEAD --name-only`) in the session's checkouts, which
are the checkout the project root is in and each folder directly under the
root that holds a .git, that are documentation, by governing-docs.py beside
this file (the test warn-governing-docs.sh applies). A
zero count is left off, and so is a part the transcript cannot supply: the time
before any owner message, the context before any response. The line closes
with ‹⋯› as a code span linking PROGRAM below, after ✍️, so that every line
ends on the same mark.

THE SIGN-OFF is read from the session's user calls in the archive checkout,
`user-calls/<short>-<slug>.json` (the user-calls skill, skills/user-calls/SKILL.md,
holds the schema). A documentation call names its document as
`owner/repo@ref:path`, and the latest such call for a repo and path, by
`created`, decides it: waiting while that call is `open`, signed off once it
is not. ✍️ counts the paths whose latest call is open, whether or not the test
above takes the path for documentation, and the changed documents no call
names; documents with the same text in one checkout count once, so a copy the
commit hook writes from its source goes with it. The ✍️ links the first open
documentation call, `session.html#id=<short>&user-call=<slug>`, or with none
open the session page alone. Without the archive there is no ✍️.

THE OWNER'S MESSAGES are told by the harness's own test for a person's words.
A `user` entry whose origin is {"kind": "human"} is a message typed between
turns. A message sent while the model was working is an `attachment` entry of
type queued_command with the same origin. The queue-operation entry that takes
that message off the queue (reason absorbed_mid_turn) repeats it under the same
id and is not counted; the same two entry types carry task notifications and
agent messages, whose origin says so. Counting takes a pass over the whole
transcript, 30 ms on a 20 MB one, so the count is kept in the state file with
the number of bytes it covers, and a run reads only what was appended since.

THE PROMPT BEING SUBMITTED is not in the transcript when UserPromptSubmit runs.
Watched 2026-11-13 on Claude Code 2.1.323, for an owner's prompt and for an
agent's message: while this event's hooks ran, the transcript ended at the
queue-operation entries for the prompt, and its `user` entry was written
between 40 and 80 ms later. So an owner's prompt adds one to the count. Two
tests decide it. The event also fires for a task notification or an agent
message, which the opening of the prompt gives away (NOT_OWNER). And should a
harness write the entry first, the prompt is already counted when the newest
owner entry carries the same text and no response has followed it.

WHAT STARTED THE TURN. On UserPromptSubmit for a prompt that is not the
owner's, the part after the count names its kind, read from the prompt. One
opening `<agent-message` or "Another Claude" is an agent message. A task
notification names its kind in its summary. Queued remote notifications list
their origins there, as "1 unread notification (GitHub activity on a
subscribed PR: 1)" or "1 unread notification (scheduled trigger (the stored
prompt of a routine or task on this account): 1)", and a background agent's
summary reads `Agent "<description>" finished`. GitHub activity is a PR event,
a scheduled trigger a scheduled task, and another Claude session or a finished
agent an agent message; a summary that lists two origins names both, in its
order. Any other prompt is a plain wake. A Stop hook that sends a turn back
writes a `user` entry opening "Stop hook feedback" and fires no
UserPromptSubmit (read 2026-11-16 in a Claude Code 2.1.325 transcript), so a
turn it continues has no line of its own to name it in.

THE LINK. The session page exists only where the session archive is checked
out, found as session-record.sh finds it: a checkout among the project root,
its children and its siblings whose .web-tools.json declares "sessions" and
whose store holds tools/on-stop.sh, or SESSIONS_STORE, whose checkout is the
nearest folder above it holding a .git. Without one the count
links the 🌿 branch page of the current checkout instead: the one the working
directory is in or, with that directory above the checkouts, the one with the
most files changed. With no checkout to link either, the count stands alone.

WHEN IT SPEAKS. On UserPromptSubmit, always. On PostToolUse only when the ✍️
count differs from the one it last printed, so that a reply made after a
commit of a document carries a fresh count. That second event follows every Bash call, so it first
compares what a commit, a checkout or a fetch moves in each checkout (HEAD, its
log, the branch's ref, origin/main, packed-refs) by stat, and stops there when
nothing moved: no git process and no transcript read. UserPromptSubmit always
asks git, so a move the mark missed is corrected at the next prompt. A
subagent's Bash call is passed over, since the caption belongs to the main
conversation's reply. Between two lines the last one stands: a message the
owner sends mid-turn, and the time and context a turn adds, show in the next.

THE STATE is one small JSON file per session id under the temp directory, as
context-size-hint.py keeps its marks: the ✍️ count last printed, the stat
mark, and the owner-message count with the bytes it covers.

Silent and exit 0 on anything else: an unparseable payload, no session id, or
any failure along the way. It never blocks a prompt.
"""
import json
import os
import re
import sys
import time

# The owner's time zone, the one setting the printed time reads.
OWNER_TZ = os.environ.get("OWNER_TZ") or "America/Los_Angeles"
PAGES = "https://mehrlander.github.io/web-tools/pages/"
PROGRAM = "https://mehrlander.github.io/web-tools/app/?view=program&program=sessions"
PILL_GAP = " \u00a0"
TAIL = 400_000
USAGE = ("input_tokens", "cache_read_input_tokens", "cache_creation_input_tokens")
NOT_OWNER = ("<task-notification", "<agent-message", "[SYSTEM", "<system", "Another Claude")


def temp_dir():
    """tempfile.gettempdir()'s answer without importing tempfile, which adds a
    quarter to this script's start and would be paid after every Bash call."""
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


# ── The checkouts, and what moved in them ───────────────────────────────────

def checkouts(root):
    """The session's git checkouts: the one the root is in, and each folder
    directly under the root that holds a .git."""
    found = []
    here = root
    while True:
        if os.path.exists(os.path.join(here, ".git")):
            found.append(here)
            break
        parent = os.path.dirname(here)
        if parent == here:
            break
        here = parent
    try:
        names = sorted(os.listdir(root))
    except OSError:
        names = []
    for name in names:
        path = os.path.join(root, name)
        if path not in found and os.path.exists(os.path.join(path, ".git")):
            found.append(path)
    return found


def git_dirs(repo):
    """A checkout's git directory and the directory its refs live in. They
    differ in a linked worktree, whose .git is a file naming the first."""
    git = os.path.join(repo, ".git")
    if os.path.isfile(git):
        with open(git, encoding="utf-8") as fh:
            pointer = fh.read().strip()
        if pointer.startswith("gitdir:"):
            git = os.path.normpath(os.path.join(repo, pointer[7:].strip()))
    common = git
    try:
        with open(os.path.join(git, "commondir"), encoding="utf-8") as fh:
            common = os.path.normpath(os.path.join(git, fh.read().strip()))
    except OSError:
        pass
    return git, common


def stamp(path):
    try:
        st = os.stat(path)
        return f"{st.st_mtime_ns}.{st.st_size}"
    except OSError:
        return "-"


def mark(repos):
    """One string that changes whenever HEAD or origin/main moves in a checkout,
    from a read of HEAD and four stat calls each."""
    parts = []
    for repo in repos:
        try:
            git, common = git_dirs(repo)
            with open(os.path.join(git, "HEAD"), encoding="utf-8") as fh:
                head = fh.read().strip()
        except OSError:
            parts.append(repo)
            continue
        ref = head[4:].strip() if head.startswith("ref:") else ""
        parts.append(" ".join([
            repo, head,
            stamp(os.path.join(git, "logs", "HEAD")),
            stamp(os.path.join(common, ref)) if ref else "-",
            stamp(os.path.join(common, "refs", "remotes", "origin", "main")),
            stamp(os.path.join(common, "packed-refs")),
        ]))
    return "\n".join(parts)


def changed(repos):
    """The files changed against main in each checkout, as lists of paths, the
    git commands run side by side. A checkout with no origin/main has none."""
    import subprocess
    runs = []
    for repo in repos:
        try:
            runs.append(subprocess.Popen(
                ["git", "-C", repo, "diff", "origin/main...HEAD", "--name-only"],
                stdout=subprocess.PIPE, stderr=subprocess.DEVNULL))
        except OSError:
            runs.append(None)
    names = []
    for run in runs:
        found = []
        if run is not None:
            try:
                out, _ = run.communicate(timeout=4)
                if run.returncode == 0:
                    found = out.decode("utf-8", "replace").splitlines()
            except subprocess.TimeoutExpired:
                run.kill()
        names.append(found)
    return names


# ── The transcript ──────────────────────────────────────────────────────────

def text_of(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "\n".join(str(block.get("text") or "") for block in content
                         if isinstance(block, dict) and block.get("type") == "text")
    return ""


def human(origin):
    return isinstance(origin, dict) and origin.get("kind") == "human"


def owner_words(entry):
    """What the owner typed in this entry, or None when the entry is not a
    message of the owner's."""
    if not isinstance(entry, dict) or entry.get("isSidechain"):
        return None
    if entry.get("type") == "user":
        if (not human(entry.get("origin")) or entry.get("isMeta")
                or entry.get("isCompactSummary") or "toolUseResult" in entry):
            return None
        message = entry.get("message")
        return text_of(message.get("content") if isinstance(message, dict) else None)
    if entry.get("type") == "attachment":
        sent = entry.get("attachment")
        if isinstance(sent, dict) and sent.get("type") == "queued_command" and human(sent.get("origin")):
            return text_of(sent.get("prompt"))
    return None


def count_owner(transcript, state):
    """Bring the owner-message count and the first message's time up to the
    transcript's last whole line, reading only what the state does not cover."""
    size = os.path.getsize(transcript)
    seen, count, first = state.get("seen"), state.get("owner"), state.get("first")
    if (state.get("transcript") != transcript or not isinstance(seen, int)
            or not isinstance(count, int) or not 0 <= seen <= size):
        seen, count, first = 0, 0, None
    with open(transcript, "rb") as fh:
        fh.seek(seen)
        for raw in fh:
            if not raw.endswith(b"\n"):
                break  # a line still being written; the next run reads it whole
            seen += len(raw)
            if b'"human"' not in raw:
                continue
            try:
                entry = json.loads(raw)
            except ValueError:
                continue
            if owner_words(entry) is None:
                continue
            count += 1
            first = first or entry.get("timestamp")
    state.update(transcript=transcript, seen=seen, owner=count, first=first)


def tail_facts(transcript):
    """From the transcript's tail: the context tokens of the last
    main-conversation response, or None; and the text of an owner's prompt that
    no response has followed, or None."""
    with open(transcript, "rb") as fh:
        fh.seek(0, os.SEEK_END)
        start = max(0, fh.tell() - TAIL)
        fh.seek(start)
        lines = fh.read().split(b"\n")
    if start:
        lines = lines[1:]  # the first line is cut partway
    unanswered, answered = None, False
    for raw in reversed(lines):
        if b'"usage"' not in raw and (answered or unanswered is not None or b'"human"' not in raw):
            continue
        try:
            entry = json.loads(raw)
        except ValueError:
            continue
        if not isinstance(entry, dict) or entry.get("isSidechain"):
            continue
        if entry.get("type") == "assistant":
            answered = True
            message = entry.get("message")
            usage = message.get("usage") if isinstance(message, dict) else None
            tokens = sum(int(usage.get(k) or 0) for k in USAGE) if isinstance(usage, dict) else 0
            if tokens:  # a notice the harness writes in the model's place counts none
                return tokens, unanswered
        elif not answered and unanswered is None and entry.get("type") == "user":
            unanswered = owner_words(entry)
    return None, unanswered


def submitting(event, payload, unanswered):
    """Whether this run is an owner's prompt on its way in and not yet counted."""
    prompt = payload.get("prompt")
    if event != "UserPromptSubmit" or not isinstance(prompt, str) or prompt.lstrip().startswith(NOT_OWNER):
        return False
    return unanswered is None or unanswered.strip() != prompt.strip()


# The origins a task notification's summary names, and the kind each one is.
ORIGINS = (("GitHub activity", "PR event"), ("scheduled trigger", "scheduled task"),
           ("Claude session", "agent message"))


def started_by(event, payload):
    """What started a turn the owner did not start, or "" for an owner's
    prompt or any other event."""
    prompt = payload.get("prompt")
    if event != "UserPromptSubmit" or not isinstance(prompt, str):
        return ""
    text = prompt.lstrip()
    if not text.startswith(NOT_OWNER):
        return ""
    if text.startswith(("<agent-message", "Another Claude")):
        return "agent message"
    summary = re.search(r"<summary>(.*?)</summary>", text, re.S) if text.startswith("<task-notification") else None
    if not summary:
        return "wake"
    said = summary.group(1).strip()
    if said.startswith('Agent "'):
        return "agent message"
    found = sorted((said.find(phrase), kind) for phrase, kind in ORIGINS if phrase in said)
    return ", ".join(dict.fromkeys(kind for _, kind in found)) or "wake"


# ── The line ────────────────────────────────────────────────────────────────

def archive(root):
    """The session archive's checkout, found by session-record.sh's test, or
    "" when it is not checked out."""
    explicit = os.environ.get("SESSIONS_STORE")
    if explicit:
        if not os.path.isfile(os.path.join(explicit, "tools", "on-stop.sh")):
            return ""
        here = os.path.abspath(explicit)
        while not os.path.exists(os.path.join(here, ".git")):
            if os.path.dirname(here) == here:
                return os.path.dirname(os.path.abspath(explicit))
            here = os.path.dirname(here)
        return here
    folders = [root]
    parent = os.path.dirname(root)
    for base in [root] + ([] if parent in ("", os.sep, ".", root) else [parent]):
        try:
            folders += [os.path.join(base, name) for name in sorted(os.listdir(base))]
        except OSError:
            pass
    for folder in folders:
        try:
            with open(os.path.join(folder, ".web-tools.json"), "rb") as fh:
                raw = fh.read()
        except OSError:
            continue
        if b'"sessions"' not in raw:
            continue
        try:
            declared = json.loads(raw).get("sessions")
        except (ValueError, AttributeError):
            continue
        if (isinstance(declared, str) and declared
                and os.path.isfile(os.path.join(folder, declared, "tools", "on-stop.sh"))):
            return folder
    return ""


def origin_slug(repo):
    """A checkout's owner/repo, lowercased, read from its git config's origin
    without running git, or ""."""
    try:
        _, common = git_dirs(repo)
        with open(os.path.join(common, "config"), encoding="utf-8") as fh:
            config = fh.read()
    except OSError:
        return ""
    section = re.search(r'\[remote "origin"\]([^\[]*)', config)
    url = re.search(r"^\s*url\s*=\s*(\S+)", section.group(1), re.M) if section else None
    slug = re.search(r"[:/]([^/:]+)/([^/]+?)(?:\.git)?/?$", url.group(1)) if url else None
    return f"{slug.group(1)}/{slug.group(2)}".lower() if slug else ""


def engine():
    """governing-docs.py, loaded by path since its name is hyphenated."""
    import importlib.util
    spec = importlib.util.spec_from_file_location(
        "governing_docs", os.path.join(os.path.dirname(os.path.abspath(__file__)), "governing-docs.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def awaiting(repos, names, store, short):
    """The count of documents still waiting on the owner's sign-off, and the
    slug of the session's first open documentation call, or ""."""
    folder = os.path.join(store, "user-calls")
    try:
        files = sorted(n for n in os.listdir(folder) if n.startswith(short + "-") and n.endswith(".json"))
    except OSError:
        files = []
    latest = {}
    for name in files:
        try:
            with open(os.path.join(folder, name), encoding="utf-8") as fh:
                call = json.load(fh)
        except (OSError, ValueError):
            continue
        if not isinstance(call, dict) or call.get("kind") != "documentation":
            continue
        named = re.fullmatch(r"([^/\s]+/[^@:\s]+)(?:@[^:\s]+)?:(\S+)", str(call.get("file") or ""))
        if not named:
            continue
        key, when = (named.group(1).lower(), named.group(2)), str(call.get("created") or "")
        if key not in latest or when >= latest[key][0]:
            latest[key] = (when, call.get("status"), str(call.get("slug") or name[len(short) + 1:-5]))
    open_calls = sorted((when, slug) for when, status, slug in latest.values() if status == "open")
    # A changed document that no call names waits too. Documents with the same
    # text in one checkout are one document: a copy the commit hook writes from
    # its source (skills/default/ from docs/) is signed off with it.
    uncalled = set()
    test = None
    for repo, found in zip(repos, names):
        found = [rel for rel in found if rel.endswith((".md", ".json"))]
        if not found:
            continue
        test = test or engine()
        cache, slug, groups = {}, origin_slug(repo), {}
        for rel in found:
            if not test.documentation(repo, rel, cache):
                continue
            try:
                with open(os.path.join(repo, rel), "rb") as fh:
                    text = fh.read()
            except OSError:
                text = rel.encode()
            groups.setdefault(text, []).append((slug, rel))
        uncalled.update(tuple(g[0]) for g in groups.values() if not any(k in latest for k in g))
    return len(open_calls) + len(uncalled), open_calls[0][1] if open_calls else ""


def branch_page(repos, counts, cwd):
    """The branch page of the current checkout, or "" when none can be named."""
    if not repos:
        return ""
    inside = [repo for repo in repos if cwd == repo or cwd.startswith(repo + os.sep)]
    repo = max(inside, key=len) if inside else repos[counts.index(max(counts))]
    import subprocess

    def git(*args):
        run = subprocess.run(["git", "-C", repo, *args], capture_output=True, text=True, timeout=4)
        return run.stdout.strip() if run.returncode == 0 else ""

    slug = re.search(r"[:/]([^/:]+)/([^/]+?)(?:\.git)?/?$", git("remote", "get-url", "origin"))
    if not slug:
        return ""
    branch = git("symbolic-ref", "--short", "-q", "HEAD")
    return f"{PAGES}branch.html#gh={slug.group(1)}/{slug.group(2)}" + (f"@{branch}" if branch else "")


KILO, DAY, HOUR, MINUTE = "k", "d", "h", "m"


def elapsed(seconds):
    minutes = max(0, int(seconds)) // 60
    if minutes < 60:
        return f"{minutes}{MINUTE}"
    hours = minutes // 60
    if hours < 24:
        return f"{hours}{HOUR}"
    return f"{hours // 24}{DAY} {hours % 24}{HOUR}"


def clock(now, zone=OWNER_TZ):
    """The time `now` as month/day hour:minute in the owner's zone, or in UTC
    with a Z when the zone cannot be loaded."""
    from datetime import datetime, timezone
    try:
        from zoneinfo import ZoneInfo
        at = datetime.fromtimestamp(now, ZoneInfo(zone))
    except Exception:
        at = datetime.fromtimestamp(now, timezone.utc)
        return f"{at.month}/{at.day} {at.hour}:{at.minute:02d}Z"
    marker = "am" if at.hour < 12 else "pm"
    return f"{at.month}/{at.day} {(at.hour + 11) % 12 + 1}:{at.minute:02d}{marker}"


def since(first, now):
    """Seconds from an entry's ISO timestamp to now, or None."""
    from datetime import datetime
    try:
        return now - datetime.fromisoformat(first.replace("Z", "+00:00")).timestamp()
    except (AttributeError, TypeError, ValueError):
        return None


def joined(parts):
    """The line: one space between two parts, PILL_GAP between two code spans."""
    line = parts[0]
    for before, part in zip(parts, parts[1:]):
        line += (PILL_GAP if before.startswith("`") and part.startswith("`") else " ") + part
    return line


def main():
    try:
        payload = json.loads(sys.stdin.read() or "{}")
    except ValueError:
        return
    if not isinstance(payload, dict) or payload.get("agent_id"):
        return
    session = str(payload.get("session_id") or "")
    if not re.fullmatch(r"[\w.-]+", session):
        return
    event = payload.get("hook_event_name") or "UserPromptSubmit"
    root = os.environ.get("CLAUDE_PROJECT_DIR") or payload.get("cwd") or os.getcwd()
    path = os.path.join(temp_dir(), "session-detail-caption", session)
    state = load(path)

    repos = checkouts(root)
    moved = mark(repos)
    if event == "PostToolUse" and state.get("mark") == moved and "waiting" in state:
        return
    names = changed(repos)
    counts = [len(found) for found in names]
    store = archive(root)
    waiting, call = awaiting(repos, names, store, session[:8]) if store else (0, "")
    state["mark"] = moved
    if event == "PostToolUse" and state.get("waiting") == waiting:
        save(path, state)
        return

    transcript = payload.get("transcript_path")
    context, unanswered = None, None
    if isinstance(transcript, str) and os.path.isfile(transcript):
        count_owner(transcript, state)
        context, unanswered = tail_facts(transcript)
    count = state.get("owner") if isinstance(state.get("owner"), int) else 0
    now = float(os.environ.get("SESSION_CAPTION_NOW") or time.time())  # a fixed clock, for the tests
    age = since(state.get("first"), now)
    if submitting(event, payload, unanswered):
        count += 1
        if age is None:
            age = 0

    glyph, url = "💬", ""
    if store:
        url = f"{PAGES}session.html#id={session[:8]}"
    else:
        url = branch_page(repos, counts, str(payload.get("cwd") or root))
        if url:
            glyph = "🌿"
    parts = [f"{glyph}[{count}]({url})" if url else f"{glyph}{count}"]
    kind = started_by(event, payload)
    if kind:
        parts.append(kind)
    if context:
        parts.append(f"`{(context + 500) // 1000}{KILO}`")
    if age is not None:
        parts.append(f"`{elapsed(age)}`")
    if waiting:
        deck = f"{PAGES}session.html#id={session[:8]}" + (f"&user-call={call}" if call else "")
        parts.append(f"[✍️{waiting}]({deck})")
    parts.append(f"[`‹⋯›`]({PROGRAM})")

    state["waiting"] = waiting
    save(path, state)
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": event,
        "additionalContext": joined([f"`{clock(now)}`"] + parts)
                             + "\nClose the reply with that line, unchanged, as its session detail caption.",
    }}))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
    sys.exit(0)
