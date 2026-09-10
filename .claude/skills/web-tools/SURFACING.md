# Surfacing

Use these rules when chat is the only output channel. The canonical source is `mehrlander/web-tools` at `docs/SURFACING.md`, loaded by that repo's `CLAUDE.md` `@`-import or fetched by the `web-tools` skill. Local `CLAUDE.md` rules override these defaults. Apply repo- and branch-scoped rules per workstream, substituting the current repo in URL templates.

---

## Surfacing primitives

### Every reply

* **Closing state.** Use exactly one, last, understandable without the preceding message. Write the glyph at the start of the line with the name in bold, as shown.
  - 🟢 **Ready to continue:** You have a clear path to proceed, approved or implied by user interest.
  - ❇️ **Ready to assess:** "Go" means report back, not implement.
  - 🟡 **Pending:** Waiting on an action, answer, or dependency.
  - 🆚 **Choice needed:** Two competing changes. Assess, recommend, and name the choice.
  - ✴️ **Needs you:** Only the reader can supply what is needed. Provide an action link for every ask.
  - 🟠 **Attention:** A concrete problem must be settled before proceeding.
  - ⚪ **Clean exit:** Nothing remains here; the reader decides whether to wrap up.
  - 🟣 **Merged:** This branch merged. State what shipped in one line.
  - 🔴 **Closed:** This branch closed unmerged. State why in one line.
  - ⚫ **Done:** Every workstream merged or closed and nothing remains open. Nothing follows.
  - 🔵 **Short answer:** The question is answered and nothing is proposed. Restate the question in bold, followed by the answer.

  Every ✴️ ask requires an action link. For more than three asks, use an inquiry surface. Use 🟢, not 🆚, for confirmation.

* **Close in one order.** End with the 🌿 caption, render line, 🧭, then the state. Include a state when no files changed. A wake that changed nothing says nothing at all: no state, no restated list.

### A reply that changed files

* **Branch anchor.** The first reply that changes files begins with `Working branch: [branch-name](url)`.

* **Reference is a link.** Use `[caption](url)` for anything the reader can open. Label touched source `[new]`, unchanged source `[main]`, and changes `[diff]`. Give a renderable page its 🥏, ⭐, or 📦. Reserve `file:line` for grep and debugging.

* **Surfacing caption.** Use:
  `🌿 [<branch>](…/pages/branch.html#gh=<owner>/<repo>@<branch>) · <N> files · [this turn](…/commit/<sha>)`
  Calculate `<N>` with `git diff origin/main...HEAD --name-only | wc -l`. Omit `this turn` on a single-commit branch. Mention files in prose only when something non-obvious must be said about them. Token-less readers and MCP URL caps take the fallbacks in [surfacing-extended.md](https://github.com/mehrlander/web-tools/blob/main/docs/surfacing-extended.md).

* **Open the branch 🌿.** Use `…/pages/branch.html#gh=owner/repo@branch[&base=ref]`, or `…#gh=owner/repo&pr=<n>` for a PR's head and base. Add `&file=<path>` to open a file or `&pane=files` to open the file list.

* **Guide pointer 🧭.** Use `🧭 [PR #N](…) (body synced)` only when this turn rewrote the guide region; otherwise use `(body not synced)`. Do not carry the marker forward from an earlier reply.

The task marker 🎫, the session diff, and review the diff 🔍 follow [surfacing-extended.md](https://github.com/mehrlander/web-tools/blob/main/docs/surfacing-extended.md).

### Showing something

* **Toss a live view 🥏.** Render an unhosted page with `toss-render.html#gh=owner/repo[@ref]:path`. It may take a trailing `#frag` and `?w=<px>`. If `#gh=` is unavailable because of token or allowlist access, use the `#gz=` fallback in [surfacing-extended.md](https://github.com/mehrlander/web-tools/blob/main/docs/surfacing-extended.md). Obtain an `@ref` SHA with `git rev-parse HEAD` and confirm it was pushed with `git rev-parse origin/<branch>`.

* **Show pixels.** For a visual change, inspect and include a headless screenshot. Measure `scrollWidth` for horizontal overflow.

* **Hand over the artifact.** Send an artifact with `SendUserFile`, not a path. Images preview inline; HTML, zip, and audio download.

Run `npm run showing` before handing over a render link, and paste the line it prints. It reads the branch's changed files and either names the page and mechanism that reach them, or reports that no link does.

Uncommon carriers (lead with the live view, publish an artifact 📦, stage a fileset 🗂️, envelopes, data toss 📊, clipboard 📋/run 📲 links): follow [surfacing-extended.md](https://github.com/mehrlander/web-tools/blob/main/docs/surfacing-extended.md).

### PR events

* **Subscribe the workstream PR 📬.** Call the `subscribe_pr_activity` tool once, after opening a PR.

  Treat each event separately. `go:` expresses intent, not write authorization. Address failing checks only when relevant to this session. If a wake changes nothing, do not reply. When an open PR merges, mark the event and close with the appropriate state even if no files changed. When an open PR closes unmerged, mark it 🔴 even if no files changed.
