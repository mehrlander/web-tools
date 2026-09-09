---
name: screenshot-review
description: "Review a rendered screenshot before handing it over or drawing a conclusion from it, using a self-read against a failure checklist and a fresh-eyes reader (a context-free Haiku subagent) run blind first, then informed. Use when a headless screenshot is about to be sent into chat, when a shot is the evidence that a change worked, when the user asks what a human would notice in an image, or when invoked as /screenshot-review with an image path."
---

# Screenshot Review

## The premise

A headless screenshot that fails rarely errors; it renders something plausible
and wrong. The recorded classes (web-tools `docs/SNAGS.md`): typography CSS
silently missing, pixels unchanged because the new file never loaded, a shot of
the wrong build, a near-blank shot that exited 0, overflow the viewport hides.
The session that produced the shot is the worst-placed reader of it: it knows
what the image is supposed to show, so it sees that. The user, arriving fresh,
notices what is actually there. This skill puts a fresh reader in front of the
image before the user is.

## Goal and output

A findings block, produced before the screenshot is sent or cited as evidence:

```
Screenshot review: <path>
Blind reader: <what a context-free reader reported, compressed>
Informed reader: <whether the claimed change is visible, verbatim verdict>
Self-read: <checklist hits, or "clean">
Discrepancies: <each point where reader and expectation diverge> | None
```

A discrepancy is a finding, never noise. Fix or explain each one before the
image travels.

## The process

1. **Self-read.** Read the image yourself and walk the checklist below.
2. **Blind reader.** Spawn a subagent (`model: haiku`) whose whole prompt is:
   read `<path>`; describe the page as a first-time viewer; then list anything
   a person would flag: broken, empty, misaligned, unstyled, placeholder, or
   odd. Give it no other context. Blind runs first: an informed reader is
   primed and stops seeing.
3. **Informed reader.** Same subagent (or a second), now told the one-sentence
   intent: "the change was X; is X visible in this image, and does anything
   contradict it?" A "yes, visible" answer must name pixels, not restate the
   intent.
4. **Reconcile and report.** Emit the findings block. If the informed reader
   cannot see the change, treat the shot as evidence of nothing (the
   silent-old-build class) and re-render before arguing with the reader.

Steps 2 and 3 can be one subagent call with the two questions ordered
blind-then-informed in a single prompt; ordering, not separation, is the
requirement.

## The checklist (self-read)

Seeded from the SNAGS classes; extend it there first, here second.

- Flat prose: body text in default serif or unstyled weights where the page
  uses a design system.
- Unchanged pixels: the image is compatible with the previous state of the
  page. If you cannot point at a pixel the change moved, the shot proves
  nothing.
- Empty or vacuous regions: blank panels, zero-row tables, a near-blank page.
- Placeholder data where real data was wired.
- Clipping and overflow: the shot cannot show horizontal overflow, so pair it
  with a `scrollWidth` measurement rather than trusting the frame.
- Wrong build: for a page importing a pre-build, confirm the build ran for the
  code under test before reading anything off the pixels.
- Theme mismatch: colors from the wrong theme, illegible contrast.
- Missing icons or fonts: tofu boxes, icon-font ligature text.

## Key insights

- **A fresh reader catches wrongness; only diff-awareness catches staleness.**
  The blind reader cannot know pixels failed to change. That is why the
  checklist's "unchanged pixels" item belongs to the self-read, and why the
  informed pass states the intent.
- **The reader cannot see what did not render.** Mechanical signals (the shot
  log's did-NOT-load warnings, `scrollWidth`, exit codes) are not replaced by
  this skill; they answer questions no image can.
- **"Looks fine" is not a verdict.** Require the reader to describe before
  judging; a description that omits the region under test is itself a finding.

## Extending

The natural next step is wiring: a `--review` flag on the repo's shot script,
or a hook on the image-send tool, so the review is not a memory. This skill
stays the protocol either way; automation would invoke it, not replace it.
