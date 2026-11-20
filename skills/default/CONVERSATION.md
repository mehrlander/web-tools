# Conversation

Use these rules when chat is the only output channel. Local `CLAUDE.md` rules
override these defaults. Apply repo- and branch-scoped rules per workstream,
substituting the current repo in URL templates.

---

## Every reply

* **Closing state.** Use exactly one, last, understandable without the message it closes. Write the glyph at the start of the line, then a bold lead: the name as shown, or for 🔵 the question.
  - 🟢 **Ready to continue:** The session has a clear path to proceed, approved or implied by user interest. It never instructs the reader. When the next step is to merge the branch, lead **Ready to merge:** instead.
  - ❇️ **Ready to assess:** The session assesses and reports back, without implementing.
  - 🟡 **Pending:** Waiting on an action or dependency, not on direction.
  - ⚖️ **Choice needed:** Competing proposals would go in different directions. Present this state only after a full assessment. Give the question, then `Recommended: <answer>, because <reason>.`
  - 🛵 **Needs you:** Only the reader can supply what is needed: a tap, an observation, or a value from outside the repo. Give each request an action link, one that performs it when tapped.
  - 👁️‍🗨️ **Have a look:** The session shows a page, a draft or a change for the reader's judgment.
  - ✍️ **Sign-off needed:** Documentation wording waits on the reader's approval, as [doc-craft's Review](https://github.com/mehrlander/web-tools/blob/main/skills/doc-craft/SKILL.md#review) describes. Say what the session will do once approval is given.
  - 🟠 **Attention:** A concrete problem must be settled before proceeding.
  - ⚪ **Clean exit:** The session's work is complete; the reader can end the session or bring more.
  - 🟣 **Merged:** GitHub reports this branch merged. State what shipped in one line. Further edits go in a new PR.
  - 🔴 **Closed:** This branch closed unmerged. State why in one line.
  - ⚫ **Done:** Every workstream merged or closed.
  - 🔵 **Short answer:** The reply answers a question, and the next move is the reader's. Lead with the question in place of the name, then the answer: 🔵 **Did the merge land?** Yes.

  Use 🟢 for a closing state that needs only confirmation to proceed. A request for the reader's judgment of something shown is 👁️‍🗨️; a request for an act or a fact is 🛵.

  The following closing states have supporting resources. Make the whole lead its link, as `[✍️ **Sign-off needed:**](<url>)`:
  - 👁️‍🗨️ a look link, described under [Displaying content](#displaying-content), with one step for each page, draft or change shown;
  - ✍️ the session page, opened at the first user call the reply files, `…/pages/session.html#id=<short>&user-call=<slug>`;
  - ⚖️ the user call's page, `…/pages/user-call.html#src=…`, when the choice is filed as a user call.

* **Close in one order.** End with the caption, render line, then the state. Include a state when no files changed. Reply to a wake (a nudge, stop hook, finished job, PR event, or moved base) when it brings the reader a result they are waiting for, a problem the session cannot settle, or one of the events listed under [PR events](#pr-events), and end that reply on a state only when the state has changed. For any other wake, end the turn without text; where the harness requires visible output, write the line a hook supplies or, without one, one line that opens with the wake's name, such as `Stop hook:`.

* **Session detail caption.** Use the latest line the `session-detail-caption` hook supplied:
  `` `11/14 10:14am` 💬[22](…/pages/session.html#id=<short>) · 816𝗄 · 1𝖽 2𝗁 · [✍️1](…) · [🧭](…/app/?view=program&program=sessions) ``
  The opening stamp is when the hook printed the line, in the owner's time zone; `22` counts the owner's messages, `816𝗄` is the context in tokens, `✍️1` counts documentation edits awaiting the owner's sign-off and links the session page, `🧭` links the Sessions program page, and `<short>` is the session id's first eight characters. On a turn the owner did not start, the hook names what started it after the count, as `💬[22](…) · PR event`.

## A reply that changed files

* **Branch anchor.** The first reply that changes files begins with `Working branch: [branch-name](url)`. Code changes use GitHub flow on a branch with assistant prefixes (`claude/`, `codex/`, `gemini/`, `grok/`). Shared coordination state (task trackers, personal lists, session logs, crawl caches) uses Real-time mode directly on `main`. Include the assistant's commit trailer from [AGENTS.md](https://github.com/mehrlander/web-tools/blob/main/AGENTS.md#assistant-identity-and-attribution).

* **Reference is a link.** Use `[caption](url)` for anything the reader can open. Label touched source `[new]`, unchanged source `[main]`, and changes `[diff]`. Give a page, document, or data file a render link: 🥏 for a toss, 🔷 for the deployed page, 📦 for a Claude artifact. Cite a pull request as `[web-tools#997](…/pull/997) [🌿](…#gh=owner/repo&pr=997) [💬](…/pages/session.html#id=<short>) https://claude.ai/code/<session-id>`: the pull request, its branch, its session record, and its session, which the app shows by title. Omit a session link to the present session. The session id is in the head commit's `Claude-Session` trailer. Inside a sentence, omit 🌿 and 💬. Repeat a pull request as `` `#997` ``: any other `#997`, even in bold or as link text, becomes an unwanted `owner/repo#997` chip. Cite a house policy as `[h:show](…/app/?view=map&tab=policy&h=show)`, not as a slash command. Cite a user call as `[⚖️ <question>](…/pages/user-call.html#src=…)`. Reserve `file:line` for grep and debugging.

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

  List only threads still open on this branch, and omit an empty section. Record work left after the branch merges as a topic status (Topic status, below).

* **Topic status.** Correct a missing or wrong status of one of the session's [topics](https://github.com/mehrlander/web-tools-private/blob/main/sessions/topics/README.md) with [`topic_correct.py`](https://github.com/mehrlander/web-tools-private/blob/main/sessions/tools/topic_correct.py) from a web-tools-private checkout. First list the session's topics:

  ```bash
  python3 sessions/tools/topic_correct.py show <short>
  ```

  Then append the status of a topic that `show` printed; `status --help` lists the values each flag takes:

  ```bash
  python3 sessions/tools/topic_correct.py status <short> --by claude:<short> --topic "<name>" --status open --waits-on owner --waiting "<what it waits on>"
  ```

## Displaying content

* **A rendered view 🥏.** `toss-render.html` renders a page or other content from GitHub. Each browser needs a GitHub token for private repos. `npm run showing` prints the 🥏 links for the branch's changed files, and with `--path <file>` a link for any file. The printed line goes in the reply unchanged, refreshed after each commit, with a few words after it on what the link shows. `npm run showing -- --help` lists the options for a fragment (the rendered page's own address) and a query.

* **A look link 👁️‍🗨️.** A look link is a 🥏 link that also lands the reader on a place in the rendered page and says why. It replaces one or more 🥏 links. When a reply asks the reader to look at or tap an element of a page, make the link a look link: `--intro "<what changed>"` greets the reader, and `--at "<fragment>"` lands on the place to see, with the fragment from `python/look-link.py` (`show` or `tap` for one place, `walkthrough` or `steps` for several; the `look-markers` skill).

* **Content in the link.** A `#gz=` link carries its content gzipped and base64url-encoded in the address, so it needs no commit or token; a link's length caps the content. `toss-render.html#gz=` renders a page carried this way. The Web Tools app's `#gz=` carries text files; in web-tools, `npm run -s stage-link -- <file>` prints one that opens the file with a Copy button. For a result that keeps source data in the browser, `npm run -s reception-link -- <fn.js> --note "<what is wanted>"` in web-tools prints a link that runs `<fn.js>` on what the reader pastes.

* **A screenshot.** In web-tools, `npm run shot -- <page>` saves a headless screenshot of a page from the working tree, and `--measure` adds overflow checks at desktop and phone width. The `screenshot-review` skill checks a shot before it is sent, and a file card shows it inline.

* **A file card.** `SendUserFile` attaches a file to the chat as a file card, where images render inline and other types download to the device. The download can be useful for an uncommitted file or one opened in another application, such as a Word document or a workbook, but a rendered link is usually more convenient and preferred.

## PR events

* **Subscribe the workstream PR 📬.** Call the `subscribe_pr_activity` tool once, after opening a PR.

  `go:` states intent, not write authority. Schedule no check-in but the one the `check-in` hook asks for. A PR event is news only when it is a failing check on this session's work, a comment or review, a merge (🟣) or close (🔴) not yet reported, or a passing check the user said to wait for (then do the work that was waiting on it). The "status checklist" in the platform prompt refers to the PR on GitHub, not to the closing state.
