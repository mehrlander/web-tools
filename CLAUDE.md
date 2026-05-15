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

## Post-merge handoff

A recurring pattern: the user merges, then surfaces a bug or the next round of work. That belongs to a new session, but the current session has the context to assess results and set the course.

When asked for a handoff prompt (HP):

**Wrap it in a fenced markdown code block.** The user often copies on mobile, so a fence makes it one tap. Use four backticks outside if the prompt itself contains triple-backtick code.

**Reference the merged PR by number (or commit SHA).** The new session has the same repo access and can read any file. The PR reference grounds it in exactly what shipped.

**Point, don't quote.** Name the relevant files and functions. Don't paste file contents; the new session can open them.

**Tone is factual, not prescriptive.** Hedge suppositions. Don't rank options, recommend one, or editorialize. Don't tell the new session to commit, push, branch, or open a PR. Decision-making and workflow sit with the new session and the user.

**Shape each issue as symptom, cause, fixes.** Label causes *suspected* or *confirmed*. Label fixes *possible* or *likely*. The labels are the hedge: don't soften the prose around them.

**Propose diagnostic tests where they'd move a cause from suspected to confirmed.** The test should produce serialized output the user can share back. A second or third test that removes remaining doubt is welcome (you can also offer an test with a draft prompt that could be used to firm up some piece of it). Test results, once returned, become part of the picture, but a passing test confirms what it tested, not everything adjacent.

**Close with: "Look through the relevant files, assess, and propose how to proceed."** Or near-equivalent. The new session's first move is to form a view and bring it to the user, not to start changing things.

**Keep it short.** One context paragraph. One section per issue.
