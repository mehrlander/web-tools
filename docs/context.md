# Context: what enters a session

Everything a Claude Code session in this estate receives is listed in one registry and rendered in the app's Map view, Context tab.

## The two halves

- [`context-sources.csv`](context-sources.csv) holds the sources defined in public places: the portable plugin's package, skills and hooks, web-tools' own instruction and settings files, and the session's own channels.
- `environment/context-sources.csv` in web-tools-private holds the rest, with the same columns: the claude.ai account, the cloud environment and its setup script, user scope under `~/.claude`, and the private repos' instruction files. The Context tab reads it with a token. `environment/account.md` beside it holds copies of the account settings that live in no repo, each with the date it was taken.

## The circles

A row's `circle` says where the source is defined, outermost first:

| Circle | Where it is set | Who changes it |
| --- | --- | --- |
| `account` | claude.ai settings | the owner |
| `environment` | the environment panel, when the snapshot is built | the owner |
| `user` | `~/.claude` in the container, written by the setup script | the owner, through the script |
| `plugin` | web-tools `skills/`, pinned per session and refreshed to main | a pull request to web-tools |
| `repo` | each checked-out repo's own files | a pull request to that repo |
| `session` | the conversation and the harness | nobody in advance |

## Overlaps

[`context-topics.csv`](context-topics.csv) names the subjects that more than one source speaks to, such as the AskUserQuestion ban or the writing rules. A row joins a topic through its `topics` column; the topic carries one authored verdict:

- **layered**: several sources on purpose, each a backstop for another.
- **redundant**: the same thing stated in more than one place.
- **conflicting**: two sources disagree, and either may win.
- **transitional**: an old and a new source both run until a replacement lands.

## Measured

A row's `tally` key joins it to the session store's cache (`state/sessions.json` in web-tools-private): `startup:<path>` for an instruction file counted at session start, `skill:<name>` for an invoked skill. A tallied file that no row claims shows in the warning tone, so an unaccounted source is visible rather than silent.

## Adding a source

Add a row to whichever half matches where the source is defined, with its topics. [`tools/test/context-sources.test.mjs`](../tools/test/context-sources.test.mjs) fails when a plugin hook has no row, a web-tools path does not exist, or a topic is undeclared.
