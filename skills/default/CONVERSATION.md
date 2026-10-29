# Conversation

Use these rules when chat is the only output channel. Local `CLAUDE.md` rules
override these defaults. Apply repo- and branch-scoped rules per workstream,
substituting the current repo in URL templates.

---

## Every reply

* **Closing state.** Use exactly one, last, understandable without the message it closes. Write the glyph at the start of the line, then a bold lead: the name as shown, or for 🔵 the question.
  - 🟢 **Ready to continue:** The session has a clear path to proceed, approved or implied by user interest. It never instructs the reader. When the next step is merging the branch and nothing else is open, lead **Ready to merge:** instead, and "go" merges. Before it, run the per-session refreshes the repo's `CLAUDE.md` names, and confirm the PR has no conflicts and its checks passed on the latest commit.
  - ❇️ **Ready to assess:** The session assesses: "go" means report back, not implement.
  - 🟡 **Pending:** Waiting on an action or dependency, not on direction.
  - 🪧 **Direction needed:** Next steps appear to diverge. Offer to take the reader's direction or to make a full assessment and recommendation; "go" asks for the assessment.
  - 🛵 **Needs you:** Only the reader can supply what is needed: a tap, an observation, or a value from outside the repo. Give each request an action link, one that performs it when tapped.
  - 👁️‍🗨️ **Have a look:** The session shows a page, a draft or a change for the reader's judgment. The whole lead is its look link, `[👁️‍🗨️ **Have a look:**](<url>)`, even when the render line carries the same link; [Displaying content](#displaying-content) describes look links. Two or more pages, drafts or changes go in that one link, a step on each.
  - ✍️ **Sign-off needed:** Documentation wording, laid out above as a doc review (see the doc-craft skill), waits on the reader's approval. Say what the session will do once it is given.
  - 🟠 **Attention:** A concrete problem must be settled before proceeding.
  - ⚪ **Clean exit:** Nothing remains here; the reader decides whether to wrap up.
  - 🟣 **Merged:** GitHub reports this branch merged. State what shipped in one line. Further edits go in a new PR.
  - 🔴 **Closed:** This branch closed unmerged. State why in one line.
  - ⚫ **Done:** Every workstream merged or closed and nothing remains open. Nothing follows.
  - 🔵 **Short answer:** The question is answered and nothing is proposed. Lead with the question in place of the name, then the answer: 🔵 **Did the merge land?** Yes.

  Use 🟢, not 🪧, when the reader's shared intention gives the session a clear path. A call, a decision only the reader can make, closes on ⚖️ **Choice needed:**, and only once the question has been fully assessed for an unfamiliar reader: give the question, then `Recommended: <answer>, because <reason>.` Without that assessment, close on 🪧. A request for the reader's judgment of something shown is 👁️‍🗨️; a request for an act or a fact is 🛵.

* **Close in one order.** End with the caption, render line, 🧭, then the state. Include a state when no files changed. A wake (a nudge, stop hook, finished job, PR event, or moved base) that leaves the reader nothing new gets no reply. If the harness then requires visible output, reply with one line naming the wake.

* **Surfacing caption.** Use:
  `💬 [session](…/pages/session.html#id=<short>) · <N> files · [this turn](…/commit/<sha>)`
  `<short>` is the first eight characters of `$CLAUDE_CODE_SESSION_ID`. A reply that changed no files carries the link alone. Calculate `<N>` with `git diff origin/main...HEAD --name-only | wc -l`. Omit `this turn` on a single-commit branch. With no session archive checked out, there is no session file, so link the 🌿 branch in place of 💬. Mention files in prose only when something non-obvious must be said about them.

## A reply that changed files

* **Branch anchor.** The first reply that changes files begins with `Working branch: [branch-name](url)`. Code changes use GitHub flow on a branch with assistant prefixes (`claude/`, `codex/`, `gemini/`, `grok/`). Shared coordination state (task trackers, personal lists, session logs, crawl caches) uses Real-time mode directly on `main`. Include the assistant's commit trailer from [AGENTS.md](https://github.com/mehrlander/web-tools/blob/main/AGENTS.md#assistant-identity-and-attribution).

