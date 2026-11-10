# Reader M: do the ten parts have regular dimensions?

Sources read: `parts.csv`, `codebook.md`, `codes-body.csv`, `instances.csv`, and the
markup carrying `data-part=` under `/home/user/web-tools/lib` and
`/home/user/web-tools/pages` (492 lines in 17 files). Markup citations are
relative to `/home/user/web-tools`. Nothing else was opened.

Two counts recur below.

- **Instance counts** come from the `parts` column of `instances.csv`: 37 units
  have counts (20 coded `list`, 11 `card-grid`, 6 `list-detail`).
- **Nesting counts** come from a tag scan I ran over the 17 files: for each
  element with `data-part`, the nearest enclosing element with `data-part`.
  The scan is approximate where a template is assembled from function calls
  (those elements show no ancestor), so every `file:line` cited here was also
  read directly.

Short answer: three characteristics hold on all ten parts with one grounded
value each (Level, Basis, Per owner) and a fourth holds weakly (Kinds). Together
they give six distinct profiles for ten parts and leave four pairs unseparated.
Level and Basis are nested rather than crossed, so they amount to one four-class
taxonomy. What tells neighbouring parts apart inside a class is in every case
either a relation (owner by part, code by part, part inside part) or a
difference that belongs to one definition only.

## Definitions split

| Part | Kind of thing the definition says it is | Words that set it apart | Nearest neighbours |
| --- | --- | --- | --- |
| list | an element | "that holds the items" | detail (the other region of the arrangement), item (what it holds) |
| item | an entry | "one entry of the list" | group (the other thing found in the list), detail (the same item shown in full) |
| group | a heading | "of an item group: a run of the list's own items set apart under it, with its own count or sentence" | item, title (a title names one item, a group heading names a run) |
| detail | a card | "that shows one item in full" | item (shows it in brief), body (fuller content kept inside the item), list |
| title | a name | "an item's" | group, meta, summary |
| meta | a fact: "code, count, amount, date, kind or status" | "an item's or a group's"; codebook: "any one fact about the item", "marked on the smallest element that holds only such facts" | title, summary |
| summary | a line or two of text | "describing the item" | title (shorter), body ("beyond its summary"), meta |
| body | content | "the item's own content shown inside it"; codebook: "beyond its summary" | summary, detail |
| links | links | "from the item or group to other things"; codebook: "lead elsewhere" | actions |
| actions | controls | "that act on the item or group"; codebook: "act on the item itself" | links |

Three things show up already. Four definitions name a place in the arrangement
(element, entry, heading, card), four name what is held (name, fact, line,
content), and two name what the thing does (links, controls). Three definitions
(meta, body, links) are written as a list of kinds. Four definitions (group,
meta, links, actions) mention a group; the other anatomy definitions mention
only the item.

## Triads

Sixteen triads. Appearances: list 4, item 5, group 5, detail 5, title 5, meta 5,
summary 5, body 6, links 4, actions 4.

| # | Triad | Two alike, one different | Candidate characteristic |
| --- | --- | --- | --- |
| 1 | list, detail, item | list and detail are single regions sitting directly in the arrangement; item is repeated inside the list | **Per owner**: how many can one owner show at once? one / many. **Tier**: is it a piece of the arrangement or a piece of an entry's anatomy? structure / anatomy |
| 2 | item, group, list | item and group are found in the list; list is what they are found in | **Level**: what is it directly a part of? arrangement / list / entry |
| 3 | list, item, group | list and item are required; group is marked `?` | **Required**: must a unit declaring a code that lists it have one? required / optional |
| 4 | item, detail, group | item and detail each present exactly one item; group stands for a run | **Scope**: how many of the list's items does one element concern? all / run / one |
| 5 | title, summary, meta | title and summary occur once per item; meta occurs many times | Per owner again. Also meta and summary may be a group's and title may not: **Group may carry**: may a group carry one, as an item may? yes / no |
| 6 | title, summary, body | title and summary say something about the item; body is the item's own substance | **About or of**: does it describe the item or is it the item's content? describes / is content |
| 7 | meta, summary, body | ordered by size: one fact, a line or two, a block | **Extent**: how much of an item does one element show? name / one fact / a line or two / own content / in full |
| 8 | links, actions, body | links and actions are defined by what they do; body by what it holds | **Basis**: what does the definition turn on? place / content / function |
| 9 | links, actions, meta | links and actions are pressed; meta is read | **Is a control**: is the marked element itself something the reader presses? yes / no |
| 10 | title, links, actions | a title that is a link and a link both take the reader away; an action works on the item | **Effect**: where does using it take effect? none / elsewhere / on the item / pick |
| 11 | list, detail, body | detail and body both give more of one item, one outside the item and one inside; list holds many | **Sits in**: inside which part's element is it found? (a list of parts) |
| 12 | item, detail, title | item and detail are containers for the anatomy parts; title is contained | **Holds parts**: may another part sit inside its element? yes / no |
| 13 | summary, actions, group | summary and actions are carried by an item or group; group is a carrier | Group may carry and Holds parts again |
| 14 | list, group, links | list and group concern several items; links concern one item or one group | Scope again |
| 15 | meta, body, item | meta and body are each defined as a list of kinds; item is one kind | **Kinds**: does the definition name one kind of thing or a family of kinds? single / family |
| 16 | summary, body, detail | three steps of showing more of one item; each has its own verb | Extent again. **Role**: what does it do for what it refers to? one verb per part |

