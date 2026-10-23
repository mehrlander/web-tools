#!/usr/bin/env python3
"""Publish bounded Claude cloud turn signals to the declared private record store.

Staging is synchronous and network-free. A detached publisher uses Git objects,
never the store's checkout or index. Timestamps make delayed publishers harmless.
The existing Stop recorder remains the owner of complete transcripts.
"""
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time

UTC = dt.timezone.utc
LIMITS = {"prompt": 2000, "response": 4000, "title": 180}
EVENTS = {"UserPromptSubmit", "PreToolUse", "Stop", "StopFailure", "SessionEnd"}


def text(value, limit):
    return value[:limit] if isinstance(value, str) else ""


def find_store(env):
    explicit = env.get("SESSIONS_STORE")
    if explicit:
        store = Path(explicit)
        return store if (store / "tools/on-stop.sh").is_file() else None
    root = Path(env.get("CLAUDE_PROJECT_DIR") or os.getcwd())
    candidates = [root]
    for parent in (root, root.parent):
        if parent == parent.parent:
            continue
        try:
            candidates.extend(p for p in parent.iterdir() if p.is_dir())
        except OSError:
            pass
    for repo in candidates:
        try:
            declared = json.loads((repo / ".web-tools.json").read_text(encoding="utf-8")).get("sessions")
            if isinstance(declared, str) and declared:
                store = repo / declared
                if (store / "tools/on-stop.sh").is_file():
                    return store
        except (OSError, ValueError, AttributeError):
            pass
    return None


def git(repo, *args, data=None, env=None):
    return subprocess.run(["git", "-C", str(repo), *args], input=data, stdout=subprocess.PIPE,
                          stderr=subprocess.PIPE, check=True, timeout=20, env=env).stdout


def atomic(path, value):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as stream:
        name = stream.name
        stream.write(json.dumps(value, ensure_ascii=False).encode("utf-8"))
    os.replace(name, path)


def latest_prompt(payload):
    """A store can be attached after the first prompt. Recover text only, bounded."""
    transcript = payload.get("transcript_path")
    if not isinstance(transcript, str) or Path(transcript).name != payload.get("session_id", "") + ".jsonl":
        return ""
    prompt = ""
    try:
        with open(transcript, "rb") as stream:
            stream.seek(0, os.SEEK_END)
            stream.seek(max(0, stream.tell() - 65536))
            tail = stream.read(65536).decode("utf-8", errors="replace")
        for line in tail.splitlines():
            try:
                row = json.loads(line)
                message = row.get("message", {})
                if row.get("type") != "user" or row.get("isMeta") or message.get("role") != "user":
                    continue
                content = message.get("content")
                if isinstance(content, str):
                    prompt = content
                elif isinstance(content, list):
                    parts = [part.get("text", "") for part in content if isinstance(part, dict) and part.get("type") == "text"]
                    if parts:
                        prompt = "\n".join(part for part in parts if isinstance(part, str))
            except (ValueError, AttributeError):
                continue
    except OSError:
        pass
    return text(prompt, LIMITS["prompt"])


