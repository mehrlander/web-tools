#!/bin/bash
# SessionStart hook: say which setup script built this environment, and
# whether that script has changed on web-tools main since.
#
# .claude/environment-setup.sh saves its own text, the commit it came from and
# when it ran to ~/.claude/environment-setup.ran. That file survives into every
# container built from the same environment, so it is the one first-hand record
# of what the settings box ran. The current script is read from the marketplace
# checkout of web-tools main, which every session already has, so there is no
# network call. Silent when the record is absent: an environment built some
# other way has nothing to report.
set -uo pipefail
cat >/dev/null 2>&1

RAN="$HOME/.claude/environment-setup.ran"
CUR="$HOME/.claude/plugins/marketplaces/web-tools/.claude/environment-setup.sh"
[ -f "$RAN" ] || exit 0

ran=$(sed -n 's/^# ran //p' "$RAN" | head -1)
sha=$(sed -n 's/^# commit //p' "$RAN" | head -1)
echo "Environment built ${ran:-at an unknown time} from .claude/environment-setup.sh at ${sha:0:7}."

if [ -f "$CUR" ] && ! diff -q <(sed '1,2d' "$RAN") "$CUR" >/dev/null 2>&1; then
  echo "The setup script on web-tools main has changed since; edit the environment settings to rebuild."
fi
exit 0
