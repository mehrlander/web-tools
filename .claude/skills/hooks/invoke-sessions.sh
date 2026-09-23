#!/bin/bash
# SessionStart hook: when a session should be recorded and its store is NOT
# checked out, tell the session to invoke the skill that fetches the store.
#
# THE GAP THIS CLOSES. The Stop hook (session-record.sh) finds the store by a
# checkout's declaration, and a spawned session starts with exactly the repos
# its task named. Measured 2026-09-21: a session that began in an empty working
# directory and attached one repo ran for hours with the recorder installed,
# firing, and finding nothing, because nothing had put web-tools-private beside
# the project root. Nothing reported the gap, which is the recorder's designed
# behavior when no store is present. That silence is correct for a session that
# was never meant to be recorded and wrong for one that was; the difference is
# whether anything DECLARED that it should be, and that is what this reads.
#
# WHO NAMES THE STORE. Not this file. session-record.sh holds no repo name, and
# neither does this: a checkout's .web-tools.json declares `sessionsStore` as
# an owner/repo string, or the environment sets SESSIONS_STORE_REPO. The plugin
# still carries no knowledge of where anyone keeps their records; the consumer
# says, the way it already says `conventions: optout` and `sessions: <dir>`.
# The env var exists for the one shape a manifest cannot cover: a session that
# starts with no checkout at all, which is how a task-spawned session begins.
#
# WHY A DIRECTIVE. A hook cannot do the fetch itself. An unattached private
# repo is unreachable from a shell in the sandbox (measured 2026-09-21:
# `git ls-remote` on one fails at the credential prompt), and attaching is a
# tool only the model holds. So the reliable form is the one invoke-default.sh
# already uses: one instruction into context at the moment it applies, and a
# skill that carries the steps.
#
# WHY ITS OWN HOOK ENTRY. The harness output cap applies per hook entry, not
# across the event (see invoke-default.sh). Folded into the dispatcher this
# would be the first thing truncated on a heavy session.
#
# Never fails into the session: every path exits 0 and prints nothing it is not
# sure of. Cost is a handful of small file reads, no network, no tree walk.
set -uo pipefail

# Drain stdin unconditionally: SessionStart delivers a JSON payload, and leaving
# it unread risks EPIPE upstream on the runs where we print nothing.
cat >/dev/null 2>&1

ROOT="${CLAUDE_PROJECT_DIR:-$PWD}" python3 <<'PY' 2>/dev/null || exit 0
import json, os, sys

root = os.environ.get("ROOT") or "."
env_repo = (os.environ.get("SESSIONS_STORE_REPO") or "").strip()

# The project root, its children, and its siblings: the same bounded search
# session-record.sh uses, so this and the Stop hook agree about what "checked
# out" means. A root that does not exist is the empty-start shape, and the env
# var is the only thing that can speak for it.
cands, seen = [], set()
def add(p):
    try:
        rp = os.path.realpath(p)
    except OSError:
        return
    if os.path.isdir(rp) and rp not in seen:
        seen.add(rp)
        cands.append(rp)
if os.path.isdir(root):
    add(root)
    for base in (root, os.path.dirname(root)):
        if not base or base in ("/", ".") or not os.path.isdir(base):
            continue
        try:
            for name in sorted(os.listdir(base)):
                add(os.path.join(base, name))
        except OSError:
            pass

def manifest(repo):
    try:
        with open(os.path.join(repo, ".web-tools.json"), encoding="utf-8") as fh:
            m = json.load(fh)
        return m if isinstance(m, dict) else {}
    except (OSError, ValueError):
        return {}

pointer = env_repo
for repo in cands:
    m = manifest(repo)
    # A store that is checked out and runnable silences this outright: the Stop
    # hook will find it, and there is nothing to fetch. Same test it applies.
    declared = m.get("sessions")
    if isinstance(declared, str) and declared and \
       os.path.isfile(os.path.join(repo, declared, "tools", "on-stop.sh")):
        sys.exit(0)
    named = m.get("sessionsStore")
    if not pointer and isinstance(named, str) and "/" in named:
        pointer = named.strip()

if not pointer:
    sys.exit(0)

# One sentence: the instruction, what invoking it gets, and the one fact the
# action needs. The repo name is included, unlike invoke-default's directive,
# because here it is not a term the reader lacks context for; it is the
# argument to the clone.
print(f"Invoke /portable:sessions now so this session is recorded; it attaches "
      f"and clones {pointer} beside the project root.")
PY
exit 0
