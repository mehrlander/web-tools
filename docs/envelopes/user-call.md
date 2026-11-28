# User calls: the envelope contract

A **user call** is one question a session puts to the owner, answered on its page in the Web Tools app. This contract states its format, `user-call/1`, one of the [content envelopes](README.md), for whoever writes or reads a call. The [`user-calls`](../../skills/user-calls/SKILL.md) skill says how to file, read and close one with [`user-call.py`](../../skills/user-calls/user-call.py). That script checks each call against this format and names any limit a field breaks.

## The file

Each call is one JSON file in [web-tools-private](https://github.com/mehrlander/web-tools-private/tree/main/user-calls)'s `user-calls/` folder, named `<session>-<slug>.json`. `<session>` is the session id's first eight characters, and `<slug>` is a short lowercase name for the call.

`user-call.py add` stamps `schema` (`user-call/1`), `id` (`<session>-<slug>`), `status` (`open`), `created` and `updated`. `user-call.py close` sets `status` to `closed` and adds `closed`, {at, answer, note}.

Every call has `session`, `slug`, `kind`, `question` and `brief`. The brief says what is at stake in plain words; the Web Tools app's [Waiting view](https://mehrlander.github.io/web-tools/app/?view=waiting) lists open calls by it.

Any call may also have `pr` and `materials`. A decision has a `recommend`, the answer the session recommends. It may give `why`, the case for that answer in one clause.

## `decision`

The owner takes the session's recommendation (`Take`) or changes it (`Adjust`).

    {"session": "a4e46375", "slug": "tracker-verdict", "kind": "decision",
     "question": "Close the task as ...?", "brief": "what is at stake",
     "recommend": "Close it", "why": "one clause",
     "pr": "owner/repo#n", "materials": [<link>...]}

## `pick`

The owner chooses from a board of found images or of the concepts a [design sprint](../../skills/design-sprint/SKILL.md) drew up. The answer is the picks. For images, `board` sets the searches [`pages/image-board.html`](../../pages/image-board.html) runs:

    "board": {"q": ["gem", "crystal"],   # the searches
              "src": "icons",            # optional: icons (Iconify) or commons (Wikimedia Commons)
              "sets": ["game-icons"],    # optional: Iconify set prefixes
              "color": "0891b2",         # optional: the tint
              "group": "medium"}         # optional: how far to fold near-alike icons, off, tight, medium or loose

For concepts, `board` holds only `ideas`: the address, at a commit, of the idea board JSON the design sprint wrote. [`pages/idea-board.html`](../../pages/idea-board.html) opens it.

    "board": {"ideas": "owner/repo@<commit>:path.json"}

## Materials

A material is a link, {kind, ref, label?, note?, answer?, field?}. Its `kind` and the form of its `ref` are one of:

- `pr`: owner/repo#n.
- `branch`: owner/repo@branch.
- `file`: owner/repo@ref:path.
- `card`: `<n>`, the number of an exchange (a prompt and its reply) in the session.
- `url`: a web address.
- `view`: a Web Tools app query, such as `view=map&tab=context`.
- `task`: `owner/repo[@ref]:<path>/tracker/tasks/<id>.md`, a tracker task the call decides. Write `awaiting: user-call <call id>` into that task.

A material with `answer: "Take"` comes up when Take is picked. Point that material at what taking approves, such as the PR or the change. One with `field` is linked from that line of the call's tree: a decision's id (`two-steps`), its inquiry (`two-steps.inquiry`) or its instrument (`two-steps.instrument`).

Where a call names a `pr`, its page shows the PR's live state. Each answer is also posted as a comment on the PR. A session subscribed to that PR receives the comment as a new event.

## `tree`, `glossary` and `views`

Each of these optional fields names a JSON file as `owner/repo@ref:path.json`.

`tree` is a decision tree. The call's page draws it in place of the question and brief. Those two stay readable in a tab beside it. Write them to name the decision and what is at stake without the tree. Draw a tree only for a decision that serves another decision, has a ruled-out alternative worth showing, or shares its goal with other calls.

The goal is the root. Each decision in the tree sits under the decision it serves, with `state` `open` or `closed`. A closed decision names what it ruled out in `not`. A decision may have an `inquiry`, the question the decision depends on. An inquiry may have an `instrument`, how we find out. A decision to build an instrument is a decision of its own.

Set `call` to this call's id on the decision the call settles. Write that decision's text as the call's question. A decision whose `call` names a call is drawn open or closed by that call's status.

    {"goal": {"text": "..."},
     "decisions": [{"id": "two-steps", "call": "<call id>", "state": "open", "text": "Switch to two steps?",
                    "paths": [{"letter": "A", "name": "one call"}],
                    "inquiry": {"text": "...", "result": "B 0.26 · A 0.30", "instrument": {"text": "..."}},
                    "decisions": [{"id": "...", "state": "closed", "text": "...", "not": "..."}]}]}

`glossary` explains the terms the question, brief and tree use. Have a reader other than the call's author write it. Each entity has:

- `asks`: the question a reader has at the term, such as "Which topics?".
- `aside`: the missing fact that answers `asks`, in one clause of about 60 characters. It must read true beside every call that names the glossary.
- `home`: `here` when the call settles the meaning, or `elsewhere` with a `link`.

`kinds`, optional, copies from its `source` the `name` and `gloss` of each kind of step the tree draws (`goal`, `decide`, `know`, `tool`).

    {"entities": [{"id": "answer-key", "terms": ["the answer key", "the key"], "home": "elsewhere",
                   "asks": "What answer key?", "aside": "...", "link": "URL or owner/repo@ref:path"}],
     "kinds": {"source": "owner/repo@ref:path#anchor",
               "steps": [{"step": "tool", "name": "Instrument", "gloss": "how we tell"}]}}

`views` holds commentary that makes the question easier to answer, each kind in a tab of its own:

- `questions`: what anyone would ask, answered short.
- `radio`: an opener, the question as a host would introduce it.
- `dialog`: a talk between the `cast`'s two speakers.

Along its bottom, the call's page shows one slide at a time: one for each answer and each material, and one for Notes. In the session page's deck, a call the owner has begun to answer also has an Adjust slide. A line's `see` names the slide to bring up with that line: an answer, a material's label, Notes or Adjust. `asides` comment on a slide while it shows.

    {"cast": {"pip": {"name": "Pip"}, "pap": {"name": "Pap"}},
     "questions": [{"q": "...", "a": "...", "see": "<a material's label>"}],
     "radio": {"title": "...", "lines": ["[stage direction]", "..."]},
     "dialog": [{"who": "pip", "line": "...", "see": "Notes"}],
     "asides": [{"on": "Adjust", "who": "pap", "line": "..."}]}

## Summary fields

Five optional fields, each the filing session's judgment, let a list of calls be read before one is opened:

- `name`: a short handle naming the thing at stake, such as "Nine Ghost PRs". It is unique among open calls and kept once filed.
- `size`: the work the recommended answer sets off, on the [tracker's scale](../TRACKER.md) (`XS` to `XL`, or `?`). A merge is `XS`.
- `confidence`: `firm` when the session would act on its recommendation unasked. Use `lean` when another option has a real case. Name that case in `why`.
- `reversible`: false for an answer that cannot cheaply be undone, such as deleting, publishing or sending.
- `depends_on`: what has to happen first, each a PR (met once merged), a call id (met once answered or closed) or a task path (met once done).

## `documentation`

The owner chooses which of a session's edits to one markdown or CSV document, or to entries of a list (`lists/*.json`), to keep. Review prose inside code, such as a docstring, on its PR instead.

    {"session": "a4e46375", "slug": "text-tools-tighten", "kind": "documentation",
     "question": "Apply 4 edits to docs/text-tools.md?", "brief": "what the edits do",
     "file": "owner/repo@branch:path",         # the document on the branch that holds the edits
     "base": "main",                           # the ref the edits were made against
     "edits": [{"from": "...", "to": "...",    # from: text the file holds once; for a list entry, {text, note?}
                "why": "one clause",           # optional
                "background": "...",           # optional, with proposal
                "proposal": "...",
                "notes": [{"kind": "correct", "text": "one clause"}]}],   # optional
     "recommend": "Apply all four", "why": "one clause",
     "pr": "owner/repo#n", "materials": [<link>...], "review": {...}}

A list call's `file` is `owner/repo@ref:lists/x.json`, with `#<id>` for one entry; each edit names its entry in `item`, with `from` and `to` as `{text, note?}`. `user-call.py add` checks that each entry is in the list at `base`. In its `review`, each span is `{item, edit}`, the entry's id in place of `lines`.

- For edits not yet made, leave out `base`: the page shows them as proposed changes to `file`. The answer's patch then puts the kept ones in.
- A document the main branch does not hold yet has `"new": true` and no edits. Its page shows the file whole. The answer approves it.
- A note's `kind` is `correct` (the text as it stands is wrong) or `clarify` (it is right but reads poorly), or is left off.
- `background` says how the edit came up and `proposal` what it changes, in complete sentences. They may mark a name in **bold** or a file in `code`.

## Review

A documentation call's `review` holds the [peeves critic](../../skills/agents/peeves-critic.md)'s runs on its document, in order, as {runs}. Each finding of the critic is a trip, one place where the document matches a peeve on its list. A run holds:

| Field | Holds |
| --- | --- |
| `verdict` | `pass` (no trip inside an edit), `fail`, or `unknown` (the report had no Trips section to read) |
| `edits` | The spans the critic was given (E1, E2, ...), each {lines, edit}. `lines` is the span's first and last line in the text the run read. `edit` is the number of the call's edit it covers, or null |
| `trips` | The critic's findings |
| `clear` | The peeve ids the critic checked and found untripped |
| `candidates` | Patterns the critic proposed adding to the peeves list |
| `preexisting` | {peeve, text}: trips in text the edits leave alone |
| `changes` | {from, to, answers}: the changes made after the run and before the next, numbered c1, c2 and so on. A change's `answers` lists the trips it answers |
| `reflow` | The count of paragraphs whose only change was in their line breaks. `changes` leaves them out |
| `note` | One line on what the session did about the run |
| `report` | The critic's text as it came back |
| `at` | When the run was recorded |

A trip is {peeve, edit, where, quote, clause, answer, why, misquoted}. The first five come from the critic's line, `P<id> · E<n> · <where> · "<quote>" · <clause>`. `edit` is 0 for `E-`, a trip outside every span. `answer`, required for a trip inside a span, is `changed`, or `kept` with `why`. `misquoted` is true when the quote is not in the text the run read.

## Answers

Each answer is one JSON line, {answer, then?, note, at, by, comment?}, in `<id>.answers.jsonl` beside the call. The owner's browser appends each line; the latest line wins. An `Adjust` answer's note says what to change. Its `then` is `go` (make the change and carry on) or `return` (draft it and file a new call before acting).

On the call's own page, the owner may answer with a note from the FAB sidebar instead. The note is about the call's file, `owner/repo[@ref]:user-calls/<id>.json`, and may carry a `vote`, `up` or `down`, on the recommendation. The [notes](../../skills/notes/SKILL.md) skill states the record. `user-call.py answers` prints these notes after the answer lines.

A pick answer adds `picks`, [{id, href}], each id naming its source and item (`iconify game-icons:crystal-shine`, `commons File:...`, `idea 2 Build it up`). An idea board's answer also adds `notes`, [{on, note}], one per card the owner wrote on.

A documentation answer adds:

- `decisions`, one per edit in the call's order, each {edit, decision, note?}. The decision is the owner's `confirmed`, `amended`, `discarded` or `open`. For an edit the page could not show, it says why: `applied` (the text already reads as proposed), `stale` (neither side found), `ambiguous` (found more than once) or `overlap` (it crosses another edit);
- `notes`, [{on, note}], the owner's notes on text no edit touches, `on` being that text's first words;
- `call`, `file` and `base`, as the page read them;
- `target` and `commit`, when the edits were committed from the page;
- otherwise `patch`, the confirmed edits as a diff (for a list, a diff of its JSON with each kept entry's text and note replaced), with `apply: "session"`. Apply it with the [`user-calls`](../../skills/user-calls/SKILL.md) skill's `user-call.py patch` command, in a checkout of the file's repo.
