# Do parts have structure? Reader C

## Answer

Yes. The ten parts are not a flat list. They sort on eight properties, and five of the eight are already stated in the inputs without being named as properties.

1. They form a containment tree of three levels: two parts of the pattern, two parts of the list, six parts of an item.
2. Each part does one of five jobs: contain, divide, describe, lead, act.
3. Four of the six item parts can also sit on a group; two cannot.
4. The parts that describe lie on one scale of how much they say, from one fact to the item in full.
5. Each has a multiplicity: exactly one, at most one, or any number.
6. Each is required, optional, or tied to one code.
7. Three parts are families whose members `parts.csv` names in the gloss: meta (six kinds of fact), body (four kinds of content), links (three kinds of destination). This is the clearest case of "similar form, varying instantiation".
8. Two parts are named in a behavior promise that the checker tries; eight are not.

## The table

| Part | Level | Function | On a group | Extent | Multiplicity | Requirement | Named variants | In a promise |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| list | pattern | contain | n/a | n/a | exactly one | required | none | no |
| item | list | contain | n/a | n/a | any number | required | none | yes |
| group | list | divide | n/a | name | any number | optional | none | no |
| detail | pattern | contain | n/a | whole | exactly one | list-detail only | none | yes |
| title | anatomy | describe | no | name | at most one | optional | none | no |
| meta | anatomy | describe | yes | token | any number | optional | 6 | no |
| summary | anatomy | describe | yes | line | at most one | optional | none | no |
| body | anatomy | describe | no | block | any number | optional | 4 | no |
| links | anatomy | lead | yes | n/a | any number | optional | 3 | no |
| actions | anatomy | act | yes | n/a | any number | optional | none | no |

Value sets:

- **Level**: `pattern` (a direct part of the arrangement), `list` (a direct part of the list), `anatomy` (a part of one item, group or detail).
- **Function**: `contain` (holds other parts), `divide` (heads a run of items), `describe` (says something about its owner), `lead` (goes to another thing), `act` (works on the owner itself).
- **On a group**: `yes`, `no`, `n/a` for the four parts that are not anatomy.
- **Extent**: `token` < `name` < `line` < `block` < `whole`, `n/a` where the part does not describe.
- **Multiplicity**, counted per owner: `exactly one`, `at most one`, `any number`.
- **Requirement**: `required`, `optional`, `list-detail only`.
- **Named variants**: the number of kinds the `parts.csv` gloss lists, or `none`.
- **In a promise**: `yes`, `no`.

## Sources for cells not obvious from `parts.csv`

"Markup" below means the 487 elements under `lib` and `pages` whose static `data-part` is one of the ten names, read with a lexical tag parser of my own. It sees templates, not rendered rows, and it finds no parent where a fragment is assembled outside the template it sits in, so its counts are approximate. "Units" means the 37 rows of `instances.csv` whose `parts` cell is filled: 20 coded `list`, 11 `card-grid`, 6 `list-detail`.

**Level.** The codebook names the third level itself: "An item's anatomy is title, meta, summary, body, links and actions". Markup agrees on the other two. The nearest part ancestor of an item is the list in 56 of 59, and of a group is the list in 20 of 24; the remaining 3 and 4 have no part ancestor my parser could see. A list has no part ancestor in 51 of 52, and a detail has none in 7 of 8, so both hang from the pattern element. No item has a group as its ancestor (0 of 59).

**Function.**
- `group` is `divide`, not `contain`: `parts.csv` calls it "the heading" of a run, and in markup items sit beside the heading, never inside it.
- `links` and `actions` differ by target, not by mechanism. The codebook: links "lead elsewhere", actions "act on the item itself". In markup 12 of 38 links are buttons and 8 of 25 actions are anchors, so the HTML tag does not decide it. The one target the rule does not settle is the item itself at another address, which markup marks both ways (see "Loose ends").
- Function belongs to the role, not the element: 16 of 52 titles and 8 of 164 metas are themselves a link or a button, and still describe.

**On a group.** The codebook: "A `group` may carry its own `meta`, `summary`, `links` and `actions`". It leaves out title and body. Markup has group-owned meta (16), summary (8), actions (2) and links (1), and no group-owned title or body. The `parts.csv` gloss for summary says only "describing the item", so that gloss is narrower than the codebook and the markup.

**Extent.** Each value is the size word in a gloss: meta is "any one fact" (codebook), title is "an item's name", summary is "a line or two", body is "the item's own content beyond its summary" (codebook), detail shows the item "in full". The group heading is a name. The ordering into one scale is mine. Markup tags fit it: meta sits on `span` or `i` in 126 of 164, summary on `p` in 21 of 33, body on `div`, `ul`, `pre` or `dl` in 30 of 31.

**Multiplicity.**

