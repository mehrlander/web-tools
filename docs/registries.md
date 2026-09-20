# Registries

A **registry** is a committed CSV that records properties of a defined set of
targets. A target is a file, a page, a test, a route, a field name, or anything
else identified by a stable key.

This document says when to create a registry, how registries divide authority,
and what the suite checks. What each field means is not here. It is in
[`registries.csv`](registries.csv), one row per registry;
[`properties.csv`](properties.csv), one row per non-key column; and
[`vocabularies.csv`](vocabularies.csv), one row per value of each closed
domain. All three render in the app's **Map view, Registries tab**. The gate is
[`properties-registry.test.mjs`](../tools/test/properties-registry.test.mjs).

Settled 2026-08-08; the origin instrument is budget-drs's `properties.csv` in
`mehrlander/home`. The dated account of how the model was reached and what its
audits found was cut from this file on 2026-09-20 and stays in git history
([last full copy](https://github.com/mehrlander/web-tools/blob/be2e302b8187/docs/registries.md)).

## A worked example

[`pages/pages.csv`](../pages/pages.csv) describes every page under `pages/` and
owns `title` and `note`. [`docs/tools.csv`](tools.csv) selects the pages the
Tools view shows and owns that selection and the `icon` it assigns. It does not
repeat a page's title or note: its row in `registries.csv` declares
`inherits: pages`, and the Tools view joins the two registries when it needs a
description.

| Target | Property | Owner |
| --- | --- | --- |
| `pages/toss-render.html` | `title` | `pages` |
| `pages/toss-render.html` | inclusion in the Tools view | `tools` |
| `pages/toss-render.html` | `icon` | `tools` |

Copying `title` into `tools.csv` would store two answers to one question.
Renaming the copy `tool_title` would hide the duplicate without removing it.

## The model

| Term | Meaning |
| --- | --- |
| **Target** | The thing a row describes. |
| **Key** | The column or columns that identify a target within one registry. |
| **Identity space** | The naming system that lets keys from different registries identify the same target. |
| **Scope** | The population a registry claims to cover. |
| **Property** | A named fact a registry records about a target. Every non-key column is a declared property. |
| **Assertion** | A nonblank property value for one target. A blank cell asserts nothing. |
| **Registry** | One CSV holding assertions about one scope of targets. |
| **Declaration** | A row in `properties.csv` that assigns a property to a registry and says how the property behaves. |
| **Gate** | A test that fails when a registry and the repository disagree. |
| **Projection** | A generated view of registry data, such as `docs/README.md` or `tracker/board.md`. Never authoritative, never edited. |

An assertion does not record which registry holds it. The declaration resolves
that, which is what makes "one target, one property, one registry" a rule the
suite can check rather than a comment in a generator. The CSV is the convenient
form for a browser and a diff; the gates are the integrity constraints a
database would otherwise supply.

## One owner per assertion

For any target and property, at most one registry may hold an assertion, and
exactly one where the declaration requires a value. Two registries may declare
the same property name; the conflict is two nonblank values for one property on
one target.

When two registries overlap:

1. Decide which registry owns the property.
2. Blank the duplicate in the other registry. Keep the column where it serves
   targets outside the overlap.
3. Declare `inherits` where the second registry needs the owner's descriptions.
4. Join the registries at render time.

Do not resolve a collision by renaming one property. A rename hides the
duplicate from the ownership check and leaves both copies stored.

This is ownership, not overlay. `.paths.json` combines declarations by
precedence, nearest wins, because frozen-ness layers. A registry has one owner
per assertion, so two competing assertions are an error rather than a
precedence question.

### Comparing keys across registries

The ownership check compares two keys only when both resolve into one identity
space, declared per registry as `identity`:

- `path`: the key is a repository-relative path.
- `path:pages/`: the key is a path relative to `pages/`.
- another name, such as `registry-id`: its own space, separate from `path` even
  when a value has the same spelling.
- blank: the key is opaque and is compared with nothing.

So `href: toss-render.html` in `pages` and `path: pages/toss-render.html` in
`tools` are one target, and a registry id spelled `skills` is not the path
`skills`. Matching is exact: a directory locator does not match the files below
it. Nesting is written into scopes instead. The `harness` scope covers `tools/`
and `scripts/` and excludes `tools/test/`, which `tests` owns.

### Two questions, not a kind

A registry has no type. `membership` says how targets enter: `computed`, the
row set can be derived; `curated`, inclusion is authored. `inherits` names the
registry whose descriptions are joined rather than copied. `span` says where the
population lives: `hub`, this checkout bounds it; `estate`, the CSV aggregates
rows about other repositories. One `kind` column with the values `census`,
`catalog` and `crosswalk` held these from 2026-08-09 to 2026-08-18 and answered
two questions at once. Do not reintroduce one.

The same separation holds for a property. `mode` is `recorded` (authored) or
`computed` (derived by the script named in `deriver`). `required` is `value`
(every target has an assertion), `counted` (blanks are legal and reported as a
count) or `none` (optional, unchecked). `values` lists the closed domain, or is
blank where the domain is open. [`column-primitives.md`](column-primitives.md)
classifies what a column holds (id, label, locator or value); that is the
column's role, not the registry's authority.

**Do not close a young domain.** Few distinct values over many rows can be an
enumeration still growing: each new project or npm script adds one, and closing
it turns growth into a build failure. Some columns carry a grammar rather than a
set; `harness.invocation` holds `npm:<script>`. Declare `values` only where the
set is settled.

## Whether a registry is needed

Create a registry when a committed table must inventory or classify a defined
population, and add its row to `registries.csv` in the same commit. Before
creating one, ask where the assertions already live:

- In code, as an authoritative array: render that array. Do not transcribe it.
- In prose, with a CSV that only indexes it: state the relation and gate both
  directions. `surfacing.csv` has this shape.
- In an existing registry: add a projection, not a second authority.
- In live state, such as the current branch or CI status: read it live.

The question is whether the file would become the authoritative source for
assertions that have none, not whether a CSV would be convenient to read.

## Adding or changing a registry

1. State the target and the scope in plain language.
2. Choose a stable key. Declare `identity` only if the key can be compared with
   other registries' keys.
3. One table, one CSV file. Two registries never share a file.
4. Add the row to `registries.csv`: `path`, `key`, `identity`, `membership`,
   `inherits`, `target`, `scope`, `span`, `fields`, `gate`, `area`, `title`,
   `gloss`. `fields` is `governed`; the suite asserts that no registry is
   `ungoverned`, so declaring one means changing the test and stating why.
   `gate` is a test path, or the token `none`. `area` is `files` where the
   target has a path in this repository and `names` otherwise.
5. Add one row to `properties.csv` per non-key column: `mode`, `deriver` (for
   `computed`), `required`, `form`, `exclusive`, `values`, `column_primitive`,
   `gloss`.
6. Add each closed-domain value to `vocabularies.csv`.
7. Where a property is computed, make its gate compare the committed values
   with a fresh derivation.
8. Run `npm run registries-reach` if app code changed, then `npm test`.

If the header of `registries.csv` changes, change `REGISTRY_COLS` in
[`registries-load.mjs`](../tools/build/registries-load.mjs) in the same commit;
the writer uses that list.

## Storage rules

A blank cell means *not asserted*, never an empty string or a checked result of
none. Where that distinction matters, use a token: `gate: none` means checked,
and nothing holds the registry. Read the token, not the cell's truthiness.

Store `recorded` values always; authored judgment cannot be recomputed. Store
`computed` values only where a browser, a gate or a reviewable diff needs a
committed artifact, and keep them held to their deriver. Never store what a
live read supplies. Store model output when it is expensive and irreproducible;
regenerate it when it is scripted.

Preserve each file's line endings. Some registries are LF and some CRLF, per
file. A CSV writer restamps every line to its own default, so a one-row edit
arrives as a whole-file diff. Read the terminator off the committed copy, match
it, and check the diff's line count before staging.

## What the suite checks

[`properties-registry.test.mjs`](../tools/test/properties-registry.test.mjs),
by its test names:

- the writer's column list matches the file it writes
- registries are well-formed: unique ids, files and gates exist
- every ungoverned registry says why, and the count is the one on the books (zero)
- each governed registry holds exactly its key plus its declared properties
- every value in a closed domain is in that domain
- every `required: value` property is present on every row
- a declared id is its registry key, and a declared label draws from a set or repeats
- modes are coherent: computed names a real deriver, recorded names none
- every registry declares its area, and leads with a title and a gloss
- `renders_in` matches its derivation on every registry
- no target answers to two registries for the same property
- the ownership gate still fires when two registries do claim one pair (a
  synthetic conflict, since a detector tested only on clean data can pass after
  it stops detecting)
- the ownership gate does not fire across two identity spaces
- every tools row resolves to a page the gallery owns

A gate reports a disagreement and does not choose the repair: sometimes the
data is wrong, sometimes the declaration. Where a check can settle only part of
a field, spend it on the bounds code can establish rather than storing a
judgment as if it were derived.

The two index files govern themselves. `registries.csv` and `properties.csv`
each have a registry row, and every non-key column in both has a declaration.

## Reader-facing fields

`title` and `gloss` identify a registry in the Map view. `area` groups the tab
by one question: does the target have a path in this repository (`files`) or
not (`names`). A topical grouping was tried first and did not hold. `renders_in`
is derived by [`registries-reach.mjs`](../tools/build/registries-reach.mjs)
from the files under `lib/`, `pages/` and `app/` that name the registry's path.
That directory list is literal (`APP_DIRS`); when the app moves, move it. An
empty `renders_in` says no app surface reads the registry, which is a question
rather than a verdict, since a GitHub-rendered projection is a legitimate
consumer.

## Limits of the model

A registry row names one CSV. Authority spread across many files, such as each
skill's `SKILL.md` owning that skill's description, cannot be a registry; the
family rule for it lives in [`owners.csv`](owners.csv).

Declarations govern the columns of registered CSVs, not prose inside JavaScript
or HTML. [`content.csv`](../data/design/content.csv) classifies those files as
artifacts; [`text-content.md`](text-content.md) measures what that leaves out.

A scope must match what its gate checks. Narrow the scope rather than adding
targets to satisfy an overstated one.

## Across repositories

A project with its own registries declares them locally; the hub's table does
not enumerate a project's internals. The ownership rule spans levels: one owner
per target and property, anywhere.

`span` separates the two populations this table can hold: `hub`, bounded by
this checkout, and `estate`, an aggregate of rows other repositories author
about themselves. A third arrangement does not fit: a governed artifact each
repository carries, with no aggregate here. `.paths.json` has that shape and is
not a row, because a registry's file must exist here and be CSV.
[`estate-span.md`](estate-span.md) records the three arrangements.

### The same model in budget-drs

budget-drs stores one property per file (54 of 54), so it declares properties
directly and factors out no registry object. The hub's registries hold several
properties each, so it does. Fan-out decides the form; neither is canonical.
budget-drs's `columns.csv` describes the columns of every table, since most of
its tables are not registries. Field for field:

| hub `properties.csv` | budget-drs `columns.csv` | difference |
| --- | --- | --- |
| `registry`, `property` | `table`, `column` | the key |
| `mode`: recorded, computed | `role`: source, authored, carried, computed | `recorded` is `authored`; `source` and `carried` have no hub value, since the hub says borrowing at registry grain, as `inherits` |
| `deriver` | `op`, `sources` | the hub names the script; budget-drs records the operation and its inputs |
| `values` | `domain`, resolved in `domains.csv` | an inline set against a keyed universe |
| `gloss` | `transform`, `note` | one sentence either side |
| `required`, `form`, `exclusive` | `additivity` | the enrichment each side needed |

No consumer reads both, so the names stay as they are. budget-drs's
`definition_owner`, the document that defines each property's domain, was tried
here and dropped: hub domains are defined in the registry itself or in
`vocabularies.csv`, so the field would be blank by construction, and where a
domain is defined elsewhere `owners.csv` already says so.
