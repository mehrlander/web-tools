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

**A checkout is not delivery, and this instruction used to say it was.** Until
2026-09-12 web-tools' `CLAUDE.md` `@`-imported both halves, so the presence of
that checkout meant the conventions were already in context and this skill said
to stop. No repo imports them now. Read on whatever the checkout looks like, and
stop only if both documents are demonstrably in context already.

The failure that rule would cause is a closed loop rather than a missing file:
the nudge fires because nothing delivered the conventions, the session invokes
this skill, the skill sees a checkout and says there is nothing to load, and the
session proceeds without them having done everything right. Measured live on
2026-09-13, the first session to run the plugin-only path.

Load both. `SURFACING.md` governs how a reply reaches the reader;
`QUALIFIED-WRITING.md` governs the prose of every document, commit message, PR
body, and reply the session writes. Neither is optional, and the writing half
is the one a session is most likely to violate without noticing. Prefer the
copies beside this `SKILL.md`, which ship in the plugin and cost no fetch;
otherwise:

```bash
base=https://raw.githubusercontent.com/mehrlander/web-tools/main/docs
curl -fsSL "$base/SURFACING.md"
curl -fsSL "$base/QUALIFIED-WRITING.md"
```

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
