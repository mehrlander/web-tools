#!/usr/bin/env python3
"""UserPromptSubmit, and PostToolUse on Bash: print the session detail caption,
the line a reply closes with (docs/CONVERSATION.md, "Session detail caption"),
so that no session works it out by hand.

    💬[22](https://mehrlander.github.io/web-tools/pages/session.html#id=f701fa79) · 1d 2h · 816k · 1 file

THE PARTS. 22 counts the messages the owner has typed, and is the link to the
session page, named by the session id's first eight characters. 1d 2h is the
time since the first of those messages: 45m under an hour, 7h under a day,
1d 2h after. 816k is the context in thousands of tokens, read the way
context-size-hint.py reads it: input_tokens + cache_read_input_tokens +
cache_creation_input_tokens of the last main-conversation response in the
transcript's tail. 1 file is `git diff origin/main...HEAD --name-only | wc -l`
summed over the session's checkouts, which are the checkout the project root
is in and each folder directly under the root that holds a .git. A zero file
count is left off, and so is a part the transcript cannot supply: the time
before any owner message, the context before any response.

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

THE LINK. The session page exists only where the session archive is checked
out, found as session-record.sh finds it: a checkout among the project root,
its children and its siblings whose .web-tools.json declares "sessions" and
whose store holds tools/on-stop.sh, or SESSIONS_STORE. Without one the count
links the 🌿 branch page of the current checkout instead: the one the working
directory is in or, with that directory above the checkouts, the one with the
most files changed. With no checkout to link either, the count stands alone.

WHEN IT SPEAKS. On UserPromptSubmit, always. On PostToolUse only when the file
count differs from the one it last printed, so that a reply made after a commit
carries a fresh count. That second event follows every Bash call, so it first
compares what a commit, a checkout or a fetch moves in each checkout (HEAD, its
log, the branch's ref, origin/main, packed-refs) by stat, and stops there when
nothing moved: no git process and no transcript read. UserPromptSubmit always
asks git, so a move the mark missed is corrected at the next prompt. A
subagent's Bash call is passed over, since the caption belongs to the main
conversation's reply. Between two lines the last one stands: a message the
owner sends mid-turn, and the time and context a turn adds, show in the next.

THE STATE is one small JSON file per session id under the temp directory, as
context-size-hint.py keeps its marks: the file count last printed, the stat
mark, and the owner-message count with the bytes it covers.

Silent and exit 0 on anything else: an unparseable payload, no session id, or
any failure along the way. It never blocks a prompt.
"""
import json
import os
import re
import sys
import time

PAGES = "https://mehrlander.github.io/web-tools/pages/"
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
    """The files changed against main in each checkout, the git commands run
    side by side. A checkout with no origin/main counts none."""
    import subprocess
    runs = []
    for repo in repos:
        try:
            runs.append(subprocess.Popen(
                ["git", "-C", repo, "diff", "origin/main...HEAD", "--name-only"],
                stdout=subprocess.PIPE, stderr=subprocess.DEVNULL))
        except OSError:
            runs.append(None)
    counts = []
    for run in runs:
        count = 0
        if run is not None:
            try:
                out, _ = run.communicate(timeout=4)
                if run.returncode == 0:
                    count = len(out.splitlines())
            except subprocess.TimeoutExpired:
                run.kill()
        counts.append(count)
    return counts


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


# ── The line ────────────────────────────────────────────────────────────────

def archive(root):
    """Whether the session archive is checked out, by session-record.sh's test."""
    explicit = os.environ.get("SESSIONS_STORE")
    if explicit:
        return os.path.isfile(os.path.join(explicit, "tools", "on-stop.sh"))
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
            return True
    return False


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


def elapsed(seconds):
    minutes = max(0, int(seconds)) // 60
    if minutes < 60:
        return f"{minutes}m"
    hours = minutes // 60
    if hours < 24:
        return f"{hours}h"
    return f"{hours // 24}d {hours % 24}h"


def since(first, now):
    """Seconds from an entry's ISO timestamp to now, or None."""
    from datetime import datetime
    try:
        return now - datetime.fromisoformat(first.replace("Z", "+00:00")).timestamp()
    except (AttributeError, TypeError, ValueError):
        return None


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
    if event == "PostToolUse" and state.get("mark") == moved and "files" in state:
        return
    counts = changed(repos)
    files = sum(counts)
    state["mark"] = moved
    if event == "PostToolUse" and state.get("files") == files:
        save(path, state)
        return

    transcript = payload.get("transcript_path")
    context, unanswered = None, None
    if isinstance(transcript, str) and os.path.isfile(transcript):
        count_owner(transcript, state)
        context, unanswered = tail_facts(transcript)
    count = state.get("owner") if isinstance(state.get("owner"), int) else 0
    now = time.time()
    age = since(state.get("first"), now)
    if submitting(event, payload, unanswered):
        count += 1
        if age is None:
            age = 0

    glyph, url = "💬", ""
    if archive(root):
        url = f"{PAGES}session.html#id={session[:8]}"
    else:
        url = branch_page(repos, counts, str(payload.get("cwd") or root))
        if url:
            glyph = "🌿"
    parts = [f"{glyph}[{count}]({url})" if url else f"{glyph}{count}"]
    if age is not None:
        parts.append(elapsed(age))
    if context:
        parts.append(f"{(context + 500) // 1000}k")
    if files:
        parts.append("1 file" if files == 1 else f"{files} files")

    state["files"] = files
    save(path, state)
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": event,
        "additionalContext": " · ".join(parts)
                             + "\nClose the reply with that line, unchanged, as its session detail caption.",
    }}))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
    sys.exit(0)
