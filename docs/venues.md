# Venues: where work can run

Each venue is a row of [venues.csv](venues.csv), and who works at each is a row of [writers.csv](writers.csv).

This account has no self-hosted Claude Code Remote pool (`ccpool_`), as of
2026-10-13.

- Dispatch's scheduled tasks need the desktop awake with the app open, as does a
  scheduled check in the Codex app (checked 2026-10-01, web-tools-private
  `probes/codex-commit-trigger/`). Antigravity is assumed to behave the same.
- The laptop daemon polls web-tools-private's `main`: errands and scheduled
  rows wait while the laptop sleeps, and after a reboot the daemon stays down
  until restarted.
- No venue is the default. Run unattended work where its inputs already are:
  work across repos fits the laptop's clones, as constellation-atlas and
  text-occurrences do. A script needs no model, so it fits a `daemon` row or
  GitHub's runners rather than a cloud session.
- Remote Control (on a session started there) and Dispatch reach the laptop
  from the phone.

The tracker's [`venue:` tag](TRACKER.md#two-conventional-open-tags-venue-and-action) names something else and is not keyed to these rows.

Checked 2026-10-13 against this account's environments, the pull requests behind
the `codex/` branches, and press reports of Anthropic's Cowork and Dispatch
announcements.
