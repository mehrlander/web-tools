# Working conventions (portable)

Remote-sandbox conventions for Claude Code web sessions; output is strictly via chat. The canonical source is `mehrlander/web-tools` at `docs/CONVENTIONS.md`, loaded by `@`-import or the `web-tools-conventions` skill. Local `CLAUDE.md` rules override these defaults. Substitute the current repo into all URL templates.

Adopt à la carte: two independent layers, take either alone.

1. **Surfacing primitives:** universal chat-handoff mechanics; apply anywhere, no setup.
2. **The surfacing course:** an opt-in lifecycle for PR-driven repos. Standing it up is never a precondition for the primitives, and a repo can adopt it later.

**Prose style:** zero em dashes. Use colons, commas, semicolons, parentheses, or new sentences.

**Extension points (set in local `CLAUDE.md`):**

* **Preview mechanism:** how to open changed code live from a branch; ⭐ links use it, else the `[new]` blob.
* **Per-session refreshes:** slow or non-deterministic artifacts regenerated once per session at wrap-up; none means no refresh step.
* **Guide-PR support:** whether the platform auto-creates draft PRs on push, and any body-sync tooling; none means the session opens the draft via the API and syncs the body by hand.

---

## Surfacing primitives

* **Explicit markdown:** use `[caption](url)` for anything tappable; bare paths drop on mobile, in rendered markdown, and when copied. Reserve `file:line` for grep and debug references, not handoff links.
* **Show pixels:** for visual changes, send a headless-browser screenshot inline (after viewing it yourself).
* **Hand over the artifact:** when you produce a file the user would open, run, or iterate on (an HTML page, a zip, an audio file), proactively send it with `SendUserFile` so they get a working in-chat downloader, rather than only describing it or pasting a path. Treat this as a default, not something to wait to be asked for. The UI renders the result as a **file card** (also **file chip**; the user may simply say "send the file"): a click-to-download chip for HTML / zip / audio and the like, an inline preview for images. Compose with Show pixels when the thing is visual (screenshot to show, card to hand over); use the tool's `proactive` status when surfacing unprompted, `normal` when replying.
* **Lead with the live view:** a README (or folder readme) for something that renders opens, right under the title, with a prominent ⭐ link to the hosted version ("go here for the nice view"), before any prose. The rendered artifact is the first tappable thing, not something buried in description.
* **Toss a live view (private-safe):** when a renderable HTML page has no hosted URL of its own (a private repo, an un-deployed branch), you can still hand over a live rendering instead of only the `[new]` source blob. **Mark a toss link with 🥏** the way ⭐ marks a hosted live view, so a reader sees at a glance it renders through the shared toss-render renderer, not source. Two forms:
  * **🥏 `#gz=` (portable, works for anyone):** gzip the page into the fragment of the shared hosted renderer and link that: `https://mehrlander.github.io/web-tools/pages/toss-render.html#gz=<base64url>`. That host is a fixed shared endpoint (use it literally; it is not a per-repo URL template). The payload rides in the `#fragment`, so it never reaches a server: nothing has to be hosted, the private content stays inside the link, and it renders in a sandbox (opaque origin, no access to the renderer's stored token). Absolute-URL CDN libraries (`<script src="https://…">`) load normally inside the toss; only same-repo **relative** deps (`./app.js`, `fetch('./x.json')`) can't resolve, since the page exists only in the link. This is the portable fallback for the ⭐ preview when a repo defines no preview mechanism of its own. Encode a file to a link with:
    ```bash
    python3 -c "import gzip,base64,sys,pathlib; b=gzip.compress(pathlib.Path(sys.argv[1]).read_bytes()); s=base64.b64encode(b).decode().replace('+','-').replace('/','_').rstrip('='); print('https://mehrlander.github.io/web-tools/pages/toss-render.html#gz='+s)" page.html
    ```
  * **🥏 `#gh=owner/repo[@ref]:path` (owner-only address mode):** fetches the file live via the viewer's stored token, so it renders a **branch** (`@<ref>`), a **private repo**, or a **private-repo branch** as a live pointer (not a snapshot), and pulls the page's same-ref relative deps in whole. It is gated to the renderer owner's allowlist, so it renders only for that owner and is **not portable** (a link sent to someone without an authorized token 404s). Reach for `#gz=` when the reader isn't the owner. Note that `#gh=` also depends on *where the link opens*, not just who taps it: the token lives in one browser's localStorage, and the Claude app's in-app browser has its own empty storage, so `#gh=` fails there by construction. For that case use the artifact below.
* **Publish an artifact (signed-in-safe) 📦:** a third live-view channel beside ⭐ and 🥏: publish the page as a Claude Code artifact, a self-contained snapshot at a stable private `claude.ai` URL, and **mark the link with 📦**. Auth is the viewer's claude.ai sign-in, not a stored token, so an artifact renders where a 🥏 `#gh=` toss cannot: the Claude app itself. The artifact CSP blocks every external request, so bake the page self-contained first (CDN libraries compiled or inlined; see the bake pipeline in `docs/artifacts.md`). Snapshot semantics: frozen at publish, republishable in place with version history, not a live pointer. On Pro and Max plans artifacts stay private to the author, so they serve the owner-in-the-app case; hand any other reader the 🥏 `#gz=` toss. Record the URL in a durable place (README, PR body, task file); a later session can only update what it can find. Mechanics and the full link-choice matrix: `docs/artifacts.md` in the canonical repo.
* **Branch anchor:** the first file-modifying reply leads with `Working branch: [branch-name](url)`.
* **Guide pointer 🧭:** mark links to the branch's guide PR (or branch-guide file, where a repo still keeps one) with 🧭, the way ⭐ marks a hosted live view, 🥏 a toss render, and 📦 a published artifact: the compass says "orient here." A reply may close with a bare `🧭 [PR #N](…)` line so the live state stays one tap away.
* **Surfacing caption:** end a file-modifying turn with what changed, a uniform bulleted list, filename plain and the link words tappable. `[new]` is the branch tip, `[main]` the pre-change version on main (omit for a new file), `[diff]` the commit; add `#L120` or `#L120-L145` for a line anchor. Keep the rows plain and uniform (no bullet swaps, no per-row icons) and don't repeat a file's links within a turn. When a renderable HTML page changed, close the caption with a 🥏 (or 📦) render line *after* the list, not as a row: the list carries the source, the render line the running page. Link its live render per **Toss a live view** or **Publish an artifact** (link text the page path, one line per page, same honesty gate as ⭐, so a kit, doc, or asset gets none).

  ```
  - pages/index.html ([new](…), [main](…), [diff](…))
  - lib/app.js ([new](…), [main](…), [diff](…))

  🥏 [pages/index.html](…)
  ```

  The caption comes in three sizes, and saying **"caption"** requests one on demand: **full** (everything changed since main; what `/caption` emits by default, and the source for a guide-PR body sync), **turn** (this turn's files; the default closer for a file-modifying reply), and **bare** (no list, just the 🧭 guide link, for turns that changed nothing).
* **Session diff:** summarize substantial work with `Session diff: [main...branch](url)`.
* **External proxies:** prohibited. Third-party GitHub render services (`htmlpreview.github.io`, `raw.githack.com`, `gitcdn.link`, and the like) fetch the file server-side, so they 404 on private repos and route content through another host. The `[new]` blob is the canonical *source* view for every file type; when you want a *rendered* view of a private or un-deployed page, use the toss primitive above (content rides in the fragment, private-safe), not one of these.
* **Skip the watch offer:** never offer to watch CI or monitor a PR.

---

## The surfacing course (opt-in)

An opt-in lifecycle for PR-driven repos. Requires maintaining `docs/MERGE-GUIDE.md` and a **guide PR** per branch; skip it and the primitives still stand.

Two artifacts surface a session's work, one at each **surfacing moment** (when the work breaks the surface for a reader): the guide PR's body (live while draft, reviewer-facing when ready) and the merge-guide entry (generated from that body at or after merge). They are one statement in two places: the guide PR body is authored, the merge-guide entry is generated from it, and both open with the same preamble:

1. **Outcome + why:** one sentence, no preamble.
2. **⭐ link to the thing to open:** the preview mechanism's target, or the honest `[new]` blob if there is none (say "view," and never promise a running preview the change can't deliver).

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

* **Open at first push.** Where the platform auto-creates draft PRs on push (see the guide-PR support extension point), that is the create. Otherwise the session opens the draft via the API, unprompted: creation is cheap and inward-facing. **Marking the PR ready is the user's decision.** The action itself is one call (`gh pr ready <n>`, or the API's ready-for-review mutation) and flips the PR from gray draft to green in the GitHub UI; the session performs it only when the user explicitly says to.
* **Sync the body on every push:** the pushed state must not lie, and a stale guide is worse than none. Keep the machine-refreshed part inside the fenced managed region below, so a sync never clobbers hand-written text outside it. The cumulative diff lives in the PR's Files tab; the body's Changed list carries only the curated layer a diff can't show (⭐/🥏 preview links, `renders on:` lines, one-line whys).
* **Narrative goes in PR comments,** append-only and dated, a progress log; the body holds only current state. (The same overwrite-vs-append split as the tracker's frontmatter tags vs progress log.)
* **Abandon by closing the draft** with a final comment saying why; a closed draft is a durable record of a dead end, which an orphan branch never is.
* **Nothing lands on main** by construction, so there is nothing to fold or delete at wrap-up. (This role was previously played by a per-branch `BRANCH-GUIDE.md` file; delete any stray one found on main as cleanup.)

Keep the body under one screen; **next steps / open threads** is the heart and the part each sync must revise.

```markdown
<One sentence: what this branch is doing and why.> [Follow-up to #N.]

<!-- guide -->
⭐ **Look:** [<the thing to open>](<branch preview w/ commit SHA, else [new] blob>)

**Changed:**
- <path> ([new](…), [main](…), [diff](…))
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
- <path> ([new](…), [main](…), [diff](…))
  renders on: [<consumer>](…)   (shared component only)

**Notes:** <only the non-obvious: why, what's unfinished, follow-ups>

[Session diff](<compare link>)
```

### Wrap-up & marking ready

Never offer to mark the PR ready on its own (the UI has that button too). Offer a bundled wrap-up: *"want me to wrap up (sync the PR body and mark the PR ready)?"* Routing it through chat gets the refreshes and the current guide region into the diff before review, and accepting the offer is what authorizes marking the PR ready.

**"Wrap up" is the standing phrase for this whole process.** When the user says it, run the sequence below and mark the PR ready at its end: it is the request to finish and go green, not to merge. (Historically the phrase meant creating the PR; the guide PR now opens at first push, so creation left the wrap-up.)

**Sequence:**

1. **Preflight: confirm the branch still merges cleanly.** `git fetch origin main && git merge-tree --write-tree origin/main HEAD` test-merges without touching the tree (a nonzero exit names the conflicting paths). A fresh clone bases the branch on main-as-it-was at session start, so if main advanced under you (a sibling session or PR merging overlapping edits) the branch conflicts at merge time and this session never sees it; resolve it now, before GitHub flags the PR unmergeable. Committed generated artifacts (bundles, lockfiles, indexes) are the usual culprits, colliding on lines neither author wrote. Report either way, so a clean run reads as verified.
2. Execute per-session refreshes.
3. Final body sync: the guide region current (it is the source the merge guide is generated from after merge), next steps become follow-ups (or tracker tasks), Notes / Risk current for the reviewer. No hand-written merge-guide entry.
4. Mark the PR ready.

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
