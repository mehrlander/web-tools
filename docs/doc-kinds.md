# Doc kinds

Which kind of documentation a document is, and how much detail that kind holds.

How much a document says follows from what it is for, who reads it, and what
that reader already has open. The estate is several things at once. The
web-tools repository is an app, a workshop of tools built from a library of
kits, and a set of conventions the `portable` plugin carries into every
session; the other repositories add data, research and their histories. Each
has its own kind of documentation.

| Kind | It says | Reader | Where it lives | How much |
| --- | --- | --- | --- | --- |
| **Guidance** | how a session should act: a rule, a procedure, a decision not to act | an agent session | `CLAUDE.md`, a skill's `SKILL.md`, [CONVERSATION.md](CONVERSATION.md) | what a session would get wrong untold |
| **App description** | what a view shows and reads, and what each control does | the owner, in the app or on GitHub; a session changing the view | [APP.md](APP.md), a view's document such as [fab.md](fab.md), a narrative in [map-tabs.csv](map-tabs.csv) | what the reader sees and can do, and the file each view reads |
| **Specification** | what an artifact must be to work | a session writing code or data to it | [loader.md](loader.md), [TRACKER.md](TRACKER.md), [envelopes/](envelopes/) | everything conformance requires, and no implementation choice |
| **API reference** | each export's arguments, result and contract | a session calling it | a kit's header comment, a script's `--help` | every export, in full |
| **Finding** | what a system does, as measured on a date | a session about to rely on it | [environment/](environment/), the `measured` rows of [docs.csv](docs.csv) | the result, its date, and the method that repeats it |

By count, most of what the estate writes is guidance, nearly every skill
included, and app description. A record (a dated decision, plan or log) and an
account (research a repository declares) keep whatever detail their moment or
their argument needed. Nothing keeps them current, so the rules below do not
govern them.

## How much a document says

**The test is the reader's next step.** The
[doc-craft](../skills/doc-craft/SKILL.md) skill's test, whether a session would
succeed without a sentence, is written for guidance. For an app description,
ask whether the reader would misread the view or change the wrong file without
it; for a specification, whether an artifact could satisfy the text and still
fail; for a finding, whether a later session could repeat the measurement.

**Leave out what the subject says for itself:** a view's labels, counts and
empty states; the signatures a kit's header gives; the options a script's
`--help` lists.

**Detail thins with distance from its declaration.** A version is declared in
`package.json`, a key format or a function list in the code. A copy farther
away is less likely to change in the same commit, and nothing checks it against
the declaration. So the header beside the code holds values in full; a folder
`README.md` holds what spans its files (how they relate, the invariant they
share, the commands to run); `docs/` holds concepts and decisions; `CLAUDE.md`
holds pointers. A document that depends on a declared value names where the
value is declared, and gives the value itself only where the reader acts on it
as written, as with a command.

**Detail is paid for by reach.** Each word costs every session that reads it:
an injected document every session, a skill each session that invokes it, a
document in `docs/` the sessions that open it. The `reach` column of
[docs.csv](docs.csv) records which. The wider a document's reach, the stronger
the case each detail needs.

**One document may hold several kinds.** A folder README often joins an app
description, a procedure and a rule, and each passage is held to its own kind.
In the [WSL Sync README](../pages/wsl-sync/README.md), the refresh commands are
guidance given in full, since a reader runs them as written; the table of which
parser builds each store is API reference far from its declaration.

## Against Diátaxis

[Diátaxis](diataxis.md) is the standard framework. It sorts documentation by
the reader's need into tutorials, how-to guides, reference and explanation, for
a person learning or using a product. The estate's most frequent reader is an
agent session, which starts without memory of earlier sessions and reads to
act. So the estate writes no tutorials. Guidance is how-to guides with rules
added; app description, specification and API reference are all reference; a
finding sits nearest explanation, though it reports evidence rather than
weighing views. Diátaxis's central claim applies unchanged: a passage that
mixes two kinds serves neither reader well.
