## Surfacing your work

Instructions for Claude Code on the web. The session runs in a [sandbox](docs/ENVIRONMENT.md); the user sees output through chat, not a local filesystem.

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

**Test page on the branch.** GitHub Pages serves from one branch, typically main, so to render branch code through the canonical URL `lib/gh-api.js` honors a `?use=<branch|tag|sha>` query parameter: pages that adopt the convention read it at boot and load the rest of their code from that ref. Useful when linking the user to a test page that exercises work on a branch. See `README.md` for the canonical boot block; for freshly-pushed commits, pass the SHA, since jsDelivr caches branch tips for ~12h.

**gh-api.js edits.** Any turn that modifies `lib/gh-api.js` must end with the jsDelivr purge link so the user can flush the CDN cache with one tap:

> [https://purge.jsdelivr.net/gh/mehrlander/web-tools/lib/gh-api.js](https://purge.jsdelivr.net/gh/mehrlander/web-tools/lib/gh-api.js)

**Creating the next PR (after Option 2).** If we continue editing after a merge, new commits land on the branch. To merge them, create a **new** PR from the branch (don't try to update the old one; it's already merged). Check `git log main -1` if unsure what's merged, then `git log main..HEAD` to see commits waiting for the next PR.

**Don't reach for external preview services.** If the repo is private, render proxies (htmlpreview.github.io, raw.githack.com, and similar) won't resolve. The blob view via `[new]` is the canonical file view for every file type. Markdown renders directly there; code gets syntax highlighting.

**URL templates for reference:**
- File on branch: `https://github.com/<owner>/<repo>/blob/<branch>/<path>`
- File on main: `https://github.com/<owner>/<repo>/blob/main/<path>`
- Commit diff: `https://github.com/<owner>/<repo>/commit/<sha>`
- Branch tree: `https://github.com/<owner>/<repo>/tree/<branch>`
- Branch vs main: `https://github.com/<owner>/<repo>/compare/main...<branch>`
- Page on a ref: `https://mehrlander.github.io/web-tools/pages/<page>.html?use=<ref>`

## Merge guide

[`MERGE-GUIDE.md`](docs/MERGE-GUIDE.md) (in `docs/`) is a newest-on-top log of what each session shipped. One file, one URL: the latest entry sits at the top, older entries stack below as history. Git holds how the file evolved, so there's no archive. It's the durable form of the per-file links and session diff above, which otherwise only live in chat.

Produced on request: when the user says "merge guide", prepend an entry for the current session. Never write it unasked. Never overwrite existing entries.

**Reading it for inclusion.** Each entry is keyed by its PR number, and an entry reaches main only by riding in on its own merge. So the entries in the main copy of this file are exactly the guide-covered merges that are in main, and the top entry is the latest. "Is PR #115 in main?" is answered by whether a #115 entry appears in the main copy. The on-demand caveat: a merge made without an entry won't show, so absence is not proof. For that, GitHub's merged state or git is authoritative. Always record the PR number as the key (known once the PR is open); fall back to the branch only until the number exists.

Keep entries short. A five-second skim, not a changelog dump.

**Entry shape:**

```markdown
## <date> <one-line title> (PR #<n> or branch)

<One sentence: the primary outcome.>

⭐ **Result:** [<primary artifact>](<live page, or ?use=<sha> link>)

**Changed:**
- <path> ([new](…), [main](…), [diff](…))
  renders on: [<page>](…)   (only for a shared component)

**Notes:** <only the non-obvious: why, what's unfinished, follow-ups>

[Session diff](<compare link>)
```

- Lead with the result, not the file list. The result is the page to open to see the change, even when what you edited was a JS file or a component the page loads. While work is on a branch, link it with `?use=<sha>` (the SHA, since jsDelivr caches branch tips ~12h). After merge the plain Pages/main URL is canonical.
- Primary file first. For a shared component, add a `renders on:` line naming each consuming page, so it's clear which page to open.
- Notes only when non-obvious. Skip anything the diff already shows.
- All links are absolute GitHub URLs, using the `[new]`/`[main]`/`[diff]` vocabulary above.

Typical case, where you edit JS but the result is a page to open:

```markdown
⭐ **Result:** [alpine-bundle-demo](https://mehrlander.github.io/web-tools/pages/alpine-bundle-demo.html?use=<sha>)

**Changed:**
- alpine-bundle.js ([new](…), [diff](…))
  renders on: [alpine-bundle-demo](…)
```

## Post-merge handoff

A recurring pattern: the user merges, then surfaces a bug or the next round of work. Merge typically marks the end of a session, but it can proceed two ways:

**Option 1: Handoff prompt.** Write a diagnostic prompt for the next session (see below), then wind down. The new session opens fresh with a new PR and CLAUDE.md context.

**Option 2: Continue with edits.** User says "ok let's add X," and we keep editing on the same branch. Tradeoff: we must then create a new PR (not update the old one) when done, since the branch now has commits ahead of the merged PR.

When asked for a handoff prompt (HP):

**Wrap it in a fenced markdown code block.** The user often copies on mobile, so a fence makes it one tap. Use four backticks outside if the prompt itself contains triple-backtick code.

**Reference the merged PR by number (or commit SHA).** The new session has the same repo access and can read any file. The PR reference grounds it in exactly what shipped.

**Point, don't quote.** Name the relevant files and functions. Don't paste file contents; the new session can open them.

**Tone is factual, not prescriptive.** Hedge suppositions. Don't rank options, recommend one, or editorialize. Don't tell the new session to commit, push, branch, or open a PR. Decision-making and workflow sit with the new session and the user.

**Shape each issue as symptom, cause, fixes.** Label causes *suspected* or *confirmed*. Label fixes *possible* or *likely*. The labels are the hedge: don't soften the prose around them.

**Close with: "Look through the relevant files, assess, and propose how to proceed."** Or near-equivalent. The new session's first move is to form a view and bring it to the user, not to start changing things.

**Keep it short.** One context paragraph. One section per issue.

As a preliminary, you can propose diagnostic tests where they'd move a cause from suspected to confirmed. The test should produce serialized output the user can share back. A second or third test that removes remaining doubt is welcome (you can also offer an test with a draft prompt that could be used to firm up some piece of it). Test results, once returned, become part of the picture, but a passing test confirms what it tested, not everything adjacent.

## Environment & testing

[`ENVIRONMENT.md`](docs/ENVIRONMENT.md) is a living, dated record of what the web sandbox can and can't do — network allowlist, headless-browser limits, the jsdom+Alpine recipe for logic-testing components, and page-preview constraints. Read it when a task involves testing, verifying, or reaching the network; extend it (edit in place, re-date) when you learn something new. Referenced by plain path, not `@`-imported, so it stays out of context until needed.
