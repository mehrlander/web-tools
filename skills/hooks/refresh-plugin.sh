#!/usr/bin/env bash
# SessionStart: move the portable plugin to the tip of web-tools main.
#
# WHY EVERY SESSION. The cloud environment runs its setup script once, when the
# snapshot is built, and every later container restores that snapshot. The
# plugin pin is therefore the one current on build day until something moves
# it, and this is the something. It replaces refresh-portable.sh, which the
# setup script wrote into ~/.claude/hooks/ where no session could read or edit
# it (docs/environment/container.md).
#
# WHAT IT CANNOT DO. It runs from the plugin, so a snapshot whose pin fails to
# load never runs it. Recovery is then manual: fix main, and change any byte of
# the setup script so the snapshot rebuilds. That trade was taken on 2026-09-27
# for a setup script that is two readable lines.
#
# WHEN IT LANDS. Skills from the new pin appear within the session (measured
# 2026-07-30 and again 2026-09-25); hooks run from the old pin until the next
# session or /reload-plugins. The one line printed names a moved pin, so a lag
# is legible rather than silent.
#
# Also uninstalls the plugins the marketplace retired on 2026-09-27
# (daisy-alpine, google-style-clarity), so a snapshot built before then stops
# carrying a second copy of daisy-alpine.
#
# Its own hook entry: the harness caps output per entry (see invoke-default.sh).
# Never fails into the session: every path exits 0.
set -uo pipefail
cat >/dev/null 2>&1
command -v claude >/dev/null 2>&1 || exit 0

LOG=/tmp/refresh-plugin.log
PIN="$HOME/.claude/plugins/installed_plugins.json"
pin() { python3 - "$PIN" "$1" <<'PY' 2>/dev/null
import json, sys
try:
    e = json.load(open(sys.argv[1]))["plugins"][sys.argv[2]]
except Exception:
    sys.exit()
print(next((x.get("version", "") for x in e if x.get("scope") == "user"), ""))
PY
}

: > "$LOG"
claude plugin marketplace update web-tools >> "$LOG" 2>&1

before=$(pin portable@web-tools)
if ! claude plugin update --scope user portable@web-tools >> "$LOG" 2>&1; then
  echo "portable@web-tools refresh FAILED (pin still ${before:-none}); see $LOG"
else
  after=$(pin portable@web-tools)
  [ "$before" != "$after" ] && echo "portable@web-tools refreshed ${before:-none} to ${after:-unknown}; its hooks ran from the old pin, so /reload-plugins if you were waiting on a hook change"
fi

for p in daisy-alpine google-style-clarity; do
  [ -n "$(pin "$p@web-tools")" ] || continue
  claude plugin uninstall --scope user "$p@web-tools" >> "$LOG" 2>&1 \
    && echo "$p@web-tools uninstalled; it now ships inside portable or was retired"
done
exit 0
