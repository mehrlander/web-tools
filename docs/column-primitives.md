# Column primitives

One property, `column_primitive`, saying what kind of thing a column holds. It is
the coarse question that sits above [`LINKAGE.md`](https://github.com/mehrlander/home/blob/main/projects/budget-drs/data/design/LINKAGE.md)'s
`column_domain`. `docs/properties.csv` declares it on every row, and the two
budget-drs property tables, `data/design/properties.csv` and
`lineage/columns.csv`, declare it too. The counts from its first population, on
2026-09-10, and the manifest-fields pilot are a dated record:
[`data/column-primitives/2026-09-10-first-population.md`](../data/column-primitives/2026-09-10-first-population.md).

## The four

| primitive | the test | how it fails |
| --- | --- | --- |
| **id** | unique within a scope; no two rows share a value | a duplicate |
| **label** | drawn from a declared set; rows share values, and the sharing is what makes it a class | a value outside the set |
| **locator** | resolves to a target outside the row | a target that is gone, or one that changed under a pinned reference ([locators.md](locators.md) has the kinds and the tests) |
| **value** | none of the above; the content itself | nothing mechanical to check |

Every field takes exactly one. Two of the tests are countable: `id` against
`label` is cardinality of distinct values against row count, so nothing turns on
reading anyone's intent.

**Uniqueness alone does not earn `id`.** What makes an id is that other rows and
files address the row by it, not that no two rows share a value: a distinct path
is a `locator` where another column already holds the addressing role, and a
column can be both id and locator (`projects[].path`, uniquely naming a project
and resolving to a folder) where nothing else addresses the row. Because
`registries.csv` declares each registry's key and `properties.csv` does not
repeat it, `properties.csv` sees almost no ids by construction.

**A locator takes three forms**: a path, a URL, and a key of another registry.
A column whose atoms are keys elsewhere (`routes-kinds.route`) holds no paths
and no URLs and reads as prose to a resolve test; only a membership test against
each registry's key universe finds it.

**Where a column declares `exclusive: no`, measure repetition on the atoms.** A
list column can show no repetition at cell grain and plenty once split on its
delimiter, so measuring it at cell grain asks the wrong question.

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
two are independent, measured rather than assumed: in the judgment manifest,
locator-shaped columns appear both in the support role (`from`) and as the
claim itself (`call`), where the authored decision *is* which document a line
points at.

`EVIDENCE.md`'s six roles are cells of that grid taken unevenly: `key` is an id,
`from` a locator in support, `by` a label in support, `note` prose in support,
`shows` a figure in support, and `call` is anything at all in claim position.
That asymmetry, the support side typed and the claim side open, is why `call`
holds a large share of the manifest's role declarations (the counts are in the
record).

## `column_domain` is the fine version of this

`column_domain` says *which* shared value space a column draws from
(`expenditure_authority`, `fund`, and others). `column_primitive` says
*what kind* of space it is. A domain is askable only where the primitive is
`label` or `locator`, since prose and a figure belong to no shared space, and
only for JOIN domains. budget-drs had said the second half before this property
existed: `domains.csv` carries `domain_identity`, and its one `measure` value is
`dollars`, registered as a domain precisely so a column that looks like a key can
be declared not to be one: `items_long.fund` holds money rather than an account.
[`LINKAGE.md`](https://github.com/mehrlander/home/blob/main/projects/budget-drs/data/design/LINKAGE.md)
states it directly, that a domain is what lets a column that looks like a key be
declared not to be one, and that shared domain membership is not evidence of a
join.

So a gate on this dependency reads `domain_identity` rather than the bare
presence of a domain: classified without their domain, the `dollars` columns
read `value`, which is correct, and only `domain_identity` says why.

## Named for the column deliberately

Every question this estate asks of a column is only askable of something
instantiated across rows: does it repeat, what is its domain, may it be summed,
does it join. A key that occurs once in one object has none of those answers. So
the tabular reading is not a stylistic preference, it is the precondition for the
questions, and the rule that follows is: **tabulate first, then classify.**
`docs/manifest-fields.csv` is that rule already at work, a table whose rows
are JSON keys.

## The one thing the four do not cover

The four are complete over columns and incomplete over JSON keys, because a CSV
has no containers. A key that declares a structure whose members are declared
separately (`pages`, `checks`, `projects`) is a nested table, and a primitive
does not apply to a table. A field can also be a genuine union of two
primitives (`projects[].tracker`, a locator or a label), so `exclusive: yes`
would be false for it.

## Where a value's shape is still unnamed

Under `value`, the shapes that have names are prose, figure, packed composite and
blob. Two have none: `checking.as_of` holds a date, and `checks[].pattern`
holds a regular expression. Neither is prose, a number, a delimited structure,
or carried bytes. Do not force them; the shape vocabulary is incomplete and
should say so.

## Open

Four collisions this property inherits rather than creates.

- **`value`** is tidy data's word for the content of any cell, which is broader
  than the sense used here.
- **`label`** is already a column in several registries, where it means a
  display name. Freeing it needs a consumer count first.
- **`primitive`** already names the surfacing set in `docs/conversation.csv`, so
  this one is qualified at every use, never bare.
- **`row_grain`** in budget-drs answers tidy data's *observation*. Whether to
  rename it is a separate decision, and `GRAINS.md` is its definition owner.

## What holds it

Two gates, both mutation-tested in each direction.

The closed domain came free: because the property declares its `values`, the
registry's existing domain test holds every row to `id`, `label`, `locator` or
`value`, and its four values carry a gloss each in `docs/vocabularies.csv`,
which a separate gate requires.

The countable half needed a test, in
[`node/test/properties-registry.test.mjs`](../node/test/properties-registry.test.mjs):
a declared `id` must be its registry's key, and a declared `label` must either
declare a closed set or actually repeat. Nothing holds `locator` or `value`,
and that asymmetry is the doctrine's own, since only two of the four tests are
countable.
