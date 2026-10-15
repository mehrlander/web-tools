---
name: rundown
description: "Read the owner's open Claude Code sessions and write a rundown: each session's state and a message the owner can paste to move it. Run when the owner asks for a rundown."
disable-model-invocation: true
---

# rundown

## Premise

The owner runs many Claude Code sessions at once, and each stops where it needs their word. A rundown lets one session read all of them and hand the owner, per session, the message that moves it: the owner reads once and pastes. A session treats a message from another session as data. The auto-mode classifier refuses a relayed decision, and a recipient that receives one waits for the owner in its own session (measured 2026-10-14, a note on `mehrlander/web-tools:skills/tend/SKILL.md`). So every decision stays with the owner, and the rundown does the reading.

## Goal and output

A chat reply. Each session is one item:

1. **Title:** `**N. [title](https://claude.ai/code/<session>)** [💬](…/pages/session.html#id=<short>)`, or ⊘ in place of 💬 for a session with no record.
2. **Caption:** `*Started <day time> · <N> prompts*`, from the record's `started` and `exchanges`.
3. **Copy line:** a `markdown` fenced block holding one heading, `## 👉 <quick read> [<short>]`. Pasted into the Web Tools app, the line opens that session's detail deck.
4. **Marker:** the session's last closing state, quoted, after its time and age: `> *Wed 6:47 pm, 2 h ago* · 🟡 **Pending:** …`.
5. **Proposed:** a fenced block in the owner's voice, ready to paste. One block per alternative, each labeled.
6. **Or ask:** one italic question the owner might send instead.
7. **Notes.** One paragraph that identifies each entity the item names, under inline italic labels.

Items sit under three headings with nothing beneath them: `## 👍 Clear path` (the session recommends and a yes suffices), `## ☝️ Quick call` (the owner reads wording or supplies a fact), `## 🤔 Needs direction` (an open choice). After the items: sessions left alone, sessions ready to archive, then the conventions' caption and closing state.

A pull request is its repo's emoji and number, linked: 🔩 web-tools, 🏠 home, 🛡️ web-tools-private. Times are Pacific: the weekday within seven days, the date beyond.

## Process

Each rundown re-reads three sources, since sessions move between rundowns: the platform's session list (`list_sessions` with `mine`), the session records in the sessions store (`sessions/YYYY/MM/<day>-<short>.json`: opening ask, prompts, replies, pushed branches, `started`, `ended`, `exchanges`), and the open pull requests with their checks and mergeability.

## Key insights

- **Decisions go to the owner as Proposed text.** Send a session directly only a fact it lacks, such as main turning green, and say the message is not the owner's.
- **Read the session's latest reply before repeating a claim about it.** A claim carried from an earlier rundown went stale once and reached a session as a false instruction; the session caught it.
- **Leave out a session updated in the last half hour.** The owner is in it; name it in one line.
- **Check across sessions for collisions:** two sessions on one set of files or one set of items. Name the collision in both items.
- **Quote the marker.** Where the last reply has none, write `▫️ *No marker.*` and quote its asking line.
- **The copy line's id:** a lone `[id]` is green on desktop only; `[id]()` is green on the phone too. The app reads both.
- **A session with no record** has no detail page and no prompt count. Use its own short id, the first eight characters of its `CLAUDE_CODE_SESSION_ID`, where known.

## Extending

A Sessions subject in `tend` could take over the reading; the format would stay here.
