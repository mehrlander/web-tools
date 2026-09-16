#!/usr/bin/env bash
# Best-effort: point git at the committed hooks directory.
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
# The second line registers a MERGE DRIVER, and it is here for the same reason
# as the first: git config is not cloned, so an attribute in .gitattributes
# naming a driver git has never heard of is inert. scripts/derived-csv-merge.mjs
# resolves this repo's registry CSVs by reading docs/properties.csv for which
# columns a deriver owns, instead of conflicting on a number no human wrote.
# What that buys is not the two minutes of resolution: a conflicted pull request
# has no merge ref, so no CI run starts and the head sits at zero checks with
# nothing saying why (docs/SNAGS.md, ci-run-silently-not-started, six sightings).
# Without this line the attributes do nothing and a conflict behaves as before.
#
# Never fails the session: all errors are swallowed, always exits 0.
DIR="${CLAUDE_PROJECT_DIR:-.}"
git -C "$DIR" config core.hooksPath .githooks >/dev/null 2>&1 || true
git -C "$DIR" config merge.derived-csv.name \
  "registry CSVs: union the rows, let the deriver own its own columns" >/dev/null 2>&1 || true
git -C "$DIR" config merge.derived-csv.driver \
  "node scripts/derived-csv-merge.mjs %O %A %B %P" >/dev/null 2>&1 || true
exit 0
