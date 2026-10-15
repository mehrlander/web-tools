# Inbound: how work reaches a session

| Channel | Who can send | Push or pull | Durable | Reachable by a non-Anthropic agent |
| --- | --- | --- | --- | --- |
| Chat prompt | the user | it *is* the session | no | no |
| **PR comment, subscribed** | anyone with repo write *except this session* | **push** | yes | **yes** |
| `send_message` between sessions | Claude sessions on the account | push | no | no |
| Routine, `send_later` | a schedule, or a session arming itself | push | the trigger is | no |
| errand, `errands/requests/` | a session; answered by a person in the browser or by the Gemini daemon | pull | yes | by token |
| `chron/dump/`, drained | the user | pull | yes | yes |
| A tracker task | anyone | pull | yes | yes |
| A commit on a branch, polled on a schedule | anyone with repo write | pull, on the poller's clock | yes | yes: a scheduled Codex check, while its machine and app run (2026-10-01) |

A subscribed PR comment is the only channel that is push, durable, and writable
by an agent outside the account. Every other durable channel waits until
something looks.

## PR comments

A session subscribes to its pull request once, when it opens it. The `portable`
plugin's `pr-subscribe-hint.sh` hook fires when `create_pull_request` returns and
prompts the session with the number; the hook cannot subscribe by itself, since
`subscribe_pr_activity` is a tool only the model can call. If a PR Steward
already watches the pull request, the call succeeds but no events arrive, and
the result text says so.

- **`go:`** at the start of a comment marks it as an instruction. Any other
  comment is context and starts nothing.
- **A comment states intent, not authority.** Anything written with a repo token
  arrives under the account owner's name, so a session cannot tell the owner
  from an agent using that token. A costly, destructive or outward-facing action
  still needs the person.
- **A session never receives its own comments**, so it cannot test a
  subscription alone; checking one takes a second party.
- **Subscriptions accumulate:** subscribing to a second pull request keeps the
  first.

## Measured

- A comment revives a session whose container was reclaimed: a new container
  booted and the conversation resumed with its context. Delivery took about
  3 minutes cold and 2 seconds warm (web-tools #464, 2026-08-20).
- Delivery works on private repositories (web-tools-private #35, 2026-08-21).
- On that pull request, a comment the session posted itself was never delivered
  over 2 h 35 m; one posted by someone else, under the same account, arrived in
  2 seconds.
- A comment on web-tools #464 arrived 40 minutes after the session subscribed to
  web-tools-private #35.

## Hook timing

The plugin refreshes at session start, but that session's hooks run from the
previous pin. A hook change applies from the next session, or after
`/reload-plugins`.
