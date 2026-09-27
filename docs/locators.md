# Locators: how the estate points at things, and how it knows a pointer still holds

A **locator** is a string that names something outside the record holding it: a
file, a part of a file, a record in a store, a passage of text, or an element on
a live page. The estate already uses the word as a column type
([`vocabularies.csv`](vocabularies.csv): "resolves to a target outside the row:
a path, a URL, or a key into another registry"), and some thirty registry
columns are typed that way. This document gives the type its kinds, states how
a reference is found from the thing it points at, and states how a reference is
tested for still being true. It adds no mechanism; where a piece exists, it is
named and linked.

## References are records

A **reference** is a record with a source, a target locator, and a kind of
relation. The shapes in use today are all references in this sense:

| Record | Source | Target | Relation |
| --- | --- | --- | --- |
| A note (`web-tools-private/notes/notes.jsonl`, [notes skill](../.claude/skills/notes/SKILL.md)) | the note | its `about` locator, plus an optional quote anchor | comments on |
| A standoff ([annotation.md](annotation.md)) | the standoff file | a document, by character spans and the document's `sha256` | annotates |
| A text proposal (`home/projects/text/proposals.jsonl`) | one passage id | another passage id | proposes a rewrite of |
| An errand's `task` field ([manifest.md](manifest.md#errands-errandsrequests--errandsresults)) | the errand | a tracker task | serves |
| A markdown link | the file holding it | a path or URL | mentions |

Treating them as one shape is what makes one question possible for anything in
the estate: **what refers to this?** The answer is the set of references whose
target resolves to it. A reader, human or agent, should see the thing and its
inbound references together.

## The kinds of locator

Each kind keys on something different, and so each breaks in a different way.

| Kind | Example | Keys on | Breaks when |
| --- | --- | --- | --- |
| **Path** | `owner/repo@ref:path`, parsed by [`repo-address.js`](../lib/kits/repo-address.js) | where a file sits | the file is renamed or moved |
| **Fragment** | `path#heading=…`, `#column=`, `#html-id=` ([content registry](../lib/kits/content-registry.js)); `path#fragment` in notes | a named part inside a file | the heading or id is edited |
| **Span** | a standoff unit's `start`/`end`, beside the document's `sha256` | exact character offsets | any byte of the document changes; the hash says so |
| **Quote** | a note's `anchor`: `exact` text with `prefix` and `suffix` ([annotate.js](../lib/kits/annotate.js)) | the quoted text and its context | the quoted text itself is edited; edits elsewhere do not break it |
| **Content id** | a passage id: the sha256 of its text | the content itself | never; changed text is a different passage |
| **Record key** | a task slug, an errand id, `note:<id>`, a registry row key | a stable name in a declared set | the record is deleted |
| **Selector** | an XPath or CSS selector into a live page | the page's current structure | the page is redesigned |

**Choose the kind by what should survive.** A record key survives renames,
moves and edits, so it is the durable handle for anything that is a record. A
path is precise and fragile to moves. A span is exact to the character and
fragile to every edit, but it can tell when it has broken. A quote is less
exact and survives edits elsewhere in the document. A selector suits acting on
a page now and suits nothing meant to last.

## The canonical form: a container and a part

Every locator resolves to two parts:

- **A container:** a repo and a path, a store and a record key, or a store and
  a content id.
- **An optional part inside it:** a fragment, a span, a quote, or a selector.

Inbound lookup always works at the container level: what refers to this file,
this task, this passage. It works at the part level only where two references
use the same kind of part, for example two standoffs over the same bytes. A
lookup that cannot see a store, because its repo is not checked out, answers
**unverifiable** rather than **none**.

## How a reference is tested

### Two questions

- **Broken:** does the locator still resolve to anything? Answering needs
  nothing stored; resolve it and see.
- **Changed:** is what it resolves to still what the reference meant?
  Answering needs a **witness** recorded when the reference was made: a hash, a
  commit SHA, or a quoted excerpt. A reference with no witness can be tested for
  broken and never for changed.

### Stance: follow or pin

A change is not always a fault, so each kind of reference declares a stance.

- **Follow:** the reference means the current version, and only broken
  matters. An errand serving a task wants the task as it now stands.
- **Pin:** the reference means one exact version, and changed matters. A
  standoff's spans are valid only against the bytes they were made on.

The stance is declared once for a kind of reference, not per record, and the
test follows from it.

### Granularity: coarse first, fine only when needed

Git supplies a hash at every level above the file, so a pinned reference can
store the finest witness it needs and be tested as a cascade:

| Level | Witness | How it is read |
| --- | --- | --- |
| Commit | the commit SHA of a ref | `git rev-parse <ref>` |
| Folder | the tree SHA of a directory | `git rev-parse <ref>:<dir>` |
| File | the blob SHA of a file | `git rev-parse <ref>:<path>` |
| Part | a hash of the resolved part's bytes (a section, a record, a span) | computed by the checker |

The checker compares the coarsest stored witness first. A match ends the test,
correctly and cheaply. A mismatch sends it one level down. The coarse levels can
raise a false alarm, since something in the file changed; they cannot miss a
change. The part level says whether the change touched what the reference is
about. Where a pinned part has changed, a quote anchor can re-find it; a span
cannot, and needs re-anchoring by hand or by a re-annotation pass.

### Verdicts

The vocabulary [`scripts/dead-links.py`](../scripts/dead-links.py) already uses,
extended by two:

| Verdict | Means |
| --- | --- |
| **ok** | resolves and, if pinned, is unchanged |
| **changed** | resolves, and the pinned witness differs |
| **moved** | resolves only through a rename record, such as `formerly` in [`docs.csv`](docs.csv) |
| **broken** | resolves to nothing |
| **unverifiable** | cannot be checked from here: a store not checked out, shallow history, a page out of reach |

A Claude Code web checkout is shallow, so a test that reads Git history there
answers *unverifiable*, never *broken* (the `sandbox-traps` skill records this
trap).

### The tests for each kind

| Kind | Broken test | Changed test, when pinned | Cost |
| --- | --- | --- | --- |
| Path | the path exists at the ref | blob SHA against the stored one | cheap |
| Fragment | the heading or id exists in the file | hash of the section's text | cheap |
| Span | the document exists | the document's `sha256` | cheap |
| Quote | the `exact` text occurs in the document | not needed: the quote is its own witness; the test is whether it is still found, and uniquely | cheap to moderate |
| Content id | the id exists in its store | not needed: re-hashing the content checks integrity | cheap |
| Record key | the key exists in its store | hash of the record against the stored one | cheap |
| Selector | the element exists on the live page | hash of the element's text | costly: network and a browser |

### When each test runs

| Tier | Runs | Suits |
| --- | --- | --- |
| **Commit** | the pre-commit hook | broken and hash tests on references inside one repo |
| **Suite** | `npm test` and the PR check | the same across repos where sibling checkouts exist, *unverifiable* where they do not; `dead-links.py` sits here |
| **Crawl** | the scheduled estate crawl | tests that read Git history (rename detection) or need every repo at once |
| **Errand** | a person or a computer-use agent, on request | selectors on live pages, and re-anchoring a changed span or quote |

## What exists, and what does not yet

**Exists:** the path grammar and its parser; fragment locators in the content
registry; spans pinned by a document hash in standoffs; quote anchors on notes;
content-addressed passages; notes addressed to any locator, with
`note.py show <about>` as the inbound lookup for notes; and the broken test with
its verdicts in `dead-links.py`.

**Does not exist yet:** a declared stance per kind of reference; stored witnesses
on anything but standoffs; the cascade; an inbound index across kinds of
reference; and one checker applying these tests in place of one tool per kind.

**Two facts to resolve before building on this.**

- The grammar has two definitions. `repo-address.js` requires `:path`;
  the notes locator (in [`notes.js`](../lib/kits/notes.js) and `note.py`) also
  accepts `owner/repo`, `@branch` alone, `#N` for a pull request, and
  `note:<id>`. The notes grammar is the superset and should become the one
  definition, with `repo-address.js` parsing the path-bearing subset of it.
- Notes address a tracker task by path (`owner/repo:tracker/tasks/<slug>.md`).
  That is a path used for a record, which this document advises against. A
  record-key form for tasks would survive a move of the tracker to another
  format; the grammar does not have one yet.
