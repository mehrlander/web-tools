## Surfacing your work

Instructions for Claude Code on the web. The session runs in a [sandbox](docs/environment/); the user sees output through chat, not a local filesystem.

**Explicit markdown only.** Bare file paths auto-link in some Claude Code UIs, but those links are transient: they resolve only in the live session, and they vanish on mobile, in rendered markdown, and anywhere the text gets copied. Use explicit `[caption](url)` markdown for anything the user might want to tap. The `file:line` convention (e.g. `src/foo.js:120`) is a separate thing: a grep-style pointer into source code for navigation when discussing or debugging code. It's not a substitute for explicit URLs when handing over an artifact.

**Branch as session anchor.** The first reply in a session that creates or modifies files leads with a one-line branch link:

> Working branch: [feature-name-abc12](https://github.com/<owner>/<repo>/tree/claude/feature-name-abc12)

This is the link the user taps to see the working tree at any point. No need to repeat it on subsequent turns.

**Opening a PR is the user's tap, not a Claude action.** In the web UI the user opens a PR with a button that auto-generates it from the session branch — so don't reflexively ask "want me to open a PR?" on its own. The branch-anchor link above is the handoff: it lands them on the working tree, where the button lives. (Open one yourself only when there's a specific reason — e.g. a *second* PR after post-merge edits; see "Creating the next PR.") What makes the button appear is unverified from inside the sandbox; the working assumption is *commits pushed to the branch*.

**The bundled offer is the exception.** When wrapping up a session, it's welcome to *offer* to open the PR together with the merge-guide entry as one step: "want me to open the PR and add the merge-guide entry?" The button still exists; this is just an alternative the user can accept verbally, not a replacement. On yes, the order is entry-first: write and commit the merge-guide entry on the branch, *then* open the PR, so the entry is part of the PR's initial diff and rides in on the merge. This sidesteps the merge-guide convention's real blocker: the merge moment isn't visible from inside a session, so an entry written to chase the merge afterward tends to be left behind. Putting it in before merge fixes that.

**Wrapping up.** "Wrap up" (e.g. "give me the PR and wrap up") invokes the full session-close ritual — the bundled offer plus every per-session refresh, in this order:

1. **Thumbnails** — if any `pages/*.html` changed this session (`git diff main...HEAD --name-only`), regenerate just those pages' thumbnails (`npm run pages-shots -- <page…>`) and commit. Thumbs are refreshed once per session here, not per commit — screenshots are slow and not byte-deterministic, so the commit hook only nags about them (see "Build-on-commit hook" below). The catalogs need no separate step; the hook regenerates them with each commit.
2. **Merge-guide entry** — write and commit it on the branch (entry-first, as above).
3. **Open the PR.**

A wrap-up always produces a PR; there's no PR-less wrap-up. The reason to route PR creation through chat rather than the button is exactly this bundling: the button only opens a PR, while the spoken request runs the refreshes that should land before merge.

**Skip the watch offer.** Don't offer to watch the PR for CI or review activity ("want me to keep an eye on CI?", "want me to watch this PR?"). It isn't useful to this user; this line suppresses the harness's default proactive prompt.

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

## The surfacing spine

Two structured artifacts summarize a session's work: the **PR body** (pre-merge, on GitHub) and the **merge-guide entry** (at/after merge, in `docs/MERGE-GUIDE.md`). Both fight the same failure mode — the unstructured summary with an unknown angle, where the reader has to reconstruct what matters and where to look. Both fix it the same way: a shove toward the thing to open, not an explanation.

So both follow one spine. The first two lines are fixed:

1. **Outcome + why** — one sentence, no preamble.
2. A single **⭐ link to the thing to open** — the shove.

Then a common tail: a `[new]/[main]/[diff]` file list, a `renders on:` line for shared components, Notes only for the non-obvious, and a diff/compare link. Skimmable in seconds. The two artifacts share this spine but stay separate; only the link targets and a few moment-specific fields differ.

**The ⭐ link, honestly.** The ⭐ is a live preview only for a page: `?use=<sha>` renders the branch's code, so "open" means open. For a non-page change — a kit, a doc — the honest best is the `[new]` blob: say "view," not "use," and link the blob. The link must never promise a running preview the change can't deliver.

**What differs.** Same spine, two moments:

| | PR body | Merge-guide entry |
|---|---|---|
| Moment | pre-merge | at / after merge |
| Audience | reviewer — "verify this" | reader — "what shipped, open here" |
| ⭐ target | branch (`?use=<sha>`, else `[new]` blob) | canonical main URL |
| File links | branch blobs | main blobs |
| Extra fields | risk, test status, "Follow-up to #N" | PR# key, date, durable Notes |
| "Is #N in main?" | n/a — nothing merged yet | answerable from the entry |
| Lives in | the GitHub PR | `docs/MERGE-GUIDE.md` |

## PR body

The body a PR opens with, before merge. Audience: a reviewer deciding whether to approve — "verify this," not "here's what shipped." Links resolve to the **branch tip**, so the reviewer reads exactly what's proposed; it doesn't assert in-main status — nothing here is merged yet.

**Body shape:**

```markdown
<One sentence: what this does and why.> [Follow-up to #N.]

⭐ **Look:** [<page>](…?use=<sha>)   ← open on the branch
   (non-page change → link the [new] blob instead)

**Changed:**
- <path> ([new](branch blob), [main](pre-change), [diff](commit))
  renders on: [<page>](…?use=<sha>)        (shared component only)

**Notes / Risk:** <what to scrutinize, test status, non-obvious why>

<session-link footer>
```

- ⭐ target is on the branch: a page via `?use=<sha>`, otherwise the `[new]` blob (see the spine's honesty note). Pass the SHA, since jsDelivr caches branch tips ~12h.
- Keep "Follow-up to #N" when this continues an earlier PR, so the chain stays legible.
- End with the session-link footer the harness appends to PR bodies.

The body of PR #129 is a worked example of this shape.

## Merge guide

[`MERGE-GUIDE.md`](docs/MERGE-GUIDE.md) (in `docs/`) is a newest-on-top log of what each session shipped. One file, one URL: the latest entry sits at the top, older entries stack below as history. Git holds how the file evolved, so there's no archive. It's the durable form of the per-file links and session diff above, which otherwise only live in chat.

Each entry inherits the surfacing spine, resolved to main: same first two lines and common tail, with the merge-guide column of the table above listing what's distinct.

Produced on request: when the user says "merge guide" (or accepts the bundled-PR offer above, which counts as the request), prepend an entry for the current session. Either way it stays request-gated: never write it unasked, and never overwrite existing entries.

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
- All links are absolute GitHub URLs, using the `[new]`/`[main]`/`[diff]` vocabulary above, resolving to main once merged.

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

**The merged-branch closer.** Option 1 is the default: merge means done, and the branch makes no further edits unless the user explicitly chooses Option 2. To make that state legible when rereading the chat later, every post-merge response on this branch — a handoff prompt, a "what shipped?" inquiry, any follow-up short of an explicit Option 2 — ends with one fixed line:

> *Branch `<branch>` merged in PR #<n> — no further edits will be made here.*

It's a marker that the work was captured, not commentary; don't elaborate on it. Drop it only when the user opts into Option 2 (at which point the branch is live again).

When asked for a handoff prompt (HP):

**Wrap it in a fenced markdown code block.** The user often copies on mobile, so a fence makes it one tap. Use four backticks outside if the prompt itself contains triple-backtick code.

**Reference the merged PR by number (or commit SHA).** The new session has the same repo access and can read any file. The PR reference grounds it in exactly what shipped.

**Point, don't quote.** Name the relevant files and functions. Don't paste file contents; the new session can open them.

**Tone is factual, not prescriptive.** Hedge suppositions. Don't rank options, recommend one, or editorialize. Don't tell the new session to commit, push, branch, or open a PR. Decision-making and workflow sit with the new session and the user.

**Shape each issue as symptom, cause, fixes.** Label causes *suspected* or *confirmed*. Label fixes *possible* or *likely*. The labels are the hedge: don't soften the prose around them.

**Close with: "Look through the relevant files, assess, and propose how to proceed."** Or near-equivalent. The new session's first move is to form a view and bring it to the user, not to start changing things.

**Keep it short.** One context paragraph. One section per issue.

As a preliminary, you can propose diagnostic tests where they'd move a cause from suspected to confirmed. The test should produce serialized output the user can share back. A second or third test that removes remaining doubt is welcome (you can also offer an test with a draft prompt that could be used to firm up some piece of it). Test results, once returned, become part of the picture, but a passing test confirms what it tested, not everything adjacent.

## The pre-build & the build-on-commit hook

`dist/web-tools.js` is **the pre-build**: the whole `lib/` frozen into one self-booting offline artifact, so a page can adopt the entire library with one import instead of a `gh.load` chain. It's generated (`npm run build:lib`) and it's the one tracked file under the otherwise-gitignored `dist/`. Full story in [`tools/README.md`](tools/README.md#the-pre-build).

Every **deterministic** derived artifact is owned by one commit-time hook (`.claude/hooks/build-on-commit.sh`, a `PreToolUse(Bash)` hook wired in `.claude/settings.json`). Before a `git commit` it regenerates and stages, in the same commit, whatever the pending changes touch:

- `lib/` changed → `npm run build:lib` → `dist/web-tools.js`
- `pages/**/*.html` changed → `npm run pages-index` → `pages/README.md` + `pages/index.html`

Don't hand-edit any of those three files — edit the source and let the hook refresh them. Thumbnails (`pages/thumbs/*.png`) are the deliberate exception: not byte-deterministic, so the hook only *warns* when a page changes without its thumb; the actual refresh happens once per session at wrap-up (see "Wrapping up" above).

## Environment & testing

[`docs/environment/`](docs/environment/) is a living, dated record of the Claude Code web environment, split by concern: [capabilities](docs/environment/capabilities.md) (network allowlist, headless browser, toolchain), [container](docs/environment/container.md) (what persists across sessions), [testing](docs/environment/testing.md) (the jsdom+Alpine recipe and page-preview constraints), and [extending](docs/environment/extending.md) (the Claude Code component model and the hooks this repo runs). Read it when a task involves testing, verifying, or reaching the network; extend it (edit in place, re-date) when you learn something new. Referenced by plain path, not `@`-imported, so it stays out of context until needed.
