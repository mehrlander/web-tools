# Column primitives

One property, `column_primitive`, saying what kind of thing a column holds. It is
the coarse question that sits above [`LINKAGE.md`](https://github.com/mehrlander/home/blob/main/projects/budget-drs/data/design/LINKAGE.md)'s
`column_domain`.

**Populated here on 2026-09-10.** `docs/properties.csv` declares it on all 178
rows, measured against each property's real column rather than read off its
gloss: **value 86, label 63, locator 27, id 2.** Two more property tables remain,
both in budget-drs: `data/design/properties.csv` (49 rows) and `lineage/columns.csv`
(1,171).

## The four

| primitive | the test | how it fails |
| --- | --- | --- |
| **id** | unique within a scope; no two rows share a value | a duplicate |
| **label** | drawn from a declared set; rows share values, and the sharing is what makes it a class | a value outside the set |
| **locator** | resolves to a target outside the row | a target that is gone |
| **value** | none of the above; the content itself | nothing mechanical to check |

Every field takes exactly one. Two of the tests are countable: `id` against
`label` is cardinality of distinct values against row count, so nothing turns on
reading anyone's intent.

## It is a role axis, not a shape axis

The four ask what a field does in its row, not what its text looks like. So
prose, a figure, base64 and a delimited pair-list all answer `value`, and that is
the design rather than a residual problem: none of them identifies the row,
classifies it, or points outside it.

That also settles the follow-up question. `id`, `label` and `locator` each
constrain their own shape almost completely, so only `value` is free to be
anything, and only `value` needs a second question.

## It crosses position and does not nest inside it

The other axis is the data-versus-documentation cut that budget-drs's
[`EVIDENCE.md`](https://github.com/mehrlander/home/blob/main/projects/budget-drs/data/authored/EVIDENCE.md)
already carries: is a field the claim being made, or support for the claim? The
two are independent, measured rather than assumed. In the judgment manifest,
locator-shaped columns appear 25 times in the support role (`from`) and 3 times
as the claim itself (`call`), where the authored decision *is* which document a
line points at.

`EVIDENCE.md`'s six roles are cells of that grid taken unevenly: `key` is an id,
`from` a locator in support, `by` a label in support, `note` prose in support,
`shows` a figure in support, and `call` is anything at all in claim position.
That asymmetry, the support side typed and the claim side open, is why `call`
carries 150 of the manifest's 432 role declarations.

## `column_domain` is the fine version of this

`column_domain` says *which* shared value space a column draws from
(`expenditure_authority`, `fund`, and eighteen others). `column_primitive` says
*what kind* of space it is. The dependency looks like one line: a domain is only
askable where the primitive is `label` or `locator`, since prose and a figure
belong to no shared space. Measured on 2026-09-10, 566 of budget-drs's 1,171
columns read `label` or `locator` and only 174 declare a domain, so **392 are
domain-askable and unanswered**, which is most of the gap between 190 and 1,171.

**Corrected 2026-09-10, and the correction is the interesting part.** That
dependency holds for JOIN domains only, and budget-drs had already said so
before this property existed. `domains.csv` carries `domain_identity`, which
runs `exact` 11, `normalized` 6, `folded` 2 and **`measure` 1**. The measure is
`dollars`, registered as a domain precisely so a column that looks like a key
can be declared not to be one: `items_long.fund` holds money rather than an
account, and the domain is what says so.
[`LINKAGE.md`](https://github.com/mehrlander/home/blob/main/projects/budget-drs/data/design/LINKAGE.md)
states it directly, that a domain is what lets a column that looks like a key be
declared not to be one, and that shared domain membership is not evidence of a
join.

So a gate on this dependency reads `domain_identity` rather than the bare
presence of a domain. Classifying the 190 domain-bearing columns without using
the domain, all five `dollars` columns came out `value`, which first read as the
property catching a defect. It was not a defect; it was the older registry being
more precise than this newer one, and the newer one had to be told.

## Named for the column deliberately

Every question this estate asks of a column is only askable of something
instantiated across rows: does it repeat, what is its domain, may it be summed,
does it join. A key that occurs once in one object has none of those answers. So
the tabular reading is not a stylistic preference, it is the precondition for the
questions, and the rule that follows is: **tabulate first, then classify.**
`docs/manifest-fields.csv` is that rule already at work, a table whose 58 rows
are JSON keys.

## The pilot, and the one thing the four do not cover

Classified against `docs/manifest-fields.csv`, recorded at
[`data/column-primitives/2026-09-10-manifest-fields-pilot.csv`](../data/column-primitives/2026-09-10-manifest-fields-pilot.csv):

| | |
| --- | --- |
| fields taking a primitive | 51 of 58 |
| locator | 21 |
| value | 16 |
| label | 10 |
| id | 2 |
| taking two primitives | 2 |
| lists of a primitive | 6 |
| **nested tables, where no primitive applies** | **7** |

The declared `type` column in that file reads `string` on 35 of the 58, which
hides all of it, and 21 resolving locators most of all.

**Seven rows are not fields.** `pages`, `checks`, `projects`, `skills`,
`checking`, `stage` and `showing` declare structures whose members are declared
separately. A primitive does not apply to a table. This is the JSON seam
showing, and it is a second argument for the column scope: the four are complete
over columns and incomplete over JSON keys, because a CSV has no containers.

Two results were predicted and confirmed. `projects[].path` is **both** id and
locator, uniquely naming a project and resolving to a folder. And
`projects[].tracker` is a genuine union of a locator and a label, so
`exclusive: yes` would be false for it.

One result is a plain embarrassment worth keeping: `checks[].label` classifies as
a **value**, because it holds a prose row caption. A field named `label` that is
not one.

## Where a value's shape is still unnamed

Under `value`, the shapes that have names are prose, figure, packed composite and
blob. The pilot found two that have none: `checking.as_of` holds a date, and
`checks[].pattern` holds a regular expression. Neither is prose, a number, a
delimited structure, or carried bytes. Do not force them; the shape vocabulary is
incomplete and should say so.

## Open

Four collisions this property inherits rather than creates.

- **`value`** is tidy data's word for the content of any cell, which is broader
  than the sense used here.
- **`label`** is already a column in five registries, where it means a display
  name. Freeing it needs a consumer count first.
- **`primitive`** already names the surfacing set in `docs/surfacing.csv`, so
  this one is qualified at every use, never bare.
- **`row_grain`** in budget-drs answers tidy data's *observation*. Whether to
  rename it is a separate decision, and `GRAINS.md` is its definition owner.


## What the first population measured

Every one of the 177 properties resolved to a real column in a real CSV, so
all four tests could be run rather than argued.

**The residual in `value` is 86 of 178, 48%.** That is the number this property
has to justify itself against, and it is the honest reading of a role axis: half
of what a registry records is content that identifies nothing, classifies
nothing and points nowhere.

**`id` is nearly absent, and the reason is structural rather than a gap.** 28 of
the 30 registries have no property row for their own key column: `registries.csv`
declares the key in its `key` field, and `properties.csv` does not repeat it,
which is the one-property-one-registry rule working correctly. So `properties.csv`
sees almost no ids by construction. The two that do appear, `aims-goals.key` and
`aims-reading.path`, are the exceptions worth a second look.

**Uniqueness alone does not earn `id`.** `registries.path` is distinct on all 30
rows and resolves on all 30, and it is a `locator`, because `registries.id`
already holds the addressing role. What makes an id is that other rows and files
address the row by it, not that no two rows share a value. The pilot's
`projects[].path` took both primitives precisely because nothing else addressed
a project.

**A cross-registry membership test finds locators nothing else does.**
`routes-kinds.route` and `routes-kinds.shown_by` hold no paths and no URLs, so
they read as prose to a resolve test; every atom is a key of another registry.
Checking membership against each registry's key universe is the third form a
locator takes, beside a path and a URL.

**Where a column declares `exclusive: no`, repetition is measured on the atoms.**
`app-routes.tabs` has two rows, two distinct cells and no repetition at all until
they are split on the semicolon, at which point `docs` appears in both lists.
Measuring a list column at cell grain asks the wrong question.

### What holds it

Two gates, both mutation-tested in each direction.

The closed domain came free: because the property declares its `values`, the
registry's existing domain test holds every row to `id`, `label`, `locator` or
`value`, and its four values carry a gloss each in `docs/vocabularies.csv`,
which a separate gate requires.

The countable half needed a test, in
[`tools/test/properties-registry.test.mjs`](../tools/test/properties-registry.test.mjs):
a declared `id` must be its registry's key, and a declared `label` must either
declare a closed set or actually repeat. Nothing holds `locator` or `value`,
and that asymmetry is the doctrine's own, since only two of the four tests are
countable.