# Working conventions (portable)

Conventions for Claude Code on the web sessions in **any** repo. The session
runs in a remote sandbox; the user sees output through chat, not a local
filesystem.

The canonical copy lives in `mehrlander/web-tools` at `docs/CONVENTIONS.md`.
That repo `@`-imports it from its own `CLAUDE.md`; other repos load it via the
`web-tools-conventions` skill, which fetches it fresh from main. Substitute the
current repo into every URL template, and where the current repo's own CLAUDE.md
conflicts on a point, the current repo wins.

**Adopt à la carte.** This is a menu, not a bundle. It has two severable layers,
and a repo can take either without the other:

- **Surfacing primitives**: how to hand work back through chat: explicit-markdown
  links, the per-file `[new]/[main]/[diff]` list, show-pixels, branch-as-anchor,
  the session diff, the URL templates. Universal and self-contained; apply them
  in any repo with no setup.
- **The surfacing course**: the branch-guide → PR-body → merge-guide lifecycle
  and the workflow habits that serve it (the "Wrapping up & PR creation,"
  "button-PR follow-up," and "Creating the next PR" notes in the next section,
  plus everything from the surfacing-course section on). A workflow opinion
  for PR-driven repos, opt-in as a whole: standing it up is never a precondition
  for the primitives, and a repo can opt in later.

**Prose style.** No em dashes, in any file or chat reply: use a colon, comma,
semicolon, parentheses, or a new sentence instead.

Three **extension points** are deliberately left to each repo's CLAUDE.md:

- **Preview mechanism**: a way to open changed code live from a branch (e.g.
  a query parameter a page reads at boot). If the repo declares one, the ⭐
  links below use it; if not, the `[new]` blob is the honest target.
- **Per-session refreshes**: slow or non-deterministic artifacts regenerated
  once per session at wrap-up (e.g. screenshots). If the repo declares none,
  wrap-up has no refresh step.
- **Branch-guide enforcement**: optional machinery (a hook nag, a CI guard)
  backing the branch-guide lifecycle below. If the repo declares none, the
  lifecycle is convention-only.

## Surfacing your work

**Explicit markdown only.** Bare file paths auto-link in some Claude Code UIs, but those links are transient: they only resolve in the live session, and vanish on mobile, in rendered markdown, and anywhere the text is copied. Use explicit `[caption](url)` markdown for anything the user might want to tap. The `file:line` convention (e.g. `src/foo.js:120`) is a separate thing: a grep-style pointer into source for discussing or debugging code, not a substitute for an explicit URL when handing over an artifact.

**Show pixels.** Image files sent to the user render inline in the chat. If a visual change can be rendered in-session (headless browser, screenshot tool), send the screenshot, after looking at it yourself.

**Branch as session anchor.** The first reply in a session that creates or modifies files leads with a one-line branch link:

