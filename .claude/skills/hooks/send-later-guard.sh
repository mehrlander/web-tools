#!/usr/bin/env bash
# PreToolUse: refuse a scheduled self check-in. Events are the only wake.
#
# WHY THIS EXISTS. The harness attaches a drive-to-green posture to a PR a
# session created and tells it to arm a self check-in about an hour out, re-check
# on every firing, and re-arm, never cancelling early. Measured 2026-09-13 over
# 395 session records: send_later was called 268 times across 65 sessions and
# EVERY retained call was a PR or CI check-in, none anything else. One PR drew
# fourteen. The wakes mostly find that main has moved and spend a merge, a suite
# run and a push on a branch nobody was waiting for. The user's standing
# instruction is that a check-in is never wanted; the reader returns and asks.
#
# WHY A HOOK RATHER THAN permissions.deny. A settings entry needs the literal
# tool name, and this tool has more than one: the records carry both
# mcp__Claude_Code_Remote__send_later and
# mcp__bf7c680d-5fdc-5ef4-b4a0-abadb619bf0a__send_later, the same server under
# its connector UUID, 45 of the 268 calls. A list of literals would have left
# those running while looking closed. The matcher in hooks.json is a regex, so
# one entry covers every spelling and any later rename. A plugin also cannot
# ship permissions.deny at all: its settings.json honors only `agent` and
# `subagentStatusLine`, which is why the AskUserQuestion ban lives in the
# account's own setup script instead.
#
# WHAT IS DELIBERATELY STILL OPEN. create_trigger. It does everything this does
# plus recurring schedules, and it is how the account's weekday morning brief
# exists. A reminder the reader actually asked for stays one call away; what is
# refused is the clock-driven return nobody requested.
#
# Never denies anything it was not aimed at: the payload is re-checked against
# the tool name, and any other shape exits 0 and says nothing. The matcher
# should make that unreachable, which is the reason to verify it rather than
# trust it.
set -uo pipefail

HOOK_PAYLOAD="$(cat)" python3 <<'PY' 2>/dev/null || exit 0
import json, os, re, sys

try:
    d = json.loads(os.environ.get("HOOK_PAYLOAD", "") or "{}")
except Exception:
    sys.exit(0)

if not re.fullmatch(r"mcp__.+__send_later", str(d.get("tool_name", ""))):
    sys.exit(0)

print(json.dumps({"hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": (
        "Scheduled self check-ins are refused here. A subscribed PR already wakes this "
        "session on a comment, a review or a check result, so a timed return adds nothing "
        "and its usual finding is that main moved, which is not work until the reader is "
        "back. Do not re-try this call and do not route around it.\n\n"
        "End the turn instead. If the PR is red or conflicted, fix it now rather than "
        "later. If something genuinely needs a clock (a cron errand, a reminder the reader "
        "asked for), create_trigger is open and appropriate; say what it is for."
    ),
}}))
PY
