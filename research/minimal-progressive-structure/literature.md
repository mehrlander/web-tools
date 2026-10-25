# Minimal progressive structure: prior work

Two literature passes run 2026-10-25 by research agents, each told to look
hardest for work that already states the method. One covered UX, information
architecture and journalism; the other covered data modeling, automated
presentation and generative interfaces. Entries marked *secondary* were seen
through a summary rather than the original; *inferred* marks a reading the
agent did not verify. Step numbers refer to the seven steps of the sketch the
agents were given: (1) extract atomic facts, (2) find entities and repeating
groups, (3) attach each fact to its entity, (4) replace a neighbor's facts with
a reference, (5) choose the root and governing question, (6) give each entity
layered projections, (7) map each relation kind to a disclosure mechanism.

## UX, information architecture and journalism

### Progressive disclosure

- **Johnson, Roberts et al. 1989**, "The Xerox Star: A Retrospective", IEEE
  Computer ([pdf](https://worrydream.com/refs/Johnson_1989_-_The_Xerox_Star,_a_Retrospective.pdf)).
  The Star (1981) named progressive disclosure as a principle, for example
  property-sheet fields hidden until "Other" is chosen (*secondary*). Step 6.
- **Carroll and Carrithers 1984**, "Training Wheels in a User Interface",
  CACM 27(8). Disabling advanced functions for novices; the empirical ancestor,
  about functions rather than information. Step 6, loosely.
- **Nielsen 2006**, [Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/).
  Split by task analysis and frequency of use; more than two levels "typically
  have low usability". The most procedural account found, and it amounts to
  "rank by need, keep to two levels". Step 6.
- **Brown 2010**, [Eight Principles of Information Architecture](https://principles.design/examples/eight-principles-of-information-architecture).
  The principle of disclosure: "Show only enough information to help people
  understand what kinds of information they'll find as they dig deeper." The
  principle of objects treats content as things with attributes. Steps 2, 6.
- **Tidwell 2005**, *Designing Interfaces*. A pattern catalogue (Extras on
  Demand, Two-Panel Selector) with no procedure for choosing. Steps 6, 7 in
  part.

### Visualization and foraging

- **Shneiderman 1996**, [The Eyes Have It](https://webspace.science.uu.nl/~telea001/uploads/VACourse/Shneiderman96.pdf).
  Overview first, zoom and filter, details on demand; seven data types against
  seven tasks, temporal data to timelines, trees to outlines. The nearest
  general precedent for step 7, though it maps data types, not relation kinds.
  Steps 6, 7.
- **Pirolli and Card 1999**, "Information Foraging", Psychological Review
  106(4). Information scent: the reader's estimate of a distant source's value
  from nearby cues such as link labels. The theory behind a label on every
  reference. Steps 4, 6.

### Object-oriented UX, the closest current practice

- **Prater 2015**, [Object-Oriented UX](https://alistapart.com/article/object-oriented-ux/),
  and the later **ORCA** process (Objects, Relationships, Calls to action,
  Attributes; [InfoQ interview](https://www.infoq.com/podcasts/object-oriented-ux-sophia-prater/)).
  Noun foraging to find objects; core content against metadata; nesting
  objects to make cross-links ("the content is the navigation"); force-ranking
  attributes, with low-ranked ones collapsed. The nested-object matrix records
  relationships with cardinality. ORCA prescribes no fixed ladder of
  projection levels, no rule against redundancy and no completeness check.
  Steps 2 and 3 strongly, 4 in part, 6 weakly, 7 absent.

### Interfaces from a domain model; hypermedia design methods

- **Pawson and Matthews 2002**, *Naked Objects*. The interface generated from
  domain objects, references shown as titles (*inferred*). Steps 2, 7 by
  construction; no editorial layering.
- **Isakowitz, Stohr and Balasubramanian 1995**, [RMM: A Methodology for
  Structured Hypermedia Design](https://archives.iw3c2.org/www2002/rmm/papers/rmd.pdf),
  CACM 38(8), read in full. Entity-relationship design first ("as in database
  modeling, a many-many relationship is factored into two one-many
  relationships"); then **slice design**, grouping an entity's attributes into
  slices, with a **head slice** "used as a default to anchor links coming into
  the entity"; then navigational design, replacing each relationship by an
  access structure: one-to-one by a link, one-to-many by a guided tour when
  there are few instances and no sort key, by an index when there are many and
  a meaningful key. Steps 2, 3, 4, 6, 7.
- **Schwabe and Rossi 1998**, OOHDM ([pdf](https://archives.iw3c2.org/www2002/_west2001/iwwost01/files/contributions/DanielSchwabe/TAPOSRevised.pdf)):
  navigation nodes are views of conceptual classes and links are views of
  relationships; indexes and guided tours are first-class. **Ceri, Fraternali
  and Bongio 2000**, [WebML](https://xml.coverpages.org/webML.html): a data
  unit shows one object, an index unit lists objects by a few representative
  attributes. Steps 3, 6, 7.

### Information architecture frameworks

- **Wurman 1989**, LATCH (location, alphabet, time, category, hierarchy) as
  the ways to organize (*secondary*). Step 7, as ordering schemes.
- **Rosenfeld and Morville 1998**: hierarchy, database model or hypertext.
  Steps 2, 7, loosely.
- **Klyn 2009, popularized by Covert 2014**: ontology, taxonomy, choreography
  ([source](https://understandinggroup.com/ia-theory/understanding-information-architecture)).
  Steps 2, 5, 7, abstractly.
- **Horn 1969**, Information Mapping: chunking, one topic per block, labeling,
  accessible detail (*secondary*). Steps 1, 6.

### Semantic-web presentation and entity cards

- **Pietriga, Bizer, Karger and Lee 2006**, Fresnel ([manual](https://www.w3.org/2005/04/fresnel-info/manual/)).
  A lens chooses and orders the properties shown; `fresnel:labelLens` gives "a
  short, human-readable label for an instance"; a related resource is shown
  through its label lens unless a sublens is named; `fresnel:depth` caps the
  recursion. This is step 4 almost word for word. Steps 4, 6.
- **Entity summarization**: RELIN (2011), FACES (2015), LinkSUM (2016) rank an
  entity's facts and keep the top k. **Hasibi, Balog and Bratsberg 2017**,
  "Dynamic Factual Summaries for Entity Cards", SIGIR: readers preferred
  summaries tailored to the query over fixed ones. Steps 6, and 5 (the query as
  governing question).
- **Salesforce compact layouts** ([docs](https://developer.salesforce.com/docs/atlas.en-us.218.0.salesforce1appadmin.meta/salesforce1appadmin/s1_admin_guide_compact_layouts_intro.htm)):
  one set of summary fields per object type, reused wherever a record is
  referenced. A production instance of steps 4, 6.

### Wikipedia

- [Summary style](https://en.wikipedia.org/wiki/Wikipedia:Summary_style):
  three depths (lead, sections, child articles), described as "layering
  inverted pyramids"; the infobox as "a further distillation"; Page Previews
  shows a linked article's lead on hover. Unlike step 4, it accepts "some
  duplication between the parent and child articles". Steps 4, 6.

### Structured journalism

- **Nielsen 1996**, [Inverted Pyramids in Cyberspace](https://www.nngroup.com/articles/inverted-pyramids-in-cyberspace/):
  "a set of pyramids floating in cyberspace". Step 6.
- **Holovaty 2006**, [A fundamental way newspaper sites need to change](https://www.holovaty.com/writing/fundamental-change/):
  abandon the "story-centric worldview"; a fire has a date, a place and a
  station number, and an obituary "is about a person". Steps 1, 3.
- **Circa, 2012 to 2015** ([how a story is built](https://journalismthatmatters.org/blog/2014/02/18/how-circa-constructs-a-story/)):
  stories built from cited fact "atoms", reusable across stories. Step 1, plus
  sources.
- **Google Living Stories 2009** ([announcement](https://news.googleblog.com/2009/12/exploring-new-more-dynamic-way-of.html)):
  one page per topic with summary, latest news, key events and the players.
  Steps 5, 6, 7.
- **Adair 2015 and Caswell 2016**, Structured Stories: events linked to people
  and organizations; some reporters "struggled with the abstraction". Steps 1,
  3, 7.
- **BBC domain-driven web design** (Smethurst 2009; Scott's
  [slides](https://derivadow.com/wp-content/uploads/2011/04/ddd-presentation.pdf)):
  "model real things not web pages", "one URI for one thing", "think of a URI
  as a database key". Steps 2, 3, 4.

### Evidence on convergence

- **Furnas et al. 1987**, "The Vocabulary Problem", CACM 30(11): two people
  chose the same term for an object with probability below 0.20 in every
  domain tested.
- **Hadar and Soffer 2006**, JAIS 7(8): "different people construct different
  models of a given domain although all may be similarly adequate"
  (qualitative).
- **Simsion 2007**, *Data Modeling Theory and Practice*: a survey of roughly
  450 practitioners concluding that data modeling is design, not description.
- **ESBM 2020** ([arXiv 2003.03734](https://arxiv.org/pdf/2003.03734)): 30
  people summarized 175 entities; two summaries of the same entity shared 1.99
  of 5 facts (39.8%) at top 5 and 5.42 of 10 (54.2%) at top 10, which the
  authors call moderate. The most direct measure of agreement on a summary
  layer.
- **Tullis and Wood 2004**: card-sort averages from 15 people correlated 0.90
  with those from 168; averages stabilize while individuals vary (*inferred*).
- **Hertzum and Jacobsen 2001**: any two usability evaluators agree on 5% to
  65% of problems (*secondary*).

### What this pass concluded

The closest prior statement of the whole method is **RMM (1995)**: an
entity-relationship model, per-entity slices with a head slice anchoring every
incoming reference, and a rule mapping each relationship to a navigation
structure by cardinality and instance count. It covers perhaps two thirds of
the sketch. It lacks extraction from prose, a governing question, a ladder
uniform across entities, a sources layer, and expand-in-place. OOUX is the
closest living practice for steps 2 and 3; Fresnel and Wikipedia's summary
style state steps 4 and 6 precisely.

No prior statement was found for step 1 as the start of page design, step 5 as
a formal choice of root and governing question, step 7's specific mapping, any
normal-form or completeness test for pages, or the seven steps as one
procedure. The convergence literature argues that independent modelers agree
on the main entities more than on the details, and share roughly 40 to 55
percent of the facts they would put in a summary.

## Data modeling, automated presentation and generative interfaces

### Normalization and data modeling

- **Codd 1970** ([pdf](https://web.eecs.umich.edu/~michjc/eecs584/Papers/codd_1970.pdf))
  and **Codd 1971**, "Further normalization of the data base relational model":
  repeating groups move to their own relation (first normal form); functional
  dependencies define second and third normal form. "Bill determines sponsor,
  sponsor determines district" is a textbook transitive dependency, so step 4
  is third normal form literally. Steps 1 to 4.
- **Chen 1976**, the entity-relationship model ([pdf](https://www.comp.nus.edu.sg/~lingtw/papers/tods76.chen.pdf)).
  Steps 2, 3.
- **Atzeni, Mecca and Merialdo 1997**, Araneus, "To Weave the Web", VLDB
  ([pdf](https://www.vldb.org/conf/1997/P206.PDF), read). A page scheme
  "resembles the notion of relation scheme"; repeated patterns on a page are
  nested lists; each page is a nested relation assumed to be in Partitioned
  Normal Form. **The only explicit pairing of web pages with a normal form
  found**, and it serves querying sites, not designing them. Steps 2, 4.
- **Arenas and Libkin 2004**, XNF ([pdf](https://marceloarenas.cl/publications/xnf_tods04.pdf)):
  a normal form for tree-shaped documents generalizing Boyce-Codd normal form,
  with redundancy defined through dependencies among paths. The formal tool for
  asking whether a containment tree repeats itself (*inferred relevance*).
- **Evans 2003; Vernon 2011**, [Effective Aggregate Design](https://www.dddcommunity.org/wp-content/uploads/files/pdf_articles/Vernon_2011_2.pdf):
  members of an aggregate are reached through its root, and other aggregates
  are held "by identity". The same line between containment and reference that
  step 4 draws, applied to consistency rather than display. Steps 4, 5, 7.
- **Kimball**, [dimensional modeling](https://www.kimballgroup.com/techniques/dimensional-modeling-techniques/):
  declare the grain, then attach deliberately denormalized dimensions.
  Declaring the grain resembles step 5; flattening a neighbor's attributes for
  readers is the opposite of step 4.

### Hypermedia design methods, the closest precedent

- **Garzotto, Paolini and Schwabe 1993**, HDM, TOIS (abstract only): an entity
  is a hierarchy of components; structural links stay inside an entity,
  application links cross between entities. Steps 2, 4, 7.
- **RMM 1995**, described in the first pass. This pass adds RMM's split between
  **structural links**, where "the information context remains within the same
  entity", and **associative links**, where it changes.
- **Isakowitz, Kamis and Koufaris 1997**, m-slices, HICSS
  ([record](https://archive.nyu.edu/handle/2451/14135)): each m-slice is owned
  by one entity, nests to five levels or more, may include attributes of
  related entities, and hides "details, which are encapsulated in other
  m-slices". Steps 4, 6.
- **OOHDM 1998**, described in the first pass. This pass adds that a node may
  copy a related object's attributes beside an anchor to it; the worked
  example folds Person into Story, which is what step 4 forbids. Step 4 as an
  option, not a rule.
- **WebML 2000, with units as defined by Comai and Fraternali 2001**
  ([pdf](https://files.ifi.uzh.ch/ddis/iswc_archive/iswc/ih/SWWS-2001/program/full/paper19a.pdf), read):
  a data unit shows "a set of attributes of a single object" (a view); an
  index unit lists objects "denoted by some representative attributes" (a
  label or row); a multidata unit shows a peer set; a scroller unit steps a
  sequence; a direct unit follows a many-to-one reference. The most direct
  table from relation kind to mechanism found. Steps 4, 6, 7.

### Automated presentation

- **Mackinlay 1986**, APT ([pdf](https://courses.ischool.berkeley.edu/i247/f05/readings/Mackinlay_APT_TOG86.pdf), read):
  input is relations with declared functional dependencies; a design is
  expressive only if it encodes "all the facts in the set" and "only the facts
  in the set". Read as the presentation form of a lossless join with no
  spurious tuples (*inferred*). It stops at charts. Steps 1, 7.
- **Card, Mackinlay and Shneiderman 1999**, the visualization reference model:
  raw data to data tables to visual structures to views. MPS has the same
  pipeline shape (*mapping inferred*).
- **Show Me 2007, CompassQL 2016, Draco 2019**: Draco encodes design guidance
  as hard and soft constraints with weights learned from experiments. The
  template for guidance an agent's output can be checked against; none reaches
  pages, navigation or disclosure.

### Model-based UI and schema generation

- **CAMELEON** (Calvary et al. 2003; [W3C note](https://www.w3.org/TR/mbui-intro/)):
  task and domain, abstract UI, concrete UI, final UI. MPS steps 1 to 5 sit at
  the first level; steps 6 and 7 are what Puerta and Eisenstein (1999) called
  the mapping problem.
- **Myers, Hudson and Pausch 2000**, TOCHI ([pdf](https://www.cs.cmu.edu/~amulet/papers/futureofhci.pdf), read):
  model-based tools "suffered from the problems of unpredictability" and "have
  a low ceiling"; their interfaces were "generally not as good" as hand-built
  ones.
- **Django admin** ([docs](https://docs.djangoproject.com/en/5.0/ref/contrib/admin/)):
  "model-centric"; for "a more process-centric interface", write your own
  views. Generated interfaces feel generic because they mirror storage rather
  than a reader's question, the gap step 5 targets.

### Semantic-web display, and text to graph to pages

- **Fresnel**, described in the first pass.
- **Tabulator 2006** ([W3C](https://www.w3.org/2005/ajar/About.html)): an
  expandable outline, a table of selected fields and a timeline over any RDF
  data. Step 7.
- **Wikidata** items carry a label, a short description, and statements with
  qualifiers and references; **Scholia** renders a profile per entity as
  lists, timelines and networks. Nearly the step 6 ladder, as data rather than
  design advice. Steps 6, 7.
- **BBC Dynamic Semantic Publishing 2010**: concept extraction tagged articles
  with entities in a triple store, generating more than 700 team and player
  pages. Entity tags, not atomic facts. Steps 2, 3.
- **NewsReader** (Rospocher et al. 2016): events with participants, time and
  place extracted from news into RDF, stopping before page design. Steps 2, 3.

### Generative interfaces with language models, 2023 to 2026

- **Leviathan et al. 2025**, Google, "Generative UI" ([pdf](https://generativeui.github.io/static/pdfs/paper.pdf), read):
  HTML generated directly, with planning guidelines in the prompt and no
  structured intermediate model. Preferred over markdown 82.8 percent of the
  time and judged at least comparable to expert-built sites in 44 percent;
  the full prompt scored 1553 Elo against 1496 for a minimal one.
- **Cao, Jiang and Xia 2025**, CHI ([html](https://arxiv.org/html/2503.04084v1), read).
  **The closest statement from the language-model era.** A model builds an
  object-relational model rooted in a Task object, with attributes typed as
  value, dictionary, pointer or array; a pointer renders as a "thumbnail"
  naming which fields of the referenced entity to show, linked to the full
  entity; an array renders expanded or as a summary; rendering recurses from
  the root. Its input is a task prompt, not a source text; about 94 percent of
  generated entities were judged necessary; eight participants; no comparison
  against generating code directly. Steps 2 to 7, in part.
- **Min et al. 2025**, "Malleable Overview-Detail Interfaces"
  ([html](https://arxiv.org/html/2503.07782v1)): readers move attributes
  between overview and detail. Step 6.
- **Graphologue 2023** ([arXiv](https://arxiv.org/pdf/2305.11473)): entities
  and relations extracted from model answers into diagrams. Steps 1 to 3.

### Empirical results on an intermediate structure

No study tests an entity model for turning content into a page. The nearest:

- **Chen et al. 2025** ([html](https://arxiv.org/html/2508.19227)): a
  structured interaction representation beat natural language (17 against 13
  percent win rate), and iterative refinement mattered more (31 against 17).
- **Athena**, Apple 2025 ([html](https://arxiv.org/html/2508.20263v1)): a
  storyboard, data model and interface skeletons; all twelve developers
  preferred it for navigation flows, yet it produced more bugs and lower
  satisfaction, and the intermediate step's effect is not isolated.
- **STORM**, NAACL 2024 ([pdf](https://arxiv.org/pdf/2402.14207)), text rather
  than interfaces: removing the outline stage halved entity recall (14.10 to
  7.39) and cut coverage (4.88 to 4.37), while organization held (4.82 with
  the outline, 4.87 without).

### What this pass concluded

Most of the sketch exists in the 1993 to 2001 hypermedia methods, read
together: RMM's entity-relationship decomposition, slices with a head slice,
the structural and associative link split, and mechanisms chosen by
cardinality; OOHDM's navigation objects as database views; WebML's unit per
relation kind. They cover steps 2, 3, 6 and 7 in formal detail and step 4 in
part. They lack prose as input, a governing question per page, separate
summary and sources layers, any normal-form argument, and a rule against
copying a neighbor's facts: OOHDM and m-slices allow the copy and Kimball
prefers it.

Searches for "presentation normal form", "UI normalization" and "normal forms
for user interfaces" found nothing that maps the normal forms onto page
design; the one hit uses "normal UI" for splitting workflows across screens.

## Taken together

- **Prior statement exists** for entities and relations as the basis of a
  site (RMM, OOHDM, WebML, OOUX, BBC), for a label projection used wherever an
  entity is referenced (RMM's head slice, Fresnel's label lens, WebML's index
  unit, Salesforce compact layouts, Cao et al.'s thumbnail), for layered depth
  (Wikipedia's summary style, Nielsen), and for choosing a mechanism by the
  kind or cardinality of a relation (RMM, WebML, Shneiderman).
- **No prior statement was found** for extracting atomic facts from prose as
  the first step of page design, for a governing question that selects the
  root, for the normal forms as a test of a page, for the checks (nothing
  lost, no duplicates, scent, depth, no empty slots) as a pre-build gate, or
  for the whole as one procedure an agent can follow.
- **Known failure of the lineage**: generated interfaces were unpredictable,
  low in ceiling and worse than hand-built ones (Myers et al. 2000); they
  mirror storage, not a reader's question (Django). A procedure that keeps a
  model in the loop must answer that, and the governing question is the
  candidate answer.
