#!/usr/bin/env bash
# SessionStart: move the portable plugin to the tip of web-tools main, and
# install or move the h plugin the same way.
#
# A cloud session restores a snapshot taken when the environment was built, so
# the plugin pin is build day's until something moves it. This moves it. Skills
# from the new pin appear within the session; hooks follow next session or after
# /reload-plugins. Each printed line names a moved or newly installed pin.
#
# It cannot recover a pin that fails to load, since it runs from the plugin: fix
# main, then change any byte of the setup script to force a rebuild
# (docs/environment/container.md).
#
# Also uninstalls the retired daisy-alpine and google-style-clarity plugins
# where an older snapshot still has them.
#
# Its own hook entry, because the harness caps output per entry. Always exits 0.
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

# The h plugin (the house policies as slash commands) installs here when absent,
# so a session gets it without an environment rebuild, and updates like portable.
hpin=$(pin h@web-tools)
if [ -z "$hpin" ]; then
  claude plugin install --scope user h@web-tools >> "$LOG" 2>&1 \
    && echo "h@web-tools installed at $(pin h@web-tools); /reload-plugins if its /h: commands are not listed yet" \
    || echo "h@web-tools install FAILED; see $LOG"
elif claude plugin update --scope user h@web-tools >> "$LOG" 2>&1; then
  [ "$hpin" != "$(pin h@web-tools)" ] && echo "h@web-tools refreshed $hpin to $(pin h@web-tools)"
else
  echo "h@web-tools refresh FAILED (pin still $hpin); see $LOG"
fi

for p in daisy-alpine google-style-clarity; do
  [ -n "$(pin "$p@web-tools")" ] || continue
  claude plugin uninstall --scope user "$p@web-tools" >> "$LOG" 2>&1 \
    && echo "$p@web-tools uninstalled; it now ships inside portable or was retired"
done
exit 0
