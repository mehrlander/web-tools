#!/bin/bash
# Claude Code on the web: delegate dependency setup to the same checkout entry
# point used by Codex, Gemini, and a terminal. The remote gate keeps automatic
# installation out of local sessions; `npm run setup` has no Claude-variable
# requirement and is the explicit path everywhere.
set -euo pipefail

# Only run in remote (web) sessions; local machines manage their own deps.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

DIR="${CLAUDE_PROJECT_DIR:-.}"
if output=$(node "$DIR/tools/checkout-setup.mjs" --root "$DIR" --dependencies-only --quiet 2>&1); then
  exit 0
fi

[ -n "$output" ] && printf '%s\n' "$output"
printf '%s\n' "session-start: dependency setup failed; run npm run setup, then npm run ready"
exit 0
