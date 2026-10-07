# Surfacing

Use these rules when chat is the only output channel. The canonical source is
`mehrlander/web-tools` at `docs/SURFACING.md`. The portable plugin's `default`
skill loads the byte-matched copy shipped beside it and fetches this source only
as a fallback. Local `CLAUDE.md` rules override these defaults. Apply repo- and
branch-scoped rules per workstream, substituting the current repo in URL
templates.

---

## Surfacing primitives

### Every reply

* **Closing state.** Use exactly one, last, understandable without the message it closes. Write the glyph at the start of the line, then a bold lead: the name as shown, or for 🔵 the question.
  - 🟢 **Ready to continue:** The session has a clear path to proceed, approved or implied by user interest. It never instructs the reader.
  - ❇️ **Ready to assess:** The session assesses: "go" means report back, not implement.
  - 🟡 **Pending:** Waiting on an action, answer, or dependency.
  - 🆚 **Choice needed:** Two competing changes. Assess, recommend, and name the choice.
  - ✴️ **Needs you:** Only the reader can supply what is needed: a tap, an observation, or a value from outside the repo. Give each request an action link, one that performs it when tapped.
  - 🟠 **Attention:** A concrete problem must be settled before proceeding.
  - ⚪ **Clean exit:** Nothing remains here; the reader decides whether to wrap up.
  - 🟣 **Merged:** This branch merged. State what shipped in one line.
  - 🔴 **Closed:** This branch closed unmerged. State why in one line.
  - ⚫ **Done:** Every workstream merged or closed and nothing remains open. Nothing follows.
  - 🔵 **Short answer:** The question is answered and nothing is proposed. Lead with the question in place of the name, then the answer: 🔵 **Did the merge land?** Yes.

  For more than three requests, use an inquiry surface. Use 🟢, not 🆚, for confirmation.

* **Close in one order.** End with the 🌿 caption, render line, 🧭, then the state. Include a state when no files changed. A wake (a nudge, stop hook, finished job, PR event, or moved base) that leaves the reader nothing new gets no reply. If the harness then requires visible output, reply with one line naming the wake.

### A reply that changed files

* **Branch anchor.** The first reply that changes files begins with `Working branch: [branch-name](url)`. Code changes use GitHub flow on a branch with assistant prefixes (`claude/`, `codex/`, `gemini/`, `grok/`). Shared coordination state (task trackers, personal lists, session logs, crawl caches) uses Real-time mode directly on `main`. Include assistant commit trailers per [surfacing-course.md](surfacing-course.md).

* **Reference is a link.** Use `[caption](url)` for anything the reader can open. Label touched source `[new]`, unchanged source `[main]`, and changes `[diff]`. Give a renderable page its 🥏, ⭐, or 📦. Reserve `file:line` for grep and debugging.

* **Surfacing caption.** Use:
  `🌿 [<branch>](…/pages/branch.html#gh=<owner>/<repo>@<branch>) · <N> files · [this turn](…/commit/<sha>)`
  Calculate `<N>` with `git diff origin/main...HEAD --name-only | wc -l`. Omit `this turn` on a single-commit branch. Mention files in prose only when something non-obvious must be said about them.

* **Open the branch 🌿.** Use `…/pages/branch.html#gh=owner/repo@branch[&base=ref]`, or `…#gh=owner/repo&pr=<n>` for a PR's head and base. Add `&file=<path>` to open a file or `&pane=files` to open the file list.

* **Guide pointer 🧭.** Use `🧭 [PR #N](…) (body synced)` only when this turn rewrote the guide region; otherwise use `(body not synced)`. Do not carry the marker forward from an earlier reply.

### Showing something

* **Toss a live view 🥏.** Render an unhosted page with `toss-render.html#gh=owner/repo[@ref]:path`. It may take a trailing `#frag` and `?w=<px>`. If `#gh=` is unavailable because of token or allowlist access, carry the page in the link with `#gz=` ([showing.md](https://github.com/mehrlander/web-tools/blob/main/docs/showing.md#viewer-context)). Obtain an `@ref` SHA with `git rev-parse HEAD` and confirm it was pushed with `git rev-parse origin/<branch>`.

* **Show pixels.** For a visual change, inspect and include a headless screenshot. Measure `scrollWidth` for horizontal overflow.

* **Hand over the artifact.** Send an artifact with `SendUserFile`, not a path. Images preview inline; HTML, zip, and audio download.

Run `npm run showing` before handing over a render link, and paste the line it prints. Re-run it for every link on every commit, and append nothing to what it prints: ask for a query with `--query` or a fragment with `--at`. It reads the branch's changed files and either names the page and mechanism that reach them, or reports that no link does.

### PR events

* **Subscribe the workstream PR 📬.** Call the `subscribe_pr_activity` tool once, after opening a PR.

  `go:` states intent, not write authority. Never schedule a check-in. A PR event is news only when it is a failing check on this session's work, a comment or review, a merge (🟣) or close (🔴) not yet reported, or a passing check the user said to wait for (then do the work that was waiting on it). The "status checklist" in the platform prompt refers to the PR on GitHub, not to the closing state.