One more candidate came from reading the `parts` cells in step 3 rather than
from a triad: **Codes**: which codes' `parts` cells list it? all three /
list-detail only.

## The table

`n/a` means the question does not apply. `;` joins values where the sources
allow several.

| Part | Tier | Level | Basis | Per owner | Required | Codes | Scope | Group may carry | Extent | About or of | Effect | Is a control | Holds parts | Sits in | Kinds | Role |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| list | structure | arrangement | place | one | required | all three | all | n/a | n/a | n/a | none | no | yes | none | single | holds |
| item | structure | list | place | many | required | all three | one | n/a | n/a | n/a | none;pick | no;yes | yes | list | single | is an entry |
| group | structure | list | place | many | optional | all three | run | n/a | n/a | n/a | none;pick | no;yes | yes | list | single | heads |
| detail | structure | arrangement | place | one | required | list-detail only | one | n/a | in full | n/a | none | no | yes | none;item | single | shows in full |
| title | anatomy | entry | content | one | optional | all three | one | no | name | describes | none;elsewhere | no;yes | yes | item;detail | single | names |
| meta | anatomy | entry | content | many | optional | all three | one;run | yes | one fact | describes | none;elsewhere | no;yes | no;yes | item;group;detail;list;body;actions | family | states a fact |
| summary | anatomy | entry | content | one | optional | all three | one;run | yes | a line or two | describes | none | no | no | item;group;detail;list | single | describes |
| body | anatomy | entry | content | many | optional | all three | one | no | own content | is content | none | no | yes | item;detail | family | is the content |
| links | anatomy | entry | function | many | optional | all three | one;run | yes | n/a | n/a | elsewhere;on the list | yes;no | no | item;group;body;actions;meta | family | lead away |
| actions | anatomy | entry | function | many | optional | all three | one;run | yes | n/a | n/a | on the item;elsewhere | yes;no | yes | item;group;detail;body | single | act on |

## Evidence for non-obvious cells

**Tier.** Codebook: "An item's anatomy is title, meta, summary, body, links and
actions". The other four are what that anatomy hangs on.

**Level.**
- list, arrangement: "the element that holds the items". In the scan, 51 of 52
  `list` elements have no part above them, and 36 share an element with
  `data-pattern` (`lib/alpineComponents/tools.js:66`); the rest sit just below
  it (`pages/shortcut-log.html:120` and `:123`). The one list found inside an
  item is a nested pattern with its own `data-pattern`
  (`lib/alpineComponents/estate.js:2833`, inside the item at `:2043`), which the
  codebook allows: "An item may hold a declared pattern of its own".
- detail, arrangement: `codes-body.csv` list-detail gloss, "a list and one
  item's card, side by side or stacked". In markup it is a sibling of the list
  under the pattern element (`pages/shortcut-log.html:123` and `:164`;
  `lib/alpineComponents/stage.js:1418` and `:1436`).
- item, list: "one entry of the list"; 56 of 59 `item` elements have `list` as
  nearest part.
