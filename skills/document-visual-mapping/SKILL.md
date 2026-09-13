---
name: document-visual-mapping
description: "Map a reference document (PDF manual, rulebook, instruction packet) into a standoff register that drives an interactive reader: a split-viewer, swipe deck or step list that opens a page and highlights one phrase. Use when the user wants to walk, slice or highlight a source document in a UI, build an interactive guide from a PDF, or bind reader cards to page coordinates."
---

# Document visual mapping

Content mapping (`atomic-decomposition`, `state-the-rule`) asks what a document
requires. This asks where on the page that requirement sits. Run it second, over
the units a content pass kept. Skip the content pass and the register highlights
whatever looks prominent; skip the register and the reader hunts fifty
obligations across thirty pages by hand.

## The register

One CSV, one row per step:

```csv
track,kind,title,note,file,page,anchor
```

`track` groups rows into procedures. `kind` weighs them, so a display can quiet
the scaffolding and mark what stops a reader (budget-drs uses `setup`, `step`,
`decision`, `gate`). `note` is the authored gloss. `file` and `page` address the
document, and `anchor` is the phrase to highlight: `source-anchoring` at one hop,
with a coordinate attached.

## The five steps

1. **Mirror and extract.** Copy the document into an immutable `source-docs/`
   directory. Extract its text one page per form feed (`\x0c`) into
   `_meta/extracted-text/`. That text is the ground for every later assertion.

2. **Triage.** Read the extracted text for what is load-bearing before choosing
   any anchor: irreversible choices, conditions that block progress, and
   behaviors that look like faults and are not, such as an empty-state notice
   before the first record, or a grid that shows drafts over approved copies.

3. **Anchor.** One exact phrase per row, at one of three levels:
   - **Landmark**, a section or screen heading, so the reader can confirm the
     page: `Logging On`.
   - **Parameter**, a field label with its constraint: `Version Code: 2-8
     Characters of choice, do not use I or O`.
   - **Payload**, an action, message or dialog: `Select the Packet icon under
     View/Prepare`.

   Never anchor a sentence fragment, a trailing preposition, or a cut-off
   clause. An anchor a reader meets on its own must still parse on its own.

4. **Gate the build.** The builder asserts that each anchor appears on the page
   its row names, and exits nonzero otherwise:

   ```python
   assert " ".join(anchor.split()) in " ".join(page_text.split()), \
       f"anchor not on page {page}: {anchor!r}"
   ```

   That assertion is the whole guarantee: no phantom highlight, and a
   repaginated reissue fails the build instead of opening the reader on the
   wrong page.

5. **Render.** Serialize the validated register to a payload the interface
   reads. A card opens the document at its page and highlights its anchor. No
   page text and no coordinates in the markup.

## What the gate does not catch

An anchor holds while the screen behind it changes. A guide revised two years
ago describes a live system, so a row can pass the build and still be wrong in
front of a user. Record when each row was last checked against the system.

## Worked example

`mehrlander/home`, `projects/budget-drs/submittal/abs-guide.csv`: 37 rows over
five tracks against two OFM PDFs, gated by `tools/build-submittal.py` and
rendered as the Budget DRS app's ABS tab.