* **Reference is a link.** Use `[caption](url)` for anything the reader can open. Label touched source `[new]`, unchanged source `[main]`, and changes `[diff]`. Give a page, document, or data file a render link: 🥏 for a toss, 🔷 for the deployed page, 📦 for a Claude artifact. Cite a pull request as `[web-tools#997](…/pull/997) [🌿](…#gh=owner/repo&pr=997) [💬](…/pages/session.html#id=<short>) https://claude.ai/code/<session-id>`: the pull request, its branch, its session record, and its session, which the app shows by title. Omit a session link to the present session. The session id is in the head commit's `Claude-Session` trailer. Inside a sentence, omit 🌿 and 💬. Repeat a pull request as `` `#997` ``: any other `#997`, even in bold or as link text, becomes an unwanted `owner/repo#997` chip. Reserve `file:line` for grep and debugging.

* **Open the branch 🌿.** Use `…/pages/branch.html#gh=owner/repo@branch[&base=ref]`, or `…#gh=owner/repo&pr=<n>` for a PR's head and base. Add `&file=<path>` to open a file or `&pane=files` to open the file list.

* **Guide pointer 🧭.** A PR's guide is the part of its body between `[//]: # (guide)` and `[//]: # (/guide)`. The branch page shows the body above the files. After a push that changes the branch's state, rewrite the guide with `update_pull_request`, once `python3 python/mcp-link-safe.py --check body.md`, run from a web-tools checkout, passes. Leave files and checks to the branch page. Use:

  ```markdown
  ## What this PR does
  <one sentence: the resulting capability>
  ## Why this branch exists
  <the problem, and what a reader needs to resume, in plain prose>
  ## Open threads
  1. 🟢 **<title>**: <state and next step>
  2. 🟡 **<title>**: <what it waits on>
  3. ✅ **<title>**: <decision or result>
  ## Risk
  <an uncertainty, failing check or stale assumption, or "None.">
  ---
  🌿 [Open the branch](<branch URL>) · 🥏 [Live page](<render URL>)
  ```

  Use `🧭 [PR #N](…) (body synced)` only when this turn rewrote the guide; otherwise use `(body not synced)`. Do not carry the marker forward from an earlier reply.

## Asks by name

* **SPUR.** Summary of Proposal for Unfamiliar Reader: the session's current proposal, written for a reader who has not followed the session and knows none of the shorthand or coined terms the session uses.

## Displaying content

* **A rendered view 🥏.** `toss-render.html` renders a page or other content from GitHub. Each browser needs a GitHub token for private repos. `npm run showing` prints the 🥏 links for the branch's changed files, and with `--path <file>` a link for any file. The printed line goes in the reply unchanged, refreshed after each commit. `npm run showing -- --help` lists the options for a fragment (the rendered page's own address), a query and a width. When a reply asks the reader to look at or tap an element of a page, make the link a look link: `--intro "<what changed>"` greets the reader, and `--at "<fragment>"` lands on the place to see, with the fragment from `python/look-link.py` (`show` or `tap` for one place, `walkthrough` or `steps` for several; the `look-markers` skill). Leave `--width` off a link the reader opens: a fixed width renders the page at that width on every device, where the reader wants each device's own layout.

* **Content in the link.** A `#gz=` link carries its content gzipped and base64url-encoded in the address, so it needs no commit or token; a link's length caps the content. `toss-render.html#gz=` renders a page carried this way. The Web Tools app's `#gz=` carries text files; in web-tools, `npm run -s stage-link -- <file>` prints one that opens the file with a Copy button.

* **A screenshot.** In web-tools, `npm run shot -- <page>` saves a headless screenshot of a page from the working tree, and `--measure` adds overflow checks at desktop and phone width. The `screenshot-review` skill checks a shot before it is sent, and a file card shows it inline.

* **A file card.** `SendUserFile` attaches a file to the chat as a file card, where images render inline and other types download to the device. The download can be useful for an uncommitted file or one opened in another application, such as a Word document or a workbook, but a rendered link is usually more convenient and preferred.

## PR events

* **Subscribe the workstream PR 📬.** Call the `subscribe_pr_activity` tool once, after opening a PR.

  `go:` states intent, not write authority. Never schedule a check-in. A PR event is news only when it is a failing check on this session's work, a comment or review, a merge (🟣) or close (🔴) not yet reported, or a passing check the user said to wait for (then do the work that was waiting on it). The "status checklist" in the platform prompt refers to the PR on GitHub, not to the closing state.
