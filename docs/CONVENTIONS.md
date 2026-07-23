# Working conventions (portable)

Remote-sandbox conventions for Claude Code web sessions; output is strictly via chat. The canonical source is `mehrlander/web-tools` at `docs/CONVENTIONS.md`, loaded by `@`-import or the `web-tools` skill. Local `CLAUDE.md` rules override these defaults. Substitute the current repo into all URL templates.

The set comes as one bag, installed together (see [PORTABLE.md](PORTABLE.md)): the **surfacing primitives** below (universal chat-handoff mechanics, no setup) and the **surfacing course** that follows (the guide-PR and merge-guide lifecycle). You get both. The course does nothing until you open a PR, so a repo that runs no PRs carries it at no cost, with nothing to opt into or stand up.

**Prose style:** zero em dashes. Use colons, commas, semicolons, parentheses, or new sentences.

**One render path.** A page renders one way: the 🥏 toss below. There is no per-repo preview mechanism to pick. ⭐ marks a hosted live view where one already exists (the canonical URL of an already-deployed page); the toss covers every branch or private page that has no hosted URL of its own.

**The one per-repo setting: per-session refreshes.** Normally none: name a refresh only if the repo has a slow or non-deterministic generated artifact that cannot ride a commit hook (a screenshot, say), regenerated once per session at wrap-up. Set it in the local `CLAUDE.md`.

**Adding your own, without clobbering.** The install owns only what it ships. Plugin skills are namespaced (`/portable:caption`), so a same-named skill of yours coexists; the fallback fetch hook writes a fixed file list and touches nothing else. Your own skills and any `CLAUDE.md` text below the import are never overwritten.

**Standing decisions: write the answer down, not just the question.** A recurring fork (commit this class of file to main without asking, skip the watch offer, take the smaller of two options) becomes a standing decision the moment a doc states it as a default: name it in `CLAUDE.md` or the relevant portable doc (this file, `TRACKER.md`), and a session that hits it takes the default and notes the assumption rather than raising it fresh. Writing it down is the only lever that works: a `permissions.deny` on the question tool does not help, since asking is a model choice, not a gated call. A repo fielding the same question has a missing standing decision, not a tool to disable.

**Leave it nicer than you found it.** Adding to a doc is a pass over it, not just an append. New material has to match the surrounding voice and structure. Go a step further and tighten related material while you are there.

**Beware make-work.** When asked to look for improvements, be wary of ideas that address a hypothetical problem. A simple, clear fix is worth making, especially when it is as easy to fix as to bring up. The trap is speculative work that draws attention and goes off course.

---

## Surfacing primitives

