#!/usr/bin/env bash
# Best-effort Claude delegate for the checkout's shared git setup.
#
# `.git/hooks/` is local-only and absent on clone, so this repo's pre-commit
# guard (.githooks/pre-commit, which keeps dist/, the page catalogs, the docs
# registry and the tracker board in lockstep with their sources) needs one line
# per clone to activate.
#
# It is a session-*.sh file, not a .claude/settings.json entry, and that is the
# reason it works: a settings entry is read only when the session's project root
# IS this repo, while the `portable` plugin's session-dispatch.sh discovers this
# by filename from any root. Home carries the identical script for the identical
# reason (mehrlander/home .claude/hooks/session-git-config.sh, 2026-07-31).
#
# Nothing here depends on ordering against the sibling session scripts, which
# the dispatcher runs in parallel.
#
# tools/checkout-setup.mjs owns the actual configuration and verification. This
# wrapper exists only so Claude's dispatcher can perform the cheap git-only half
# automatically. Codex, Gemini, and an ordinary terminal use `npm run setup`.
#
# Never fails the session, but a failed write is no longer reported as success:
# the shared command's concrete error and the explicit recovery command reach
# session output. `npm run ready` remains the read-only answer afterward.
DIR="${CLAUDE_PROJECT_DIR:-.}"
if output=$(node "$DIR/tools/checkout-setup.mjs" --root "$DIR" --git-only --quiet 2>&1); then
  exit 0
fi

[ -n "$output" ] && printf '%s\n' "$output"
printf '%s\n' "session-githooks: checkout configuration failed; run npm run setup, then npm run ready"
exit 0
