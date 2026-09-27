#!/usr/bin/env bash
# PreToolUse: refuse AskUserQuestion in every session the plugin reaches.
#
# WHY A HOOK. The owner's standing rule is prose over a menu: lay out what was
# found, the options and a recommendation, and let the reader answer freely. It
# was enforced by permissions.deny, written into ~/.claude/settings.json by the
# account's environment setup script and repeated in home's and web-tools'
# project settings. A plugin cannot carry that deny: its settings.json honors
# only `agent` and `subagentStatusLine`. Project settings are not read when a
# multi-repo session's root sits above the checkouts. So the one channel that
# reaches every session is a hook, and moving the ban here is what lets the
# setup script shrink to the plugin install.
#
# UNVERIFIED as of 2026-09-27: whether PreToolUse fires for AskUserQuestion. The
# hooks reference lists matchers by tool name without excluding it. The project
# settings deny stays as a backstop where it is read, and the first session with
# the setup-script deny removed is the test.
#
# Never denies anything it was not aimed at: the payload is re-checked against
# the tool name, and any other shape exits 0 and says nothing.
set -uo pipefail

HOOK_PAYLOAD="$(cat)" python3 <<'PY' 2>/dev/null || exit 0
import json, os, sys

try:
    d = json.loads(os.environ.get("HOOK_PAYLOAD", "") or "{}")
except Exception:
    sys.exit(0)

if d.get("tool_name") != "AskUserQuestion":
    sys.exit(0)

print(json.dumps({"hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": (
        "AskUserQuestion is refused in this estate. Ask in prose instead: say what you "
        "found, the options as you see them, and your recommendation, and name plainly "
        "any decision that is the reader's to make. Do not retry this call."
    ),
}}))
PY
