---
name: find-session
description: >-
  Find earlier Claude Code sessions by topic, phrase, date, repository, file or
  pull request, and answer with a link to each. Use when the owner asks for a
  session ("the one where…", "which session did X", "link me to the session
  about Y").
---

# find-session

## Premise

The session archive in [web-tools-private](https://github.com/mehrlander/web-tools-private) keeps a record of every Claude Code session that had it checked out. [`sessions/tools/search.py`](https://github.com/mehrlander/web-tools-private/blob/main/sessions/tools/search.py) searches those records.

## Goal and output

One line per matching session, newest first, at most five unless the owner asks for more:

```
- <day> <claude.ai link> [💬](https://mehrlander.github.io/web-tools/pages/session.html#id=<short>) · <why it matched, in one clause>
```

The claude.ai link is the record's `agent_session`; where a record has none, the 💬 link stands alone. `<short>` is the record's `short`. When nothing matches, say in one line which filters and terms were searched.

## Process

1. **Reach the archive.** Work in a web-tools-private checkout. Where none is in or beside the project root, attach and clone one as the [`sessions`](../sessions/SKILL.md) skill describes. Run `git pull --ff-only origin main` in it first.
2. **Search** with `python3 sessions/tools/search.py`, starting from the most distinctive phrase the request offers. Its `--help` lists the filters, which combine with AND. `--grep` matches a literal substring of the session's prompts and replies, unranked. `--json` gives each record's fields, and `--show <short>` one record in full.
   - For a pull request, the session is named by the `Claude-Session` line in its head commit's message.
   - Where the archive has no match, try the `list_sessions` tool, if the session has it.
3. **Answer** in the shape above, the clause drawn from the prompt that matched.

## Key insights

- **From a working session, summon the [`session-finder`](../agents/session-finder.md) agent** rather than follow this skill inline. The search output then stays out of that session's context.
