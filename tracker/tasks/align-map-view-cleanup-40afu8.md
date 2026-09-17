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

Item 5 is the one item here that cannot start: the words it would unify are
owned by `registry-authored-derived-split-v3qm2x`, and only their rendering is
Map's. Everything else on this list is startable today.

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

**5. Render the settled warning vocabulary consistently. Waits on the words.**
Six tabs report the same governance finding under six names: Docs calls it
orphan reach, Registries unread (`renders_in` empty), Kits a blank gloss or
namespace or a kit nothing loads, Automation a blank role or an invocation of
"none found", Themes and Owners a measured pair with no account, Tests an
unexplained file.

**Choosing those words is not Map's to do,** which is why this item is smaller
than it looks. At least two of the six take their word from committed registry
data rather than from the component: `docs/docs.csv` carries `orphan` on 26 rows
of its `reach` column, and `docs/harness.csv` carries `none found` in
`invocation`. Renaming either edits a registry and its generator. That work is
`registry-authored-derived-split-v3qm2x`, whose Layer 3 already names the five
`map.js` glossaries as its subject, and whose own stage list puts Layer 3 first.

So the words go there and the rendering stays here: once the vocabulary is
settled, make the six tabs draw a warning the same way, so Map reads as one
instrument. Start this item only after that task's Layer 3, or the rename lands
twice.

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
- task `registry-authored-derived-split-v3qm2x`: owns the warning words (its Layer 3, the `map.js` glossaries); item 5 here waits on it, not the other way round
- `docs/docs.csv`, `docs/harness.csv`: carry two of the six warning words as column values, which is why item 5 is not a `map.js` edit

## Done when

- No doc or UI string promises a Map Injection tab.
- Primary Map addresses match current labels (aliases still resolve).
- Portable and Skills cross-link without double-teaching plugin skills.
- Surfacing, Showing, and Context read as one pipeline.
- Every Map tab renders the warning vocabulary the same way, once
  `registry-authored-derived-split-v3qm2x` has settled what the words are. If
  that task has not run, this clause is deferred in a log line rather than
  answered here.
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
- 2026-09-17: Item 5 narrowed to rendering, the words handed to
  `registry-authored-derived-split-v3qm2x`. Two of the six warning words are
  registry column values, not component strings: `docs/docs.csv` has `orphan` on
  26 rows of `reach`, `docs/harness.csv` has `none found` in `invocation`.
  Renaming either is a registry edit, which is that task's Layer 3. This also
  undoes a circular claim: the two tasks had each been recorded as sequencing
  after the other. Size stays L on item 2's strength alone.
