# Minimal progressive structure: the theory

A working theory of how content that arrives as text becomes a page, written
2026-10-25. [method.md](method.md) is the operational form an agent follows;
this file says why the method has the shape it has, where it comes from, and
what it predicts. The [account](README.md) holds the test.

## The definition

**Minimal progressive structure:** the layout that delivers all of the content
with no text spent describing how that content is organized, because familiar
conventions show it.

Shannon's source coding theorem (1948) sets a limit on how short a lossless
encoding of a message can be, and practical codes approach that limit without
reaching it. Minimal progressive structure is a limit of that kind. Some
arrangements have no convention a reader knows: a chart that plots recorded
altitudes beside altitudes a crew only spoke aloud needs a sentence saying so,
as the judges of the NTSB pages noted. A practical page keeps that text.

## The claim

A page is a **rooted projection of an entity graph**. Building a page from
text takes two moves of different character:

1. **Normalize:** recover the graph that the text was written from: the things
   it talks about, the facts that belong to each, and the relations between
   them. This move is largely determined by the content.
2. **Project:** choose a root and a governing question, then lay the graph onto
   the screen in layers, so the root appears in full and every neighbor
   appears as a label one step from its own view. This move is determined by
   the reader the page is for.

## Text is a serialization of a graph

Steven Pinker's account of writing (*The Sense of Style*, 2014) runs from a web
of ideas, through a tree of syntax, to a string of words. A writer holds a web
and must emit a line, so the writer picks one traversal and commits the reader
to it. A news article about a ballot measure is one walk through a small graph
(the measure, the fund it governs, the board that would invest it, the
campaign, the opponents, the earlier failed attempt), flattened into
paragraphs in the order a reporter judged best.

A page can undo that flattening. Its reader can choose the traversal, so the
page builder runs Pinker's sequence in reverse to recover the web, then picks
a different tree to render it:

| Pinker's stage | Here | Produced by |
|---|---|---|
| string | the source text | the writer |
| web | the entity model | normalization |
| tree | the projection rooted at the reader's subject | the root and governing question |
| (screen) | the page, with references left as cross-links | the mechanisms and checks |

This gives a diagnosis of the generic AI page, the stack of cards each holding
a heading and a paragraph. **It formats the string instead of recovering the
web.** Its sections mirror the source's paragraphs or topics ("Background",
"Supporters", "Opponents", "What's next"), so it inherits the writer's
traversal and adds boxes. Nothing on it is organized by what the facts are
about.

The test sharpened this diagnosis. Unguided builders did not mirror the
paragraphs; they reached for a genre. All three bare WA Cares pages used the
news explainer's stock sections (the question on the ballot, what would
change, for and against, how we got here), which already encode some
relation kinds: a before-and-after comparison, a two-sided comparison, a
sequence. What the genre lacks is a root other than the article itself, so
each fact appears wherever a stock section mentions it, and facts repeat. The
generic page formats a genre rooted on the text, not a model rooted on the
reader's subject.

## Normalization: structural forms

Database normalization (Codd, 1970 and 1971) removes redundancy by putting each
fact where it depends. The analogy to content is close enough to borrow the
ladder, each form removing one defect that shows on a page.

| Form | Rule | Database counterpart | Page defect it removes |
|---|---|---|---|
| 0 | text | (unstructured) | (none: the input) |
| 1 | atomic facts; repeated groups become collections | first normal form: atomic values, no repeating groups | a list buried in prose; a sentence carrying four facts |
| 2 | each fact on its owner; facts about a pairing on the pairing | second normal form: no partial dependency on a composite key | a candidate's biography repeated inside every race it touches |
| 3 | references, not copies | third normal form: no transitive dependency | the sponsor's district and party on the bill's own view |

Form 3 is the owner's opening example. On a page about a bill, the sponsor's
party and district reach the bill only through the sponsor (bill, then sponsor,
then district), which is exactly a transitive dependency. They live on the
sponsor's view; the bill holds a reference.

Two properties of a good decomposition carry over as checks:

- **Lossless join** becomes *nothing lost*: every fact in the source is
  reachable from the root by some path.
- **Dependency preservation** becomes *relations navigable*: a relation the
  text states (a union funds a campaign) can be followed from the side the
  reader starts on.

The analogy also names the opposite failure. **Over-normalization** in a
database means a query needs many joins; on a page it means a tap for every
noun, the feel of a generated admin interface. The **earned-view rule** sets
the stopping point: a thing gets a view of its own only when it has facts of
its own beyond its name, or relations to more than one other thing. Otherwise
it stays a value in someone else's view.

## Projection: root, ladder, mechanisms

**The root and the governing question.** Normalization yields a graph with no
privileged node. The governing question (what the reader came to learn or
decide) picks the root, and the root turns the graph into a tree: each
entity's distance from the root becomes its default depth on the page. A page
about a set of things (twelve races to watch) has the collection as its root,
and the collection's full view is the comparison of its members.

**The projection ladder.** Every entity type gets four projections:

