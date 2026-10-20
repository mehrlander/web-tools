# Audit: the envelope contract

An **audit** gives every unit of one document, a sentence or a block, a label from a declared vocabulary and a verdict on whether the unit stays. It is a standoff annotation: units record character offsets into the document and leave it unedited, so an audit describes a document only while that document's bytes match the digest the audit records. An audit has two formats. `standoff/1` is the annotation alone, naming its document and recording the digest; `audit/1` joins a standoff to the document's text so a page can render both from one file. [`python/annotate/audit-payload.py`](../../python/annotate/audit-payload.py) writes both, ⭐ [pages/audit-render.html](https://mehrlander.github.io/web-tools/pages/audit-render.html) renders either, and the [`wording-audit`](../../skills/wording-audit/SKILL.md) skill produces audits of a document's wording. The invariants and edits below have two implementations, [`lib/kits/standoff.js`](../../lib/kits/standoff.js) in the page and [`python/annotate/ops.py`](../../python/annotate/ops.py) in a session, so a change to one needs the same change in the other; `node/render/scenarios/audit-edit.mjs` compares them over one patch.

## Delivery

The page reads `#gz=` before `?src=`, and shows its embedded payload when it has neither:

| channel | form | use when |
| --- | --- | --- |
| `#gz=<base64url>` | a gzipped `audit/1` payload in the URL fragment | handing over an audit without a commit; the fragment never reaches a server |
| `#audit=<spec>` | the toss route: `…/toss-render.html#audit=<owner>/<repo>[@<ref>]:<path>` | the shortest link to a committed file; resolves into this page's `?src=` |
| `?src=<spec>` | `owner/repo[@ref]:path`, fetched via the contents API | a committed `audit/1` payload, or a `standoff/1` file, whose document the page reads from `target.path` on the same branch and checks against `target.sha256` |
| (none) | the page's embedded payload, a binding audit of `docs/CONVENTIONS.md` | a look at the page |

`?view=review` (or `#view=review`) opens the page on Review, one label's units at a time. An edit made in the page is saved to the standoff's `self.path` when the page reads a branch other than the repository's default; otherwise it leaves as a patch, copied or downloaded from the page's patch dialog, for `ops.py` to apply.

## The files

`audit/1`:

| Field | Holds |
| --- | --- |
| `kind` | `audit/1` |
| `title` | The document's file name |
| `standoff` | The `standoff/1` annotation, verbatim |
| `text` | The document's text; `audit-payload.py payload` refuses to join a text whose sha256 differs from `standoff.target.sha256` |

`standoff/1`:

| Field | Holds |
| --- | --- |
| `kind` | `standoff/1` |
| `question` | What the vocabulary asks of each unit, such as *is this unit binding?* |
| `self` | Optional: the standoff's own `path`, and `repo` when known, where the page saves an edit; without it, an edit leaves only as a patch. It has no `ref`, since the page saves to the branch it is reading |
| `target` | The document: `path`, then `repo`, `ref` and `url` when known, and the `bytes` and `sha256` of the text annotated |
| `vocabulary` | The labels in order, each with `label`, `side` (the group it belongs to), `gloss`, and optionally `color` as an `r,g,b` string |
| `verdicts` | The verdicts a unit may take, each with `verdict` and `gloss`: `KEEP` and `DROP` |
| `units` | In document order |
| `insertions` | Optional: text the document does not have, each placed after a unit or at the head of the document |

A **unit** has a `uid`, `start` and `end` (offsets into the document in code points, end exclusive), `kind` (`h1` to `h6`, `sent`, `code`, `table` or `mixed`, derived from the span), `words`, `label` and `verdict`. It may also have a `note`, a `why` (the reason given for the last edit to it), and a `from` naming the edit that produced its span: `split:<uid>`, `merge:<uid>+<uid>` or `shift:<uid>/<uid>`. A split's halves take the parent's uid with `a` and `b` appended.

An **insertion** has `after`, the uid of the unit whose end is its boundary (`null` for the head of the document), and `text`. It may have `why`, and `as`, which overrides the document's own spacing at that boundary: `block` places the text as its own paragraph and `run` joins it to the text around it.

## Invariants

In offset order the units partition the document: only whitespace lies between one unit's end and the next one's start, no unit overlaps the one before, and no text lies before the first unit or after the last. Every span holds text, every uid is unique, every label is in the vocabulary, and where `verdicts` is declared every verdict is one of them. An insertion's `after` names an existing unit or the head, its text is not empty, no other insertion shares its boundary, and an insertion at the head is not a `run`. `check()` in the kit returns the breaches, and `ops.py` refuses a patch that would cause one.

## Edits

A patch is a JSON list of operations, each keyed by a unit's `uid`, or for a boundary by `after`, rather than by array position. `split`, `merge` and `shift` change the units' boundaries; `relabel`, `verdict` and `note` change a unit's label, verdict or note; `insert` adds text at a boundary. The fields of each are in `ops.py`'s docstring. A patch applies whole or not at all: if one operation is refused or breaks an invariant, nothing changes.

## Vocabularies

Each audit declares its labels in a vocabulary, a TSV with the columns `label`, `side`, `gloss` and optionally `color`, passed to `audit-payload.py standoff` with `--vocab` and the matching `--question`, and copied into the standoff. Two are in use:

| Question | Vocabulary | Labels |
| --- | --- | --- |
| *is this unit binding?* (the builder's default) | [`skills/doc-craft/binding/vocab.tsv`](../../skills/doc-craft/binding/vocab.tsv) | WHAT, HOW, WHY, PROV, EVID, NAV, META |
| *is this unit's wording weak or wrong?* | [`skills/wording-audit/vocab.tsv`](../../skills/wording-audit/vocab.tsv) | OK, WEAK, WRONG |

## Verdicts

`KEEP` leaves a unit standing and `DROP` removes it. [`python/annotate/materialize.py`](../../python/annotate/materialize.py) projects an audit onto its document: it removes every DROP unit, places every insertion, and lists each kept unit's note as the brief for a rewrite rather than writing new text. A decided rewording is a DROP plus an insertion whose `after` is that unit's own uid, which `materialize.py` places where the unit stood.
