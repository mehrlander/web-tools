---
name: find-session
description: >-
  Find earlier Claude Code sessions by topic, phrase, date, repository, file or
  pull request, and answer with a link to each. Use when the owner asks for a
  session ("the one where…", "which session did X", "link me to the session
  about Y"), and for every request in the finder session.
---

# find-session

## Premise

The session archive in web-tools-private keeps a record of every Claude Code session that had it checked out, and [`sessions/tools/search.py`](https://github.com/mehrlander/web-tools-private/blob/main/sessions/tools/search.py) searches those records. Finding a session is a lookup in those records.

## Goal and output

One line per matching session, newest first, at most five unless the owner asks for more:

```
- <day> <claude.ai link> [💬](https://mehrlander.github.io/web-tools/pages/session.html#id=<short>) · <why it matched, in one clause>
```

The claude.ai link is the record's `agent_session`. The Claude app shows it by the session's current title. Where a record has no `agent_session`, the 💬 link stands alone. When nothing matches, say in one line what was searched: the filters and the terms.

## Process

1. **Reach the archive.** Work in a web-tools-private checkout, the one whose `.web-tools.json` declares `sessions`. Where none is in or beside the project root, attach and clone it as the [`sessions`](../sessions/SKILL.md) skill describes. Run `git pull --ff-only origin main` in it first, since records reach `main` continuously.
2. **Search.** Run `python3 sessions/tools/search.py` with the filters the request names; filters combine with AND.
   - `--grep TEXT`: the opening ask, stored prompts and replies, and the closing message, case-insensitive. Search a topic or a phrase with it.
   - `--since DAY`, `--until DAY` (YYYY-MM-DD), `--repo NAME`, `--file PATTERN` (a file the session opened), `--tool NAME`.
   - `--json` prints the matched records, each with `short`, `day`, `opening_ask`, `agent_session` and `repos` (each repository's branch). `--show <short>` prints one record in full.
   - `--name` matches titles from a dated export, dated in the listing's footer; a topic search uses `--grep` instead.
   - For a pull request, the session is named by the `Claude-Session` line in its head commit's message, read with the GitHub tools.
   - Where the archive has no match and the session has the `list_sessions` and `get_session` tools, those list cloud sessions with their titles, including ones that never recorded.
3. **Answer** in the shape above.

## Key insights

- **Treat each request as new.** Search again rather than reuse an earlier answer in the conversation; records keep arriving.
- **From a working session, summon the [`session-finder`](../agents/session-finder.md) agent** rather than follow this skill inline. The search output then stays out of that session's context.

## The finder session

A long-lived cloud session whose only job is this skill. Create it once with the `create_session` tool:

- `title`: an emoji and the role, such as `🧭 Session finder`
- `source_url`: web-tools-private alone, which keeps the session's fixed context small
- `append_system_prompt`: `You are the session finder. Answer each request by following the portable find-session skill.`

The owner types `/clear` when the topic changes, and `/autocompact 200k` is the backstop for a clear the owner forgets.
