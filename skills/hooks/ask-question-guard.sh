#!/usr/bin/env bash
# PreToolUse: refuse AskUserQuestion in every session the plugin reaches.
#
# The owner's rule is a question asked in prose, not a menu. A plugin cannot
# ship permissions.deny (its settings.json honors only `agent` and
# `subagentStatusLine`), and project settings are not read when a session's
# root sits above the checkouts, so a hook is the one channel that reaches
# every session.
#
# Not verified: whether PreToolUse fires for AskUserQuestion. The project
# settings deny in home and web-tools stays as a backstop.
#
# Denies nothing else: the tool name is re-checked, and any other payload exits
# 0 silently.
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
