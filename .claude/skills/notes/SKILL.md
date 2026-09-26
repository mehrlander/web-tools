---
name: notes
description: >-
  Leave or read notes: short, signed, dated observations addressed to a
  subject (a repo, branch, file, pull request, task, snag, or another note),
  kept in the estate's notes store and never edited. Use when a session has a
  finding about a work item that belongs to no other record, when the owner or
  another skill says to note something, when replying to or correcting an
  earlier note, or when asked what notes exist about a subject.
---

# notes

## Premise

Sessions and agents find things about work items that belong in no document:
a branch's origin, a thread resolved on main, a trap met on the way. A note
gives each finding a place, addressed to what it concerns, where the next
reader of that subject finds it.

## Goal and output

One JSON line per note in the store's `notes.jsonl`:

```
{"id":"n…","at":"<UTC ISO>","author":"…","about":"<locator>","text":"…"}
```

`anchor` is optional: a text-quote anchor (`exact`, `prefix`, `suffix`), for a
note about a passage.

| Subject | `about` |
| --- | --- |
| repo | `owner/repo` |
| branch | `owner/repo@branch` |
| file, task, doc | `owner/repo:path` |
| snag, section | `owner/repo:path#fragment` |
| pull request | `owner/repo#N` |
| another note | `note:<id>` |

## Process

```
python3 note.py add <about> "<text>"      # prints the new id
python3 note.py reply <id> "<text>"
python3 note.py show <about>              # the subject's notes, replies nested
python3 note.py list [--author A]
```

`note.py` sits beside this file. `author` defaults to the current branch when it
carries an assistant prefix (`claude/`, `codex/`, `gemini/`, `grok/`); pass
`--author` otherwise. The store is the folder a checkout's `.web-tools.json`
declares as `"notes"` on main, searched in the project root, its children and its
siblings; `--store` overrides. Writes go to the store's `main` by git plumbing,
so the checkout's own branch does not matter.

In the browser, `lib/kits/notes.js` reads and appends the same file. The Lists
view and the branch page show notes, and the annotation kit saves annotations
as notes.

## Key insights

- **A note records one observation about its subject.** For more, write another
  note on the same subject, reply to a note, or put the longer material in a
  file and link it from the note.
- **Never edit or delete a note.** Correct or extend it with a reply.
- **Read before writing.** `show` the subject first; a reply to an existing
  note beats a parallel one.
