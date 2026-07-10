---
name: shape-text
description: "A reference on using structure in text to convey information. Consult it when working structure into or out of a document, chat answer, or HTML page, alongside the stated aim, for example surfacing structure latent in flat prose, calming an over-formatted draft, or auditing whether existing structure is used with discipline. Covers what each form asserts, detection cues, the shape-to-form map, the emphasis budget, HTML canvas levers, channel discipline, and the fold."
---

# Shape Text

## Premise

Text conveys relations: sequence, comparison, containment, accrual. It can do so in plain prose, but it can also use symbols and structures that enrich the text with additional semantic layers and affordances. The power comes from common knowledge of what a form means, and from the sharpness with which it arrays bits of information within its frame. The relations a passage holds are its shape.

Two surfaces hold the levers. Markdown offers a small fixed palette, and the craft is selection and rationing. An HTML page adds the canvas: measure, space, channels, and the fold.

## Goal and output

The goal is the smart use of structure in text. The right approach depends on the ask, but the major themes include discipline and balance.

## Process

No specific process is prescribed, but iterative thinking is helpful. Good use of structure typically emerges, and starts with pattern identification. A pattern may also have been forced into a structure and look smooth; catch the weak or faulty premise underneath.

## Key insights

- **A form asserts.** A structure makes a claim about its content. Discipline is honoring the claim; the map's third column states it per form.
- **Rich means low-friction.** Presenting information richly means a smooth read, not visual load.
- **The wall is a default.** Test a flat passage against what it might secretly be: a sequence, a comparison, a definition set, a decision.
- **Detection cues.** Enumeration ("three factors", "first, then"), contrast frames ("whereas", "unlike"), conditionals ("if", "unless"), sequence markers ("before", "once"), definitional phrasing ("is defined as", "we call"), and parallel construction repeated across sentences, which marks the rows of one table.
- **Peers only.** A list asserts its items are peers of one kind. Sentences that build on each other are a paragraph.
- **Emphasis is a budget.** Bold for a term of art at first naming. A heading only where a reader would otherwise lose the thread. A rule only at a genuine break. Spent everywhere, each signal reads as noise.
- **A slot is not a reason.** Markup chosen because the position expects markup (a header because answers open with headers) fills a slot with a token. No shape, no form.
- **A distinction is a structure.** Not-X-but-Y asserts X was live and Y displaces it. Two paired generalities displace nothing, and the frame is a gesture. Reserve the form for a pole the narrative raised and a cut that removes ambiguity.
- **Good structure disappears.** The reader takes in the idea without noticing the scaffolding. Formatting that announces itself has spent budget for no return. When in doubt, prose.
- **Name, then hold.** Introduce a coined term in the content before any apparatus or later section leans on it, then keep the exact term. Near-synonym drift dissolves what the naming built.
- **Labeled pairs are the middle form.** A fixed label vocabulary with bold-led one-line entries sits between prose and table: scannable without asserting a grid. Fits notes, apparatus, at-a-glance blocks. This section is the form in use.
- **Less text outranks tighter boxes.** When a section feels unwieldy, the first fix is fewer words, not narrower containers or added headings.

## The map

| Shape | Form | The form asserts |
|---|---|---|
| Ordered procedure | numbered list | order matters |
| Unordered peers | bulleted list | items are peers of one kind |
| Comparison across shared attributes | table | cells are comparable down each column |
| Term and meaning pairs | definition list, or bold-led pairs in markdown | each term is distinct and means one thing here |
| Taxonomy | nested list | indentation is containment |
| Condition and outcome | decision table | the listed conditions determine the outcome |
| Quoted authority | blockquote | the words are another's, verbatim |
| Commands, literals, machine text | code | every character is literal |
| Scene, narrative, argument that builds, weighed judgment | prose | the reasoning is cumulative |

## The HTML canvas

Levers dormant in markdown, where the renderer decides:

- **Measure.** Cap prose columns near 66 characters (45 to 75), max-width in ch. Prose columns only: headings, tables, and full-bleed elements are exempt, and capping them makes a page look broken rather than considered.
- **Leading.** line-height near 1.5 for body text.
- **Space.** Proximity groups, separation divides. Whitespace carries hierarchy before any glyph changes.
- **De-emphasis.** Build hierarchy by dimming the secondary (opacity, muted color) sooner than by enlarging the primary.
- **Type features.** font-variant and font-feature-settings for small caps, text figures, ligatures; confirm the font carries them. hanging-punctuation is Safari-only.

An explainer can enact each rule in its own typesetting; the demonstration then replaces a paragraph.

## Channel discipline (HTML)

Assign each visual channel one meaning and hold it. A working inventory: hue for identity, type family for voice, opacity for presence, weight for coinage, enclosure for speech act, scale and style for caesura, modality matched to content shape. A recurring form recurs exactly: the box that poses a problem rhymes visually with the box that defines the answer.

## The fold (HTML)

A scroll is multiplexed by space; tabs, decks, and collapsibles are multiplexed by time, through navigation. Navigation can keep an overview (the strip) and detail (the pane) visible together. Shneiderman's ordering: overview first, details on demand. But keep comparanda on one plane.

A fold also enforces grain: eight tabs assert eight peers at one altitude, and the panel that is a different kind of thing stands exposed.

An opt-in second plane (instructor or reviewer notes behind a control, rendered from the same data as the content) carries apparatus without crowding the read and cannot drift from what it annotates.

The category behind tab deck, collapsible tree, video, and PDF is the access mode, defined by its traversal verb (switch, expand, scrub, page) rather than its appearance.

## When prose stays prose

Consider cumulative force. An argument that builds, a narrative, a judgment weighing considerations: bullets assert a peer-hood these do not have, and extraction into a table strips the reasoning that connected the cells. Where a passage resists the map, hand off: arriving-together governs the sequencing of prose that stays prose; succinct-text executes the less-text fix.

## Extending

- A drafted research prompt on access modes (multiplexing provenance, the Cockburn-Karlson-Bederson taxonomy, Green's cognitive dimensions, explorable explanations) is pending; its findings would grow the fold into a catalogue of modes with traversal verbs and visibility tradeoffs.
- Horn's Information Mapping types and Wurman's LATCH could graduate the map into a fuller shape taxonomy.
- The layout-primitive research (Every Layout, Gerstner) seeds a sibling skill on composable layout, out of scope here.

Grounding: Bringhurst, Butterick, Rutter on typography; Lupton, Horn, Wurman, Schriver and Redish, Minto on information design; Shneiderman and Tufte on the fold and its dissent.
