---
name: default
description: >-
  The context every session runs on: the portable conventions from
  mehrlander/web-tools, the surfacing primitives (docs/SURFACING.md) and
  the Qualified writing rules (docs/QUALIFIED-WRITING.md), fetched into a
  session that does not have that repo checked out. Load this at the start
  of any session that did not receive them, and in any repo when the user
  mentions "my conventions", "house rules", surfacing/per-file link
  format, show-pixels/screenshot-it, "hand over the artifact"/SendUserFile,
  branch anchor, wrap-up, PR body shape, qualified writing, or the no-em-dash
  rule, or when invoked explicitly as /portable:default.
---

# The default session context

A session with `mehrlander/web-tools` checked out already has the conventions:
its `CLAUDE.md` `@`-imports both halves of the contract. If the checkout is
present, say so and stop; there is nothing to load.

Otherwise, fetch both. `SURFACING.md` governs how a reply reaches the reader;
`QUALIFIED-WRITING.md` governs the prose of every document, commit message, PR
body, and reply the session writes. Neither is optional, and the writing half
is the one a session is most likely to violate without noticing:

```bash
base=https://raw.githubusercontent.com/mehrlander/web-tools/main/docs
curl -fsSL "$base/SURFACING.md"
curl -fsSL "$base/QUALIFIED-WRITING.md"
```

Both also ship beside this SKILL.md in the plugin, so read the sibling copy
instead where the plugin is installed and the fetch costs nothing.

Fetch `docs/surfacing-course.md` beside it only when this session will open or
drive a pull request. It is the guide-PR lifecycle and idles until one exists,
which is why it is a second file rather than a longer first one.

If `curl` is denied, use `mcp__github__get_file_contents` (owner `mehrlander`,
repo `web-tools`), or WebFetch on the same raw URLs.

Apply them with the current repo substituted into the URL templates; where the
current repo's own CLAUDE.md conflicts on a point, the current repo wins. Then
report the repo's frozen paths per [`markers/SKILL.md`](../markers/SKILL.md):
nothing declared means say nothing; anything declared is named in one line
before any editing.
