# Conversation

Use these rules when chat is the only output channel. Local `CLAUDE.md` rules
override these defaults. Apply repo- and branch-scoped rules per workstream,
substituting the current repo in URL templates.

---

## Every reply

* **Closing state.** Use exactly one, last, understandable without the message it closes. Write the glyph at the start of the line, then a bold lead: the name as shown, or for 🔵 the question.
  - 🟢 **Ready to continue:** The session has a clear path to proceed, approved or implied by user interest. It never instructs the reader. When the next step is merging the branch and nothing else is open, lead **Ready to merge:** instead.
  - ❇️ **Ready to assess:** The session assesses and reports back, without implementing.
  - 🟡 **Pending:** Waiting on an action or dependency, not on direction.
  - 🪧 **Direction needed:** Next steps appear to diverge. Offer to take the reader's direction or to make a full assessment and recommendation.
  - 🛵 **Needs you:** Only the reader can supply what is needed: a tap, an observation, or a value from outside the repo. Give each request an action link, one that performs it when tapped.
  - 👁️‍🗨️ **Have a look:** The session shows a page, a draft or a change for the reader's judgment. The whole lead is its look link, `[👁️‍🗨️ **Have a look:**](<url>)`; [Displaying content](#displaying-content) describes look links. Two or more pages, drafts or changes go in that one link, a step on each.
  - ✍️ **Sign-off needed:** Documentation wording, presented as the doc-craft skill asks, waits on the reader's approval. Say what the session will do once it is given.
  - 🟠 **Attention:** A concrete problem must be settled before proceeding.
  - ⚪ **Clean exit:** Nothing remains here; the reader decides whether to wrap up.
  - 🟣 **Merged:** GitHub reports this branch merged. State what shipped in one line. Further edits go in a new PR.
  - 🔴 **Closed:** This branch closed unmerged. State why in one line.
  - ⚫ **Done:** Every workstream merged or closed and nothing remains open. Nothing follows.
  - 🔵 **Short answer:** The question is answered and nothing is proposed. Lead with the question in place of the name, then the answer: 🔵 **Did the merge land?** Yes.

  Use 🟢, not ⚖️ or 🪧, when the reader's shared intention gives the session a clear path. A choice that cannot be answered by simple approval closes on ⚖️ **Choice needed:**, and only once the question has been fully assessed for an unfamiliar reader: give the question, then `Recommended: <answer>, because <reason>.` Without that assessment, close on 🪧. A request for the reader's judgment of something shown is 👁️‍🗨️; a request for an act or a fact is 🛵.

* **Close in one order.** End with the caption, render line, then the state. Include a state when no files changed. A wake (a nudge, stop hook, finished job, PR event, or moved base) that leaves the reader nothing new gets no reply. If the harness then requires visible output, reply with one line naming the wake.

* **Session detail caption.** Use the latest line the `session-detail-caption` hook supplied:
  `💬[22](…/pages/session.html#id=<short>) · 1d 2h · 816k · 1 file`
  `22` counts the owner's messages, `816k` is the context in tokens, `1 file` counts the files changed against `main`, and `<short>` is the session id's first eight characters.

## A reply that changed files

* **Branch anchor.** The first reply that changes files begins with `Working branch: [branch-name](url)`. Code changes use GitHub flow on a branch with assistant prefixes (`claude/`, `codex/`, `gemini/`, `grok/`). Shared coordination state (task trackers, personal lists, session logs, crawl caches) uses Real-time mode directly on `main`. Include the assistant's commit trailer from [AGENTS.md](https://github.com/mehrlander/web-tools/blob/main/AGENTS.md#assistant-identity-and-attribution).

