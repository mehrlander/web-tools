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

The session archive in [web-tools-private](https://github.com/mehrlander/web-tools-private) keeps a record of every Claude Code session that had it checked out. [`sessions/tools/search.py`](https://github.com/mehrlander/web-tools-private/blob/main/sessions/tools/search.py) searches those records by what was said, when, in which repository and in which file.

## Goal and output

One line per matching session, newest first, at most five unless the owner asks for more:

```
- <day> <claude.ai link> [💬](https://mehrlander.github.io/web-tools/pages/session.html#id=<short>) · <why it matched, in one clause>
```

The claude.ai link is the record's `agent_session`. The Claude app shows it by the session's current title. Where a record has no `agent_session`, the 💬 link stands alone. When nothing matches, say in one line what was searched: the filters and the terms.

## Process

1. **Reach the archive.** Work in a web-tools-private checkout, the one whose [`.web-tools.json`](https://github.com/mehrlander/web-tools-private/blob/main/.web-tools.json) declares `sessions`. Where none is in or beside the project root, attach and clone it as the [`sessions`](../sessions/SKILL.md) skill describes. Run `git pull --ff-only origin main` in it first, since records reach `main` continuously.
2. **Search.** Run `python3 sessions/tools/search.py` with the filters the request names; filters combine with AND. Each run reads the whole archive and takes about half a minute, whatever the filters. Start with the most distinctive phrase the request offers.
   - `--grep TEXT`: a literal, case-insensitive substring of the opening ask, a stored prompt or reply, or the closing message. Matches are unranked. A common word also matches sessions that use it only in passing.
   - `--since DAY`, `--until DAY` (YYYY-MM-DD), `--repo NAME`, `--file PATTERN` (a file the session opened), `--tool NAME`.
   - The default listing shows candidates without links. For the answer's fields, add `--json` and keep four of them: `| python3 -c 'import json,sys; [print(r["day"], r["short"], r.get("agent_session", "-"), " ".join(r["opening_ask"].split())[:100]) for r in json.load(sys.stdin)]'`. `--show <short>` prints one record in full; its `repos` field lists each repository the session worked in, with its branch.
   - `--name` matches titles from an export of the claude.ai sidebar, as of the date the listing's footer prints. Search a topic with `--grep`.
   - For a pull request, the session is named by the `Claude-Session` line in its head commit's message, read with the GitHub tools.
   - Where the archive has no match, try the `list_sessions` and `get_session` tools, if the session has them. They list cloud sessions by title. Some cloud sessions never reach the archive.
3. **Answer** in the shape above, the clause drawn from the opening ask or the prompt that matched.

## Key insights

- **Treat each request as new.** Search again rather than reuse an earlier answer in the conversation.
- **From a working session, summon the [`session-finder`](../agents/session-finder.md) agent** rather than follow this skill inline. The search output then stays out of that session's context.
