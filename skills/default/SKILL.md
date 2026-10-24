---
name: default
description: >-
  The context every session runs on: the portable conventions from
  mehrlander/web-tools, the conversation rules (docs/CONVERSATION.md) and
  the Qualified writing rules (docs/QUALIFIED-WRITING.md), shipped beside
  this skill. Load them at the start of any session that did not receive
  them, and in any repo when the user
  mentions "my conventions", "house rules", surfacing/per-file link
  format, show-pixels/screenshot-it, "hand over the artifact"/SendUserFile,
  branch anchor, wrap-up, PR body shape, qualified writing, or the no-em-dash
  rule, or when invoked explicitly as /portable:default.
---

# The default session context

**A checkout is not delivery.** No repo's `CLAUDE.md` imports these documents,
so a web-tools checkout does not mean they are in context. Read on whatever the
checkout looks like, and stop only if both documents are demonstrably in context
already.

Load both. [`CONVERSATION.md`](CONVERSATION.md) governs how a reply reaches the reader;
[`QUALIFIED-WRITING.md`](QUALIFIED-WRITING.md) governs the prose of every document, commit message, PR
body, and reply the session writes. Neither is optional, and the writing half
is the one a session is most likely to violate without noticing. Prefer the
copies beside this `SKILL.md`, which ship in the plugin and cost no fetch;
otherwise:

```bash
base=https://raw.githubusercontent.com/mehrlander/web-tools/main/docs
curl -fsSL "$base/CONVERSATION.md"
curl -fsSL "$base/QUALIFIED-WRITING.md"
```

If `curl` is denied, use `mcp__github__get_file_contents` (owner `mehrlander`,
repo `web-tools`), or WebFetch on the same raw URLs.

Apply them with the current repo substituted into the URL templates; where the
current repo's own CLAUDE.md conflicts on a point, the current repo wins.
