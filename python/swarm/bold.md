# Edit ladder, bold run: the roles

A bold run reads a passage before it shortens it. A reader finds where the
passage fails its own reader and repairs it; scouts each look through one lens
for a bold idea; builders turn the strongest ideas into concrete rewrites;
judges rate everything. `ladder.py context` hands each agent the common brief,
its role's section, and its lens or assignment.

## bold

The passage is shown by paragraph, `P1`, `P2`, and so on, with the Qualified
writing rules below it. Those rules are the standard: a shorter passage that
breaks them is worse, not better.

What is worth proposing, in order:

1. **A repair**: a term used before it is introduced, one thing called by
   several names, a missing connection between two statements. A repair may
   add words. It states only what the repository says; name the file.
2. **A structural cut**: material another document already owns (link it), a
   paragraph that repeats one elsewhere in the file, a sentence in the wrong
   place, two paragraphs that make one point.
3. **A premise cut**: a claim resting on a shaky premise, such as a warning
   about a case that does not happen or a reason no reader acts on. Say why the
   premise fails, and check it against the repository.
4. **A qualifier that replaces explanation**: a word or two that lets a clause
   go.

What is not worth proposing: trimming a word or two from a sentence that is
already clear, dropping an article or a connective, or any cut that leaves a
reader guessing what a term means. Clarity is never traded for a small gain.

Identifiers, file paths, commands, flags, numbers and the words `not`, `never`,
`no`, `only`, `except` and `unless` survive verbatim. The repository is at
`/home/user/web-tools`; read any file the passage names before relying on it.

## reader

Read the passage closely, following the passage-reading skill
(`skills/passage-reading/SKILL.md`, its contract `docs/envelopes/passage-reading.md`
and its example `skills/passage-reading/references/skill-prefs-description.json`).
Write the reading to `reading.json` in the run directory, with the source
file as context, and run its checker until it passes:
`python3 skills/passage-reading/scripts/check.py <run>/reading.json --root /home/user/web-tools`.

Then write JSON Lines to the output path. For each place the passage fails its
reader, a problem:
`{"problem":"unintroduced|names|connection|premise","blocks":["P8"],"quote":"exact words","note":"..."}`.
For each problem you can fix from what the repository says, a repair:
`{"repair":"qualify|connect|add","blocks":["P8"],"from":"exact words in that paragraph","text":"the repaired words","why":"what was wrong, and the file that supports the fix"}`.
A repair replaces `from` with `text` and may be longer. Keep each repair to
the fewest words that remove the guess.

## scout

Look at the passage through your lens only, and propose one to three ideas, as
JSON Lines to the output path:
`{"idea":"one or two sentences","kind":"cut|merge|reorder|delegate|qualify|connect|premise|restructure","blocks":["P4","P5"],"rewrite":"your draft of the new words, or empty","saves":12,"why":"..."}`.
`saves` is your estimate of words saved, negative when the idea adds words.
Be bold: an idea a careful editor would not dare is welcome, as long as it
keeps every rule a reader acts on. Say so when your lens finds nothing.

## lenses

- premise: Find a claim resting on a shaky premise, such as a warning about a case that does not happen or a reason no reader acts on, and propose removing it.
- owner: Find material another document already owns (read the files the passage links) and propose replacing it with a link and a clause.
- merge: Find two paragraphs or sentences that make one point, and merge them.
- reorder: Find an order of the material that lets a sentence or clause go.
- qualify-to-cut: Find a place where a qualifier of a word or two lets a clause of explanation go.
- connect: Find a missing connection between two paragraphs, and what adding it makes redundant.
- action: For each paragraph, ask what a reader does differently after reading it, and rewrite the paragraph to that action.
- half: Rewrite the whole passage at half its length, keeping every rule a reader acts on.
- third: Rewrite the whole passage at a third of its length, then say what that lost.
- list: Find a list or table hiding in the prose.
- rationale: Keep the rules and cut the reasons a reader does not need in order to act; name any reason that does change what a reader does.
- duplicate: Read the whole of the source file and find what this passage repeats from elsewhere in it.
- names: Find one thing called by several names, or one name used for several things, and unify them.
- misplaced: Find a sentence that belongs in another section or another document.
- opening: Rewrite the passage's opening so the rest can be shorter.
- headline: Reduce each paragraph to its first sentence, and say which paragraphs survive that and which need more.
- bold-cut: Name the one paragraph you would delete entirely, and argue for it.
- guard: Name the one sentence that must not be cut, and what a reader would do wrong without it.
- fusion: Find two ideas that can be fused into one phrase.
- newcomer: Read as someone new to this repository: where do you get lost, and what is the fewest-word fix?

## builder

Turn the scouts' strongest ideas into concrete rewrites of the passage as it
stands after the reader's repairs, shown below. Write JSON Lines to the output
path, one edit per line:
`{"blocks":["P4","P5"],"from":"exact words, or omit to replace the whole paragraphs","text":"the new words","why":"...","ideas":["merge.1","owner.2"]}`.
`blocks` lists consecutive paragraphs; with `from` omitted the edit replaces
all of them with `text`, which is how two paragraphs become one. `ideas` cites
the ideas the edit builds on. Prefer a few large, well-made edits to many
small ones, and keep every rule a reader acts on. Your assignment follows.

## builders

- architect-bold: Rewrite the whole passage as one edit, with the most structural ambition the rules allow.
- architect-clear: Rewrite the whole passage as one edit, as clear as the Qualified writing rules ask and as short as that allows.
- architect-balanced: Rewrite the whole passage as one edit, taking the boldest ideas that cost no clarity.
- editor-a: Write edits for P2 and P3, together or apart.
- editor-b: Write edits for P4 and P5, together or apart.
- editor-c: Write edits for P6 and P7, together or apart.
- editor-d: Write edits for P8 and the heading P1.

## judge

Rate every repair and every edit below, once each, as JSON Lines to the
output path:
`{"edit":"e7","risk":"green","confidence":90,"clarity":"ok","brilliancy":"","brutality":"","note":""}`.

- `risk`: `repair` for a repair that is right and needed; otherwise `green`
  (a reader loses nothing), `yellow` (a reader feels the pinch: a nuance, a
  reason or the flow is thinner) or `red` (full caveman, or a reader might act
  differently).
- `confidence`: 0 to 100, how sure you are that a reader of the result acts as
  a reader of the original would, and for a repair that it is true to the
  repository.
- `clarity`: `ok`, or `loses` when the edit trades clarity for a small gain by
  the Qualified writing rules; say how in `note`.
- `brilliancy`: one line, for an edit that fuses ideas or finds the phrase that
  carries what took a clause.
- `brutality`: one line, for a drastic cut that the passage, on reflection,
  does not need.

Award both honours where an edit earns them; the passage's best one or two of
each are expected. Before returning, run the check command and fix every line
it reports.
