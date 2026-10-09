# Outposts

An **outpost** is a place outside git that holds the estate's material and that
no commit can write. Material reaches an outpost by hand (a paste, an import, an
upload, a settings box) and changes there by hand, so the repository cannot know
its state; it can only observe it and compare. [`outposts.csv`](outposts.csv)
lists each one with its particulars, and the app's Map view renders them on the
Outposts tab.

## The four parts

Every outpost is held the same way:

- **Declared:** a committed file saying what the outpost should hold.
- **Observed:** the latest reading of what it does hold, and who supplies it.
- **Check:** code comparing the two. Each item gets a label naming what was
  compared and what was found, such as "differs" or "GitHub changed since",
  never "synced": an observation shows what the outpost held when it was read,
  not what it holds now.
- **Upkeep:** the cheapest step that brings the outpost back in line. It is
  usually a step only the owner can take, which is why the check names it.

## What keeps an outpost current

**Who supplies the observation decides whether the record keeps up.** Where the
outpost reports itself (the environment's receipt, the account's synced copy,
the phone's daily manifest), observations arrive with nobody acting. Where the
owner supplies them, they wait for someone to remember: on 2026-10-02 the
PowerShell ledger, home's `projects/wps/data/observations.csv`, held no rows
against eleven files awaiting adoption. When adding an outpost, look first for
a way to make it report itself.

**What the outpost holds decides how far it can drift.** The environment
settings hold one line that fetches the setup script from main, so the only
drift possible is a build older than main, and the upkeep is a rebuild. An outpost
holding copies can drift item by item. Where the far side can hold a pointer,
prefer that.

## The account

The claude.ai account's skills reach chat, Cowork and cloud sessions, and are
changed only in the app, under Customize. Claude Code downloads the whole
account to `~/.claude/skills/synced/` at session start, so every session has a
fresh observation without anyone acting.

- [`account-skills.csv`](account-skills.csv) declares each skill: `on` or `off`,
  and its `twin`, the folder under `skills/` its copy should match. For an
  upload the plugin's copy is authoritative and the upkeep is a re-upload; for
  one of Anthropic's skills the account's copy is authoritative and the upkeep
  is refreshing or dropping the copy the plugin vendors.
- [`skills/hooks/account-skills.py`](../skills/hooks/account-skills.py) runs at
  session start and prints one line only when something needs attention. Run
  by hand it lists every skill and its state; `--zip <dir>` builds an
  upload-ready zip for each upload that differs, and `--write <path>` writes the
  observation that web-tools-private keeps at `environment/account-skills.csv`.
- The comparison covers every file in a skill's folder and reports "differs"
  rather than "older" or "newer". Which copy is ahead is a claim about dates,
  and a sandbox clone's history is too shallow to support it.

## Upstreams: the reverse direction

An **upstream** is the mirror image of an outpost: a skill someone else wrote,
which the estate watches, studies, holds a copy of, or ships. It is held by the
same four parts run the other way. The declaration is the version pinned, by
upstream commit and folder fingerprint, in
[`upstream-skills.csv`](upstream-skills.csv); the observation is what the
author holds now; the check compares them; the upkeep is a re-pin, a refreshed
copy, or a decline.

Skills created or adapted here belong to the personal collection. Skills used
as supplied belong to the third-party collection. Adaptations keep a source
credit; they do not form a third collection. The Skills tab presents that
division. A **dependency** is fetched from its author by a separately attributed
entry in the [marketplace](MARKETPLACE.md), rather than copied into `skills/`.

- A **held** copy sits under `outside/<author>/<skill>/` with its author's
  license beside it. The plugin ships only `skills/`, so a held copy reaches no
  session and costs no context. A **vendored** copy ships in `skills/` exactly
  as pinned; an **adapted** one ships after changes of our own.
- [`python/upstream-skills.py`](../python/upstream-skills.py), or
  `npm run upstreams`, fetches each pinned folder by a shallow sparse clone and
  says whether it moved since the pin. `--offline` checks only that every held
  and vendored copy still matches its pin, which the suite runs.
- Discussion of an upstream goes in notes addressed to its file, for example
  `obra/superpowers:skills/writing-skills/SKILL.md`, through the notes skill.
- A pin names a commit only where our copy is that commit's folder exactly.
  Dependency rows record the official source revision tested for the marketplace
  entry; the entry owns what the installer fetches.
