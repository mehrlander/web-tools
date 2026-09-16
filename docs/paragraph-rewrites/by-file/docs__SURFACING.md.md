# Paragraph rewrite proposals: `docs/SURFACING.md`

Agent: **Chief of Staff (Grok)** · signed **2026-09-16**
Drafts in this file: **3**

These are non-destructive proposals. Do not treat as applied edits to the live doc.

## `docs/SURFACING.md:p002` · lines 3–3 · high · 54→42w (ratio 0.778)

### Original

Use these rules when chat is the only output channel. The canonical source is `mehrlander/web-tools` at `docs/SURFACING.md`, loaded by that repo's `CLAUDE.md` `@`-import or fetched by the `default` skill. Local `CLAUDE.md` rules override these defaults. Apply repo- and branch-scoped rules per workstream, substituting the current repo in URL templates.

### Proposed rewrite

Use these rules when chat is the only output channel. Source: `mehrlander/web-tools` `docs/SURFACING.md` (via `CLAUDE.md` `@`-import or the `default` skill); local `CLAUDE.md` wins. Apply repo- and branch-scoped rules per workstream, substituting the current repo in URL templates.

*Signed: Chief of Staff (Grok) · 2026-09-16*

---

## `docs/SURFACING.md:p012` · lines 34–36 · high · 70→53w (ratio 0.757)

### Original

* **Surfacing caption.** Use:
  `🌿 [<branch>](…/pages/branch.html#gh=<owner>/<repo>@<branch>) · <N> files · [this turn](…/commit/<sha>)`
  Calculate `<N>` with `git diff origin/main...HEAD --name-only | wc -l`. Omit `this turn` on a single-commit branch. Mention files in prose only when something non-obvious must be said about them. Token-less readers and MCP URL caps take the fallbacks in [surfacing-extended.md](https://github.com/mehrlander/web-tools/blob/main/docs/surfacing-extended.md).

### Proposed rewrite

* **Surfacing caption.** `🌿 [<branch>](…/pages/branch.html#gh=<owner>/<repo>@<branch>) · <N> files · [this turn](…/commit/<sha>)`. Compute `<N>` with `git diff origin/main...HEAD --name-only | wc -l`; omit `this turn` on single-commit branches. Name files in prose only when non-obvious. Fallbacks: [surfacing-extended.md](https://github.com/mehrlander/web-tools/blob/main/docs/surfacing-extended.md).

*Signed: Chief of Staff (Grok) · 2026-09-16*

---

## `docs/SURFACING.md:p024` · lines 60–60 · high · 77→65w (ratio 0.844)

### Original

  Treat each event separately. `go:` expresses intent, not write authorization. Address failing checks only when relevant to this session. Never schedule a check-in; an event is the only wake. A base branch that moved is not work. If a wake changes nothing, do not reply. When an open PR merges, mark the event and close with the appropriate state even if no files changed. When an open PR closes unmerged, mark it 🔴 even if no files changed.

### Proposed rewrite

Handle each event on its own. `go:` is intent, not write rights. Touch failing checks only when this session cares. Never schedule a check-in—events are the only wake. A moved base branch is not work; if a wake changes nothing, stay silent. On PR merge, mark and close with the right state even with no file changes; on unmerged close, mark 🔴 the same way.

*Signed: Chief of Staff (Grok) · 2026-09-16*

---
