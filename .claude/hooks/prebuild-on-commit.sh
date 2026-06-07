#!/usr/bin/env bash
# PreToolUse(Bash) hook — keep the pre-build (dist/web-tools.js) in lockstep with
# lib/ without per-edit rebuilds.
#
# Fires before every Bash call, but only acts when the command is a `git commit`
# AND lib/ has pending changes: then it rebuilds dist/web-tools.js and stages it,
# so the refreshed pre-build rides into the same commit. The build is
# deterministic, so a commit that didn't really change lib/ produces identical
# bytes (a no-op `git add`). Non-blocking: a build failure warns but never stops
# the commit.
set -euo pipefail

root="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || true)}"
[ -n "$root" ] || exit 0

# The Bash tool's command arrives as JSON on stdin: { tool_input: { command } }.
cmd="$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write((JSON.parse(s).tool_input||{}).command||"")}catch{process.stdout.write("")}})' 2>/dev/null || true)"

case "$cmd" in
  *"git commit"*) ;;
  *) exit 0 ;;
esac

cd "$root" || exit 0

# Only rebuild when lib/ has staged or unstaged changes.
if ! git status --porcelain -- lib/ | grep -q .; then
  exit 0
fi

if ! npm run build:lib --silent >/dev/null 2>&1; then
  echo "prebuild hook: 'npm run build:lib' failed — committing without refreshing dist/web-tools.js" >&2
  exit 0
fi

git add dist/web-tools.js 2>/dev/null || true
exit 0