* **Explicit markdown:** use `[caption](url)` for anything tappable; bare paths drop on mobile, in rendered markdown, and when copied. Reserve `file:line` for grep and debug references, not handoff links.
* **Reference is a link.** The rule above governs the body of a reply too, not only the end-of-turn caption: when you name a repo file, doc, or page you are pointing at and the reader might want to open it, link it inline on first mention. A source file links its blob (`[main]` when unchanged, `[new]` on the branch when you touched it); a renderable page links its render (🥏 toss, ⭐ hosted, or 📦 artifact) so the reader lands on the running page, not the source. The caption's file list stays the end-of-turn roll-up; this covers everything you reference mid-reply. Keep the honesty gate: only a renderable page gets a render link, and say "view" when the link is really source. Showing the 🥏 render whenever the reader would want to look at a page is this rule applied to pages, not a separate one.
* **Show pixels:** for visual changes, send a headless-browser screenshot inline (after viewing it yourself).
* **Hand over the artifact:** when you produce a file the user would open, run, or iterate on (an HTML page, a zip, an audio file), proactively send it with `SendUserFile` so they get a working in-chat downloader, rather than only describing it or pasting a path. Treat this as a default, not something to wait to be asked for. The UI renders the result as a **file card** (also **file chip**; the user may simply say "send the file"): a click-to-download chip for HTML / zip / audio and the like, an inline preview for images. Compose with Show pixels when the thing is visual (screenshot to show, card to hand over); use the tool's `proactive` status when surfacing unprompted, `normal` when replying.
* **Lead with the live view:** a README (or folder readme) for something that renders opens, right under the title, with a prominent ⭐ link to the hosted version ("go here for the nice view"), before any prose. The rendered artifact is the first tappable thing, not something buried in description.
* **Toss a live view (private-safe):** when a renderable HTML page has no hosted URL of its own (a private repo, an un-deployed branch), you can still hand over a live rendering instead of only the `[new]` source blob. **Mark a toss link with 🥏** the way ⭐ marks a hosted live view, so a reader sees at a glance it renders through the shared toss-render renderer, not source. Two forms:
  * **🥏 `#gz=` (portable, works for anyone):** gzip the page into the fragment of the shared hosted renderer and link that: `https://mehrlander.github.io/web-tools/pages/toss-render.html#gz=<base64url>`. That host is a fixed shared endpoint (use it literally; it is not a per-repo URL template). The payload rides in the `#fragment`, so it never reaches a server: nothing has to be hosted, the private content stays inside the link, and it renders in a sandbox (opaque origin, no access to the renderer's stored token). Absolute-URL CDN libraries (`<script src="https://…">`) load normally inside the toss; only same-repo **relative** deps (`./app.js`, `fetch('./x.json')`) can't resolve, since the page exists only in the link. This is the render path for any page that has no hosted URL of its own, which is the default case. Encode a file to a link with:
    ```bash
    python3 -c "import gzip,base64,sys,pathlib; b=gzip.compress(pathlib.Path(sys.argv[1]).read_bytes()); s=base64.b64encode(b).decode().replace('+','-').replace('/','_').rstrip('='); print('https://mehrlander.github.io/web-tools/pages/toss-render.html#gz='+s)" page.html
    ```
  * **🥏 `#gh=owner/repo[@ref]:path` (owner-only address mode):** fetches the file live via the viewer's stored token, so it renders a **branch** (`@<ref>`), a **private repo**, or a **private-repo branch** as a live pointer (not a snapshot), and pulls the page's same-ref relative deps in whole. It is gated to the renderer owner's allowlist, so it renders only for that owner and is **not portable** (a link sent to someone without an authorized token 404s). Reach for `#gz=` when the reader isn't the owner. Note that `#gh=` also depends on *where* the link opens, not just who taps it: the token lives in one browser's localStorage, so the Claude app's in-app browser has it only if one was entered there. Treat it as possibly absent (a fresh in-app browser, a shared machine); when it is, `#gh=` 404s and the artifact below (or `#gz=`) is the fallback.
* **Publish an artifact (signed-in-safe) 📦:** a third live-view channel beside ⭐ and 🥏: publish the page as a Claude Code artifact, a self-contained snapshot at a stable private `claude.ai` URL, and **mark the link with 📦**. Auth is the viewer's claude.ai sign-in, not a stored token, so an artifact renders on the viewer's sign-in alone, with no token to enter: the reliable choice for the Claude app, where the `#gh=` in-app-browser token caveat above bites. The artifact CSP blocks every external request, so bake the page self-contained first (CDN libraries compiled or inlined; see the bake pipeline in `docs/artifacts.md`). Snapshot semantics: frozen at publish, republishable in place with version history, not a live pointer. On Pro and Max plans artifacts stay private to the author, so they serve the owner-in-the-app case; hand any other reader the 🥏 `#gz=` toss. Record the URL in a durable place (README, PR body, task file); a later session can only update what it can find. Mechanics and the full link-choice matrix: `docs/artifacts.md` in the canonical repo.
* **Stage a fileset (transport) 🗂️:** a live view moves a *page*; a **stage link** moves a *fileset*. When the handoff is "here are these files, across repos, to look at or move," mint a `#stage=` link into the shared show-repo shell and **mark it 🗂️** (a transport marker beside ⭐/🥏/📦). It is the transfer-side sibling of the toss forms: the link carries the file **refs** (content stays behind the viewer's token) plus, optionally, **authored commentary and a mode** (yours to expose, so they ride the link, unlike repo content). Grammar: `…/show-repo/show-repo.html#stage=owner/repo[@ref]:path1,path2;owner2/repo2:path3` (groups `;`-separated, paths `,`-separated, `@ref` optional), with optional `&prompts=<base64url>` (a `{label, ask}` review-prompt list) and `&mode=diff` (opens on the Diff tab, runs the compare on open). Both keys also ride the `?query` (`StageLink.read`), so a stage survives a fragment-stripping context (a toss render, an email); the fragment is the default and private form. Opening it stages those refs for view, a concatenated-bundle copy/download, a two-tap copy into another repo, or a review diff. Honesty gate: a stage link is **token-gated** (renders only for the token owner, same in-app-browser caveat as `#gh=`); the token-less `#gz=`-style bundle form is contemplated, not built, so for a token-less reader download the bundle and hand it over (**Hand over the artifact**) instead. This is an inline handoff you offer when moving files, not a **surfacing caption** row. Full mechanics, plus the `.web-tools.json` manifest a repo uses to configure the shell: `docs/show-repo.md` in the canonical repo.
* **Carry content in an envelope:** when the handoff is a curated, annotated set of items (files, chats, diffs, search hits) rather than a single page, the shared form is a **content envelope**: one JSON document that names the items, layers selection and commentary over them, and renders through a web-tools page instead of a bespoke viewer. The stage above is one carrier; the others are the **surface** (a general shelf of cross-repo items, rendered by show-repo's estate view and the Surfacer app) and the **chat-results envelope** (a search over the chat archives, rendered by `pages/chat-results.html`). All three share one item grammar (the `owner/repo[@ref]:path` ref, the `#gz=`/`?src=` delivery split, live-code rendering), so learn the family once and each carrier is a specialization. Reach for an envelope over an ad-hoc format when a set of items wants to travel and render together. Contracts, schemas, and the family map: [`docs/envelopes/`](envelopes/) in the canonical repo (`README.md` frames it, the JSON Schemas validate it).
* **Branch anchor:** the first file-modifying reply leads with `Working branch: [branch-name](url)`.
* **Guide pointer 🧭:** mark links to the branch's guide PR (or branch-guide file, where a repo still keeps one) with 🧭, a marker beside ⭐/🥏/📦: the compass says "orient here." A reply may close with a bare `🧭 [PR #N](…)` line so the live state stays one tap away.
* **Task marker 🎫:** where the repo runs a tracker ([TRACKER.md](TRACKER.md)), mark any surfaced task with 🎫 the way 🧭 marks a guide PR: the ticket says "this is a filed task." A task link reads `🎫 [title](<task blob url>)`; the board prefixes every row with it. The id (the filename) is never shown, so 🎫 plus the title is the whole handle a reader sees.
* **Surfacing caption:** end a file-modifying turn with what changed, a uniform bulleted list, filename plain and the link words tappable. `[new]` is the file at the branch tip, `[main]` the main baseline (omit for a new file). A diff link is slashed to the anchor it is measured against: `[main]/[diff]` is the net change against main (the reviewer's diff, all most rows need), `[new]/[diff]` the on-branch history (only when several branch commits touched the file). So a changed file is `[new], [main]/[diff]`; a new file is `[new]` alone, or `[new]/[diff]` when built over several commits; a deleted file is `[main]/[diff]`. Add `#L120` or `#L120-L145` for a line anchor. Keep the rows plain and uniform (no bullet swaps, no per-row icons) and don't repeat a file's links within a turn. When a renderable HTML page changed, close the caption with a 🥏 (or 📦) render line *after* the list, not as a row: the list carries the source, the render line the running page. Link its live render per **Toss a live view** or **Publish an artifact** (link text the page path, one line per page, same honesty gate as ⭐, so a kit, doc, or asset gets none).

  ```
  - pages/index.html ([new](…), [main](…)/[diff](…))
  - lib/app.js ([new](…), [main](…)/[diff](…))

  🥏 [pages/index.html](…)
  ```

  The caption comes in three sizes, and saying **"caption"** requests one on demand: **full** (everything changed since main; what `/caption` emits by default, and the source for a guide-PR body sync), **turn** (this turn's files; the default closer for a file-modifying reply), and **bare** (no list, just the 🧭 guide link, for turns that changed nothing).
* **Session diff:** summarize substantial work with `Session diff: [main...branch](url)`.
* **External proxies:** prohibited. Third-party GitHub render services (`htmlpreview.github.io`, `raw.githack.com`, `gitcdn.link`, and the like) fetch the file server-side, so they 404 on private repos and route content through another host. The `[new]` blob is the canonical *source* view for every file type; when you want a *rendered* view of a private or un-deployed page, use the toss primitive above (content rides in the fragment, private-safe), not one of these.
* **Skip the watch offer:** never offer to watch CI or monitor a PR.

---

## The surfacing course

The lifecycle that engages once you open a PR: a **guide PR** per branch and a generated `docs/MERGE-GUIDE.md`.

Two artifacts surface a session's work, one at each **surfacing moment** (when the work breaks the surface for a reader): the guide PR's body (live while draft, reviewer-facing when ready) and the merge-guide entry (generated from that body at or after merge). They are one statement in two places: the guide PR body is authored, the merge-guide entry is generated from it, and both open with the same preamble:

1. **Outcome + why:** one sentence, no preamble.
2. **⭐ link to the thing to open:** the hosted URL for an already-deployed page, else a 🥏 toss render of the branch page, else the honest `[new]` blob (say "view," and never promise a running preview the change can't deliver).

Then a common tail: the `[new]/[main]/[diff]` file list, a `renders on:` line for shared components, Notes only for the non-obvious, and a diff or compare link. Skimmable in seconds.

|  | Guide PR body | Merge guide |
| --- | --- | --- |
| **Moment** | Live session through review | At/after merge |
| **Audience** | Resuming reader, then reviewer | Reader |
| **⭐ target** | Branch | Main URL |
| **File links** | Branch blobs | Main blobs |
| **Unique fields** | Next steps / open threads; Notes / Risk | PR#, date, durable notes |
| **Location** | GitHub PR | `docs/MERGE-GUIDE.md` |
| **Fate** | Persists with the PR | Persists in main |

### The guide PR

The branch's PR opens as a **draft at first push**, and its body is the branch guide: the live answer to "where did I leave things," which matures into the reviewer's summary. The draft state marks work in flight; marking it ready is the actual request the name "pull request" makes. Keep "Follow-up to #N" when continuing an earlier PR; end with the harness's session-link footer.

* **Open at first push.** Where the platform auto-creates draft PRs on push (an account-level toggle in the Claude Code web settings, not a repo property), that is the create. Otherwise the session opens the draft via the API, unprompted: creation is cheap and inward-facing. **Marking the PR ready is the user's decision.** The action itself is one call (`gh pr ready <n>`, or the API's ready-for-review mutation) and flips the PR from gray draft to green in the GitHub UI; the session performs it only when the user explicitly says to.
* **Keep the body synchronized as you work:** the body is the current-state summary, so it must not lie; keep it in step as the work progresses. This is a default, never a question: don't offer to sync it, defer it, or fold it into the wrap-up. It is not a per-push, per-file changelog: a single objective spanning many files or several pushes wants the body to reflect the resulting state, not a line for every change, so the right cadence is per meaningful change in state, not per commit. The sync engine is `/caption` (the `caption` skill in the bag), the same everywhere; keep the machine-refreshed part inside the fenced managed region below, so a sync never clobbers hand-written text outside it. The cumulative diff lives in the PR's Files tab; the body's Changed list carries only the curated layer a diff can't show (⭐/🥏 preview links, `renders on:` lines, one-line whys).
* **Narrative goes in PR comments,** append-only and dated, a progress log; the body holds only current state. (The same overwrite-vs-append split as the tracker's frontmatter tags vs progress log.)
* **Abandon by closing the draft** with a final comment saying why; a closed draft is a durable record of a dead end, which an orphan branch never is.
* **Nothing lands on main** by construction, so there is nothing to fold or delete at wrap-up. (This role was previously played by a per-branch `BRANCH-GUIDE.md` file; delete any stray one found on main as cleanup.)

Keep the body under one screen; **next steps / open threads** is the heart and the part each sync must revise.

```markdown
<One sentence: what this branch is doing and why.> [Follow-up to #N.]

<!-- guide -->
⭐ **Look:** [<the thing to open>](<branch preview w/ commit SHA, else [new] blob>)

**Changed:**
- <path> ([new](…), [main](…)/[diff](…))
  renders on: [<consumer>](…)     (shared component only)

**Next steps / open threads:**
- <current and honest; revise on every sync>

**Notes / Risk:** <what to scrutinize, test status, non-obvious why>
<!-- /guide -->

<session-link footer>
```

### Merge guide

Durable newest-on-top log of shipped sessions: one file, one URL, **generated** from merged PR bodies by a repo-owned script (web-tools ships [`scripts/build-merge-guide.py`](../scripts/build-merge-guide.py); reimplement freely). The guide PR body's guide region is the editable source, so there is no hand-written merge-guide step: the generator projects each merged PR into an entry. It is non-destructive, keyed by PR number: existing entries are preserved, a generated entry is added for a PR the file does not yet cover, and `--refresh` regenerates covered PRs (the mode a retroactive backfill uses). Run it where API access exists (a merge-triggered Action, or a local run); the output stays a committed file so the projection survives offline. (This log keys on the **PR**, a unit of delivery; the opt-in project tracker in [`docs/TRACKER.md`](TRACKER.md) keys on the **task**, a unit of intent. Same niche from two angles: pick one primary axis, since running both produces two logs that drift.)

**Reading it for inclusion:** an entry reaches main only on its own merge, so the main copy answers "Is PR #N in main?" (top entry is the latest). A merge made without an entry won't show, so absence isn't proof; git or GitHub's merged state is authoritative.

The generated entry mirrors the guide region: result first, primary file first, a `renders on:` line per shared component, branch URLs rewritten to main, and the branch-only **next steps** dropped.

```markdown
## <date> <one-line title> (PR #<n>)

<One sentence: the primary outcome.>

⭐ **Result:** [<primary artifact>](<canonical main URL; branch preview while unmerged>)

**Changed:**
- <path> ([new](…), [main](…)/[diff](…))
  renders on: [<consumer>](…)   (shared component only)

**Notes:** <only the non-obvious: why, what's unfinished, follow-ups>

[Session diff](<compare link>)
```

### Wrap-up & marking ready

Never offer to mark the PR ready on its own (the UI has that button too). Offer a bundled wrap-up: *"want me to wrap up (per-session refreshes, then mark the PR ready)?"* The body is already current (it is kept in step as you work, above), so the offer is not about syncing it: routing the wrap-up through chat gets the refreshes and the finalized guide into the diff before review, and accepting the offer is what authorizes marking the PR ready. When the prep is already done (refreshes run, body current), the only open action is marking ready, so ask that plainly rather than bundling in finished work.

**"Wrap up" is the standing phrase for this whole process.** When the user says it, run the sequence below and mark the PR ready at its end: it is the request to finish and go green, not to merge. (Historically the phrase meant creating the PR; the guide PR now opens at first push, so creation left the wrap-up.)

**Sequence:**

1. **Preflight: confirm the branch still merges cleanly.** `git fetch origin main && git merge-tree --write-tree origin/main HEAD` test-merges without touching the tree (a nonzero exit names the conflicting paths). A fresh clone bases the branch on main-as-it-was at session start, so if main advanced under you (a sibling session or PR merging overlapping edits) the branch conflicts at merge time and this session never sees it; resolve it now, before GitHub flags the PR unmergeable. Committed generated artifacts (bundles, lockfiles, indexes) are the usual culprits, colliding on lines neither author wrote. Report either way, so a clean run reads as verified.
2. Execute per-session refreshes.
3. Finalize the guide (the routine per-push sync already keeps it current; this is the content pass): next steps become follow-ups (or tracker tasks), Notes / Risk current for the reviewer. It is the source the merge guide is generated from after merge. No hand-written merge-guide entry.
4. Mark the PR ready.

**Last look before the container goes.** A wrap-up gets the PR green; it is also the last moment the session's volatile context still exists. Two cheap passes close the gap. First, harvest any **precious work product**: output that would cost real tokens to reproduce and lives only in this session (a fan-out's findings, a spike's conclusion, a diagnosis that never became a commit). Route it to the guide's next steps, a tracker task, or a PR comment; if the diff or a one-line note already rebuilds it cheaply, let the container take it. Second, widen "leave it nicer" from the doc to the repo: check the files you added landed where they belong, and name any placement that sits uneasily. Both are a sentence or two when there is nothing to report, so neither is make-work.

**UI trigger:** if the user marks the PR ready (or merges it) from the UI before a wrap-up ran, run steps 1 through 3 silently, surfacing any conflict the preflight finds since the open PR will show it.

### The next PR

Post-merge edits on the same branch require a *new* PR; don't update the merged one. The next push opens (or the session opens) a fresh draft, and `git log main..HEAD` shows the commits waiting for it.

---

## Post-merge handoff

Merge terminates the session branch.

When the repo runs a project tracker ([`docs/TRACKER.md`](TRACKER.md)), follow-ups become tasks and Option 1's HP collapses to "check the tracker and assess how to proceed"; the full diagnostic HP below is the trackerless form.

* **Option 1 (default):** issue a diagnostic handoff prompt (HP) and wind down.
* **Option 2:** continue edits (only on explicit user instruction; a new PR is then required, per above).

**Merged-branch closer:** under Option 1, end every subsequent reply with the exact line `*Branch <branch> merged in PR #<n>; no further edits will be made here.*` It marks that the work was captured, so don't elaborate on it; drop it only when the user opts into Option 2.

**Handoff prompt (HP):**

* Wrap in a fenced markdown block (four backticks if the prompt contains three).
* Reference the merged PR number or commit SHA; point to files and functions, don't dump code.
* Shape each issue as symptom, cause (*suspected*/*confirmed*), and fixes (*possible*/*likely*).
* Factual, non-prescriptive tone; keep it short (one context paragraph, one section per issue).
* Where useful, propose diagnostic tests that move a cause from suspected to confirmed, each emitting serialized output the user can share back.
* Close with: "Look through the relevant files, assess, and propose how to proceed."
