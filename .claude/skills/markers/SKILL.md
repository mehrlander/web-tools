---
name: markers
description: >-
  Operate the status system: mark a claim Stale or Wrong; declare a path frozen
  or a record in .paths.json; inventory every marker and declaration in a repo;
  and check that arrow targets and declared paths resolve. Use when the user
  asks whether something is frozen or pinned, says "is this frozen", "what is
  frozen here", "mark this stale", "this is out of date but keep it", "flag this
  as wrong", "freeze this page", "preserve this as written", "what should I not
  edit", "stale flags", "update markers", or invokes /markers. Also use before
  editing anything in a workspace that pins historical material, and when a
  session opens on a repo whose frozen areas it has not seen. Owns the
  Stale/Wrong vocabulary, the .paths.json frozen/record declaration, and
  status.py; the tasks skill owns tracker tasks and the default skill owns PR
  bodies and surfacing links.
---

# markers

A marker and a declaration, split by subject. Getting the split right is the
whole point, so lead with it.

| | Subject | Says | Covers |
|---|---|---|---|
| **Marker** | a claim, in prose | this passage has aged out of truth, or was never true | markdown only |
| **Declaration** | a file path | this whole path is pinned, or preserved as written | any file type |

**One question decides which you want: does the statement answer to a sentence
or to a file?** A marker answers to a sentence. A declaration answers to a file
or a folder. They are not two spellings of one thing, and since 2026-09-20 they
do not overlap either.

A marker cannot carry the declaration's job, and not by preference: a GFM alert
renders in markdown and nowhere else, so `.html`, `.js`, and `.csv` artifacts
can never hold one. That gap is exactly why frozen pages stay illegible until
something outside the prose declares them.

## The vocabulary

Two words a marker may open with, and both describe the text beside them
without changing it:

- **`Stale`**: no longer accurate, aged out of truth.
- **`Wrong`**: flatly incorrect, not merely aged. The claim **stays as written**,
  and a path has to be declared a record before a commit may add one (below).

Two declaration keys, and both describe a whole path:

- **`frozen`**: do not edit or rebuild this. A pinned exhibit, a payload no
  builder regenerates, a reconstruction kept as the measurement it is.
- **`record`**: preserved as written. It may gain a dated appendix; its existing
  text stays. This is the key for a document that a successor superseded.

**`Frozen` was a third until 2026-09-20, and it left because it was answering
the file question in the sentence form.** A census of all 21 in the
estate is the argument. Twelve said a whole file was preserved, which is
`record`. Six more sat in a live README and described a frozen *neighbour*,
so the banner asserted of its own file the opposite of what was true, and
nothing could catch it: the check only ever ran declaration to banner, never
back. Two were genuinely about a section, and both were the same file, whose
repair is a split rather than a marker. The last was a banner quoted inside
pasted evidence. So `Frozen` was carrying one real job, twice, in one file.

## Marking a claim

A marker defers: it leaves the text standing and sends the reader elsewhere for
the truth.

```markdown
**Stale 2026-07-20 → ../timeline.md:** the dates here predate the reschedule.
```

That is right in a dated record, where the text is the evidence and editing it
would destroy what the file is for. It is wrong everywhere else. A living
document is read for what it currently claims, so a false sentence left standing
under a banner goes on being read as the rule: fix the sentence. Do not add a
note saying you fixed it, which buries the current claim under its own history
and duplicates what git already holds.

