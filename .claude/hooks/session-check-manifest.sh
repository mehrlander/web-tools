#!/bin/bash
# Gated note, one-shot: did the revised setup script's manifest actually land?
#
# docs/environment/container.md claims the account's environment setup script
# writes ~/.claude/env-manifest.txt. The script was revised 2026-09-14 and only a
# snapshot rebuild carries that change, so the claim is untested until a session
# runs on a snapshot built after it. This is that test, handed to whichever
# session happens to be first rather than held in anyone's head.
#
# Three states, and the middle one is why this does not nag. A snapshot older
# than the revision is EXPECTED to lack the file, so it says nothing. A snapshot
# newer than the revision either has it, and the check reports itself finished
# and asks to be deleted, or does not, and something in the manifest block
# failed. Speaking on success is what lets the item clear itself: the next
# session is told to remove this file, which is a one-line commit.
#
# Never fails a session: every path exits 0.
MANIFEST="$HOME/.claude/env-manifest.txt"
SETTINGS="$HOME/.claude/settings.json"
SELF="web-tools/.claude/hooks/session-check-manifest.sh"

if [ -s "$MANIFEST" ]; then
  echo "env-manifest: present, so container.md's claim holds. This one-shot check is finished; delete $SELF and commit."
elif [ -n "$(find "$SETTINGS" -newermt 2026-09-14 2>/dev/null)" ]; then
  echo "env-manifest: MISSING on a snapshot built after the setup script was revised. Its last six lines did not run; read them before trusting container.md's claim."
fi
exit 0
