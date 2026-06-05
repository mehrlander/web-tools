#!/bin/bash
# Claude Code on the web: install the repo's devDependencies at session start
# so the preview harness, headless screenshot/build tools, and the jsdom+Alpine
# logic tests work out of the box, without an ad-hoc `npm i` each task.
# Plain-language rationale: docs/environment/extending.md ("SessionStart install").
set -euo pipefail

# Only run in remote (web) sessions; local machines manage their own deps.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Idempotent: skip only if EVERY declared devDependency is already on disk.
# A narrow check (e.g. jsdom + alpinejs) drifts the moment a new devDep is added
# — playwright, daisyui, tailwind and the alpine plugins all post-date the first
# version of this guard — so a cached env with a partial node_modules slips past
# it and leaves `npm run shot` / verify-build broken behind a passing check.
# Deriving the set from package.json keeps the guard honest as devDeps grow.
missing=$(node -e '
  const fs = require("fs"), p = require("path");
  const dd = JSON.parse(fs.readFileSync("package.json", "utf8")).devDependencies || {};
  process.stdout.write(Object.keys(dd).filter(d => !fs.existsSync(p.join("node_modules", d))).join(" "));
')

if [ -z "$missing" ]; then
  echo "session-start: devDependencies already present; skipping npm install"
  exit 0
fi

echo "session-start: installing devDependencies (missing: $missing)"
npm install