Getting this backwards is logged twice in
[`docs/SNAGS.md`](https://github.com/mehrlander/web-tools/blob/main/docs/SNAGS.md)
as `marker-on-a-living-doc`; `.githooks/pre-commit` refuses the case a fact can
settle, a `Wrong` added to a path no declaration calls a record.

A section, as a GFM alert with the word in the bold lead-in (`> [!WARNING]` for
both):

```markdown
> [!WARNING]
> **Stale 2026-07-06 (tracker task 0032):** the counts below predate the
> migration; the live figures are in the arrow target.
```

For a **whole file** there is no banner form, because there is no marker for it:
write the `.paths.json` entry instead. A note at the top of the file explaining
what superseded it is welcome and is ordinary prose, not a marker.

Shape: `**Kind YYYY[-MM[-DD]] [(note)] [→ target]:**`. Kind, date, and target
hold fixed positions so the set is auditable rather than merely
greppable. The date is when you flagged it. The parenthetical is optional and
usually cites the task that made the call. The target is optional and may be a path, a markdown link, or prose
("two successors below"); only path-shaped targets are existence-checked.

A `status: stale 2026-07-06; note` line in frontmatter is the optional metadata
layer. It never says `frozen`: a whole-file claim belongs in `.paths.json`,
where a tool can read it. Six files in home carried a bare `status: frozen` with
no date, which the scanner requires, so they were invisible to every inventory
that ran over them.

**Annotate a record; correct a living document.** A dated file stays put as
evidence, so mark its claim and leave the text. A document read for what it
currently says gets the claim fixed and the marker records what it used to say.
The scope is the file's job, not its folder's name: a live README inside a dated
snapshot directory is a living document, which is exactly the reading that has
failed twice.

## Declaring a path

`.paths.json` may sit at a **repo root or any workspace root**. Entries are
relative to its own directory, and the nearest declaration wins. This is the
`.gitignore` cascade, and it is what lets one repo hold several workspaces with
different regimes without a root file that knows about all of them.

`frozen` and `record` are separate properties about the same kind of target, so
one file may carry both lists. `frozen` says do not edit this at all. `record`
says its existing text stays as written, which is what licenses a `Wrong`
marker; append to it freely.

```json
{
  "record": ["chron/"],
  "frozen": [
    "research/budget-dive/dashboard.html",
    { "path": "app/studies/", "since": "2026-07-05", "why": "task 0016: pinned exhibits",
      "except": ["*/tools/*"] },
    { "path": "data/records/", "since": "2026-07-09",
      "except": ["fiscal-note-persistence-drs.csv"] }
  ]
}
```

- A bare string is shorthand for `{ "path": ... }`.
- A trailing `/` makes an entry cover a directory.
- `except` patterns are `fnmatch`, matched against the path *below* the entry,
  and `*` crosses `/`. They are what keeps a guard off the live inputs that sit
  inside frozen folders, which is the failure mode any whole-directory scheme
  walks into.

**Keep entries workspace-relative.** A workspace that gets restructured keeps
its declaration intact; root-relative entries would need rewriting on every
move.

## Running it

`status.py` ships beside this file. From a skill invocation:

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/markers/status.py" inventory
python3 "${CLAUDE_PLUGIN_ROOT}/markers/status.py" check
python3 "${CLAUDE_PLUGIN_ROOT}/markers/status.py" is projects/budget-drs/app/spend/data.js
```

| Subcommand | What it does |
|---|---|
| `inventory` | every marker and declaration, as tables, plus findings |
| `declared` | just the declared paths, one per line, for piping |
| `check` | findings only; exit 1 if any |
| `is PATH` | whether that path is frozen or a record, and which file says so |
| `gate` | refuse a staged `Wrong` marker on a path no declaration calls a record |

`--root DIR` scopes it; the default is the git toplevel of the working
directory.

### Calling it from a plain shell

`CLAUDE_PLUGIN_ROOT` is only set inside a skill invocation, so a repo's own
build or verify script resolves the path itself. The install is discoverable in
three places, and this is the order to try:

```bash
plugin_script() {   # $1 = e.g. markers/status.py
  if [ -n "${CLAUDE_PLUGIN_ROOT:-}" ] && [ -f "$CLAUDE_PLUGIN_ROOT/$1" ]; then
    echo "$CLAUDE_PLUGIN_ROOT/$1"; return 0
  fi
  local reg="$HOME/.claude/plugins/installed_plugins.json" p
  p=$(python3 -c "import json,sys;d=json.load(open(sys.argv[1]));print(d['plugins']['portable@web-tools'][0]['installPath'])" "$reg" 2>/dev/null || true)
  if [ -n "$p" ] && [ -f "$p/$1" ]; then echo "$p/$1"; return 0; fi
  p="$HOME/.claude/plugins/marketplaces/web-tools/.claude/skills/$1"
  if [ -f "$p" ]; then echo "$p"; return 0; fi
  p=".web-tools-scripts/$(basename "$1")"          # no-plugin fetch fallback
  if [ -f "$p" ]; then echo "$p"; return 0; fi
  p="$(dirname "$PWD")/web-tools/.claude/skills/$1"  # attached working clone
  if [ -f "$p" ]; then echo "$p"; return 0; fi
  return 1
}
```

The second path comes from `installed_plugins.json`, which records the exact
`installPath` and its `gitCommitSha`. The third is the marketplace clone, a
plain checkout of `main` at a stable path. Plugins install from **user**
settings rather than project settings, so they are present in sessions where a
repo's own `.claude/settings.json` was never read and its hooks never
registered. That makes the plugin the more dependable of the two channels, and
it is why a check that matters belongs here rather than in a repo hook.

The last entry is ranked last on purpose. A working clone attached beside the
repo makes a cross-repo change testable before it merges, and keeping it below
the installed copies means a normal run never silently exercises unmerged code.

## What `check` reports

1. a marker that does not parse, so a malformed one is loud instead of silently skipped;
2. an arrow target that no longer exists;
3. a declared path that does not exist, is empty, or is an empty directory.

Every finding stays on one side of the split. **There was a fourth until
2026-09-20**, crossing from a declaration to a marker: a markdown file declared
frozen had to carry a `Frozen` banner, so a reader opening it could see so. It
went with `Frozen`, and the measurement is why it went quietly. Every `frozen`
entry in the estate is a directory or a non-markdown artifact, so the rule
reached zero paths and had never once fired. What tells a reader is a sentence
in the file or its README, which no check can verify and which was doing the
work all along.

## What to do when asked

- **"Is this frozen?"** → `is PATH`. Answer with the declaration and the why,
  not just yes or no.
- **"What is frozen here?"** → `inventory`, and report the declarations. Say
  plainly if the repo declares nothing.
- **"Mark this stale / wrong"** → write the marker at the claim, dated today,
  with the arrow at the living copy when there is one. If the whole file is the
  subject, this is the wrong instrument: declare it instead.
- **"Freeze this page" / "preserve this as written"** → add the `.paths.json`
  entry, `frozen` if nothing may touch it, `record` if it may gain an appendix.
  Name the task or the reason in `why`. Add a plain sentence at the top of the
  file saying what superseded it, which is prose and carries no marker grammar.
- **Before editing** in a repo that declares anything → run `is` on the target
  path. A frozen file is re-anchored deliberately through its builder, never
  hand-edited.

Fix a finding rather than loosening the pattern to hide it, unless the pattern
is what is wrong: this convention has twice dropped markers that people wrote
correctly by any reasonable reading, and both times the fix belonged in the
regex.
