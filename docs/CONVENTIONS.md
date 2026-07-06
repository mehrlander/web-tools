# Working conventions (portable)

Remote-sandbox conventions for Claude Code web sessions; output is strictly via chat. The canonical source is `mehrlander/web-tools` at `docs/CONVENTIONS.md`, loaded by `@`-import or the `web-tools-conventions` skill. Local `CLAUDE.md` rules override these defaults. Substitute the current repo into all URL templates.

Adopt à la carte: two independent layers, take either alone.

1. **Surfacing primitives:** universal chat-handoff mechanics; apply anywhere, no setup.
2. **The surfacing course:** an opt-in lifecycle for PR-driven repos. Standing it up is never a precondition for the primitives, and a repo can adopt it later.

**Prose style:** zero em dashes. Use colons, commas, semicolons, parentheses, or new sentences.

**Extension points (set in local `CLAUDE.md`):**

* **Preview mechanism:** how to open changed code live from a branch; ⭐ links use it, else the `[new]` blob.
* **Per-session refreshes:** slow or non-deterministic artifacts regenerated once per session at wrap-up; none means no refresh step.
* **Branch-guide enforcement:** optional CI or hooks backing the branch-guide lifecycle; none means convention-only.

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
  * **🥏 `#gh=owner/repo[@ref]:path` (owner-only address mode):** fetches the file live via the viewer's stored token, so it renders a **branch** (`@<ref>`), a **private repo**, or a **private-repo branch** as a live pointer (not a snapshot), and pulls the page's same-ref relative deps in whole. It is gated to the renderer owner's allowlist, so it renders only for that owner and is **not portable** (a link sent to someone without an authorized token 404s). Reach for `#gz=` when the reader isn't the owner.
* **Branch anchor:** the first file-modifying reply leads with `Working branch: [branch-name](url)`.
* **Per-file links:** file-modifying turns end with a list, filename plain and link words tappable: `- src/file.ts ([new](…), [main](…), [diff](…))`. `[new]` is the branch tip, `[main]` the pre-change version on main (omit for new files), `[diff]` the commit. Append `#L120` or `#L120-L145` for line anchors. Don't duplicate a file's links within a turn.
* **Session diff:** summarize substantial work with `Session diff: [main...branch](url)`.
* **External proxies:** prohibited. Third-party GitHub render services (`htmlpreview.github.io`, `raw.githack.com`, `gitcdn.link`, and the like) fetch the file server-side, so they 404 on private repos and route content through another host. The `[new]` blob is the canonical *source* view for every file type; when you want a *rendered* view of a private or un-deployed page, use the toss primitive above (content rides in the fragment, private-safe), not one of these.
* **Skip the watch offer:** never offer to watch CI or monitor a PR.

---

## The surfacing course (opt-in)

An opt-in lifecycle for PR-driven repos. Requires maintaining `docs/MERGE-GUIDE.md` and a per-branch `BRANCH-GUIDE.md`; skip it and the primitives still stand.

Three artifacts surface a session's work, one at each **surfacing moment** (when the work breaks the surface for a reader): the branch guide (live), the PR body (pre-merge), and the merge-guide entry (at or after merge). They are sequential drafts of one statement, kept aligned, and all open with the same preamble:

1. **Outcome + why:** one sentence, no preamble.
2. **⭐ link to the thing to open:** the preview mechanism's target, or the honest `[new]` blob if there is none (say "view," and never promise a running preview the change can't deliver).

Then a common tail: the `[new]/[main]/[diff]` file list, a `renders on:` line for shared components, Notes only for the non-obvious, and a diff or compare link. Skimmable in seconds.

|  | Branch guide | PR body | Merge guide |
| --- | --- | --- | --- |
| **Moment** | Live session | Pre-merge | At/after merge |
| **Audience** | Resuming reader | Reviewer | Reader |
| **⭐ target** | Branch | Branch | Main URL |
| **File links** | Branch blobs | Branch blobs | Main blobs |
| **Unique fields** | Next steps / open threads | Risk, testing, follow-ups | PR#, date, durable notes |
| **Location** | `BRANCH-GUIDE.md` | GitHub PR | `docs/MERGE-GUIDE.md` |
| **Fate** | Folded + deleted at wrap-up | Persists with PR | Persists in main |

### Branch guide

Answers "where did I leave things" for unmerged work; never lands on main.

* **Create and push on the first commit,** before substantive work, so the branch exists on GitHub and every branch URL resolves from the first reply.
* **Update on every push:** the pushed state must not lie, and a stale guide is worse than none.
* **Fold and delete at wrap-up:** resolved into the merge-guide entry and deleted in one commit, so it nets out of the PR diff and never reaches main. If one leaks to main (a merge bypassed wrap-up), the next session deletes it.

Keep it under one screen; **next steps / open threads** is the heart and the part each update must revise.

```markdown
# Branch guide: <branch>

<One sentence: what this branch is doing and why.>

⭐ [<the thing to open>](<branch preview w/ commit SHA, else [new] blob>)

**Changed:**
- <path> ([new](…), [main](…), [diff](…))

**Next steps / open threads:**
- <current and honest; the reason this file exists>
```

### PR body

Answers "verify this" for reviewers; links resolve to the branch tip. Keep "Follow-up to #N" when continuing an earlier PR. End with the harness's session-link footer.

```markdown
<One sentence: what this does and why.> [Follow-up to #N.]

⭐ **Look:** [<artifact>](<branch preview, else [new] blob>)

**Changed:**
- <path> ([new](…), [main](…), [diff](…))
  renders on: [<consumer>](…)     (shared component only)

**Notes / Risk:** <what to scrutinize, test status, non-obvious why>

<session-link footer>
```

### Merge guide

Durable newest-on-top log of shipped sessions: one file, one URL. Written at wrap-up; outside a wrap-up only when the user asks. Never overwrite existing entries. Key each entry by PR number.

**Reading it for inclusion:** an entry reaches main only on its own merge, so the main copy answers "Is PR #N in main?" (top entry is the latest). A merge made without an entry won't show, so absence isn't proof; git or GitHub's merged state is authoritative.

Lead with the result, not the file list; primary file first; for a shared component add a `renders on:` line per consumer.

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

### Wrap-up & PR creation

Never offer PR creation on its own (the web UI already has a button). Offer a bundled wrap-up: *"want me to wrap up (fold the branch guide into the merge-guide entry and open the PR)?"* Routing it through chat gets the docs and refreshes into the PR's initial diff.

**Sequence:**

1. Execute per-session refreshes.
2. Fold `BRANCH-GUIDE.md` into `docs/MERGE-GUIDE.md` and delete the branch guide (single commit).
3. Open the PR.

**UI trigger:** if a PR opens via the web UI button mid-session, run steps 1 and 2 silently (step 3 is already done).

### Creating the next PR

Post-merge edits on the same branch require a *new* PR; don't update the merged one. `git log main..HEAD` shows the commits waiting for it.

---

## Post-merge handoff

Merge terminates the session branch.

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