| Part | Units carrying it (of 37) | Count per item in a unit | Per item template in markup |
| --- | --- | --- | --- |
| list | 37 | always 1 per unit | n/a |
| item | 37 | 1 to 2770 per unit | n/a |
| group | 17 | 1 to 20 per unit | n/a |
| detail | 6 (all 6 list-detail units) | always 1 per unit | n/a |
| title | 36 | 1.00 in 35 of 36 | one in 41, two in 4 (alternates) |
| meta | 32 | median 3.0, up to 10.7; above 1 in 30 of 32 | two or more in 36 of 43 |
| summary | 26 | 1.00 in 17; never above 1.05 | never more than one (23 of 23) |
| body | 13 | up to 4.0 | one in 9, two to seven in 4 |
| links | 15 | up to 2.5 | one in 14, two to five in 5 |
| actions | 18 | 1.00 in 14 of 18 | one in 11, two or three in 3 |

Where a unit has more summaries than items, the excess never exceeds its group count (group summaries). The one unit with more titles than items is `view/stage/errands`, 4 to 3, because its detail repeats the title (`lib/alpineComponents/stage.js:1439`).

**Requirement.** Read off the `parts` cell of `codes-body.csv`: `list` and `item` lead all three cells unmarked, `detail` appears only under `list-detail`, and the other seven carry `?` in all three.

**Named variants.** Counted from the `parts.csv` glosses. meta: code, count, amount, date, kind, status. body: a diff, a script, a small chart, a panel expanded in place. links: tags that filter the list, doors to other views, related documents. The three families vary on different things: meta by the type of the fact, body by the form of the content, links by where the destination is (this list, another view, a document).

**In a promise.** The codebook's promises name only two parts: "for `list`, at least one item shown; for `card-grid`, at least one card; for `list-detail`, picking an unselected item changes (or first shows) the detail and moves the selection to it". The item is also the only part given a state attribute (`aria-selected` or `aria-current`); markup carries one on 6 item templates.

## Confidence

Confident, because the inputs state them:
- **Requirement** (`codes-body.csv`).
- **Named variants** (`parts.csv`).
- **In a promise** (codebook).
- **On a group** (codebook, confirmed in markup).
- **Level** (codebook for the anatomy level, markup for the other two).

Confident, because measured:
- **Multiplicity** for list, item, detail, title, summary and meta.

My inference:
- **Function**: the five names are mine. Each sits close to a gloss. The `lead` and `act` cells are the least firm, because markup does not apply that boundary the same way everywhere.
- **Extent**: the glosses give the sizes; treating them as one ordered scale is my reading.
- **Multiplicity** for body, links and actions: the mark lands on one control in some places and on a row of several in others (links: 28 single controls, 10 wrappers; actions: 16 and 9), so an element count is not a count of links or controls.
- That named variants are a latent `kind` of a part rather than only examples in a gloss.

## Three things that are structure but not a column

**A part is a role on an element, not a kind of element.** meta is carried by nine different tags, item by five. One element computes its part from state: `:data-part="sessionLabel(row) ? 'meta' : 'title'"` (`lib/alpineComponents/estate.js:2203`). The codebook's alternates rule is the same fact.

**The anatomy has three carriers, and nesting does not always say which.** An anatomy part sits on an item, on a group, or in the detail, which is the item drawn again in full: the errands detail carries title, meta, summary, body, links and actions (`stage.js:1436` to `1491`). Group-owned parts sit inside the heading element in 22 cases and beside it in 5 (for example `pages/news/news.html:402` and `403`, `lib/alpineComponents/map.js:5542`), where their nearest part ancestor is the list. So `instances.csv` counts such as "meta 268" mix item, group and detail marks, and the owner is a property of the instance, not of the part.

**A group reads as a reduced item.** Its heading stands for a title, its run of items stands for a body, and it may carry the other four anatomy parts. One group heading is itself selectable with `aria-current` (`lib/alpineComponents/powershell-outpost-view.js:385`). This is inference.

## How full the item is drawn varies by code

The same anatomy is filled to a different depth under each code, which fits the extent scale: where a detail exists, the item stays thin.

| Part | list (20 units) | card-grid (11) | list-detail (6) |
| --- | --- | --- | --- |
| title | 19 | 11 | 6 |
| meta | 18 | 8 | 6 |
| summary | 15 | 10 | 1 |
| actions | 11 | 5 | 2 |
| links | 7 | 8 | 0 |
| body | 4 | 9 | 0 |

## Loose ends seen in markup

- Three marks use names outside the ten: `head` (`map.js:2580`, a column-heading row inside a list part), `response` (`map.js:3938`, a status chip, which the vocabulary calls meta) and `lanes` (`lib/alpineComponents/traffic-view.js:117`).
- One `detail` sits inside an item under a pattern declared `list` (`map.js:5254`), against every other detail.
- A control that opens the item itself at another address is marked both ways. All 8 anchors marked `actions` do this (seven in `map.js`, for example `map.js:2269` "Open on GitHub", and `lib/alpineComponents/estate.js:2609`). The same kind of control is `links` at `lib/alpineComponents/tools.js:97` ("Source on GitHub"), `estate.js:1164` (a repo's GitHub links) and `lib/alpineComponents/proposals.js:197` (a proposal's own record).

## What is derivable and what would need authoring

Requirement is already in `codes-body.csv`. Multiplicity and the per-code depth table fall out of `instances.csv`. Level, function, group eligibility, extent and the variant lists exist only as wording in glosses and codebook prose, so they would have to be authored as columns of `parts.csv` if anything is to read them.
