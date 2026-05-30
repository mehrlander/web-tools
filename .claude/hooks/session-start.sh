#!/bin/bash
# Claude Code on the web: install the repo's devDependencies at session start
# so the preview harness and the jsdom+Alpine logic tests work out of the box,
# without an ad-hoc `npm i` each task. Plain-language rationale: docs/STARTUP.md
set -euo pipefail

# Only run in remote (web) sessions; local machines manage their own deps.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Idempotent: if the devDeps are already on disk (cached env), do nothing.
if [ -d node_modules/jsdom ] && [ -d node_modules/alpinejs ]; then
  echo "session-start: devDependencies already present; skipping npm install"
  exit 0
fi

echo "session-start: installing devDependencies (jsdom, alpinejs, fake-indexeddb, idb-keyval)"
npm install
