---
id: stranded-titles-panel-or-drop-o6hqom
title: Convert the title attributes outside the app to title-tips
status: backlog
opened: 2026-08-19
size: M
priority: low
---
# Convert the title attributes outside the app to title-tips

The house style uses no `title` attribute at all since 2026-10-16
(`skills/html-style/references/mechanics.md`, "Title-tips and panel-tips"; rule
11 of `skills/html-style/SKILL.md`). PR #965 converted the Web Tools app and
every kit it draws, so `npm run stranded-titles -- app` finds none. The rest of
the repo still carries them: on 2026-10-19 `npm run stranded-titles -- --all`
reported 186 title attributes plus 12 set from script, across standalone pages,
kit demos and the components only those pages mount.

The largest carriers:

| File | Titles |
| --- | --- |
| `pages/dictate.html` | 35 |
| `lib/alpineComponents/transform-workbench.js` | 23 |
| `lib/kits/demos/index.html` | 18 |
| `pages/diff-tool.html` | 15 |
| `pages/pdf-inspect.html` | 13 |
| everything else | 82 |

The method is PR #965's: write `data-title-tip` where the `title` was, add
`data-title-tip-bare` on an element that is not a control, and make sure the
page loads `kits/title-tip.js`. A page on the `gh.load` chain gets the kit
through `alpine-bundle.js`; a page that loads the pre-build or neither needs it
named, which is why this goes a page at a time. The scanner also lists an
`<iframe>` title, a `data-title` and an SVG axis title; those are not tooltips
and stay.

## Related

- `python/stranded-titles.py`: `npm run stranded-titles -- --all` lists every title; `--script` lists the ones set from script
- `lib/kits/title-tip.js`: the kit, and its header on title-tips that sit on controls
- `skills/html-style/references/mechanics.md`: the popup rule, "Title-tips and panel-tips"
- PR #965: the app's conversion, the worked precedent
- PR #610, PR #447: the earlier surveys and fixes of stranded titles

## Done when

`npm run stranded-titles -- --all` lists no tooltip `title` under `pages/` or
`lib/`, and the pages that gained title-tips load the kit.

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
- 2026-10-19: PR #965 merged. The owner ruled out `title` everywhere, icon buttons included, so the panel-or-leave question this task was filed to decide is settled: every title becomes a title-tip. The app holds none. Reframed around the rest of the repo, unclaimed, size S to M; the scanner's `--facts` reading was dropped in PR #965.
