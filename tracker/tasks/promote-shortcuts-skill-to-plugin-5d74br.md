---
id: promote-shortcuts-skill-to-plugin-5d74br
title: Decide whether apple-shortcuts-actions belongs in the portable plugin
status: backlog
opened: 2026-08-10
size: S
awaiting: leave it in the library and close, recommended with three supports
---
# Decide whether apple-shortcuts-actions belongs in the portable plugin

The skill sits in `skills/`, the on-demand library, so it loads only when
someone asks. The case for moving it to `.claude/skills/`, where the plugin
ships it and it fires ambiently, is that handing a user a tappable link that
puts wired content on their clipboard is a general delivery mechanism rather
than an Apple Shortcuts curiosity. It is the only route that reaches a phone's
pasteboard from a sandbox.

The case against is that it is narrow: it needs the Actions app, a receiving
shortcut, and an iOS device, and none of the plugin's 15 skills carries a device
dependency.

Promotion also closes the drift this came out of. Plugin-shipped skills track
`main` through the marketplace clone; an account-scope install does not, and
that is what left a superseded version firing unprompted (PR #392,
`skills/README.md`).

## What to weigh
- Whether the delivery mechanism generalizes past Shortcuts, or only reads that
  way because it is the only device channel available.
- Whether an ambient skill that cannot work without a specific device setup is
  worth the trigger surface in every session.
- Whether promoting it means splitting it: a general "deliver to the device"
  primitive in the plugin, the Shortcuts specifics left in the library.

## Recommended: leave it in the library, and close

Three supports, added 2026-09-17, each independent of the others.

**The drift argument does not point at promotion.** What went wrong in PR #392
was an *account-scope* install, a third location that tracks nothing. The library
here is in the repository, so `/load-skill` reads `main` exactly as the
marketplace clone does. Promotion buys no freshness the library does not already
have; deleting any account-scope copy buys all of it.

**Ambient is the wrong default for a skill with a hardware prerequisite.** An
ambient skill earns its trigger surface when the user would not think to ask for
it, which is why `daisy-alpine` is ambient: someone building a page does not know
the house style exists. Nobody wants a Shortcuts link without knowing they want
one. Firing in every session to serve the sessions that have an iOS device, the
Actions app and a receiving shortcut installed is a poor trade, and none of the
plugin's other skills carries a device dependency to set a precedent.

**The split builds a collective with one member.** A general "deliver to the
device" primitive has exactly one device channel today, so its extent would be
decided by its single implementation. `retire-shell-name-the-parts-r152bt` is
this repo's own worked example of that failure: a collective noun is stable only
when something enumerates its extent. Build the primitive when a second channel
exists, which is also what this repo's standing caution about improvements
addressing hypothetical problems asks for.

**Done when** the skill is either moved with its manifest and README updated,
or left in the library with the reasoning recorded here so it is not re-asked.
The reasoning above is that record; closing this needs only your word.

## Related

- `skills/apple-shortcuts-actions/SKILL.md`: the library skill under decision
- `skills/README.md`: on-demand library vs plugin placement; PR #392 drift context
- `.claude-plugin/marketplace.json`: how plugin skills track main
- task `retire-shell-name-the-parts-r152bt`: cited worked example against a one-member collective
- PR #392: account-scope install drift that never argued for promotion

## Progress log
- 2026-09-04: Skill count corrected, 16 to 15, in a refinement pass:
  `.claude/skills/` holds 15 `SKILL.md` files plus a `hooks/` directory that is
  not a skill, against 41 in the on-demand `skills/` library. The decision is
  untouched and still the whole task.
- 2026-09-17: Marked awaiting the promote / leave / split ruling; the task is entirely that decision.
- 2026-09-17: Recommended leave-and-close, with the reasoning written into the
  body so the Done-when clause is satisfied either way this goes. The load-bearing
  correction is that the PR #392 drift was an account-scope install rather than a
  library one, so it never argued for promotion.
- 2026-09-18: Added ## Related (paths / sibling tasks / premise PRs).
