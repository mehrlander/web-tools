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
  - 🟡 **Pending:** Waiting on an action or dependency, not on direction.
  - 🪧 **Direction needed:** The session needs the reader to set the next step. Close with the recommendation: `🪧 **Direction needed:** <question>. Recommended: <answer>, because <reason>.`
  - ✴️ **Needs you:** Only the reader can supply what is needed: a tap, an observation, or a value from outside the repo. Give each request an action link, one that performs it when tapped.
  - 🟠 **Attention:** A concrete problem must be settled before proceeding.
  - ⚪ **Clean exit:** Nothing remains here; the reader decides whether to wrap up.
  - 🟣 **Merged:** This branch merged. State what shipped in one line.
  - 🔴 **Closed:** This branch closed unmerged. State why in one line.
  - ⚫ **Done:** Every workstream merged or closed and nothing remains open. Nothing follows.
  - 🔵 **Short answer:** The question is answered and nothing is proposed. Lead with the question in place of the name, then the answer: 🔵 **Did the merge land?** Yes.

  Use 🟢, not 🪧, when the session can proceed without the reader. Before 🪧, explore what could settle the question; more exploration is a valid recommendation. A call, a decision only the reader can make, closes instead on ⚖️ **Choice needed:** after a full assessment, with the same `Recommended:` clause.

* **Close in one order.** End with the caption, render line, 🧭, then the state. Include a state when no files changed. A wake (a nudge, stop hook, finished job, PR event, or moved base) that leaves the reader nothing new gets no reply. If the harness then requires visible output, reply with one line naming the wake.

* **Surfacing caption.** Use:
  `💬 [session](…/pages/session.html#id=<short>) · <N> files · [this turn](…/commit/<sha>)`
  `<short>` is the first eight characters of `$CLAUDE_CODE_SESSION_ID`. A reply that changed no files carries the link alone. Calculate `<N>` with `git diff origin/main...HEAD --name-only | wc -l`. Omit `this turn` on a single-commit branch. With no sessions store checked out, there is no record, so link the 🌿 branch in place of 💬. Mention files in prose only when something non-obvious must be said about them.

### A reply that changed files

* **Branch anchor.** The first reply that changes files begins with `Working branch: [branch-name](url)`. Code changes use GitHub flow on a branch with assistant prefixes (`claude/`, `codex/`, `gemini/`, `grok/`). Shared coordination state (task trackers, personal lists, session logs, crawl caches) uses Real-time mode directly on `main`. Include assistant commit trailers per [surfacing-course.md](surfacing-course.md).

* **Reference is a link.** Use `[caption](url)` for anything the reader can open. Label touched source `[new]`, unchanged source `[main]`, and changes `[diff]`. Give a page, document, or data file a render link: 🥏 for a toss, ⭐ for the deployed page, 📦 for a Claude artifact. Reserve `file:line` for grep and debugging.

* **Open the branch 🌿.** Use `…/pages/branch.html#gh=owner/repo@branch[&base=ref]`, or `…#gh=owner/repo&pr=<n>` for a PR's head and base. Add `&file=<path>` to open a file or `&pane=files` to open the file list.

* **Guide pointer 🧭.** Use `🧭 [PR #N](…) (body synced)` only when this turn rewrote the guide region; otherwise use `(body not synced)`. Do not carry the marker forward from an earlier reply.

### Displaying content

* **A rendered view 🥏.** `toss-render.html` renders a page or other content from GitHub. Each browser needs a GitHub token for private repos. `npm run showing` prints the 🥏 links for the branch's changed files, and with `--path <file>` a link for any file. The printed line goes in the reply unchanged, refreshed after each commit. `npm run showing -- --help` lists the options for a fragment (the rendered page's own address), a query and a width.

* **Content in the link.** A `#gz=` link carries its content gzipped and base64url-encoded in the address, so it needs no commit or token; a link's length caps the content. `toss-render.html#gz=` renders a page carried this way. The Web Tools app's `#gz=` carries text files; in web-tools, `npm run -s stage-link -- <file>` prints one that opens the file with a Copy button.

* **A screenshot.** In web-tools, `npm run shot -- <page>` saves a headless screenshot of a page from the working tree, and `--measure` adds overflow checks at desktop and phone width. The `screenshot-review` skill checks a shot before it is sent, and a file card shows it inline.

* **A file card.** `SendUserFile` attaches a file to the chat as a file card, where images render inline and other types download to the device. The download can be useful for an uncommitted file or one opened in another application, such as a Word document or a workbook, but a rendered link is usually more convenient and preferred.

### PR events

* **Subscribe the workstream PR 📬.** Call the `subscribe_pr_activity` tool once, after opening a PR.

  `go:` states intent, not write authority. Never schedule a check-in. A PR event is news only when it is a failing check on this session's work, a comment or review, a merge (🟣) or close (🔴) not yet reported, or a passing check the user said to wait for (then do the work that was waiting on it). The "status checklist" in the platform prompt refers to the PR on GitHub, not to the closing state.