| Level | Name | Shows | Appears |
|---|---|---|---|
| 0 | label | name, plus a qualifier or two | inside a neighbor's view |
| 1 | row | the fields that tell members of its collection apart | in a table or list |
| 2 | view | all its own facts, its relations as labels or rows | when it is the subject |
| 3 | sources | quotations, passages, method | on demand, from a claim |

*Progressive disclosure* becomes a precise rule: the root is shown at level 2,
its neighbors at level 0 or 1, and one interaction raises any neighbor to its
own level 2, recursively.

**The label is controlled denormalization.** A read model in a database copies
attributes for speed; a label copies a neighbor's attributes for scent. The
copy is right when it identifies the neighbor or bears on the governing
question at that spot. Newsrooms settled one label long ago: a legislator is
"Sen. Bob Hasegawa, D-Tukwila", party and home town, because those are what a
reader needs to place the name.

**A view opened from a reference leads with the relation that brought the
reader.** The ladder is the same everywhere, but the order inside a view
depends on the path. A union's view opened from a ballot measure leads with its
funding of the campaign, not its membership. This follows from the governing
question being inherited along the path, and it is one place where the theory
says more than a fixed schema-driven interface can.

**Mechanism by relation kind.** The kind of a relation picks its default form:
attribute to a field, part to an expanding outline, member to a table with a
pick, reference to a label that opens a view, sequence to a timeline,
comparison to side-by-side panels with fields at fixed places, evidence to a
disclosure on the claim. This is the shape-to-form map of the
[shape-text skill](../../skills/shape-text/SKILL.md), lifted from spans of text
to entities.

## Minimality

Two pressures act in opposite directions. Normalization splits: it separates
facts by owner and pushes neighbors behind references. Minimality merges: it
refuses a view, a level or a control that holds nothing distinct. The five
checks in the method are where they meet: no duplicates, nothing lost, scent on
every control, the governing answer on the first screen with every fact within
two steps, and no empty slots.

## What the theory predicts

Written before any page in the experiment was judged.

1. **Convergence decreases down the ladder.** The owner's intuition that
   seventeen experts would arrive at much the same page splits by level.
   Normalization follows from what the facts are about, so independent
   builders should agree on which things are entities and which earn views.
   They should agree less on the root, which depends on the imagined reader,
   and least on which facts go into each label and row: the entity
   summarization benchmark ESBM found two people's five-fact summaries of the
   same entity sharing about two facts ([literature](literature.md)).
2. **Guidance should change the page's organizing principle.** A builder told
   to recover the web, rather than format the string, should produce fewer
   pages organized by the source's topics and more organized by its entities,
   with a reader's lookups closer to the first screen and fewer source facts
   lost.
3. **The failure modes are predictable.** Without normalization: walls of
   prose, buried lists, neighbors' details on the root. With
   over-normalization: navigation for every noun, the generated-interface feel
   that Myers, Hudson and Pausch (2000) found unpredictable and low in ceiling.

The account's experiment tests predictions 1 and 2.

## What the test showed

The [account](README.md#findings) has the figures. Four results bear on the
theory itself.

- **The root is the method's main lever.** Builders converged with or without
  the method, at about the same rate; the method changed the root they
  converged on, from the article to the thing the article is about. Where the
  unguided builders already rooted on things (races by district, the NTSB
  report by aircraft), the method added little.
- **The earned view is the weakest rule.** Replicates following the method
  agreed on the root and diverged on which neighbors earn a view. The revised
  rule ties the threshold to the label: a thing earns a view when its own
  facts are more than its label can carry.
- **Minimality cuts both ways.** One method page hid a collection's rows behind
  counts, which satisfies the depth check and defeats the comparison. A
  collection root shows its rows.
- **Normalization protects fidelity.** Attaching a claim to its speaker is Form
  2 applied to speech, and the method pages kept attribution where unguided
  pages promoted a campaign's claim to fact.

## Where it sits

Much of this has been said before, in pieces; [literature.md](literature.md)
holds the two research passes. The hypermedia design methods of the 1990s
modeled sites as entities and relations and chose a navigation structure per
relation: RMM (Isakowitz, Stohr and Balasubramanian, 1995) gave every entity
a **head slice** that anchors each incoming link, which is the label level
above; WebML (2000) gave a unit per relation kind, close to the mechanism
table. Fresnel's label lens (2006) is the label rule for linked data, and
Wikipedia's summary style layers inverted pyramids across lead, sections and
child articles. Cao, Jiang and Xia (CHI 2025) had a language model build an
object model and render references as thumbnails, from a task prompt rather
than a source text.

What the passes did not find stated anywhere: atomic facts extracted from
prose as the first step of page design; a governing question that selects the
root, which answers the old complaint that generated interfaces mirror storage
rather than a reader's purpose; the normal forms used as a test of a page
(Araneus, 1997, paired pages with a normal form only to query them); the five
checks as a gate before building; and the whole as one procedure. The claim
of novelty is therefore narrow: the assembly, the normal-form test, the
governing question, and the checks.
