---
id: stranded-titles-panel-or-drop-o6hqom
title: Decide the remaining stranded title attributes, panel or leave
status: in-progress
session: claude/eager-ride-1lzonz
opened: 2026-08-19
size: S
priority: low
---
# Decide the remaining stranded title attributes, panel or leave

`npm run stranded-titles` reported 89 **stranded** titles across the app when
this was filed, and 120 on 2026-09-04: places
where a `title` attribute is the only route to a fact, so a phone reader never
reaches it at all. PR #447 fixed the worst cases on the branch row and the
sessions row and left the rest, because HTML-STYLE.md's rule turns on judgment
the survey cannot supply: *a tooltip worth having is worth building*, and some
of these tooltips are not worth having in the first place.

They sit in four components, and the concentration is the point. This is a
habit rather than a scattering of accidents:

| Component | Stranded |
| --- | --- |
| `lib/alpineComponents/estate.js` | 24 |
| `lib/alpineComponents/map.js` | 20 |
| `lib/alpineComponents/state-view.js` | 15 |
| `lib/alpineComponents/fab.js` | 13 |
| everything else | 17 |

The method is settled, so this needs no design pass. For each one, decide
between three answers: **build the panel** where the fact is worth reaching
(the row card in `estate.js` is the worked precedent, and a list card costs
nothing when the data is already in hand), **put words on the page** where a
mark is carrying meaning no reader can guess, or **leave it** where the title
is a convenience label for a control whose action is obvious and reachable by
tapping. Most of the 89 are the third answer, which is why this is low
priority rather than a defect list.

Do it a component at a time; they decouple cleanly and nothing here needs to
land together.

## Related

- `python/stranded-titles.py`: `npm run stranded-titles`; re-run before deciding (body table is pre-#610)
- `lib/alpineComponents/map.js`: start here after Map cleanup; largest untouched carrier at filing
- `lib/alpineComponents/estate.js`: worked precedent for building a panel from a stranded title
- `lib/alpineComponents/state-view.js`, `lib/alpineComponents/fab.js`: other concentrated carriers in the filing table
- `skills/html-style/SKILL.md`: house-style rule 11 (numbered 7 when PR #543 carried it in); the popup rule itself is in `references/mechanics.md`, "Title-tips and panel-tips"
- PR #965: moved the clear-cut stranded titles to title-tips and added the `--facts` and `--script` readings to the scanner
- task `align-map-view-cleanup-40afu8`: soft sequence: finish Map alignment before working map.js titles
- PR #610: cut stranded titles ~128 to ~25 (notes+cards); restamp counts before acting
- PR #447: original survey and worst-case fixes on branch/session rows

## Done when

Every stranded title in those four components has been decided rather than
merely counted, and the ones that earned a panel have one.

**Not** when the survey reports zero, and that distinction matters enough to
state. The count cannot see its own best outcome: a mark that gains visible
text still reports stranded while the *reason* stays in its title, which is the
right result for a reader and no movement in the number. Two marks already sit
in that state deliberately (the dimmed twins on a session row, where the visible
dash says "unknown" and the title distinguishes the two causes). Read the list,
not the total.

## Progress log
- 2026-08-19: Filed. Findings and the audit behind them are in web-tools PR #447
  and its survey comment; the reasoning about why three hand passes got this
  wrong is recorded in home `chron/2026/08/2026-08-19-the-hand-audit-was-wrong-three-times.md`.
  Next step is a component at a time, `map.js` first as the largest untouched one.
- 2026-08-28: Command name corrected here; it is `npm run stranded-titles`, and
  `npm run title-survey` never shipped. The count has moved 89 to 110, and the
  three largest components have all grown: estate.js 24 to 29, map.js 20 to 27,
  state-view.js 15 to 16. The rule this task decides against now carries the
  replacement it was missing (web-tools PR #543): HTML-STYLE.md states the four
  behaviours a built panel owes, and daisy-alpine carries it as house-style rule
  7, which is what should stop the total climbing while the backlog is worked.
- 2026-09-04: 120 stranded, up from 110 a week earlier and 89 at filing. That is
  the second consecutive reading where the count rose after the fix meant to hold
  it: house-style rule 7 (PR #543) landed 2026-08-28 and the total gained ten in
  the six days after. The rule is not holding the line on its own, which argues
  for working the list a component at a time rather than waiting on it. The
  four-component table is the 2026-08-19 survey and is not restamped; rerun the
  command for current per-component figures.
- 2026-09-17: PR #610 cut stranded titles from about 128 to about 25 (notes and
  cards). The body counts and the four-component table are pre-#610, so re-run
  `npm run stranded-titles` before deciding anything. Size M to S. Queue after
  `align-map-view-cleanup-40afu8` and start with `map.js`, the largest untouched
  carrier. Added `## Related`.
- 2026-10-15: Claimed on `claude/eager-ride-1lzonz` (PR #965). Thirteen title-only facts on non-controls became title-tips, `cursor-help` is gone from live code, and the scanner reports 24 stranded across lib, app and pages (14 in the app's own files). The larger class is now facts parked in the `title` of a button or link, which the scanner used to call reachable and fine: `npm run stranded-titles -- --facts` lists 59 in the app, and `--script` counts 48 titles set from script. Most of the 59 explain how a control works, so house-style rule 2 (no explanatory prose) argues for trimming them to labels rather than moving them onto the page; that call, and a sentence for mechanics.md saying a title-tip does not go on a control whose tap acts, are with the owner on PR #965.
