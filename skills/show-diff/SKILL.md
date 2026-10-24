---
name: show-diff
description: "Summoned when proposing a change to an existing document the user will review, a skill file, a piece of prose, a config, and you want the edit shown rather than described in words or dumped as a block to paste into a separate tool. Also when the user asks to see an edit as a diff or a tracked change. Renders one before/after pair as a self-contained, dependency-free HTML diff artifact. Not for writing a document, only for showing a change to one. Read before proposing the edit."
---

# Show Diff

## Premise

A proposed edit to an existing document is hard to take in as prose ("change X to Y") or as a raw block to paste into a separate tool. The usual library stack (Tailwind, daisyUI, Alpine, a diff lib over CDN) does not render in the artifact frame without the baking pipeline, so the diff stands alone: plain HTML, CSS and JS that fetch nothing and render on open. Keep the template that way when changing it, and keep two choices it depends on: the texts sit in hidden `<pre>` blocks read back through `.textContent`, which renders backticks, `${...}`, quotes and tags in the documents inert; and `text-size-adjust: 100%`, without which iOS Safari inflates long non-wrapping lines. Word-level highlight inside changed lines and a side-by-side view already exist in web-tools' `lib/kits/text-diff.js` and `lib/kits/cm6-merge.js`, if the template ever needs them.

## Goal and output

One self-contained HTML artifact: a console-style inline diff of a single before/after pair, edge-to-edge, reading like a view the app already owned. Companion template at `assets/doc-diff.html`. Fill it, present it. The diff is line-based on purpose: a word-level pass mis-pairs repeated tokens, bullet markers and punctuation.

## Process

- Copy `assets/doc-diff.html` to the output directory.
- Old text into the hidden `<pre id="a">`, new text into `<pre id="b">`, each HTML-escaped (`&`, `<`, `>`).
- Set the `.name` label to the document under review.
- Present the file.
- For a coarse, line-level change a fenced `diff` block in chat is the cheaper route. Reach for the artifact when the edit is surgical, long, or wants the console view.
