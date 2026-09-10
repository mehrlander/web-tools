---
name: default
description: >-
  The context every session runs on: the portable surfacing conventions
  from mehrlander/web-tools (docs/SURFACING.md), fetched into a session
  that does not have that repo checked out. Load this at the start of any
  session that did not receive them, and in any repo when the user
  mentions "my conventions", "house rules", surfacing/per-file link
  format, show-pixels/screenshot-it, "hand over the artifact"/SendUserFile,
  branch anchor, wrap-up, or PR body shape, or when invoked explicitly as
  /portable:default.
---

# The default session context

A session with `mehrlander/web-tools` checked out already has the conventions:
its `CLAUDE.md` carries Qualified writing and `@`-imports `docs/SURFACING.md`.
If the checkout is present, say so and stop; there is nothing to load.

Otherwise, fetch the primitives, which govern every reply:

```bash
curl -fsSL "https://raw.githubusercontent.com/mehrlander/web-tools/main/docs/SURFACING.md"
```

Fetch `docs/surfacing-course.md` beside it only when this session will open or
drive a pull request. It is the guide-PR lifecycle and idles until one exists,
which is why it is a second file rather than a longer first one.

If `curl` is denied, use `mcp__github__get_file_contents` (owner `mehrlander`,
repo `web-tools`), or WebFetch on the same raw URLs.

Apply it with the current repo substituted into the URL templates; where the
current repo's own CLAUDE.md conflicts on a point, the current repo wins. Then
report the repo's frozen paths per [`markers/SKILL.md`](../markers/SKILL.md):
nothing declared means say nothing; anything declared is named in one line
before any editing.
