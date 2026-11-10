# The parts test: do the ten parts have regular dimensions

A record of one test, run on 2026-11-10 in session [3a3fd776](https://mehrlander.github.io/web-tools/pages/session.html#id=3a3fd776), for whoever decides what [`parts.csv`](../../../data/ui-units/parts.csv) should hold. It continues the [category-mapping account](../README.md), which put the same general question to two families of words in October, in session [5ff9f92b](https://mehrlander.github.io/web-tools/pages/session.html#id=5ff9f92b).

**What it found.** Two agents working apart, called Reader C and Reader M below, reported the same six regularities among the ten parts; the section "What both readers reported" lists them. The two readers differed on which of the six are properties of a part by itself: Reader C kept all six as columns, and Reader M kept three (level, count per owner, families) and treated the others as rules about a part and its owner or pattern, or as the definitions restated. The five properties that session [698af169](https://mehrlander.github.io/web-tools/pages/session.html#id=698af169) had proposed cover three of the six and touch a fourth, and they give list and detail the same values, and item and group the same values.

## The question

`parts.csv` names the ten parts that a page's markup can mark with `data-part` inside a pattern: list, item, group, detail, title, meta, summary, body, links and actions, each with a one-line definition. A pattern here is a named arrangement of a page's main region, such as `list-detail`; the [codebook](../../../data/ui-units/codebook.md) defines both.

In session [698af169](https://mehrlander.github.io/web-tools/pages/session.html#id=698af169) ([web-tools#1267](https://github.com/mehrlander/web-tools/pull/1267)) the owner asked whether parts "have any regular dimensions that we can categorize". Session [698af169](https://mehrlander.github.io/web-tools/pages/session.html#id=698af169) proposed five properties from its own reading of the codebook:

| Property | Values session 698af169 gave |
| --- | --- |
| Level | structure (list, item, group, detail) or an item's own content (the other six) |
| Sits inside | the pattern, the list, an item, or a group |
| How many per parent | exactly one (list, detail), at most one (title), any number (item, group, meta) |
| What it holds | a name, a fact, a sentence, content, links away, or controls |
| What the reader does with it | reads it, leaves by it, or acts through it |

Session [698af169](https://mehrlander.github.io/web-tools/pages/session.html#id=698af169) added that whether a pattern requires a part, and what the pattern promises about it, belong to the part's place in a pattern. It said that only the first two rows are stated in the codebook and that no second reader had checked any of the five.

## What was run

Session [3a3fd776](https://mehrlander.github.io/web-tools/pages/session.html#id=3a3fd776) started two agents on the question. Neither saw the other's work, the five properties or this folder. Each had `parts.csv`, the codebook, the `body` rows of [`codes.csv`](../../../data/ui-units/codes.csv) and [`instances.csv`](../../../data/ui-units/instances.csv) as they stood at commit `0967d7d97b44`, and could read the markup that carries `data-part` under `lib/` and `pages/`.

| | Reader C | Reader M |
| --- | --- | --- |
| Given | the owner's question and an output shape ([prompt](prompt-c.md)) | a six-step procedure: split each definition, compare parts three at a time, code a table with a source for each cell, apply seven named tests, list the pairs left with identical values, give a verdict ([prompt](prompt-m.md)) |
| Result | eight properties, all kept ([reader-c.md](reader-c.md)) | sixteen candidates; four kept (level, basis, count per owner, families), twelve dropped, and four rules ([reader-m.md](reader-m.md)) |
| Cost | 39 tool calls, about 209,000 tokens, 8 minutes | 23 tool calls, about 213,000 tokens, 11 minutes |

Session [3a3fd776](https://mehrlander.github.io/web-tools/pages/session.html#id=3a3fd776) then ran [`separation-checks.py`](https://github.com/mehrlander/web-tools/blob/07357db10b676337a40298a0f927116317a41634/skills/cat-map/separation-checks.py), the script of the `cat-map` skill withdrawn on 2026-10-25, on three tables: the five properties as session [698af169](https://mehrlander.github.io/web-tools/pages/session.html#id=698af169) stated them ([session-five.csv](session-five.csv), with `unstated` where it gave no value), Reader C's eight ([reader-c.csv](reader-c.csv)) and Reader M's kept four ([reader-m-kept.csv](reader-m-kept.csv)). The output is [checks.txt](checks.txt).

## What both readers reported

1. **A level with three values.** A part sits directly in the pattern (list, detail), in the list (item, group), or in an item's anatomy (title, meta, summary, body, links, actions).
2. **A count per owner.** One for list, detail, title and summary; any number for item, group, meta, body, links and actions. Both readers took the counts from [`instances.csv`](../../../data/ui-units/instances.csv).
3. **What a group may carry.** Meta, summary, links and actions, and not title or body, from the codebook's sentence on groups and from markup.
4. **A size.** One fact, a name, a line or two, the item's own content, the item in full.
5. **Families.** The definitions of meta, body and links each list several kinds; the other seven name one.
6. **Requirement and the behavior a pattern promises.** List and item are required, detail only under `list-detail`, the other seven optional. The codebook's promise for `list-detail` is that picking an item redraws the detail.

The two readers treated the six differently. Reader C kept each as a column of a part, added a function, meaning what a part does (contain other parts, divide the list, describe its owner, lead elsewhere, or act on its owner), and noted that requirement is already in `codes.csv` and that the count can be derived from `instances.csv`. Reader M kept level, the count, families and a basis (place, content, function), and judged level and basis to be nested, which leaves about two independent dimensions. Reader M moved the other regularities out of the part's own row:

- a **nesting rule**: which part may sit inside which;
- an **ownership rule**: which of the six anatomy parts an item, a group or a detail may carry;
- a **count rule** for each pattern and owner, with requirement as its lower bound and the count per owner as its upper;
- the **promised behavior**, which belongs to the pattern `list-detail`.

Reader M dropped the size because it gives each part a value of its own, which restates the definitions.

## The five properties against the two readings

The checks reported two kinds of finding on the five properties. List and detail have identical values on all five, as do item and group. Level follows from "sits inside", and "what the reader does with it" follows from "what it holds". On Reader C's eight the checks reported nothing. On Reader M's kept four they reported four pairs with identical values, which Reader M had listed.

| Property of session 698af169 | In the two readings |
| --- | --- |
| Level, two values | Three values in both. Reader M's two-valued candidate was dropped as following from the three-valued one. |
| Sits inside | The same three levels. Read from markup, where a part sits takes several values on eight parts, and a detail also carries title, meta, summary and links ([`stage.js:1436`](https://github.com/mehrlander/web-tools/blob/0967d7d97b44a1e5a90c0e9612ad033574a7ba5f/lib/alpineComponents/stage.js#L1436)), which the values of session 698af169 leave out. |
| How many per parent | Reported by both and completed by measurement: one for summary; more than one for body, links and actions. |
| What it holds | The size. Reader C kept it and marked it as inference; Reader M dropped it. |
| What the reader does with it | Reader C's function, whose lead and act values Reader C called its least firm. Reader M's candidate was dropped as taking several values on six parts. |

The five properties name a group as one place a part may sit without saying which parts a group may carry, and they leave out the families.

## What the readers found in the files

Session [3a3fd776](https://mehrlander.github.io/web-tools/pages/session.html#id=3a3fd776) read each cited line at commit `0967d7d97b44`.

- `parts.csv` defines summary as "a line or two describing the item"; the codebook lets a group carry a summary, and markup has group summaries.
- Three `data-part` values are outside the ten: `head` ([`map.js:2580`](https://github.com/mehrlander/web-tools/blob/0967d7d97b44a1e5a90c0e9612ad033574a7ba5f/lib/alpineComponents/map.js#L2580)), `response` ([`map.js:3938`](https://github.com/mehrlander/web-tools/blob/0967d7d97b44a1e5a90c0e9612ad033574a7ba5f/lib/alpineComponents/map.js#L3938)) and `lanes` ([`traffic-view.js:117`](https://github.com/mehrlander/web-tools/blob/0967d7d97b44a1e5a90c0e9612ad033574a7ba5f/lib/alpineComponents/traffic-view.js#L117)).
- One `detail` sits inside an item under a pattern declared `list` ([`map.js:5254`](https://github.com/mehrlander/web-tools/blob/0967d7d97b44a1e5a90c0e9612ad033574a7ba5f/lib/alpineComponents/map.js#L5254)).
- A control that opens the item on GitHub is marked `actions` in the Map ([`map.js:2269`](https://github.com/mehrlander/web-tools/blob/0967d7d97b44a1e5a90c0e9612ad033574a7ba5f/lib/alpineComponents/map.js#L2269)) and `links` in the Tools view ([`tools.js:97`](https://github.com/mehrlander/web-tools/blob/0967d7d97b44a1e5a90c0e9612ad033574a7ba5f/lib/alpineComponents/tools.js#L97)).
- The codebook says which parts an item and a group may carry and is silent on a detail, which carries the anatomy parts in markup.
- One element chooses its part from data, meta or title ([`estate.js:2203`](https://github.com/mehrlander/web-tools/blob/0967d7d97b44a1e5a90c0e9612ad033574a7ba5f/lib/alpineComponents/estate.js#L2203)).

## What the sources say

Session [698af169](https://mehrlander.github.io/web-tools/pages/session.html#id=698af169) named six terms to verify. Each was checked on 2026-11-10 as the table says. The October account's [survey of methods](https://github.com/mehrlander/web-tools/blob/07357db10b676337a40298a0f927116317a41634/research/category-mapping/README.md#methods) covers the classification methods themselves.

| Term | What the source says | Read in |
| --- | --- | --- |
| Facet, faceted classification | Vickery, 1960: "the sorting of terms in a given field of knowledge into homogeneous, mutually exclusive facets". On how facets are found: "it is however, still unclear whether categories are discovered or constructed and how, precisely, they are identified, and how their identification can be verified by other scholars." | Hjørland, [Facet analysis](https://www.isko.org/cyclo/facet_analysis), ISKO encyclopedia |
| A procedure for facets | Seven steps, after Vickery and Spiteri. The third: "see what general, high-level categories appear across all the entities". A hierarchy, a tree or a two-way table is preferred wherever one works, and facets serve three or more dimensions. | Denton, [How to Make a Faceted Classification and Put It On the Web](https://www.miskatonic.org/library/facet-web-howto.html), 2003 |
| Characteristic of division | Toohey's four rules: the members are mutually exclusive, together co-extensive with the class, divided on one basis, and proximate. | Frické, [Logical division](https://www.isko.org/cyclo/logical_division), ISKO encyclopedia |
| Genus and differentia | Aristotle defines a species by a genus and a difference, and allows division as a way to discover definitions. | Frické, Logical division |
| Partonomy against taxonomy | Toohey separates logical division, "the resolution of a class into the subclasses that compose it", from physical division, "the resolution of an individual thing into the physical parts which compose it". | Frické, Logical division; the words partonomy and meronomy only in search summaries of Tversky and Hemenway, 1984 |
| WAI-ARIA role definitions | Each role has a Required Context Role and Required Owned Elements; each "does not imply the reverse relationship", and of several owned roles "at least one instance of one required owned element is expected". The role taxonomy is a separate section. HTML gives each element its contexts and a content model, where the count sits on the owner: for `ul`, "Zero or more li and script-supporting elements". | [WAI-ARIA 1.2](https://www.w3.org/TR/wai-aria-1.2/), section 5.2; [HTML, element definitions](https://html.spec.whatwg.org/multipage/dom.html#element-definitions) |
| Slot and filler | Not read in a source. Search summaries describe Minsky's 1974 slots, and say that frame systems such as Protégé use "facet" for a property of a slot, such as its cardinality, which is a second sense of the word. | search results only |

## What this does not show

- **Whether the procedure helped.** One agent took each approach, and a second run of either would differ. The two readings also differ in more than the procedure. The comparison supports no claim that the procedure did better than the question alone.
- **An unbiased procedure.** Session [3a3fd776](https://mehrlander.github.io/web-tools/pages/session.html#id=3a3fd776) wrote the procedure after seeing the five properties, and its test for a value that depends on a part's owner points toward the conclusion Reader M reached.
- **Exact counts of markup.** Each reader counted markup with its own tag scan, approximate where a template is assembled from function calls, and each says so.
- **The five properties as their author would code them.** [`session-five.csv`](session-five.csv) is the coding of session [3a3fd776](https://mehrlander.github.io/web-tools/pages/session.html#id=3a3fd776); session [698af169](https://mehrlander.github.io/web-tools/pages/session.html#id=698af169) gave values for some parts only.
- **A decision.** Adopting any column of these tables is the owner's call.