* **Reference is a link.** Use `[caption](url)` for anything the reader can open. Label touched source `[new]`, unchanged source `[main]`, and changes `[diff]`. Give a page, document, or data file a render link: 🥏 for a toss, 🔷 for the deployed page, 📦 for a Claude artifact. Cite a pull request as `[web-tools#997](…/pull/997) [🌿](…#gh=owner/repo&pr=997) [💬](…/pages/session.html#id=<short>) https://claude.ai/code/<session-id>`: the pull request, its branch, its session record, and its session, which the app shows by title. Omit a session link to the present session. The session id is in the head commit's `Claude-Session` trailer. Inside a sentence, omit 🌿 and 💬. Repeat a pull request as `` `#997` ``: any other `#997`, even in bold or as link text, becomes an unwanted `owner/repo#997` chip. Cite a house policy as `[h:smug](…/app/?view=map&tab=policy&h=smug)`, not as a slash command. Cite a user call as `[⚖️ <question>](…/pages/user-call.html#src=…)`. Reserve `file:line` for grep and debugging.

* **Open the branch 🌿.** Use `…/pages/branch.html#gh=owner/repo@branch[&base=ref]`, or `…#gh=owner/repo&pr=<n>` for a PR's head and base. Add `&file=<path>` to open a file or `&pane=files` to open the file list.

* **The PR guide.** A PR's guide is the part of its body between `[//]: # (guide)` and `[//]: # (/guide)`. Write it when the PR opens, when its purpose changes, and before it merges. Leave out files, which the branch page shows, and commits and checks, which GitHub shows. Check a body with `python3 python/mcp-link-safe.py --check body.md`, run from a web-tools checkout, before sending it. Use:

  ```markdown
  ## What this PR does
  <one sentence: the resulting capability>
  ## Why this branch exists
  <the problem and the decisions behind the change, in plain prose>
  ## Open threads
  1. 🟢 **<title>**: <a step the session will take>
  2. 🟡 **<title>**: <what it waits on, and on whom>
  ## Risk
  <an uncertainty or stale assumption>
  ---
  🌿 [Open the branch](<branch URL>)
  ```

  List only threads still open, and omit a section with nothing to say.

## Displaying content

* **A rendered view 🥏.** `toss-render.html` renders a page or other content from GitHub. Each browser needs a GitHub token for private repos. `npm run showing` prints the 🥏 links for the branch's changed files, and with `--path <file>` a link for any file. The printed line goes in the reply unchanged, refreshed after each commit, with a few words after it on what the link shows. `npm run showing -- --help` lists the options for a fragment (the rendered page's own address) and a query.

* **A look link 👁️‍🗨️.** A look link is a 🥏 link that also lands the reader on a place in the rendered page and says why. It replaces one or more 🥏 links. When a reply asks the reader to look at or tap an element of a page, make the link a look link: `--intro "<what changed>"` greets the reader, and `--at "<fragment>"` lands on the place to see, with the fragment from `python/look-link.py` (`show` or `tap` for one place, `walkthrough` or `steps` for several; the `look-markers` skill).

* **Content in the link.** A `#gz=` link carries its content gzipped and base64url-encoded in the address, so it needs no commit or token; a link's length caps the content. `toss-render.html#gz=` renders a page carried this way. The Web Tools app's `#gz=` carries text files; in web-tools, `npm run -s stage-link -- <file>` prints one that opens the file with a Copy button. For a result that keeps source data in the browser, `npm run -s reception-link -- <fn.js> --note "<what is wanted>"` in web-tools prints a link that runs `<fn.js>` on what the reader pastes.

* **A screenshot.** In web-tools, `npm run shot -- <page>` saves a headless screenshot of a page from the working tree, and `--measure` adds overflow checks at desktop and phone width. The `screenshot-review` skill checks a shot before it is sent, and a file card shows it inline.

* **A file card.** `SendUserFile` attaches a file to the chat as a file card, where images render inline and other types download to the device. The download can be useful for an uncommitted file or one opened in another application, such as a Word document or a workbook, but a rendered link is usually more convenient and preferred.

## PR events

* **Subscribe the workstream PR 📬.** Call the `subscribe_pr_activity` tool once, after opening a PR.

  `go:` states intent, not write authority. Never schedule a check-in. A PR event is news only when it is a failing check on this session's work, a comment or review, a merge (🟣) or close (🔴) not yet reported, or a passing check the user said to wait for (then do the work that was waiting on it). The "status checklist" in the platform prompt refers to the PR on GitHub, not to the closing state.