> Working branch: [feature-name-abc12](https://github.com/<owner>/<repo>/tree/claude/feature-name-abc12)

This is the link the user taps to see the working tree at any point. No need to repeat it on subsequent turns.

**Wrapping up & PR creation.** The web UI gives the user a button that opens a PR from the session branch, so don't ask "want me to open a PR?" on its own. Offer PR creation only as part of the bundled wrap-up: *"want me to wrap up (fold the branch guide into the merge-guide entry and open the PR)?"* Routing PR creation through chat gets the documentation and refreshes into the PR's initial diff, instead of chasing a merge that isn't visible from inside the session. (Open a PR outside a wrap-up only for a specific reason, e.g. a *second* PR after post-merge edits; see "Creating the next PR.")

A wrap-up always produces a PR; there's no PR-less wrap-up. The sequence:

1. **Per-session refreshes**: any refresh steps the repo's CLAUDE.md declares (see extension points above). Skip if the repo declares none.
2. **Fold the branch guide**: resolve `BRANCH-GUIDE.md` into the merge-guide entry and delete it, in one commit (see "Branch guide").
3. **Open the PR.**

**The button-PR follow-up.** If a PR for the session branch appears via the web UI button (the harness announces it mid-session), treat that as the wrap-up request even though the user didn't say so: complete steps 1 and 2 behind it (per-session refreshes, fold the branch guide) and reshape the PR body to the shared shape, without waiting to be asked. Only step 3 is already done.

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

**Creating the next PR (after Option 2).** If we continue editing after a merge, new commits land on the branch. To merge them, create a **new** PR from the branch (don't try to update the old one; it's already merged). Check `git log main -1` if unsure what's merged, then `git log main..HEAD` to see commits waiting for the next PR.

**Don't reach for external preview services.** If the repo is private, render proxies (htmlpreview.github.io, raw.githack.com, and similar) won't resolve. The blob view via `[new]` is the canonical file view for every file type. Markdown renders directly there; code gets syntax highlighting.

**URL templates for reference** (a repo's CLAUDE.md may add repo-specific ones, e.g. for its preview mechanism):
- File on branch: `https://github.com/<owner>/<repo>/blob/<branch>/<path>`
- File on main: `https://github.com/<owner>/<repo>/blob/main/<path>`
- Commit diff: `https://github.com/<owner>/<repo>/commit/<sha>`
- Branch tree: `https://github.com/<owner>/<repo>/tree/<branch>`
- Branch vs main: `https://github.com/<owner>/<repo>/compare/main...<branch>`

## The surfacing course

**Opt-in layer.** Everything from here on is the course: take it whole or leave
it. It assumes a PR-driven workflow and commits the repo to maintaining a
`docs/MERGE-GUIDE.md` and a per-branch `BRANCH-GUIDE.md`. Skip this section and
the primitives above still stand; the rest of this doc describes the course for
repos that opt in.

Three structured artifacts summarize a session's work, one at each **surfacing moment** (when the work breaks the surface for a reader): the **branch guide** (live, on the branch), the **PR body** (pre-merge, on GitHub), and the **merge-guide entry** (at/after merge, in `docs/MERGE-GUIDE.md`). All fight the same failure mode: the unstructured summary with an unknown angle, where the reader has to reconstruct what matters and where to look. All fix it the same way: a shove toward the thing to open, not an explanation.

So all follow one shape. The first two lines are fixed:

1. **Outcome + why**: one sentence, no preamble.
2. A single **⭐ link to the thing to open**: the shove.

Then a common tail: a `[new]/[main]/[diff]` file list, a `renders on:` line for shared components, Notes only for the non-obvious, and a diff/compare link. Skimmable in seconds. Only the link targets and a few moment-specific fields differ between the artifacts, and they're sequential drafts of each other, kept aligned: the branch guide folds into the merge-guide entry at wrap-up and seeds the PR body.

**The ⭐ link, honestly.** The ⭐ is a live preview only when the repo declares a preview mechanism and the change is one it can render; then "open" means open. Otherwise the honest best is the `[new]` blob: say "view," not "use," and link the blob. The link must never promise a running preview the change can't deliver.

**What differs.** Same shape, three moments:

| | Branch guide | PR body | Merge-guide entry |
|---|---|---|---|
| Moment | while work is live | pre-merge | at / after merge |
| Audience | resuming reader: "where did I leave things" | reviewer: "verify this" | reader: "what shipped, open here" |
| ⭐ target | branch (preview mechanism, else `[new]` blob) | branch (preview mechanism, else `[new]` blob) | canonical main URL |
| File links | branch blobs | branch blobs | main blobs |
| Extra fields | next steps / open threads | risk, test status, "Follow-up to #N" | PR# key, date, durable Notes |
| Lives in | `BRANCH-GUIDE.md`, branch root only | the GitHub PR | `docs/MERGE-GUIDE.md` |
| Fate | folded + deleted at wrap-up | persists with the PR | persists in main |

## Branch guide

`BRANCH-GUIDE.md`, at the repo root of the working branch, surfaces the work on the branch so far. It is a guide to the branch, an answer to "where did I leave things" for work that hasn't reached a PR yet, and at wrap-up it flows into the merge-guide entry and seeds the PR body (see the lifecycle below). It never lands on main.

**Lifecycle:**

- **Create and push first thing.** The first commit of any session, before substantive work; even a session that has only reviewed material gets a guide saying briefly what's under review. Pushing immediately has a second payoff: the branch then exists on GitHub, so the branch-anchor link and every branch URL in chat resolve from the first reply onward.
- **Accurate on every push.** Each push leaves the guide truthful; update it within the batch being pushed, not as separate churn commits. The freshness rule binds to *push*, not commit: the public state is what must not lie. A stale guide is worse than none.
- **Fold and delete at wrap-up.** Wrap-up step 2 resolves the guide into the merge-guide entry (links toward main, PR# once known, durable next-steps into Notes) and deletes it, in the same commit. Added and deleted on the same branch, it nets out of the PR diff entirely, so it can't reach main by merge and the reviewer never sees it. Its lifetime is exactly the gap it fills: pushed commits, no PR yet. Once the PR body exists, that takes over the self-description job.

**Stay tight.** Same bar as the merge guide: a five-second skim, minimal commentary. The one field the other artifacts lack, **next steps / open threads**, is the heart of the file and the part each update must actually revise. Past a screenful, it has stopped being a guide.

**Guide shape:**

```markdown
# Branch guide: <branch>

<One sentence: what this branch is doing and why.>

⭐ [<the thing to open>](<branch preview w/ commit SHA, else [new] blob>)

**Changed:**
- <path> ([new](…), [main](…), [diff](…))

**Next steps / open threads:**
- <current and honest; the reason this file exists>
```

If a merge bypasses wrap-up (the PR button mid-session), the guide leaks to main; the next session deletes the stray file as cleanup. A repo can declare **branch-guide enforcement** (see extension points) to backstop this mechanically.

## PR body

The body a PR opens with, before merge. Audience: a reviewer deciding whether to approve; "verify this," not "here's what shipped." Links resolve to the **branch tip**, so the reviewer reads exactly what's proposed. Nothing here is merged yet, so it doesn't assert in-main status.

**Body shape:**

```markdown
<One sentence: what this does and why.> [Follow-up to #N.]

⭐ **Look:** [<artifact>](<branch preview, else [new] blob>)

**Changed:**
- <path> ([new](branch blob), [main](pre-change), [diff](commit))
  renders on: [<consumer>](<branch preview>)     (shared component only)

**Notes / Risk:** <what to scrutinize, test status, non-obvious why>

<session-link footer>
```

- ⭐ target is on the branch: the repo's preview mechanism if it has one, otherwise the `[new]` blob (see the "⭐ link, honestly" note above). If the mechanism takes a ref, prefer the commit SHA over the branch name; CDN-style caches go stale on branch tips.
- Keep "Follow-up to #N" when this continues an earlier PR, so the chain stays legible.
- End with the session-link footer the harness appends to PR bodies.

The body of [PR #129 in web-tools](https://github.com/mehrlander/web-tools/pull/129) is a worked example of this shape.

## Merge guide

`docs/MERGE-GUIDE.md` is a newest-on-top log of what each session shipped. One file, one URL: the latest entry sits at the top, older entries stack below as history. Git holds how the file evolved, so there's no archive. It's the durable form of the per-file links and session diff above, which otherwise only live in chat.

Each entry is the merge-guide moment of the course, following the same shape resolved to main: same first two lines and common tail, with the merge-guide column of the table above listing what's distinct.

Produced at wrap-up: writing the entry is wrap-up step 2 (the branch-guide fold), so any wrap-up includes it, whether accepted from the bundled offer or completed after a PR was opened with the UI button. Outside a wrap-up, write it only when the user asks ("merge guide"). Never overwrite existing entries.

**Reading it for inclusion.** Each entry is keyed by its PR number, and an entry reaches main only by riding in on its own merge. So the entries in the main copy of this file are exactly the guide-covered merges that are in main, and the top entry is the latest. "Is PR #115 in main?" is answered by whether a #115 entry appears in the main copy. The caveat: a merge made without an entry won't show, so absence is not proof; GitHub's merged state or git is authoritative. Key every entry by PR number once it exists; fall back to the branch only until then.

Keep entries short. A five-second skim, not a changelog dump.

**Entry shape:**

```markdown
## <date> <one-line title> (PR #<n> or branch)

<One sentence: the primary outcome.>

⭐ **Result:** [<primary artifact>](<canonical main URL; branch preview while unmerged>)

**Changed:**
- <path> ([new](…), [main](…), [diff](…))
  renders on: [<consumer>](…)   (only for a shared component)

**Notes:** <only the non-obvious: why, what's unfinished, follow-ups>

[Session diff](<compare link>)
```

- Lead with the result, not the file list. The result is the thing to open to see the change, even when what you edited was a module or component something else loads. While work is on a branch, use the repo's preview mechanism (with the commit SHA, per the caching note above); after merge the canonical main URL takes over: the live page where one exists, the main blob otherwise.
- Primary file first. For a shared component, add a `renders on:` line naming each consumer, so it's clear what to open.
- Notes only when non-obvious. Skip anything the diff already shows.
- All links are absolute GitHub URLs, using the `[new]`/`[main]`/`[diff]` vocabulary above, resolving to main once merged.

## Post-merge handoff

A recurring pattern: the user merges, then surfaces a bug or the next round of work. Merge typically marks the end of a session, but it can proceed two ways:

**Option 1: Handoff prompt.** Write a diagnostic prompt for the next session (see below), then wind down. The new session opens fresh with a new PR and CLAUDE.md context.

**Option 2: Continue with edits.** User says "ok let's add X," and we keep editing on the same branch. Tradeoff: we must then create a new PR (not update the old one) when done, since the branch now has commits ahead of the merged PR.

**The merged-branch closer.** Option 1 is the default: merge means done, and the branch makes no further edits unless the user explicitly chooses Option 2. To make that state legible when rereading the chat later, every post-merge response on this branch (a handoff prompt, a "what shipped?" inquiry, any follow-up short of an explicit Option 2) ends with one fixed line:

> *Branch `<branch>` merged in PR #<n>; no further edits will be made here.*

It's a marker that the work was captured, not commentary; don't elaborate on it. Drop it only when the user opts into Option 2 (at which point the branch is live again).

When asked for a handoff prompt (HP):

**Wrap it in a fenced markdown code block.** The user often copies on mobile, so a fence makes it one tap. Use four backticks outside if the prompt itself contains triple-backtick code.

**Reference the merged PR by number (or commit SHA).** The new session has the same repo access and can read any file. The PR reference grounds it in exactly what shipped.

**Point, don't quote.** Name the relevant files and functions. Don't paste file contents; the new session can open them.

**Tone is factual, not prescriptive.** Hedge suppositions. Don't rank options, recommend one, or editorialize. Don't tell the new session to commit, push, branch, or open a PR. Decision-making and workflow sit with the new session and the user.

**Shape each issue as symptom, cause, fixes.** Label causes *suspected* or *confirmed*. Label fixes *possible* or *likely*. The labels are the hedge: don't soften the prose around them.

**Close with: "Look through the relevant files, assess, and propose how to proceed."** Or near-equivalent. The new session's first move is to form a view and bring it to the user, not to start changing things.

**Keep it short.** One context paragraph. One section per issue.

As a preliminary, propose diagnostic tests where they'd move a cause from suspected to confirmed; each should produce serialized output the user can share back, and a second or third test that removes remaining doubt is welcome. Returned results join the picture, but a passing test confirms what it tested, not everything adjacent.