- group, list: "a run of the list's own items set apart under it"; 20 of 24
  `group` elements have `list` as nearest part, none is inside an item, and no
  item is inside a group element (0 of 59). The group part is the heading only;
  the run itself has no element.
- the six anatomy parts, entry: `parts.csv` glosses ("an item's", "an item's or
  a group's", "from the item or group", "act on the item or group").

**Basis.** Read from the kind word of each gloss (see Definitions split).
- group is the one judgment call: a "heading" is also the run's name, and in
  markup the element carries the run's label as its text
  (`pages/news/news.html:402`, `pages/links.html:325`). I coded `place` because
  the gloss turns on "set apart under it".
- links, function: codebook, "`links` lead elsewhere".
- actions, function: codebook, "where `actions` act on the item itself".

**Per owner.**
- list, one: `list 1` in 37 of 37 units.
- detail, one: `detail 1` in 6 of 6 list-detail units; `codes-body.csv` test,
  "the card shows exactly one item of the list". Two elements may exist as
  alternates: "a detail drawn as a parsed panel or as the source sheet".
- item, many: counts run from 1 to 2770.
- group, many: 1 to 20 in the 17 units that have groups.
- title, one: title equals item in 35 of 36 units. The exception is
  `view/stage/errands` (title 4, item 3), where the fourth is the detail card's
  own title (`lib/alpineComponents/stage.js:1439`). Title never exceeds item
  plus group plus detail (36 of 36). Two title elements in one item are
  alternates (`lib/alpineComponents/map.js:6143` and `:6146`), as the codebook
  says: "a title that is a link or plain text".
- summary, one: summary never exceeds item plus group plus detail (26 of 26).
  Where it exceeds item, the excess is the group count: `map/distribution`
  101 = 96 + 5, `map/registries` 48 = 46 + 2, `map/tests` 391 = 386 + 5.
- meta, many: meta exceeds item plus group plus detail in 29 of 32 units
  (`map/data` 268 against 63 items).
- body, many: body exceeds item in 7 of 13 units (`map/registries` 184 against
  46); seven body elements in one item at
  `lib/alpineComponents/proposals.js:91` to `:165`.
- links, many: exceeds item in 3 of 15 units (`map/registries` 82 against 46);
  six in one card at `lib/alpineComponents/estate.js:1164` to `:1306`.
- actions, many: `view/sessions` 8 against 6 items; two in one item at
  `lib/alpineComponents/map.js:3377` and `:3380`; two in one detail at
  `lib/alpineComponents/stage.js:1466` and `:1491`. This is the thinnest
  "many": 14 of 18 units have exactly one per item.

**Required.** `codes-body.csv` `parts` cells. `list` and `card-grid`:
`list;item;group?;title?;meta?;summary?;body?;links?;actions?`. `list-detail`:
`list;item;detail;group?;title?;meta?;summary?;body?;links?;actions?`. Instances
agree: list and item in 37 of 37 units, detail in 6 of 6 list-detail units and
0 of 31 others.

**Codes.** Same cells: detail appears only in the list-detail cell.

**Scope.**
- detail, one: "the card that shows one item in full".
- summary, one;run: `parts.csv` says "describing the item", but the codebook
  says "A `group` may carry its own `meta`, `summary`, `links` and `actions`",
  and a group's summary exists in markup (`lib/alpineComponents/map.js:3363`).
- meta, links, actions, one;run: their glosses name "item or group".

**Group may carry.**
- title, no: "an item's name"; the codebook's group sentence omits title; 0 of
  52 title elements sit in a group.
- body, no: "the item's own content shown inside it"; omitted from the group
  sentence; 0 of 31 body elements sit in a group.
- meta, yes: `lib/alpineComponents/map.js:2243`, `pages/news/news.html:403`.
- summary, yes: codebook sentence above; `lib/alpineComponents/map.js:3363`,
  `lib/alpineComponents/state-view.js:1194`. `parts.csv` alone would say no.
- links, yes: `lib/alpineComponents/map.js:5537`.
- actions, yes: `lib/alpineComponents/estate.js:1132`,
  `lib/alpineComponents/map.js:5826`; codebook example, a "show more".

**Extent.** `parts.csv` and codebook wording: "name"; "any one fact"; "a line or
two"; "the item's own content beyond its summary"; "in full". In markup a meta
element does not always hold one fact: three joined in one at
`lib/alpineComponents/map.js:5378` to `:5380`, four in a row at
`lib/alpineComponents/tending.js:61` to `:69`.

**About or of.** Codebook: "`body` is the item's own content beyond its
summary"; title, meta and summary are a name, facts and a description of it.

**Effect.**
- item, none;pick: the list-detail promise, "picking an unselected item changes
  (or first shows) the detail and moves the selection to it". Under `list` no
  such promise exists; items are plain there
  (`lib/alpineComponents/tending.js:55`) or pressed
  (`pages/shortcut-edit.html:60`).
- group, none;pick: 23 of 24 are plain; one is an anchor that selects a
  resource (`lib/alpineComponents/powershell-outpost-view.js:385`).
- title, none;elsewhere: `lib/alpineComponents/map.js:6143` (button) and
  `:6146` (plain text).
- meta, none;elsewhere: a meta that opens a card
  (`lib/alpineComponents/estate.js:2511`), a meta that is an anchor
  (`lib/alpineComponents/map.js:6176`).
- links, elsewhere;on the list: `parts.csv` counts "tags that filter the list"
  as links, and a filter works on the list in place.
- actions, on the item;elsewhere: "Open on GitHub" anchors are marked `actions`
  (`lib/alpineComponents/map.js:2269`, `:5262`).

**Is a control.** Scan of the marked element itself (an `a`, a `button`, or a
click handler): list 0 of 52, item 10 of 59, group 1 of 24, detail 0 of 8,
title 16 of 52, meta 9 of 164, summary 0 of 33, body 0 of 31, links 29 of 38,
actions 16 of 25. The links and actions elements that are not controls are rows
that hold them (`lib/alpineComponents/tending.js:95`, `:148`).

**Holds parts.**
- list, item: by definition.
- group, yes: meta and summary inside the heading element
  (`lib/alpineComponents/map.js:3359` to `:3363`). A group's parts also sit
  beside the heading, not inside it (`pages/news/news.html:402` and `:403`;
  `lib/alpineComponents/map.js:2241` and `:2245`).
- detail, yes: title, meta, summary, body, links and actions inside one detail
  (`lib/alpineComponents/stage.js:1436` to `:1491`). The codebook does not
  state this.
- title, yes: codebook only, "a date inside a title". No instance in the 492
  lines.
- meta, no;yes: codebook, "the smallest element that holds only such facts";
  against it, a link inside a meta row
  (`lib/alpineComponents/stage.js:1444` and `:1451`).
- body, yes: links and meta inside (`pages/text-lab.html:1258`, `:1280`,
  `:1284`); actions inside (`lib/alpineComponents/tools.js:69` and `:83`).
- actions, yes: codebook, "a link inside an actions row";
  `lib/alpineComponents/proposals.js:192` and `:193`.
- summary, links, no: nothing is nested in either in the 492 lines. No source
  states a rule, so these two cells rest on absence only.

**Sits in.** Nearest part above, from the scan: title in item 49 and detail 1;
meta in item 139, group 14, detail 5, list 2, body 2, actions 1; summary in
item 23, group 5, list 3, detail 1; body in item 25 and detail 1; links in
item 28, body 4, actions 3, group 1, meta 1; actions in item 18, group 2,
detail 2, body 1. "list" for meta and summary is a group's part placed beside
its heading. detail in item is one stray use under a `list` pattern, whose
`parts` cell does not list detail (`lib/alpineComponents/map.js:5254`).

**Kinds.** `parts.csv` wording only. meta: "code, count, amount, date, kind or
status". body: "a diff, a script, a small chart, a panel it expands in place".
links: "tags that filter the list, doors to other views, related documents".
The other seven glosses name one thing.

**Role.** The verb of each gloss or the nearest one to it.

Other markup facts that bear on the tests:
- One element's part is chosen by its data: `:data-part="sessionLabel(row) ?
  'meta' : 'title'"` (`lib/alpineComponents/estate.js:2203`).
- Three `data-part` values are outside the ten: `head`
  (`lib/alpineComponents/map.js:2580`), `response`
  (`lib/alpineComponents/map.js:3938`), `lanes`
  (`lib/alpineComponents/traffic-view.js:117`).
- A button is marked `links` (`lib/alpineComponents/map.js:2272`) and an anchor
  `actions` (`lib/alpineComponents/map.js:2269`), so the tag does not decide
  between the two.

## Tests

"Fixed by another" is judged against characteristics that are not themselves
one value per part, since those would fix everything.

| Characteristic | constant | fixed by another | one value per part | narrow range | not single-valued | no evidence | belongs to a relation | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Tier | no | **yes**: Level (arrangement, list give structure; entry gives anatomy), and Basis likewise | no | no | no | no | no | drop |
| Level | no | no | no | no | no | no | no | keep |
| Basis | no | no | no | no | no | no | no | keep |
| Per owner | no | no | no | no | no | no | no | keep |
| Required | no | no | no | no | no | no | **yes** | drop as a part characteristic |
| Codes | no, but nine parts share one value | no | no | no | no | no | **yes** | drop |
| Scope | no | no | no | no | **yes**: meta, summary, links, actions | no | **yes** | drop |
| Group may carry | no | no | no | **yes**: title, meta, summary, body, links, actions | no | no | **yes** | drop as a part characteristic |
| Extent | no | no | **yes**: five values on five parts | **yes**: title, meta, summary, body, detail | no | no | no | drop |
| About or of | no | **yes**: Extent (own content gives is content) | no | **yes**: title, meta, summary, body | no | no | no | drop |
| Effect | no | no | no | no | **yes**: item, group, title, meta, links, actions | no | **yes** | drop |
| Is a control | no | no | no | no | **yes**: item, group, title, meta, links, actions | no | no | drop |
| Holds parts | no | no | no | no | **yes**: meta | **partly**: summary and links rest on absence; title on the codebook with no instance | **yes** | drop |
| Sits in | no | no | no | no | **yes**: eight parts | no | **yes** | drop |
| Kinds | no | no | no | no | no | no | no | keep, weakly |
| Role | no | no | **yes** | no | no | no | no | drop |

Notes on the results that are not self-evident.

- **Level** passes every test as worded: each part has one level, the same in
  all three codes. It is not independent of the nesting rule, though. It is the
  rank a part holds in that rule (arrangement, then list, then entry). If the
  rule is written down, Level follows from it.
- **Level and Basis are nested, not crossed.** Only four of their nine
  combinations occur: arrangement and place (list, detail), list and place
  (item, group), entry and content (title, meta, summary, body), entry and
  function (links, actions). Each adds one split to Tier, and each split divides
  only one branch: Level divides the structure parts, Basis divides the anatomy
  parts. Read together they are one classification with four classes.
- **Basis** has one judged cell (group). If group is coded `place;content`,
  Basis fails *not single-valued* on that part.
- **Per owner** passes as worded: the value is the same under every owner and
  code seen (title is one per item and one per detail; summary is one per item,
  per group and per detail; meta is many under each). It is a count bound, and
  "owner" differs by part (the arrangement for list and detail, the list for
  item and group, an item, group or detail for the six). Among the structure
  parts it repeats Level (arrangement gives one, list gives many); it adds
  information only among the content parts.
- **Required** is single-valued for the nine parts listed in all three codes,
  but the source writes it per code ("required ones first and optional ones
  marked `?`"), and detail's status changes with the code: required in
  list-detail, absent from the other two. Two of the three cells are also
  identical ("A card grid's parts are a list's"), so the claim that it does not
  vary by code rests on two distinct cells. It is also the lower bound of the
  same count whose upper bound is Per owner.
- **Codes** is the code by part table read along a row, and it does one thing:
  it marks detail.
- **Scope** takes two values on exactly the four parts a group may carry, and
  there its value follows the owner. Its single-valued remainder is Group may
  carry.
- **Group may carry** is single-valued on its six parts and separates two
  otherwise unseparated pairs, but it is one row of an owner by part allowance
  (what a group may carry, beside what an item may carry and what a detail was
  seen to carry). It has the same form as a code's `parts` cell. The sources
  disagree on one cell: `parts.csv` gives summary to the item only.
- **Effect** depends on the code for item (a pick is promised only under
  list-detail) and is mixed in markup for five other parts. Between links and
  actions it restates the two definitions, and the markup does not hold even
  that line (anchors to GitHub marked `actions`, filter tags counted as links).
- **Is a control** is a fact about an element, not about a part.
- **Kinds** passes every test, but its only evidence is the wording of three
  glosses. A gloss for actions that listed "run, copy, show more" would flip
  its cell without anything else changing.

## Unseparated pairs

Profiles on the four kept characteristics (Level, Basis, Per owner, Kinds):

| Profile | Parts |
| --- | --- |
| arrangement, place, one, single | list, detail |
| list, place, many, single | item, group |
| entry, content, one, single | title, summary |
| entry, content, many, family | meta, body |
| entry, function, many, family | links |
| entry, function, many, single | actions |

Four pairs are unseparated.

| Pair | What does separate them |
| --- | --- |
| list, detail | Scope (all the items against exactly one). Codes (all three against list-detail only). Extent (detail shows "in full"). The list-detail promise, which is about the pattern: a pick redraws the detail. |
| item, group | Required (item required, group optional). Scope (one against a run). The definitions: an entry against a heading. What each may carry: an item all six anatomy parts, a group four. |
| title, summary | Group may carry (summary yes, title no). Extent (a name against a line or two). |
| meta, body | Group may carry (meta yes, body no). Extent (one fact against the item's own content). About or of. |

A fifth pair, links and actions, is separated by Kinds alone. Without Kinds it
is unseparated too, and what separates it is Effect (elsewhere against on the
item), which is the two definitions restated.

## Verdict

**Keep**

1. **Level**: arrangement / list / entry. All ten, one value each, grounded in
   the glosses and in nesting counts. It is the rank of the part in the nesting
   rule.
2. **Basis**: place / content / function. All ten, one value each, grounded in
   the kind word of each gloss. One judged cell (group).
3. **Per owner**: one / many. All ten, one value each, grounded in instance
   counts. It is the upper bound of a count.
4. **Kinds**: single / family. All ten, one value each, grounded in gloss
   wording only. Weakest of the four.

Level and Basis together are a four-class taxonomy (region, member, content,
control), not two crossed dimensions. So the honest count of independent
dimensions is about two: that classification and Per owner, with Kinds as a
doubtful third.

**Drop**

- Tier: fixed by another (Level, and Basis).
- Required: belongs to a relation (code by part).
- Codes: belongs to a relation; marks one part.
- Scope: not single-valued; belongs to a relation.
- Group may carry: narrow range; belongs to a relation (owner by part).
- Extent: one value per part; narrow range.
- About or of: fixed by another (Extent); narrow range.
- Effect: not single-valued; belongs to a relation for item.
- Is a control: not single-valued.
- Holds parts: not single-valued; belongs to a relation; two cells rest on
  absence.
- Sits in: not single-valued; belongs to a relation.
- Role: one value per part.

**Better described as something other than a characteristic of a part**

- **A nesting rule (part inside part).** The arrangement holds list and detail.
  The list holds items and group headings, plus a group's own parts when they
  sit beside its heading. An item holds the six anatomy parts and may hold a
  nested pattern. A detail holds the six as well (observed; the codebook does
  not say so). Inside those, a link may sit in an actions row and a date in a
  title (stated), and meta, links and actions were found inside a body, and one
  link inside a meta row (observed). Tier, Level, Holds parts and Sits in are
  all readings of this one rule.
- **An ownership rule (which owner may carry which part).** An item: all six.
  A group: meta, summary, links, actions. A detail: all six, by observation.
  Ownership is not containment for a group: its parts may sit beside the
  heading. Group may carry and Scope are rows of this rule.
- **A count rule, per code and per owner.** Minimum from the code's `parts`
  cell (list, item, and detail under list-detail are at least one; the rest may
  be zero). Maximum from Per owner (list, detail, title, summary at most one
  shown; the rest any number). Required, Codes and Per owner are its three
  faces. How often an optional part is present also varies by code (body in 9
  of 11 card-grid units, 4 of 20 list units, 0 of 6 list-detail units), which is
  a count on the same relation.
- **A behaviour promise of the pattern.** That an item can be picked and that
  the detail follows the pick is promised by list-detail, not by item or
  detail.
- **Facts about one element.** Whether it is a control, which tag carries it,
  whether it is one of two alternates, and in one case which part it is
  (`lib/alpineComponents/estate.js:2203`).
- **Single definitional differences.** Name, one fact, a line or two, own
  content, in full; elsewhere against on the item. Each tells one part from its
  neighbour and groups nothing.
