---
name: show-diff
description: "Summoned when proposing a change to an existing document the user will review, a skill file, a piece of prose, a config, and you want the edit shown rather than described in words or dumped as a block to paste into a separate tool. Also when the user asks to see an edit as a diff or a tracked change. Renders one before/after pair as a self-contained, dependency-free HTML diff artifact. Not for writing a document, only for showing a change to one. Read before proposing the edit."
---

# Show Diff

## Premise

A proposed edit to an existing document is hard to take in as prose ("change X to Y") or as a raw block to paste into a separate tool. The reader reconstructs the change by hand. The usual library stack (Tailwind, daisyUI, Alpine, a diff lib over CDN) does not render in the artifact frame without the baking pipeline, which is too much apparatus for a glance. The diff must stand alone, fetch nothing, render on open.

## Goal and output

One self-contained HTML artifact: a console-style inline diff of a single before/after pair, edge-to-edge, reading like a view the app already owned. Companion template at `assets/doc-diff.html`. Fill it, present it.

## Process

- Copy `assets/doc-diff.html` to the output directory.
- Old text into the hidden `<pre id="a">`, new text into `<pre id="b">`, each HTML-escaped (`&`, `<`, `>`).
- Set the `.name` label to the document under review.
- Present the file.
- For a coarse, line-level change a fenced `diff` block in chat is the cheaper route. Reach for the artifact when the edit is surgical, long, or wants the console view.

## Key insights

- Dependency-free. No CDN, no framework. Plain HTML, CSS, JS, so it renders in the artifact frame unaided.
- Before and after sit in hidden `<pre>` blocks, read back through `.textContent`. The decode renders backticks, `${...}`, quotes, and tags inside the documents inert. The documents are often skill files carrying all of these; the decode is load-bearing.
- Line-based diff, not word-based. A word-level pass mis-pairs repeated tokens, bullet markers and punctuation, and smears the highlight. Whole-line highlighting stays clean.
- The tally counts lines.
- `text-size-adjust: 100%`. Without it iOS Safari inflates wide non-wrapping lines, so long lines grow and row heights go ragged.
- One line-number column, the resulting-file number. A removed line carries the sign and no number.
- Chrome stripped: no card, no radius, safe-area insets, light and dark through `prefers-color-scheme` on a git-diff palette.

## Extending

- Word-level highlight inside changed lines: pair changed line i with i, diff within. Recovers the surgical-edit case the line view gives up.
- Side-by-side on desktop, collapsing to unified below a width threshold. Cramped on a phone.
- Copyable git patch: standard `@@` hunks with `+`/`-` prefixes as plain selectable text.
