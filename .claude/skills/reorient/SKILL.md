---
name: reorient
description: Re-orient the user with a fixed-form recap of the session so far: goal, decisions made, current state with links, open questions, next actions. Use when the user says "reorient", "recap", "catch me up", or "where are we", or after a long gap in the conversation.
---

# Reorient

Summarize the session so far in this exact shape, kept to one screen. The
fixed form is the point: every reorientation reads the same way, so the user
can scan by section.

1. **Goal:** one sentence: what this session set out to do and why.
2. **Decisions:** the choices settled so far, one line each, in the order they
   were made. State the decision, not the deliberation.
3. **State:** what exists right now: branch, files changed, PRs, tracker tasks
   touched. Every artifact linked with explicit markdown, no bare paths. Close
   the section with the 🧭 guide link when one exists.
4. **Open:** questions raised but not settled, one line each.
5. **Next:** the immediate next actions, in order.

Rules: plain, dry register; no em dashes; a recap introduces nothing new (no
proposals, no analysis); when a section is empty, write "none" rather than
omitting it, so the form stays fixed.
