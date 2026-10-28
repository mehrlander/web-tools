# Minimal progressive structure: the method, as the test agents received it

A method for turning content that arrives as text into a page. The page it aims
at shows the reader's subject in full, shows each related thing by a label, and
reaches every fact in the source in a small number of steps. The method runs in
two halves: **normalize** the content into an entity model, then **project**
that model onto the page in layers. Write each half's output down before
building, and render the page from it.

## Half one: normalize

Each form removes one defect, in the manner of database normal forms.

**Form 0: text.** The input. Its structure is implicit in grammar.

**Form 1: atomic facts, repeated groups as collections.** Split the text into
facts, each a single assertion: an owner, a property or relation, a value, and
the source sentence. Where several facts share a shape (four laptops, each with
a price, a weight and a battery life; a list of endorsers), declare a collection
whose columns are the shared fields. Defect removed: lists buried in prose, and
sentences that carry several facts at once.

**Form 2: each fact on its owner.** Attach every fact to the one thing it is
about. A fact about a pairing belongs to the pairing: a player's statistics for
one season belong to the player-season. A fact about one member of the pairing
belongs to that member: the player's birthplace belongs to the player. Defect
removed: facts stranded on whatever they happened to be mentioned beside.

**Form 3: references, not copies.** When a fact reaches the subject only
through another thing (a bill, its sponsor, the sponsor's committee seats), the
fact lives on that other thing, and the subject holds a reference to it. Defect
removed: a subject's view crowded with its neighbors' details, and the same
detail repeated across views.

**Earned views.** Not every noun is an entity. A thing earns a view of its own
only when it has facts of its own beyond what names it, or relations to more
than one other thing. Otherwise it stays a value: an item in a list, a cell in a
row. Splitting past this point, a tap for every noun, is the opposite failure:
it charges the reader a step and returns nothing.

**Relation kinds.** Give each relation one kind:

- **attribute:** a value of the thing (a price, a date, a count).
- **part:** contained in it (chapters of a book, sections of a bill).
- **member:** one of a collection of like things.
- **reference:** a separate thing it points to (a sponsor, a manufacturer).
- **sequence:** ordered in time (amendments, versions, steps).
- **comparison:** peers the reader weighs against each other on shared fields.
- **evidence:** the quotation or source passage behind a claim.

Half one's output is the **entity model**: the entity types and their fields,
the entities, the collections, and the relations with their kinds.

## Half two: project

**Root and governing question.** Write the one question the reader brings to
the page ("Which of these laptops fits a student budget?", "What does this
recipe ask of a weeknight cook?"). The **root** is the thing that question is
about. When the question is about a set, the root is the collection, and its
full view is the comparison of its members. Choosing the root is a judgment
about the reader, so state it.

**Projection levels.** Give each entity type a ladder of four projections:

- **Label:** the name, plus the one or two qualifiers a reader needs to decide
  whether to follow it, chosen for the place where it appears.
- **Row:** the fields that tell one member of its collection from another.
  These are the collection's columns.
- **View:** all of its own facts, with each relation shown as the related
  thing's label or row.
- **Sources:** the quotations, source passages and method behind its facts.

The page shows the root as a view and each neighbor as a label or a row. One
interaction raises a neighbor to its own view (a panel, a dialog, a strip card,
a route), and that view follows the same rule in turn. A fact's distance from
the root in the model sets its default depth on the page.

A label is the one sanctioned copy. Copying a neighbor's attribute into its
label is right when the attribute identifies the neighbor or bears on the
governing question at that spot, and wrong otherwise.

**Order within a view.** Order facts by their bearing on the governing
question: the answer first, then what identifies, then what compares, then
background.

**Mechanism by relation kind.** The default form for each kind:

| Relation kind | Default on the page |
|---|---|
| attribute | a field in the view; a column in a collection |
| part | an outline that expands in place |
| member | a table or list whose rows share columns; a pick opens the member's view |
| reference | a label that opens the referenced thing's view |
| sequence | a timeline, where position and interval carry meaning |
| comparison | side by side, each field at the same place on every side |
| evidence | a disclosure attached to the claim it supports |

## Checks before building

1. **No duplicates.** Each fact appears in full in one view; anywhere else, at
   most inside a label.
2. **Nothing lost.** List the source facts that no path on the page reaches.
   Dropping a fact is a decision; state it.
3. **Scent.** Every control names what it reveals. A control labeled "More" or
   "Details" fails.
4. **Depth.** The answer to the governing question is on the first screen, and
   every fact is within two interactions of it, sources excepted.
5. **No empty slots.** A level, section or control with nothing distinct in it
   is left out, and a thing that has not earned a view gets none.

## Output

Before the page, write: (1) the governing question and the root; (2) the entity
model; (3) the projection table, giving each entity type's label, row fields and
view sections; (4) the outcome of the five checks. Then build the page from that
model, keeping the model as the page's data.
