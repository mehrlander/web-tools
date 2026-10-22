---
name: programs
description: "Manage a declared program, which organizes work and related resources around an ongoing concern such as surfacing. Reports what changed in its governed files, what its measures show, its open tasks and the snags on its files, then works a proposed change through its reviewers to the owner. Use when the owner invokes /portable:programs with a program's name, when the program-files hook names a program after an edit, or when asked how a program is doing or to manage one."
---

# programs

## Premise

An ongoing concern, such as how a reply reaches the reader, changes often, and
whichever session is at hand changes it. Nothing returns to ask whether a change
did what it was meant to. A program gives the concern a folder of its own
(`programs/<name>/`, whose README.md is the charter), a declaration (`programs`
in `.web-tools.json`), measures, reviewers and a slice of the tracker. The manager is the role a session
takes on here; the record stays with the program, whoever fills the role.

## Goal and output

A report, then work with the owner. The report and every proposal go to the owner
in chat. One note addressed to the charter closes each run.

## Process

1. **Report.** Run `python3 program.py report <name>` beside this file, from the
   declaring checkout or its parent. It prints commits to the governed files since
   the charter's latest note, each measure's summary and caveats, open tasks
   marked `project: <name>`, snags whose targets include a governed file, and the
   notes on the charter and the governed files. `list` names the declared programs.
2. **Read it against the charter.** Read the charter's Measures row for what
   working means. Say what moved, what the measure shows with its caveats, and
   which snags or tasks bear on it. Recommend a next step.
3. **Propose.** A change to a governed file goes first to the reviewers the
   declaration names (Agent tool), then to the owner: wording as a doc review
   (doc-craft skill), anything else with its evidence.
4. **Record.** Leave one note addressed to the charter
   (`owner/repo:programs/<name>/README.md`) with the notes skill: what the report
   showed and what was decided. The next run starts from it. Material longer than
   a note, such as a report, goes in the program's folder.

## Key insights

- **Report from the script's output, not from memory.** A count, a date or a
  commit in the report comes from `program.py` or from a file it names.
- **A measure is read with its caveats.** Show its table and say what it cannot
  show; the owner judges from the table.
- **Tasks go through the tasks skill,** marked `project: <name>`, and are
  proposed rather than filed unless the owner asked for them.
- **Governed files stay governed by their own rules.** Documentation wording
  still needs the owner's approval; the program adds reviewers, not authority.
- **A file belongs to one program.** A file two programs need is governed by one
  and named in the other's charter.
