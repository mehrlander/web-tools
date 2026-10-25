# Category mapping: finding the characteristics that separate a set of things

Research for a proposed skill, working name `cat-map`, that takes a set of
things whose category names blur together and finds the characteristics that
separate them: gather the instances, find the characteristics on which they
differ, lay out each characteristic's range of values with an instance for each
value, and only then name categories from where the instances cluster.

Gathered 2026-10-22. The inquiry looks outward, at published skills and at
established classification methods, and then tests what it found on one case
inside the estate, the word "registry". The skill it led to is
[`skills/cat-map/`](../../skills/cat-map/SKILL.md), built in session
[5ff9f92b](https://mehrlander.github.io/web-tools/pages/session.html#id=5ff9f92b);
this account holds the research behind it.

## Where the question came from

In session
[007acb88](https://mehrlander.github.io/web-tools/pages/session.html#id=007acb88)
the question was what kind of collection an agent persona's dated entries
belong in: a list, a log, a stream or a tracker. The step that helped was a
table whose rows were characteristics, each with its range of values and an
estate example for each value:

| Characteristic | Values | Examples |
| --- | --- | --- |
| What one entry stands for | a thing · an event | snag, task · note, progress-log line |
| Whether an entry changes after it is written | edited in place · never edited, corrected by a later entry | to-do, snag · notes |
| Whether entries leave | kept · a window of recent entries · drained as each is promoted elsewhere | chron, notes, tasks · `chron/sweeps.md` · jot list, `chron/dump/` |
| The order a reader takes entries in | by key · by time, newest first · by due date | registries · notes, chron · to-do |

The table separated what the words had run together. "Transient" turned out to
be one value range, whether entries leave. "Stack" turned out to describe how a
view orders a collection, not how the collection is stored. The skill would make
that step repeatable, and the research below asks what already exists for it.

## What the estate already has

Eight pieces of existing work bear on the question. One is a finished
instance of the move; none states it as a method.

- **[`docs/registries.md`](../../docs/registries.md#two-questions-not-a-kind), "Two questions, not a kind".**
  The move, made once and kept. From 2026-08-09 to 2026-08-18 one `kind` column,
  with the values census, catalog and crosswalk, answered two questions at once.
  It was replaced by `membership` (computed or curated), `inherits` and `span`,
  each a characteristic with its own values, and the section says not to
  reintroduce a kind.
- **[`docs/registries.md`](../../docs/registries.md#registries-and-streams), section "Registries and streams".**
  Two collection shapes, each defined by two characteristics: a registry entry
  stands for a thing and is edited when the thing changes; a stream entry stands
  for an event and is never edited. The registries' own closed value sets, such as
  `membership` (computed or curated), live in
  [`docs/vocabularies.csv`](../../docs/vocabularies.csv), and
  [`docs/properties.csv`](../../docs/properties.csv) declares every column of
  every registry. The section's own wording is the subject of the test below.
- **[`docs/QUALIFIED-WRITING.md`](../../docs/QUALIFIED-WRITING.md) rule 2**,
  "Use standard terms for a general audience." On 2026-09-29, in session
  [7488dafa](https://mehrlander.github.io/web-tools/pages/session.html#id=7488dafa),
  a fuller draft read "When two things differ, state the characteristic that
  separates them; do not let a choice between near-synonyms (ledger, catalog,
  inventory) carry the distinction." The rule that landed is shorter, and the
  characteristic-stating clause is not in it. A category map
  is that clause turned into a procedure.
- **Three plugin skills cover neighboring steps.**
  [`concept-index`](../../skills/concept-index/SKILL.md) builds a repository's
  declared vocabulary and reports terms a text uses as though the reader knew
  them; it finds which words are in play, and its index is where a proposed name
  can be looked up for a collision with an existing term. [`atomic-decomposition`](../../skills/atomic-decomposition/SKILL.md)
  breaks prose into the claims it makes, which is how a definition's
  characteristics can be pulled out of a sentence such as registries.md's first
  one. [`outlining`](../../skills/outlining/SKILL.md) contributes a coverage
  check: walk from source to result to find what was dropped. None of the three
  finds characteristics or tests whether one separates anything.
- **home's [`projects/term-migration`](https://github.com/mehrlander/home/blob/main/projects/term-migration/README.md).**
  Its first rule is "Decide what is actually retired. Not the word: the senses."
  `register` was retired by its coined senses only, as a pattern in home's
  `tools/lint-conventions.py`, while linguistic register and the ordinary verb
  stayed. That is the step after a category map: once the senses are separated,
  each gets its own fate. Its rule 3, name our own artifact by its exact
  filename rather than a descriptive synonym, gives one answer for a sense with
  a single member.
- **[`data/ui-units/`](../../data/ui-units/README.md) and its
  [codebook](../../data/ui-units/codebook.md)**, the closest precedent. The UI
  units of the Web Tools app and the budget-drs app were coded on five dimensions, each a row of
  `dimensions.csv` carrying what it holds, the test that decides it, and whether
  a unit takes one code or several. A hand-coded pilot of seven units changed the
  codebook in three ways (one field became three; two codes split because "the
  geometry is the same and the binding is not"), and eight readers then coded
  the remaining 88 units against it. It is content analysis with a codebook.
  What it lacks for this purpose is a check that a dimension separates anything, and a line
  between examining the units and naming the codes: eleven codes that readers
  proposed while coding joined `codes.csv` at synthesis.
- **home's 2026-10-16 entry,
  [entity kinds against the classification schemes](https://github.com/mehrlander/home/blob/main/chron/2026/10/2026-10-16-entity-kinds-against-the-classification-schemes.md).**
  It covers Ranganathan's PMEST, the Classification Research Group, BFO, DOLCE
  and prototype theory, for a different question: whether a fixed list of six
  entity kinds rests on any theory. The history is not repeated here.
- **home's readings of Kleppmann and Kimball**
  ([Designing Data-Intensive Applications](https://github.com/mehrlander/home/blob/main/chron/2026/10/2026-10-11-designing-data-intensive-applications.md),
  [The Data Warehouse Toolkit](https://github.com/mehrlander/home/blob/main/projects/library/data-warehouse-toolkit/2026-10-15-the-data-warehouse-toolkit.md)).
  Each ends with a crosswalk from the estate's terms to the book's. The
  Kleppmann reading maps a registry to a "table of current state" and a stream
  to an "event log"; the Kimball reading maps a registry to a type 1 dimension
  table and a tracker task to an "accumulating snapshot". These are the
  standard terms a naming step would reach for first.

### Earlier discussions

The question has come up several times, each time for one case.

- Session [2c5c7b71](https://mehrlander.github.io/web-tools/pages/session.html#id=2c5c7b71),
  2026-08-16 to 18: which dimensions apply to documentation files, how to
  declare that a set of values is mutually exclusive and exhaustive, and "We
  want to be explicit about our distinctions." The retirement of the `kind`
  column on 2026-08-18 appears to come from it.
- Session [b11d0321](https://mehrlander.github.io/web-tools/pages/session.html#id=b11d0321),
  2026-09-05: categorizing the estate's tests "from established frameworks",
  which produced `data/checks-reading/`.
- Session [314550f5](https://mehrlander.github.io/web-tools/pages/session.html#id=314550f5),
  2026-09-09: grouping the skills, "Could have other characteristics if they
  can name a clear dimension."
- Session [c5014872](https://mehrlander.github.io/web-tools/pages/session.html#id=c5014872),
  2026-10-04 to 05: the ui-units codebook above, and the request that its
  categories read as ways of sorting one set rather than separate sets.

Chats, which open only when signed in to the account:

- [Examples and the problem of categorization](https://claude.ai/chat/14abaf51-e629-4b3e-853b-968319797bb0),
  2026-04-04: a single example underdetermines a category.
- [Hierarchical structure in Obsidian](https://claude.ai/chat/2fead8d0-5d5f-43f1-a402-fa37cdc8aced),
  2026-03-17: hierarchy found after the fact rather than decided in advance,
  "let connection density reveal clusters, then name them".
- [Managing multi-leader budget allocations](https://claude.ai/chat/3422e4ad-2553-4916-a509-e9a967196c11),
  2026-04-07: program indexes that ran together organizational home and
  funding source.

One earlier account covers the test question below directly: home's
[surveying the estate's stores](https://github.com/mehrlander/home/blob/main/chron/2026/10/2026-10-12-surveying-the-estates-stores.md),
2026-10-12, which classified every kind of store in the three repositories
against the registry and stream vocabulary of the day before.

## Agent skills that do part of this

**In the estate.** Besides the three plugin skills above, two cover a step at
one remove. [`gold-set`](../../skills/gold-set/SKILL.md) scores a classifier
against blind readers, which is the shape a second coder of an
instance-by-characteristic table would take. The review panel's
[counterexample-hunter](../../skills/agents/counterexample-hunter.md) seat
looks for the case where a stated rule fails, which is what a proposed category needs before it is adopted. The claude.ai skill catalog
for this account returned nothing for taxonomy, classification, facet, typology, card
sorting or concept map.

**In public collections.** A research agent in this session searched the
skills.sh index (about 110 queries), the claude-plugins.dev index, about 50
cloned repositories including `anthropics/skills`, `anthropics/knowledge-work-plugins`,
`obra/superpowers` and eight "awesome" lists, and read about 45 SKILL.md files.
Four of the quotations below were rechecked word for word against the raw
files (cva-analysis, schema-induction, defining-concepts, codebook-validate).

| Skill | What it covers | Its mechanism | Its guard against a characteristic that separates nothing |
| --- | --- | --- | --- |
| [cva-analysis](https://github.com/rjmurillo/ai-agents/blob/main/src/codex/skills/cva-analysis/SKILL.md) | characteristics and value ranges, from software use cases | Coplien's commonality and variability analysis: one row per commonality, one cell per case | "Each variability differs in at least 2 use cases"; "An all-identical ROW is NOT a variability: remove it and hoist it to a constant" |
| [schema-induction](https://github.com/thistleknot/skills/blob/main/.skills/schema-induction/SKILL.md) | characteristics and value ranges, from structured records | each pair of instances sorts every field into SAME, VARIES or ABSENT; fields that vary become "the dimensions of meaningful difference" | a field that is SAME across all pairs is a constant; names no categories |
| [phoenix-error-analysis](https://github.com/Arize-ai/phoenix/blob/main/src/phoenix/server/mcp/skills/phoenix-error-analysis/SKILL.md) | instances to characteristics to labels, for model traces | open coding to saturation; each cluster of notes "is a candidate dimension" with two to four labels | dimensions must have "emerged from actual note text, not assumed upfront" and be "tied to a fix"; no rule drops a one-label dimension |
| [axial-coding](https://github.com/shipaleks/ux-research-pipeline/blob/main/skills/13-axial-coding/SKILL.md) and [typology](https://github.com/shipaleks/ux-research-pipeline/blob/main/skills/16-typology/SKILL.md) | the whole sequence, for interview data | codes grouped into themes and then four to eight categories; two to four types, each with markers, anti-markers and quotes | each type needs "a set of markers that other types lack" and at least two representatives |
| [codebook-construct](https://github.com/smirik/psy-qm-skills/blob/main/skills/codebook-construct/SKILL.md) and [codebook-validate](https://github.com/smirik/psy-qm-skills/blob/main/skills/codebook-validate/SKILL.md) | a codebook built from material, then piloted | inductive coding; each variable gets a value set and decision rules | flags "codes never applied (too fine); codes applied to >80% of units (too coarse)", skewed variables and codes that always co-occur |
| [defining-concepts](https://github.com/hadden-industries/agent-skills/blob/main/skills/defining-concepts/SKILL.md) | one term's senses and definition | "Treat polysemous or homonymous designations as separate candidate concepts until disambiguated"; positive, negative and near-miss instances | a "non-discriminating definition" is a critical failure; one concept at a time |
| [semantic-relations](https://github.com/jacob-balslev/skill-graph/blob/main/marketplace/skills/semantic-relations/SKILL.md) and [taxonomy-design](https://github.com/jacob-balslev/skill-graph/blob/main/marketplace/skills/taxonomy-design/SKILL.md) | a naming conflict; a taxonomy with facets | sorts a conflict into synonymy, near-synonymy, polysemy or homonymy, then picks one label, qualifies, or renames | test with real items and count duplicates and "misc"; no check that a facet splits anything |
| [scholar-conceptual](https://github.com/joshzyj/open-scholar-skill/blob/main/.claude/skills/scholar-conceptual/SKILL.md) | Lazarsfeld's property space | cross-classify two to four dimensions, name each cell, give an example per populated cell | none; empty cells are "theoretical predictions to test" |
| [think-affinity-mapping](https://github.com/product-on-purpose/thinking-framework-skills/blob/main/skills/think-affinity-mapping/SKILL.md) and [think-morphological-analysis](https://github.com/product-on-purpose/thinking-framework-skills/blob/main/skills/think-morphological-analysis/SKILL.md) | clustering before naming; a Zwicky box | KJ method; parameters with values and cross-consistency pruning | "If the field merely reproduces the preferred solution, the axes are probably arbitrary"; the box generates options rather than classifying instances |
| [term-check](https://github.com/timschoch/skilly/blob/main/bundles/workflow/skills/term-check/SKILL.md) | the naming step only | three candidate names placed in a neutral scenario, three models asked what each means | scores the guesses; a test of a name, not of a characteristic |

No public skill does the whole job: none starts from category names that blur,
gathers the instances they are applied to, finds the characteristics with an
example for each value, and only then names categories. The parts exist
separately, and five skills carry a guard worth borrowing: the constant-row
rule in cva-analysis and schema-induction, codebook-validate's never-applied
and over-80-percent counts, the marker rule in the typology skill, and
defining-concepts' requirement that each delimiting characteristic separate
the concept from a named neighbor. No public skill was found for repertory
grids, formal concept analysis or running a card sort (one analyzes a sort's
results). Collections searched without a
relevant result include `anthropics/skills`, `obra/superpowers`, and the
ComposioHQ, VoltAgent and travisvn lists.

## Methods

A second research agent checked each method against its primary text where the
text was reachable: the 1937 *Prolegomena* in full, the official preview
samples of ISO 25964-1, ISO 1087:2019 and ISO 704:2022, Ritchey's papers,
Coplien, Hoffman and Weiss, the FODA report and Collier, LaPorte and Seawright.
Quotations below come from those reads; anything taken from a secondary source
says so.

Each method is described by three things: the mechanism it would contribute, its
test for a characteristic that separates nothing or a combination that cannot
occur, and what it costs to use.

| Method | Mechanism it would contribute | Its test | Cost to use |
| --- | --- | --- | --- |
| **Faceted classification**: Ranganathan, *Prolegomena to Library Classification* (1937); Vickery, *Faceted Classification* (1960), for the Classification Research Group | Divide a universe by one characteristic at a time into arrays. A characteristic is "any attribute ... with reference to which the likeness or unlikeness of entities can be determined and at least two of them are unlike" (1937, p. 9) | Canons for characteristics (pp. 31 to 34): **differentiation**, "gives rise at least to two classes"; **concomitance**, "No two characteristics should be concomitant"; **relevance**; **ascertainability**, "should be definitely ascertainable"; **permanence**. Arrays must be exhaustive and mutually exclusive (pp. 40 to 41) | One expert, no participants. On choosing characteristics: "there can be no a priori rules ... Generally, it depends on genius" (p. 33) |
| **Property space and typology**: Lazarsfeld (1937); Barton, "The concept of property-space in social research" (1955); Bailey, *Typologies and Taxonomies* (1994); Collier, LaPorte and Seawright, "Putting typologies to work" (2012) | Cross the characteristics into a space of cells, each cell a candidate type. **Substruction** rebuilds the space behind an existing set of types: Barton recovers folkways, mores, law and custom from "how originated", "how enforced" and "strength of group feeling". Collier and colleagues name a cell type only after its row and column values are fixed | **Functional reduction** discards "all empirically null and thus unnecessary cells" (Bailey); substruction exposes types that differ on no characteristic and cells no one named | One analyst. The cell count is the product of the value counts, and case data is needed to find the null cells |
| **Morphological analysis**: Zwicky, *Discovery, Invention, Research through the Morphological Approach* (1969); Ritchey, "Problem structuring using computer-aided morphological analysis" (2006) | Parameters, each with a range of values, laid out as a box of all configurations | **Cross-consistency assessment** compares every pair of values for "(mutual) consistency", sorting contradictions into logical, empirical and normative, and judging the normative last. Ritchey: "Poorly defined parameters become immediately (and embarrassingly) evident" | Workshops of six or seven specialists over 2 to 15 days. A field of 6 to 10 parameters holds 50,000 to 5,000,000 configurations, which the assessment cuts "by up to 90 or even 99%". It generates configurations rather than starting from instances |
| **Formal concept analysis**: Wille (1982); Ganter and Wille, *Formal Concept Analysis* (1999) | A table of objects by attributes yields every pair of an object set and an attribute set that determine each other, arranged as a lattice; implications between attributes fall out | An attribute every object has, or whose extent equals the intersection of others' extents, is **reducible**: removing it leaves the lattice unchanged. Duplicate columns are removed by clarification. **Attribute exploration** asks an expert to accept each implication or supply a counterexample, which separates impossible combinations from unobserved ones | Mechanical once the table exists; many-valued characteristics need conceptual scaling into yes/no attributes; the lattice can grow exponentially |
| **Repertory grid**: Kelly, *The Psychology of Personal Constructs* (1955); Fransella, Bell and Bannister, *A Manual for Repertory Grid Technique* (2004) | **Triads**: of three elements, how are two alike and different from the third (secondary wording). Each answer is a two-pole construct. Each construct has a **range of convenience**: the elements it applies to | Every construct separates at least its own triad. A construct with no variance, or one highly correlated with another, shows in analysis | One participant per grid; new information tends to level off at about 15 to 20 constructs and a similar number of elements (secondhand). An agent can run triads over instances itself |
| **Componential analysis**: Goodenough (1956); Frake (1962); Spradley, *The Ethnographic Interview* (1979) | A **contrast set** of terms, a **paradigm worksheet** with terms as rows and **dimensions of contrast** as columns, and **contrast questions** to fill the gaps; eight steps, from selecting the contrast set to completing the paradigm | Two identical rows mean two terms not yet distinguished; a blank cell is a question to ask | Informant interviews; slow. The closest published method to the 007acb88 table |
| **Rough sets**: Pawlak, "Rough sets" (1982) and *Rough Sets* (1991); Skowron and Rauszer (1992) for the discernibility matrix | For every pair of instances, the set of attributes that separates them. A **reduct** is a minimal attribute set that separates every pair the full set separates; the **core** is what every reduct contains | A constant attribute is always dispensable; a core attribute is the only separator of some pair; an empty cell of the matrix is two instances nothing separates | Mechanical. Finding all minimal reducts is NP-hard, but a brute-force search over ten or so characteristics takes under a second |
| **Commonality and variability analysis**: Coplien, Hoffman and Weiss, "Commonality and variability in software engineering" (1998); Weiss and Lai (1999); Kang and others, the FODA report (1990) | Commonalities, variabilities, and **parameters of variation**, each with a value range; a dictionary of terms | "a variability is ... an attribute with different values for at least two elements" (Coplien and others, p. 38), which is Ranganathan's differentiation canon; FODA marks features that "cannot coexist" as mutually exclusive, and warns the rules are empirical: "a car was announced which had both types of transmission" | Domain experts |
| **Prototype theory**: Rosch, "Cognitive representations of semantic categories" (1975); Rosch and Mervis (1975); Rosch and others, "Basic objects in natural categories" (1976); Rosch, "Principles of categorization" (1978); Lakoff, *Women, Fire, and Dangerous Things* (1987) | Categories have central and borderline members, scored by family resemblance over listed attributes. Rosch (1978): "the task of category systems is to provide maximum information with the least cognitive effort" | **Cue validity**: an attribute spread equally across contrasting categories predicts none of them | Many participants giving ratings and attribute lists; an agent can approximate the listing. Its main contribution here is permission: a borderline member is expected, not a defect |
| **Card sorting**: Spencer, *Card Sorting* (2009); Tullis and Wood (2004) | Open sorts, where participants group and name cards; closed sorts into given categories; a co-occurrence matrix and hierarchical clustering | None for characteristics, since a sort records groups without reasons. A closed sort's agreement rate tests whether proposed categories hold | 15 to 30 participants (Tullis and Wood resampled 168; 5 users gave a correlation of 0.75 with the full set, 15 gave 0.90, 30 gave 0.95) |
| **Thesauri**: ISO 25964-1:2011 and ISO 25964-2:2013; ANSI/NISO Z39.19-2005, its US counterpart | A **characteristic of division**, "attribute by which a concept can be subdivided into an array of narrower concepts, each having a distinct value of that attribute" (2.4); **node labels** naming the characteristic an array was sorted by (2.38, clause 11); **homographs** (2.24) disambiguated by qualifiers (6.2); preferred and non-preferred terms; scope notes (5.2) | Each sibling needs "a distinct value" of the characteristic; every homograph and quasi-synonym gets an explicit decision. Z39.19 adds that "use of qualifiers should be avoided whenever possible" (secondhand) | One expert; the standards are paywalled |
| **Terminology work**: ISO 1087:2019; ISO 704:2022 | A concept is "a unique combination of characteristics" (1087, 3.2.7); a **delimiting characteristic** is one "used for distinguishing a concept from related concepts" (3.2.5); a **criterion of subdivision** is the type of characteristic a concept is divided by (3.2.17). ISO 704 (5.4.2) orders the work from properties to characteristics to concepts to definitions, and "assigning a designation" last | A narrower concept needs "at least one additional delimiting characteristic" (3.2.13) | One expert; works from concepts, not from instances |

Three others fit narrower parts. Grounded theory's open coding (Glaser and
Strauss, 1967; Strauss and Corbin, 1990) builds categories from their
properties and dimensions and supplies the stopping rule, saturation, but no
test of whether a dimension separates anything. Quinlan's decision-tree
induction (1986) gives an equivalent test in information terms: an attribute
with zero information gain separates nothing. Sokal and Sneath's numerical
taxonomy (1963) clusters instances on many equally weighted characters.

### What the methods add up to

Read together, the methods supply five tests for a characteristic that sounds
right and separates nothing, and two rules for the order of the work.

| Test | The finding it catches | From |
| --- | --- | --- |
| one value wherever it applies | a characteristic that separates nothing | Ranganathan's differentiation canon; Coplien's variability; a dispensable attribute in rough sets; a reducible attribute in formal concept analysis |
| fixed by another characteristic on these instances | two names for one characteristic, or a sample too small to tell them apart | Ranganathan's concomitance canon; reducts; clarification |
| two instances nothing separates | a missing characteristic, or one category | the discernibility matrix; Spradley's paradigm worksheet |
| a combination no instance has | an impossible combination, or a gap in the sample | functional reduction; cross-consistency assessment; attribute exploration |
| a cell decided without evidence | a characteristic coded by impression | Ranganathan's ascertainability canon; the ui-units dimension tests |

The two rules: name last, after the characteristics and the clusters are fixed
(ISO 704:2022, 5.4.2; Collier and colleagues on naming cell types); and give one
term one concept, deciding every homograph explicitly (ISO 25964-1, 2.24 and 6.2).
Only the morphological and componential traditions, and formal concept
analysis's attribute exploration, separate an impossible combination from one
the sample happens to lack, and the registry test below turned on exactly that
distinction.

## The test case: "registry"

The estate uses "registry" in at least three senses: a CSV listed in
[`docs/registries.csv`](../../docs/registries.csv); the shape in
registries.md's "Registries and streams", under which a tracker task counts as
a registry entry; and "the private registry", meaning the web-tools-private
repository. The test ran the checks described under Methods on the things the
word is applied to, plus near neighbors it is not applied to.

### Instances

A search of the three repositories' tracked files, session records excluded,
found the word about 6,000 times in some 830 files. Fifteen instances were
taken: one or two per distinct referent, plus four contrast instances the word
is not applied to.

| Instance | Called a registry where | |
| --- | --- | --- |
| `docs/kits.csv` | `docs/README.md`: "the kits registry" | listed in `registries.csv` |
| `docs/writers.csv` | `docs/manifest.md`: "writers registry" | listed |
| `tracker/board.csv` | `registries.csv` row `tracker-tasks` | listed |
| `docs/direct-to-main.csv` | `docs/surfacing-course.md`: "the registry of writers and paths" | not listed |
| a tracker task file | registries.md: "a task is a registry entry" | |
| web-tools-private `data/design/triggers.csv` | its `README.md`: "the trigger registry" | |
| home `trackers.md` | `tools/generate-tracker-registry.py`: "the registry of tracker instances" | |
| web-tools-private `lists/snag.json` | not called one | contrast |
| web-tools-private `notes/notes.jsonl` | not called one; the `stores` example in `docs/manifest.md` gives it `shape: stream` | contrast |
| a tending finding, a note carrying a `finding` object | not called one | contrast |
| a session record, `sessions/YYYY/MM/<day>-<short>.json` | not called one | contrast |
| the web-tools-private repository | its `.web-tools.json`: "The private registry"; `app/index.html`: `REGISTRY_REPO` | |
| `window.__loadedScripts` | `README.md`: "a registry of every load" | |
| PyPI | home `projects/text/doc-audit/model-delivery.md`: "Package registry" | outside the estate |
| the Windows registry | home `chron/2026/02/2026-02-25-chat-catalog-feb-8-to-24.md` | outside the estate |

### Characteristics

Nine characteristics were coded for every instance, in
[`registry-instances.csv`](registry-instances.csv). Six came from the texts
under test: registries.md's first sentence (`keyed`), its two-shape table
(`stands_for`, `after_written`) and its provenance paragraph, and `CLAUDE.md`'s
rule that a committed CSV inventorying part of the tree gets a row in
`registries.csv` (`is_csv`, `in_registries_csv`). Three (`medium`, `gets_in`,
`lasts`) came from comparing instances, informally rather than by a fixed
procedure.

| Characteristic | Values | Examples |
| --- | --- | --- |
| `medium`: what holds the entries | a file · a file per entry · an entry inside a shared file · a repository · a running page's memory · a system outside the estate | `kits.csv` · task files, session records · a tending finding · web-tools-private · `__loadedScripts` · PyPI |
| `stands_for`: what one entry stands for | a thing · an event · n/a | a snag · a note · web-tools-private, which holds collections rather than entries |
| `after_written`: whether an entry changes after it is written | edited in place · edited until its occurrence ends · never edited · n/a | `writers.csv` · a session record · `notes.jsonl` |
| `gets_in`: how an entry enters | by a rule over files · by an author · on its own arrival · n/a | `kits.csv`, `trackers.md` · `writers.csv`, a snag · a script on first load, a package on publication |
| `in_registries_csv` | yes · no | `writers.csv` · `direct-to-main.csv` |
| `lasts` | in git · for a page's lifetime · with an outside operator | `kits.csv` · `__loadedScripts` · PyPI |
| `keyed`: whether an entry is found by a stable key | yes · n/a | every collection here · web-tools-private |
| `is_csv` | yes · no | `triggers.csv` · `snag.json` |
| `provenance`, as registries.md defines it | derived · authored · n/a | `board.csv` · `writers.csv` · PyPI |

### What the checks found

[`separation-checks.py`](../../skills/cat-map/separation-checks.py), bundled with the
skill, runs the checks over the table:

```bash
python3 skills/cat-map/separation-checks.py \
  research/category-mapping/registry-instances.csv \
  "writers.csv|direct-to-main.csv" "task file|notes.jsonl" x:stands_for,after_written
```

1. **The private repository falls outside every characteristic of an entry.**
   web-tools-private is `n/a` on what an entry stands for, whether it is edited
   and how it enters. It is not a collection of entries; it is a repository that
   holds several (lists, notes, session records, the configuration cache, the
   errands folder). Calling it a registry names its role for the app, the
   repository `REGISTRY_REPO` points at, and no characteristic of what it holds.
   `docs/manifest.md` says "There is no registry list of repos" and calls the
   `hidden` key "the single exception to the no-registry-list rule", which
   suggests the name once meant a list of repositories kept there. This checkout's
   history is shallow, so the account does not date that.
2. **Only the listing separates the first sense from its neighbors.**
   `writers.csv` and `direct-to-main.csv` sit in the same folder, are both
   CSVs of one row per thing, edited in place by an author, and both are called a
   registry. The one characteristic that separates them is whether
   `registries.csv` lists them. The first sense is therefore defined by
   membership in a curated list, which `registries.csv`'s own row states: "no
   rule decides whether a file is a registry". The test also turned up a
   probable gap: `CLAUDE.md` says a committed CSV that inventories part of the
   tree gets a `registries.csv` row in the same commit, and `direct-to-main.csv`
   has none. It is one of 17 tracked CSVs in web-tools without a row; the other 16 are
   15 files under `data/` (dated readings and the ui-units coding) and
   `skills/doc-craft/binding/runs.csv`, a log of runs, which the rule may not
   mean to cover.
3. **The two-shape table bundles two characteristics.** On the first twelve
   instances, `stands_for` and `after_written` divided the instances
   identically, which is why one pair of names, registry and stream, seemed to
   cover both. The empty-cell check named the two combinations no instance had,
   a thing never edited and an event that is edited, and the estate has both: a
   tending finding is a thing (it opens and later settles) kept as a note that
   is never edited, its state folded from the replies that carry a `finding`; a
   session record is an event, rewritten by the Stop hook at the end of each
   turn until the session ends. With those two instances added, the characteristics separate.
   Session 007acb88 reached the same conclusion by argument, proposing "a third
   arrangement: a thing kept in a stream". Two combinations remain unfilled and
   unsearched: a thing edited until it ends, and an event edited indefinitely.
4. **"Found by a stable key" separates nothing.** registries.md's first
   sentence uses it, and every collection in the table has one, the notes stream
   included (`key: id` in the `stores` example). What separates a registry entry
   from a stream entry is what the key identifies, which `stands_for` already
   records.
5. **The outside senses cluster on how entries enter.** PyPI, the Windows
   registry and `__loadedScripts` are the instances whose entries enter on their
   own arrival: a package is published by its maintainer, a program writes its
   own keys, a script is recorded on first load. This is the sense a reader from
   outside the estate brings to the word, the "general audience" of rule 2.
   None of the 53 registries listed in `registries.csv` works that way: each
   row's `membership` is `computed` or `curated`, so entries enter by rule or
   by an author.
6. **Two characteristics were redundant on this sample.** `lasts` is fixed by
   `medium`, and `gets_in` and `provenance` are interchangeable in every minimal
   set. registries.md treats provenance as independent of shape; this sample
   cannot test that, since no instance has authored membership with derived
   values.

The minimal sets of characteristics that keep every separated pair apart have
five members, `medium`, one of `stands_for` and `after_written`, one of
`gets_in` and `provenance`, `in_registries_csv` and `is_csv`. Three are core,
each the only separator of some pair: `medium` (a task file from a snag),
`in_registries_csv` (`writers.csv` from `direct-to-main.csv`) and `is_csv`
(`triggers.csv` from `snag.json`).

### What the test does not show

- **The instances are a sample.** Fifteen referents chosen by one reader from a
  word search; another reader would choose others, and the reducts depend on
  the choice. The checks report what this table supports, nothing wider.
- **Codes are one reader's.** Each cell was coded by this session from the
  file or line named above; no second coder checked them, which the ui-units
  readers and the gold-set skill would both require before the table counted
  as settled.
- **The empty-cell check is noisy when run on every pair.** Run across all
  pairs of characteristics, it lists 39 empty combinations, most of them
  impossible by definition (a listed registry that is not a CSV). It was useful
  only when aimed at the one pair the shape names bundled, which is why the
  script takes `x:` crosses.

## How to display a category map

A category map is read best as a picture, so the display was explored before
the skill was rewritten to feed one. [`idea-board.json`](idea-board.json) holds
a Crazy Eights round from the design-sprint skill: four sketchers, each blind to
the others, drew two concepts each from one angle (classification forms, spatial
metaphor, process, instances first), all over the registry test's data. Three of
the eight independently drew the same field, "stands for" against "after
written", with the words as regions. The proposed selection takes the per-word
docket as its base and puts that field above it. It opens in
[the idea board page](https://mehrlander.github.io/web-tools/pages/idea-board.html#gh=mehrlander/web-tools@claude/amazing-edison-w6l3ho:research/category-mapping/idea-board.json).

The selection became [`pages/cat-map.html`](../../pages/cat-map.html), which
draws a `catmap/1` file (the format is in the skill): the map's answer on the
first tab, laid out as a poster; each run's
outcome; a field of two characteristics chosen by pills, each sense a region of the cells it allows; a
docket of each sense's required values with the things it names checked
against them, a red row naming what it breaks; and, for a file with several
runs, a Compare view. [`registry-map.json`](registry-map.json), the registry
test rebuilt in that format, is the page's default.

## The blind test: collections

The question: what do registry, stream, list, log, ledger, cache, snapshot,
tracker and inbox imply about a collection, do they carve the estate's
collections cleanly, and where is a collection called by a word whose
implications it does not meet. Four readers answered it independently, each
blind to the others and to this account: three following the skill (A, B, C)
and one with only the question and the output format (D). Their maps are the
four runs of [`collections-map.json`](collections-map.json), drawn in
[the page](https://mehrlander.github.io/web-tools/pages/cat-map.html#gh=mehrlander/web-tools@claude/amazing-edison-w6l3ho:research/category-mapping/collections-map.json&view=compare),
whose Compare view leads with where they agree.

| | A | B | C | D, no skill |
| --- | --- | --- | --- | --- |
| Senses mapped | 15 | 14 | 19 | 20 |
| Characteristics | 9 | 10 | 11 | 7 |
| Things coded | 33 | 35 | 32 | 30 |
| Things called by a word they do not meet | 8 | 5 | 5 | 6 |

**They agree on most of it.** Nine of the thirteen findings in the file's
agreement list were stated by all four readers, among them:

- registry, stream and snapshot sit on one plane, what an entry stands for
  crossed with whether it changes after it is written;
- stream, log and ledger name the same cell;
- cache, tracker, inbox and list each sit on an axis of their own (where
  entries come from, a status, whether entries leave, curated membership);
- session records are called a stream but are rewritten while the session
  runs;
- "snapshot" names both a dated reading kept as written and a derived copy
  replaced in place.

**The reader without the skill reached the same plane and the same main
findings** with fewer characteristics, and its table, checked afterwards, has
no characteristic that separates nothing, none fixed by another and no pair
left unseparated. It also made the fullest naming proposal: two declared
fields, grain and change, with the nouns reserved for named combinations and
"window" added for a rolling one.

**What the skill added** was the checks and the record of answering them.
Reader A's first run could not separate the constellation atlas from the
activity cache and added "who rebuilds it"; Reader C's could not separate the
news ledger from the shortcut run logs and added what an entry is about. All
three wrote an answer to every finding the checks left, each empty combination
marked impossible or not found. Those
are the discriminations a reader without a check has no prompt to make.

**What no run did** was answer the question the test was for: what to call a
collection. Each ended with a verdict per sense and a summary of kinds, so the
answer was drawn afterwards, by this session, from all four. Two questions
decide the word (what one entry stands for, and whether it changes once
written); cache, tracker, inbox and list add to it; three current names change;
four choices stay open. It is the `answer` block of
[`collections-map.json`](collections-map.json), the page's first tab, and the
reason the skill's last step now produces one.

**What the test does not show.**

- **A shared source.** Home's 2026-10-12 survey of the estate's stores
  classifies the same collections against the same vocabulary, and nothing
  excluded it; Reader B cites it. Agreement may partly be that survey read
  four times.
- **A head start for the skill.** The skill's own key insights carry the
  registry test's result (registry and stream bundle two characteristics),
  which the readers following it had and D did not.
- **One breach.** Reader B reported opening one of Reader C's scripts in a
  shared scratch folder after B's map was finished; B's run records it.
- **The marks are this session's.** The agreement list was marked from each
  reader's outcome, verdicts and report; a blank is a finding the reader did
  not state, not one it rejected.

A question with no prior survey would test the method more fairly. Standing,
occasioned and recurring, from the forms work of 2026-10-22, is one.

## The poster

The first answer was drawn as tables on the page's front tab, and it still did
not read as an answer. It led with the study (readers, checks, agreement) and
showed none of the owner's own collections. The poster turns that around: it
opens on the question the owner asks ("What kind of collection is it?"), puts
two or three of the estate's own files in every box, shows each misnamed thing
with its wrong name struck through, and ends in the calls only the owner can
make. How the map was made shrinks to a footnote. It is the page's Answer tab,
and `poster=1` renders it alone as an image:

```bash
npm run shot -- pages/cat-map.html --hash 'src=../research/category-mapping/collections-map.json&poster=1' \
  --width 720 --scale 2 --full --out poster.png
```

**Every placement is checked.** The answer names one run as its basis, and
[`answer-check.py`](../../skills/cat-map/answer-check.py), run by the suite,
holds each example to that run's coding: an example sits in its cell and meets
no add-on word's condition, an add-on example meets its condition, a renamed
thing is called by the old word. Its first run caught two slips in the
hand-drawn draft, trackers.md shown as a plain registry though Reader A coded
it a cache, and notes shown as a plain stream though the Lists view lists it,
and it sharpened cache from "rebuilt from other files" to rebuilt with nothing
checking it against them, which is what separates the activity cache from
docs.csv.

### Is the poster useful

Three readers, blind to one another and to this account, got only the poster
image and eight collections the poster does not show, and named each one.
[`poster-test/`](poster-test/) holds the instructions (`question.md`), their
answers (`reader-p1.json`, `reader-p2.json`, `reader-p3.json`) and the scorer
(`score.py`); the poster they saw is the Answer tab at commit `37908ad5`, regenerable
with the command above. Seven collections have a key computed from Reader A's
coding through the answer's own rules; the eighth, errands, probes a case the
answer leaves open.

| | Box right | Box and add-on words right |
| --- | --- | --- |
| Against the key as first drawn | 5 of 7, each reader | 3, 3 and 4 of 7 |
| After two corrections to the key | 6 of 7, each reader | 5, 5 and 6 of 7 |

The readers chose the same box as one another for all seven scored
collections, and their notes traced two of their departures from the key to
the key:

- **A coding error.** Reader A coded the traffic ledger's entries "never
  changed"; `lib/gh-boot.js:325` pushes each entry with status 0 and fills it
  in when the request settles. The value is corrected in Reader A's run, with
  that evidence, and the run's method says so.
- **A meaning its rule did not match.** The list card said "members chosen by
  hand", and the readers rightly called the aims reading list a list; the
  rule accepted only the Lists view's sense. The rule now takes either list
  sense.

The third departure stays: all three readers called the decision ledger a
stream and a cache, at low confidence, where Reader A coded an event whose
entry changes. It exposed a real gap, that "does an entry change after it is
written" is unclear for a collection rebuilt from other files; the grid now
carries a note (ask about what each entry records, not the rebuild). All three
sent errands to the open call for request files, which is where the poster
meant them to go. Two of eight collections, `window.__traffic` and
`state/sessions.json`, turned on the open call for a rolling window, which
had been one reader's proposal. Examples are now named by findable paths:
"the traffic logs" sent all three readers to the wrong collection.

The corrections were found by the readers and checked against the files
before the key changed; a key revised after seeing the answers would otherwise
be a weak result, and the uncorrected row is the one to quote against it.

### Does the method generalize

A fifth reader, new to the skill, took a second question through it end to
end: the estate's words for when work or an instruction acts (standing,
recurring, scheduled, periodic, routine, one-off, ad hoc, triggered), plus the
owner's own word, occasioned. The result is
[`timing-map.json`](timing-map.json): 14 senses, 9 characteristics, 33 things
in the three repositories, 11 findings each answered, and an answer that passes
the check. It reads as an answer, which the collections test did not until the
skill's last step was rewritten:

- **Two questions:** what sets it off (the clock, or something happening or
  someone asking, which is occasioned), and whether it acts once, again as
  written down, or again decided each time. One-off, scheduled, standing and
  ad hoc fill four of the six cells; a timer set to go off once has no word
  (the reader recommends reminder); a clock that decides anew each time is
  impossible.
- **Four words add to it:** on request, gated, polled and routine.
- **Four names change:** news-fetch and the configuration crawl become
  standing, being set off by a session start rather than a clock;
  scheduled-tasks.yml and the morning brief become scheduled.
- **Four calls for the owner:** adopt occasioned; reminder for a one-off
  timer; retire triggered and periodic; whether news-fetch stays in the
  scheduled-task registry.

The hardest call, standing against recurring, was settled by a sentence quoted
in home's term-lab report: "a recurring fork becomes a standing decision the
moment a doc states it as a default." Whether what a thing does is written down
became its own characteristic.

The reader also listed twelve places where the skill made it guess, each now
answered in the skill, the page or the check: a `kind` for a sense that names a
characteristic itself (`axis`); `requires` taking a list of values; the grid's
columns following the data rather than being fixed at two; an `impossible`
cell, which the check refuses to find a thing in; a rule that an add-on word
must leave each cell plain cases; a response to the identical-instances
finding; which pair `field` takes; the vocabulary check across several
repositories; when `called` applies; the fields the scripts read but the skill
did not name (`short`, `{a, b, question}` pairs, `crosses`); the render
command's wait; and the `where` of a word only the owner has used.

What this does not show: one reader, so no agreement to measure, and its
coding has had no second reader; its renames are its own proposals.

## Sources

Citations marked secondhand were not read in the original.

- Bailey, Kenneth D. *Typologies and Taxonomies: An Introduction to Classification Techniques*. Sage, 1994. Quantitative Applications in the Social Sciences 07-102.
- Barton, Allen H. "The concept of property-space in social research." In Lazarsfeld and Rosenberg, eds., *The Language of Social Research*. Free Press, 1955.
- Collier, David, Jody LaPorte and Jason Seawright. "Putting typologies to work." *Political Research Quarterly* 65(1), 2012, 217 to 232.
- Collier, David, and James E. Mahon. "Conceptual 'stretching' revisited." *American Political Science Review* 87(4), 1993, 845 to 855.
- Coplien, James, Daniel Hoffman and David Weiss. "Commonality and variability in software engineering." *IEEE Software* 15(6), 1998, 37 to 45.
- Fransella, Fay, Richard Bell and Don Bannister. *A Manual for Repertory Grid Technique*, 2nd ed. Wiley, 2004.
- Frake, Charles O. "The ethnographic study of cognitive systems." In Gladwin and Sturtevant, eds., *Anthropology and Human Behavior*. Anthropological Society of Washington, 1962.
- Ganter, Bernhard, and Rudolf Wille. *Formal Concept Analysis: Mathematical Foundations*. Springer, 1999.
- Glaser, Barney, and Anselm Strauss. *The Discovery of Grounded Theory*. Aldine, 1967.
- Goodenough, Ward H. "Componential analysis and the study of meaning." *Language* 32(1), 1956, 195 to 216.
- ISO 704:2022, *Terminology work: Principles and methods*. ISO 1087:2019, *Terminology work and terminology science: Vocabulary*. Preview samples read.
- ISO 25964-1:2011, *Thesauri for information retrieval*; ISO 25964-2:2013, *Interoperability with other vocabularies*. Preview sample of part 1 read. ANSI/NISO Z39.19-2005 (R2010), secondhand.
- Kang, Kyo C., and others. *Feature-Oriented Domain Analysis (FODA) Feasibility Study*. CMU/SEI-90-TR-21, 1990.
- Kelly, George A. *The Psychology of Personal Constructs*. Norton, 1955. Triad wording secondhand.
- Lakoff, George. *Women, Fire, and Dangerous Things*. University of Chicago Press, 1987.
- Lazarsfeld, Paul F. "Some remarks on the typological procedures in social research." *Zeitschrift für Sozialforschung* 6(1), 1937, 119 to 139.
- Pawlak, Zdzisław. "Rough sets." *International Journal of Computer & Information Sciences* 11(5), 1982, 341 to 356; and *Rough Sets: Theoretical Aspects of Reasoning about Data*. Kluwer, 1991.
- Quinlan, J. Ross. "Induction of decision trees." *Machine Learning* 1(1), 1986, 81 to 106.
- Ranganathan, S. R. *Prolegomena to Library Classification*. Madras Library Association, 1937 ([scan](https://archive.org/details/in.ernet.dli.2015.281864)); 3rd ed., Asia Publishing House, 1967.
- Ritchey, Tom. "Problem structuring using computer-aided morphological analysis." *Journal of the Operational Research Society* 57(7), 2006, 792 to 801; and "General Morphological Analysis: A general method for non-quantified modelling." Swedish Morphological Society, 2002, revised 2013.
- Rosch, Eleanor. "Cognitive representations of semantic categories." *Journal of Experimental Psychology: General* 104(3), 1975, 192 to 233; and "Principles of categorization," in Rosch and Lloyd, eds., *Cognition and Categorization*, 1978.
- Rosch, Eleanor, and Carolyn Mervis. "Family resemblances." *Cognitive Psychology* 7(4), 1975, 573 to 605.
- Rosch, Eleanor, and others. "Basic objects in natural categories." *Cognitive Psychology* 8(3), 1976, 382 to 439.
- Skowron, Andrzej, and Cecylia Rauszer. "The discernibility matrices and functions in information systems." In Słowiński, ed., *Intelligent Decision Support*. Kluwer, 1992, 331 to 362.
- Sokal, Robert R., and Peter H. A. Sneath. *Principles of Numerical Taxonomy*. W. H. Freeman, 1963.
- Spencer, Donna. *Card Sorting: Designing Usable Categories*. Rosenfeld Media, 2009.
- Spradley, James P. *The Ethnographic Interview*. Holt, Rinehart and Winston, 1979.
- Strauss, Anselm, and Juliet Corbin. *Basics of Qualitative Research*. Sage, 1990.
- Tullis, Tom, and Larry Wood. "How many users are enough for a card-sorting study?" UPA 2004 conference. Secondhand, through Nielsen (2004).
- Vickery, B. C. *Faceted Classification: A Guide to Construction and Use of Special Schemes*. Aslib, 1960.
- Weiss, David M., and Chi Tau Robert Lai. *Software Product-Line Engineering*. Addison-Wesley, 1999.
- Wille, Rudolf. "Restructuring lattice theory." In Rival, ed., *Ordered Sets*. Reidel, 1982, 445 to 470.
- Zwicky, Fritz. *Discovery, Invention, Research through the Morphological Approach*. Macmillan, 1969.
