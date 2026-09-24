---
id: views-forms-and-key-primitive-k5ngay
title: Split show-repo.md by view and form, and make the registries one model
status: in-progress
session: claude/show-docs-restructure-fc9r96
opened: 2026-09-22
project: show-repo
size: L
depends-on: typed-subject-registry-xys5g4
---
# Split show-repo.md by view and form, and make the registries one model

Everything the viewer shows is an object: a thing with a type, properties
and verbs. A type has a page that draws it: a renderer draws a file by
kind, a form draws a branch or a session by type, a view is a screen of the
app. `docs/subjects.csv` (titled Object types) is the list of types, the
announcement record is an object's properties, a page's `actions`,
`toggles` and `menu` are its verbs, and the FAB is the object's inspector.
Subject is the role a link addresses; record is a row in a registry; a
cache is an observation with an age; a store is another repo's corpus with
its own index. No other words are needed, and brief is retired.

Four parts, which land together or in order.

## 1. Documentation split

`docs/show-repo.md` is 31,855 words and its headings no longer match its
contents: `### Lists` holds 7,381 words, of which about 1,200 are the two
personal piles and the rest is the Branches view with no heading of its
own. Move each estate view's section to `docs/views/<key>.md`, named by the
app-routes key, and the branch and session pages' material to
`docs/forms/`; show-repo.md keeps the shell's own material (preamble,
honesty caveat, browsing, shell mode, ref switch, public browse, boundary,
using it from a session; about 6,300 words). Sections and destinations:

| show-repo.md section | Words | Destination |
| --- | --- | --- |
| The estate (the Repos index) | 3,042 | `views/estate.md` |
| Routes | 1,326 | `views/routes.md`, folding toward `views/map.md` |
| Lists, first part | about 1,200 | `views/todo.md` |
| Lists, the rest (Branches) | about 6,200 | `views/branches.md` |
| Sessions, Sessions cache | 5,014 | `views/sessions.md`; the cache section may sit with State |
| Files | 1,551 | `views/search.md` |
| State | 4,668 | `views/state.md` |
| Stage, takeover placement, transfer | 1,575 | `stage.md`, which exists |
| Branch review | 253 | `forms/branch.md` |
| Writes, the app's own commits | 610 | `views/writes.md` |

`app-routes.csv` gains a `doc` column on the routes-routes precedent, held
by a test in both directions (every `doc` exists; every file under
`docs/views/` has a row). Each new file needs its `docs.csv` row; the README
regenerates. Code cites show-repo.md by filename only, never by anchor, so
nothing in lib or the app breaks. The commit hook wants a
documentation-approval trailer per doc file, so the approval has to name
the split as a whole.

**Scope widened 2026-09-24.** The table above covers ten estate sections
and no repo view. Part 1 covers every row of `app-routes.csv`: a view with
material gets `docs/views/<key>.md`, a view without any gets a blank `doc`
cell, and a view whose contract already has a reference (stage, proposals)
points at it. The misfiled blocks move by content, not by heading: the Map,
Tools, the repo dialog and token gating sit under "Sessions cache" today.

**Writing rule for the split (owner, 2026-09-24).** Keep only what changes
what a future assistant does: addresses, the files that draw a view, the
data it reads and writes, and the invariants an edit could break, each with
the test that holds it. Cut history, measurements, rationale and design
narration; git and the code comments hold them. The assistant finds things
well, so the documents connect and organize rather than explain. The move is
one commit and the trim follows it, so the diff stays reviewable.

## 2. The FAB and the deck

A deck slide reaches the layer strip as an in-document subject and is
captioned by its path, so a branch slide inside the app reads as a file.
Insert a `deck` carrier row when the subject arrived by announcement rather
than by the frame walk, and have the deck announce the object's `type` so
the slide is captioned Branch or Session. The strip then reads app › deck ›
branch, and the deck row is where "close returns to the view underneath"
is true.

## 3. Registries: one model

A registry is a themed set of objects keyed by an id or a locator, each row
with declared properties. Membership across registries is free (the
`identity` column exists to compare keys across them); property ownership
is not (one property about one target answers to one registry). A key is a
locator only when its identity space is declared and the gate tests that
the target exists; otherwise it is an id, even where a rule could resolve
it. Files are the case where the space is the tree; `assistant-branches`
is already keyed by a locator that is not a path.

- Replace `area` (files, names) in `registries.csv` with `key_primitive`
  (`id`, `locator`); test its relation to `identity` (a `path` identity if
  and only if `locator`).
- Gloss both values in plain words in `vocabularies.csv`: "the key is a
  path in this repository" and "the key is a name this registry assigns";
  the `declared` gloss says "each row defines an object that is not a file".
- Regroup the Map's Registries tab by the new column ("keyed by a locator",
  "keyed by a name").
- Write the two paragraphs above into `registries.md`, with the sentence
  "a registry registers objects".
- Settle the five registries whose `files` area rested on an unstated rule:
  tracker-tasks, assistant-branches, themes, sources, aims-reading. Each
  declares its resolution rule as an identity and becomes locator-keyed
  with an existence check, or stays id-keyed.

## 4. Object types

Add a `store` column to `subjects.csv` saying where each type's objects
come from (a registry, a cache, a store, or a shaped file). Admit new rows
only as their forms exist: the tracker task first (a store, a list and a
type, shown today as a file), then the probe (home's `probes.json` has the
record and Text Lab the list; only the page is missing), then the trawl
when `results/` has a list.

## Not in this task

Retiring the Tools view and `tools.csv`; a generic form for registry rows
derived from properties.csv; renaming the `subject` columns of the showing
tables, which name the role a link addresses and keep the word.

## Related

- `docs/show-repo.md`: the file to split; its section table is above.
- `docs/app-routes.csv`, `docs/routes-routes.csv`: the `doc` column precedent.
- `lib/alpineComponents/fab.js`: `readLayers`, `_typeLayers`, the object model comment above `SUBJECT_ICON`.
- `lib/kits/swipe-deck.js`, `lib/kits/subject-channel.js`: where the deck announces.
- `docs/registries.md`, `docs/registries.csv`, `docs/column-primitives.md`, `tools/test/properties-registry.test.mjs`: part 3.
- `docs/subjects.csv`: part 4.
- PR #756 (`typed-subject-registry-xys5g4`): the registry and the FAB captions this builds on.

## Done when

show-repo.md is the shell's reference and every estate view and form has a
file of its own, linked from app-routes.csv and pages.csv by a tested
column; the FAB captions a deck slide by its type with a deck row above it;
`registries.csv` carries `key_primitive` in place of `area`, tested against
`identity`, with the five loose registries settled; `subjects.csv` carries
`store`.

## Progress log
- 2026-09-22: filed from the design pass on claude/serene-einstein-dyr03b, after PR #756.
- 2026-09-24: claimed on claude/show-docs-restructure-fc9r96 for part 1, with the scope widened to every route and the owner's trim rule added above.
- 2026-09-24: part 1 on claude/show-docs-restructure-fc9r96, PR #778: show-repo.md split into docs/views/ and docs/forms/ (31,586 words to 5,333), doc columns on app-routes.csv and subjects.csv held by app-routes.test.mjs, routes folded into the Map doc. Parts 2 to 4 remain.