def capture(payload, env, now=None):
    """Return a staged signal, or nothing for unconfigured/local/subagent hooks."""
    event = payload.get("hook_event_name")
    # The cloud harness uses cse_<id>; Claude's browser URL uses session_<id>.
    remote = re.fullmatch(r"cse_([A-Za-z0-9]{20,32})", env.get("CLAUDE_CODE_REMOTE_SESSION_ID", "").strip())
    session = payload.get("session_id", "")
    if event not in EVENTS or not remote:
        return None
    remote_id = "session_" + remote.group(1)
    if not isinstance(session, str) or not re.fullmatch(r"[a-fA-F0-9]{8}(?:-[a-fA-F0-9-]+)?", session):
        return None
    if payload.get("agent_id"):
        return None
    store = find_store(env)
    if store is None:
        return None
    repo = Path(git(store, "rev-parse", "--show-toplevel").decode().strip())
    # A linked worktree and its primary checkout share one staging namespace.
    common = git(repo, "rev-parse", "--path-format=absolute", "--git-common-dir")
    namespace = hashlib.sha256(common.strip()).hexdigest()[:16]
    stage = Path(env.get("SESSIONS_ACTIVITY_STAGE") or tempfile.gettempdir()) / "web-tools-turns" / namespace
    short = session[:8].lower()
    path = stage / (short + ".json")
    now = now or dt.datetime.now(UTC)
    prior = {}
    try:
        prior = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        pass
    if event == "PreToolUse":
        last = dt.datetime.fromisoformat(prior["updatedAt"]) if prior.get("updatedAt") else None
        if last and prior.get("agent") == "https://claude.ai/code/" + remote_id and prior.get("state") == "working" and (now - last).total_seconds() < 30:
            return None
    at = now.isoformat(timespec="microseconds")
    signal = dict(prior) if prior.get("agent") == "https://claude.ai/code/" + remote_id else {}
    signal.update(schemaVersion=1, id=short, provider="Claude", location="Cloud",
                  agent="https://claude.ai/code/" + remote_id, updatedAt=at)
    if event == "UserPromptSubmit" or not signal.get("startedAt"):
        prompt = text(payload.get("prompt"), LIMITS["prompt"]) if event == "UserPromptSubmit" else latest_prompt(payload)
        signal.update(startedAt=at, prompt=prompt, response="", lastTool="")
    title = text(payload.get("session_title"), LIMITS["title"])
    if title:
        signal["title"] = title
    if event in ("UserPromptSubmit", "PreToolUse"):
        signal.update(state="working", response="")
        if event == "PreToolUse":
            tool = payload.get("tool_name", "")
            signal["lastTool"] = tool if isinstance(tool, str) and re.fullmatch(r"[A-Za-z0-9_]{1,80}", tool) else ""
    else:
        signal["state"] = {"Stop": "idle", "StopFailure": "interrupted", "SessionEnd": "ended"}[event]
        signal["response"] = text(payload.get("last_assistant_message"), LIMITS["response"]) if event == "Stop" else signal.get("response", "")
        signal["lastTool"] = ""
    atomic(path, signal)
    return repo, path


def publish(repo, staged):
    """Retry a conditional, single-path update. Never overwrite a newer signal."""
    row = json.loads(Path(staged).read_text(encoding="utf-8"))
    at = dt.datetime.fromisoformat(row["updatedAt"])
    if dt.datetime.now(UTC) - at > dt.timedelta(days=1):
        return
    if not re.fullmatch(r"[a-f0-9]{8}", row["id"]):
        return
    target = "sessions/activity/" + at.strftime("%Y-%m-%d") + "/" + row["id"] + ".json"
    encoded = json.dumps(row, ensure_ascii=False).encode("utf-8")
    for attempt in range(3):
        try:
            # FETCH_HEAD is not used by the worker. Pin the returned commit for every read.
            base = git(repo, "ls-remote", "origin", "refs/heads/background").decode().split()[0]
            git(repo, "fetch", "--quiet", "--no-tags", "origin", base)
            try:
                old = json.loads(git(repo, "show", base + ":" + target))
                if dt.datetime.fromisoformat(old["updatedAt"]) >= at:
                    return
            except (subprocess.CalledProcessError, ValueError, KeyError):
                pass
            with tempfile.TemporaryDirectory(prefix="web-tools-turn-index-") as scratch:
                index_env = dict(os.environ, GIT_INDEX_FILE=str(Path(scratch) / "index"))
                git(repo, "read-tree", base, env=index_env)
                blob = git(repo, "hash-object", "-w", "--stdin", data=encoded).decode().strip()
                git(repo, "update-index", "--add", "--cacheinfo", "100644," + blob + "," + target, env=index_env)
                tree = git(repo, "write-tree", env=index_env).decode().strip()
                message = "Update Claude turn activity\n\nClaude-Session: " + row["agent"] + "\n"
                commit = git(repo, "commit-tree", tree, "-p", base, data=message.encode()).decode().strip()
                git(repo, "push", "--quiet", "origin", commit + ":refs/heads/background")
                return
        except (OSError, ValueError, IndexError, subprocess.SubprocessError):
            if attempt == 2:
                raise
            time.sleep(attempt + 1)


def launch(repo, staged):
    options = {"stdin": subprocess.DEVNULL, "stdout": subprocess.DEVNULL, "stderr": subprocess.DEVNULL}
    if os.name == "nt":
        options["creationflags"] = subprocess.CREATE_NO_WINDOW | subprocess.DETACHED_PROCESS
    else:
        options["start_new_session"] = True
    subprocess.Popen([sys.executable, str(Path(__file__).resolve()), "--publish", str(repo), str(staged)], **options)


def main():
    try:
        if len(sys.argv) == 4 and sys.argv[1] == "--publish":
            publish(Path(sys.argv[2]), Path(sys.argv[3]))
        else:
            payload = json.load(sys.stdin)
            if isinstance(payload, dict):
                staged = capture(payload, os.environ)
                if staged:
                    launch(*staged)
    except Exception:
        # Telemetry must never block a prompt or inject context into the conversation.
        pass


if __name__ == "__main__":
    main()
