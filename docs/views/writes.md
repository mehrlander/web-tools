# Writes

## Writes: the estate's commit stream, read for who wrote it

`?view=writes`, the sixth pill under Activity. Branches, Sessions and Chats all
ask **who was working**, and every answer they can give is development. This
pane asks the question none of them can: how much of what lands in these repos
is development at all.

The classifier is [`lib/kits/write-kinds.js`](../lib/kits/write-kinds.js), seven
kinds over one split:

| | kinds | signal |
| --- | --- | --- |
| **development history** | session, merge, CI, authored | the author the platform sets, or a merge subject |
| **application state** | crawl, tap, device | a subject this estate writes on purpose |

**The accent marks the split and nothing else.** Seven colours would mean none
of them did, so kinds are told apart by icon and label and the primary colour
says one thing: the app or the phone using a repo as its store.

**`device` is the only kind that is a guess**, a heuristic over the subject
prefixes Log-Repo has been observed to write, and the pane marks it with a `?`.
Every other kind reads a signal a writer emits deliberately. `authored` is the
residual and claims nothing: session work pushed from a local CLI is authored by
the account and is indistinguishable from a person's own commit, so it is not
guessed at.

**It renders from the activity cache**, the same read the Branches pane already
pays for, so the default costs no request. That cache keeps the newest thirty
commits per repo, which is a month in a quiet repo and about three hours in the
registry, where the session recorder commits on every Stop. So the pane states
the window its rows actually cover, and one control reads a hundred commits per
repo when that window is too short, which it is wherever the app writes most.

## What the app's own commits say, and why

Every write the app makes is a real commit on a real branch, made with the
viewer's token, so it lands in `git log` beside development history and is
indistinguishable from it by author. **Three writers share the same GitHub
identity in the registry repo**: this app, the phone (through `Log-Repo` in
`mehrlander/shortcut-tools`, which is where `page report:`, `probe-unattended:`
and `manifest:` come from), and a pull-request merge. Only a Claude session
stands apart, authored as `Claude <noreply@anthropic.com>` and carrying its own
trailers. So the subject line is the only thing that says who wrote a commit,
and that makes its shape a contract rather than a courtesy.

**`via Web Tools` marks a write a person made by tapping in this app.** It is
on the twenty-one sites a person reaches: a jot, a to-do, a pin, a
`.web-tools.json` save, an estate join or set-aside, a proposal applied or
retired, a mailbox request fulfilled, a stage deposit.

**The crawl's writes carry no trailer**, and the absence is the signal. The four
cache refreshes (`state/configs.json`, `state/activity.json`,
`state/sessions.json`, `state/calls.json`) run on a tab-arrival kick as well as
on the Refresh button, so nobody deliberately made them. Their subjects already
name a derived file, which is all a reader needs.

That split was measured on 2026-09-08 and it is lopsided: of 584 stamped
commits in the registry repo, 563 were the crawl and about twenty were a
person. Claiming a person acted on all of them made the twenty unfindable,
which is the whole cost of a trailer that means nothing.

**A commit here is application state, not development history.** It has no
branch, no pull request and no review, and it is not a step toward a release; it
is the app using a repo as its store. Both halves are real GitHub commits, so
nothing separates them but this convention.
