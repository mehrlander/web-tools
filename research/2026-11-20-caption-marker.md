# Caption marker: how the session detail caption links the Sessions program

This probe tested how the Claude app draws candidate forms of the session detail caption. The caption is the line that [`session-detail-caption.py`](../skills/hooks/session-detail-caption.py) supplies for the end of every reply. The probe was run to choose how that line links the [Sessions program page](https://mehrlander.github.io/web-tools/app/?view=program&program=sessions).

The app draws each Markdown code span as a grey box with rounded ends. This write-up calls that box a pill. The stamp is the code span that opens the caption with the time the hook printed it.

## Question

The caption ended on `· [📖](…)`, a book emoji linking the program page. The book read as one more metric after a separator dot. A book also suggests documentation, while the program page is a dashboard. Which marker, in which position, links the program page cleanly?

## What was tried

About sixty mockups of the caption were written into chat replies with live links, and the owner judged each from screenshots of the rendered reply. The client and device were not recorded. The variables:

- **Marker:** words in Mathematical Sans-Serif letters, emoji (📖 🗂️ 🏠 💬), and text glyphs (⌂ ⋯ ⋮ ↗ ≡ ☰ ▤ ☷ ⌘ ◎ ⎈ ↻ ∞ ⚑ 🗨 🗪 🗫), bare or framed in brackets, parentheses or angle quotes.
- **Position:** first, joined to the start or end of the stamp, after the stamp, after the message count, and last.
- **Setting:** plain link text or a linked code span, with the metrics as text between middle dots or each in a pill of its own.
- **Spacing:** one space, two no-break spaces, an em space, and no space.

## Findings

1. Adjacent code spans with no space between them render as one pill. In a linked span, only the linked part takes the link underline. A glyph can therefore sit inside the stamp's pill as its own link.
2. A linked code span keeps its pill. Digits and letters in it turn blue. A lone glyph in a linked pill differs from an unlinked pill mainly by its underline.
3. In prose, two no-break spaces and an em space each rendered at the width of one ordinary space, the widest gap measured.
4. In a pill, ⌂, ⋮ and the middle dot render small, and ⌘ renders crisp. ▤ reads as a document icon and ☷ as a drag handle.
5. 🗨 and 🗫 render as solid black glyphs from a fallback font and keep that color when linked. At caption size, 🗫 merges into a blob. A glyph outside common fonts may draw differently, or not at all, on another client.
6. 💬 renders pale against a white background. It is legible beside its count and weak as a link by itself.
7. Angle quotes frame ⋯ evenly but render small beside ⌘.
8. In the owner's judgment, a middle dot beside ⋯ reads as clutter. Metrics in pills of their own read as a status strip.

## Outcome

The caption now opens with ⌂ as a linked code span placed against the stamp with no space. The two render as one pill with the house as its icon. The context and the session's age each have a pill of their own, with k, d, h and m as unit letters. Single spaces separate the parts, and the 📖 link was removed. [CONVERSATION.md](../docs/CONVERSATION.md) states the current form.

⌂ was chosen over ‹⋯› at the end of the line and over 🗨. It shares the stamp's pill. A house suggests the place every session belongs to, which the program page lists. It is present in nearly every font. The open risk is the tap target, one small glyph at the edge of a pill.

## Source chats

- [The caption marker session](https://claude.ai/code/session_01Ug8CXBjF2XPbWgn4LncWYw), 2026-11-20.
