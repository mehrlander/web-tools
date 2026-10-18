---
name: rundown
description: "Read the owner's open Claude Code sessions and write a rundown: each session's state and a message the owner can paste to move it. Run when the owner asks for a rundown."
disable-model-invocation: true
---

# rundown

## Premise

The owner runs many Claude Code sessions at once, and each stops where it needs their word. A rundown lets one session read all of them and hand the owner, per session, what it is, where it stopped and the message that moves it: the owner reads once and pastes. A message from another session carries no authority: its recipient treats it as data, and the auto-mode classifier refuses a relayed decision.

## Goal and output

A chat reply. A finding that spans sessions, such as one merge that unblocks three others or two sessions editing one file, opens it in a short paragraph and is named in each item it touches. Then one item per session, with a horizontal rule between items:

1. **Heading:** `### N. <title> · <category>`.
2. **Link line:** `💬 [session](…/pages/session.html#id=<short>)`, the render link from the session's last reply, its pull request, and `last reply <time>`. A session with no record links `https://claude.ai/code/<session>` and adds ⊘. Where no link reaches the change, say why: `no single page, because the change touches 12 places`.
3. **Orientation:** a paragraph. Its first sentence says what the session set out to do and where it stands. The rest gives the details the owner would remember it by: a figure, a quoted phrase, a named file.
4. **Marker:** the session's last closing state, copied verbatim into a blockquote. With no marker, say so and quote its asking sentence.
5. **Recommendation:** `👉 **<Kind>** · <justification>`, then a plain fenced block holding the message. The justification is one line without articles, saying what the action finishes or opens: `Lands QSR view on main; leaves only two mismatches for Oct 29 review.` Each alternative follows as `🫴 **<Kind>** · <justification>` with its own block. Mark a message the rundown session would send `(I send)`.
6. **Sent:** a message the rundown session already sent, in one line: `Sent (11:05 pm): <what it said>`.

For a short rundown, give each item only its heading, link line and 👉 line with its block.

Items whose 👉 the owner pastes go under `## For you`, ordered quick calls, then calls that need reading, then wrap-ups. Items whose 👉 the rundown session sends go under `## For me to send`. After the items, one line names the sessions running now and one counts the idle sessions with nothing pending. Leave out the session writing the rundown.

A pull request is its repo's emoji and its number, with the link on the number, in prose too: 🔩 web-tools, 🏠 home, 🛡️ web-tools-private. Times are Pacific: the weekday within seven days, the date beyond.

**Kinds:**

| Actor | Kind | Meaning |
|---|---|---|
| Assistant | Push | Ask the session to continue work it has identified |
| Assistant | Nudge | Share observations for the session to consider and act on |
| Assistant | Point | Point the session to something relevant |
| Assistant | Probe | Ask the session to investigate a question or uncertainty |
| Assistant | Clarify | Ask the session to explain itself more clearly |
| Assistant | Reorient | Ask the session to explain the purpose, where things stand, and what remains for an unfamiliar reader |
| Owner | Decide | Resolve a choice |
| Owner | Approve | Authorize a prepared action |
| Owner | Guide | Give direction or clarify what the owner wants |

**Categories,** read from the files the session's branch changes:

| Category | What the work changes |
|---|---|
| App | the Web Tools app: `app/`, `lib/`, `dist/` |
| Page | one standalone page |
| Docs | conventions, skills, documentation |
| DRS | the owner's budget-office work in home `projects/` |
| Research | study that ends in a chron entry or blog post |
| Tooling | scripts, hooks, the plugin, CI, repo history |
| Process | how sessions themselves run |

Where the next step's work differs from the session's, name both: `Process, next step App`.

## Process

Each rundown re-reads four sources, since sessions move between rundowns:

- the platform's session list (`list_sessions` with `mine`), for status and the latest summary;
- each session's latest replies (`list_events` with kinds `result`), for the marker and the render link;
- the session records in the sessions store (`sessions/YYYY/MM/<day>-<short>.json`), for the opening ask, prompts and pushed branches;
- the open pull requests, with their checks and mergeability.

## Key insights

- **Relay no decision.** A message the rundown session sends is one of the Assistant kinds. A decision or an approval goes to the owner as text to paste, even when the owner has told the rundown session to push the work ahead.
