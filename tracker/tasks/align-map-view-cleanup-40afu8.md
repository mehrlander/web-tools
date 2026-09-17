---
id: align-map-view-cleanup-40afu8
title: Align the Map view's names, addresses, and warning vocabulary
status: backlog
opened: 2026-09-17
size: L
project: map
---
# Align the Map view's names, addresses, and warning vocabulary

A 2026-09-17 reading of Map (`lib/alpineComponents/map.js`) against the docs
and registries found the tab strip itself is sound. What drifts is the language
around it: old addresses, unfinished renames, and the same "unread / unowned /
blank" finding named six different ways.

The outcome: a reader of Map, or of a doc pointing at Map, meets one vocabulary
and lands where the label says.

**Three phases, and the first is startable alone.** Scope items 1 and 2 are the
addressing half, 3 to 5 are the vocabulary half, and 6 is the leftovers. Item 1
is the smallest and the most certain: `docs/environment/capabilities.md:63`
still names a "Map view's Injection tab" that does not exist, which is a
checkable defect rather than a design question. Start there. If the vocabulary
half stalls on a decision, carve items 1 and 2 off as their own task and leave
the rest here, rather than letting a settled rename wait on an unsettled one.

## Scope

**1. Finish Injection → Context.**
`docs/environment/capabilities.md` still says the Map "Injection tab" renders
`startup_delivery` (schema 7). Map has no Injection tab; Harness → Context is
the successor, and `pages/delivery.html` / `docs/delivery.json` are historical.
Either retarget every remaining "Injection tab" pointer at Context, or give
Context an explicit Delivery lens so the measured full-vs-injected view has one
home. Do not leave a third name.

**2. Promote current labels into the primary addresses (keep aliases).**
These still speak two languages:

| Label | URL key today |
| --- | --- |
| Portable | `set` |
| Themes | `claims` |
| Purpose | `aims` |
| Docs click → Purpose | `?tab=docs` still means Inventory |
| Automation | reuses parent key `harness` |

Aliases for saved links are fine. Make the current name the primary key, with
redirects, or surface the alias in the UI so teaching Map does not require a
glossary.

**3. Clarify Portable ↔ Skills.**
Skills already shows three arrival sets and pulls plugin rows from
`portable.csv`. Portable still lists the whole to-go bag, including those
skills. Keep the two questions (files that travel vs how a skill reaches a
session), but make the handoff obvious: Portable owns non-skill travelers plus
a door into Skills; Skills stays the answer to "is there a skill for X?"

**4. Label the Surfacing → Showing → Context pipeline.**
Map's own comments treat these as a sequence (what to hand over, what makes it
openable, how material enters a session). They can stay three tabs; they should
read as one family (cross-links or a shared framing line), not three unrelated
siblings.

**5. One warning grammar for the unread/unowned/blank finding.**
Today:

- Docs: orphan reach
- Registries: unread (`renders_in` empty), including Snags and Sources
- Kits: blank gloss / namespace / nothing loads
- Automation: blank role / invoke "none found"
- Themes/Owners: measured pair with no account
- Tests: unexplained files

Same governance shape. Share vocabulary and strip behavior so Map feels like
one instrument.

**6. Small leftovers (fold in, do not spawn siblings).**

- Automation still has no gloss while Tests and Context do.
- Views lives in Map, but `app-routes` does not list `map.js` in `renders_in`.
- Header comments still cite `docs/PORTABLE.md`; the tree has `portable.csv` and
  no `PORTABLE.md` (Surfacing and Showing each have a prose parent).
- Docs Inventory and Harness Automation share a folder-rail pattern; keep them
  from drifting (extract or document the twin).
- Growth (corpus chart) and Inventory (per-row trend) are dual grain on purpose;
  bridge them in UI copy so they do not read as duplication.
- Growth and Context are iframe islands while the rest of Map is native; either
  name that as intentional, or pull the Map-needed parts (especially startup
  delivery) into native panes.

## Out of scope

Pages / Tools / tracker boards that render elsewhere by design. Themes'
measured graph beside Owners' curated registry (that contrast is the point).
Kits vs Automation. Building a Snags or Sources *tab* unless the warning pass
shows the Registries surface is not enough; prefer rendering unread registries
well before minting new tabs.

## Related

- `lib/alpineComponents/map.js`: Map implementation; names, URL keys, warning copy, tab strip
- `docs/environment/capabilities.md`: still names a Map Injection tab (Context is the successor)
- `pages/delivery.html`, `docs/delivery.json`: historical delivery surface behind the Injection to Context rename
- `docs/SURFACING.md`: prose parent for the Surfacing tab family (PORTABLE.md is gone; portable travelers live in data)
- task `stranded-titles-panel-or-drop-o6hqom`: queue after this; `map.js` is the largest remaining stranded-title carrier
- task `registry-authored-derived-split-v3qm2x`: Layer 3 (vocabularies out of map.js) sequences after Map cleanup

## Done when

- No doc or UI string promises a Map Injection tab.
- Primary Map addresses match current labels (aliases still resolve).
- Portable and Skills cross-link without double-teaching plugin skills.
- Surfacing, Showing, and Context read as one pipeline.
- The unread/unowned/blank finding uses one shared warning vocabulary across
  the Map tabs that carry it.
- The small leftovers above are fixed or explicitly deferred in a Progress log
  line with a reason.

## Progress log
- 2026-09-17: Filed from a Map gap-and-alignment reading. Highest-payoff first
  cut called out as closing Injection→Context in docs and UI, then normalizing
  URL keys to current labels.
- 2026-09-17: Added `## Related`.
- 2026-09-17: Resized M to L on a read of the scope against `TRACKER.md`'s
  calibration: item 2 (primary URL keys plus alias redirects across five tabs)
  and item 5 (one warning grammar over six tabs drawing on different registries)
  are each a full session on their own. Phased the body and named the carve
  point. Three claims spot-checked and all three hold:
  `docs/environment/capabilities.md:63` names the Injection tab,
  `lib/alpineComponents/map.js:3265` carries `key: 'set', context: 'Portable'`,
  and `map.js:9` cites a `docs/PORTABLE.md` that does not exist.
