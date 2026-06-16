# Branch guide: claude/stoic-clarke-c8jwcl

Reworking the portable docs set: (1) make adoption à la carte, with CONVENTIONS.md severable into universal surfacing primitives plus an opt-in PR-workflow layer; (2) retire the overloaded "spine" term for a distributed vocabulary (surfacing course / surfacing moments / plain "shape"); (3) a succinctness + restructure pass on CONVENTIONS.md that also fixes the layering (course machinery now lives under the course, not under the universal primitives).

⭐ [docs/CONVENTIONS.md (branch)](https://github.com/mehrlander/web-tools/blob/claude/stoic-clarke-c8jwcl/docs/CONVENTIONS.md)

**Changed:**
- docs/CONVENTIONS.md — terse rewrite: two-layer adoption framing, course consolidated into one section with the three artifacts + table, wrap-up/UI-trigger/next-PR moved under the course, sentence-case headings, no em dashes
- docs/PORTABLE.md — CONVENTIONS row severability; MERGE-GUIDE line ties to the opt-in course
- .claude/skills/web-tools-conventions/SKILL.md — description + Apply reflect severable/opt-in intent and new vocabulary

**Next steps / open threads:**
- Rule content (link formats, shapes, handoff) preserved; only adoption framing, terminology, and concision change. Restored load-bearing lines the first compression dropped (merge-guide "reading for inclusion," HP diagnostic-tests, stale-guide rule, [new]/[main]/[diff] definitions).
- Artifact headings left un-numbered to preserve the durable `#branch-guide` anchor linked from MERGE-GUIDE.md (#171).
- docs/MERGE-GUIDE.md left as-is: its "spine" mentions are historical entries, not overwritten.
