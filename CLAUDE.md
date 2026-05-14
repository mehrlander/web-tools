## Surfacing your work

Instructions for Claude Code on the web. The session runs in a sandbox; the user sees output through chat, not a local filesystem.

**Explicit markdown only.** Bare file paths auto-link in some Claude Code UIs, but those links are transient: they resolve only in the live session, and they vanish on mobile, in rendered markdown, and anywhere the text gets copied. Use explicit `[caption](url)` markdown for anything the user might want to tap. The `file:line` convention (e.g. `src/foo.js:120`) is a separate thing: a grep-style pointer into source code for navigation when discussing or debugging code. It's not a substitute for explicit URLs when handing over an artifact.

**Branch as session anchor.** The first reply in a session that creates or modifies files leads with a one-line branch link:

> Working branch: [feature-name-abc12](https://github.com/<owner>/<repo>/tree/claude/feature-name-abc12)

This is the link the user taps to see the working tree at any point. No need to repeat it on subsequent turns.

**Per-file links.** Any turn that touches files ends with a compact list. The filename is plain text; the link words in parens are tappable:

> - src/components/Header.tsx ([new](...), [main](...), [diff](...))
> - docs/setup.md ([new](...), [diff](...))

Link words and what they point at:
- `[new]`: the file at the branch tip (current version)
- `[main]`: the file before changes, on main. Omit for brand-new files.
- `[diff]`: the commit that introduced the change

Line anchors work on any blob URL: append `#L120` for a single line or `#L120-L145` for a range. Use these when a turn touches a narrow region of a large file and you want the link to land on the change, not the top.

Don't repeat a file's links if they already appeared earlier in the same turn.

**Session diff.** When wrapping up substantial work, or when the user asks what changed across the session, include a compare link:

> Session diff: [main...feature-name-abc12](https://github.com/<owner>/<repo>/compare/main...claude/feature-name-abc12)

**Don't reach for external preview services.** If the repo is private, render proxies (htmlpreview.github.io, raw.githack.com, and similar) won't resolve. The blob view via `[new]` is the canonical file view for every file type. Markdown renders directly there; code gets syntax highlighting.

**URL templates for reference:**
- File on branch: `https://github.com/<owner>/<repo>/blob/<branch>/<path>`
- File on main: `https://github.com/<owner>/<repo>/blob/main/<path>`
- Commit diff: `https://github.com/<owner>/<repo>/commit/<sha>`
- Branch tree: `https://github.com/<owner>/<repo>/tree/<branch>`
- Branch vs main: `https://github.com/<owner>/<repo>/compare/main...<branch>`
