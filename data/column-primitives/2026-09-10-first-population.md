# Column primitives: the first population, 2026-09-10

A record of the measurements taken when `column_primitive` was first declared,
moved here from [`docs/column-primitives.md`](../../docs/column-primitives.md),
which keeps the doctrine. Every figure is as of 2026-09-10 and is not restamped;
today's counts are in the files themselves. The manifest-fields pilot's rows
are [`2026-09-10-manifest-fields-pilot.csv`](2026-09-10-manifest-fields-pilot.csv),
beside this file.

## The population

`docs/properties.csv` declared the property on all 178 rows, measured against
each property's real column rather than read off its gloss: **value 86, label
63, locator 27, id 2.** Two more property tables remained, both in budget-drs:
`data/design/properties.csv` (49 rows) and `lineage/columns.csv` (1,171); both
have declared it since.

Every one of the 177 properties resolved to a real column in a real CSV, so all
four tests could be run rather than argued.

**The residual in `value` was 86 of 178, 48%.** That is the number the property
has to justify itself against, and it is the honest reading of a role axis: half
of what a registry records is content that identifies nothing, classifies
nothing and points nowhere.

**`id` was nearly absent.** 28 of the 30 registries had no property row for
their own key column, since `registries.csv` declares the key and
`properties.csv` does not repeat it. The two that did appear, `aims-goals.key`
and `aims-reading.path`, were the exceptions worth a second look.

**Uniqueness alone did not earn `id`.** `registries.path` was distinct on all 30
rows and resolved on all 30, and it is a `locator`, because `registries.id`
already holds the addressing role.

**A cross-registry membership test found locators nothing else did.**
`routes-kinds.route` and `routes-kinds.shown_by` hold no paths and no URLs, so
they read as prose to a resolve test; every atom is a key of another registry.

**`app-routes.tabs`** has two rows, two distinct cells and no repetition at all
until they are split on the semicolon, at which point `docs` appears in both
lists.

## Position and the judgment manifest

In budget-drs's judgment manifest, locator-shaped columns appeared 25 times in
the support role (`from`) and 3 times as the claim itself (`call`), where the
authored decision *is* which document a line points at. `call` carried 150 of
the manifest's 432 role declarations, the support side being typed and the
claim side open.

## Domains

budget-drs's `domains.csv` `domain_identity` ran `exact` 11, `normalized` 6,
`folded` 2 and `measure` 1 (`dollars`).

566 of budget-drs's 1,171 columns read `label` or `locator` and only 174
declared a domain, so **392 were domain-askable and unanswered**, which was most
of the gap between 190 and 1,171. Classifying the 190 domain-bearing columns
without using the domain, all five `dollars` columns came out `value`. That
first read as the property catching a defect; it was the older registry being
more precise than the newer one.

## The manifest-fields pilot

Classified against `docs/manifest-fields.csv`, then 58 rows:

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

The declared `type` column in that file read `string` on 35 of the 58, which
hid all of it, and 21 resolving locators most of all.

Seven rows were not fields: `pages`, `checks`, `projects`, `skills`,
`checking`, `stage` and `showing` declare structures whose members are declared
separately.

Two results were predicted and confirmed: `projects[].path` is **both** id and
locator, uniquely naming a project and resolving to a folder, and
`projects[].tracker` is a genuine union of a locator and a label. One result was
a plain embarrassment: `checks[].label` classified as a **value**, because it
holds a prose row caption.

The pilot also found two `value` shapes with no name: `checking.as_of` holds a
date, and `checks[].pattern` holds a regular expression.
