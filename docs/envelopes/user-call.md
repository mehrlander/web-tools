# User calls: the envelope contract

A **user call** is one question a session puts to the owner, answered on its page in the Web Tools app. This contract states its format, `user-call/1`, one of the [content envelopes](README.md), for whoever writes or reads a call. The [`user-calls`](../../skills/user-calls/SKILL.md) skill says how to file, read and close one with [`user-call.py`](../../skills/user-calls/user-call.py), which checks each call against this format and names any limit a field breaks.

## The file

One JSON file per call, `<session>-<slug>.json`, in [web-tools-private](https://github.com/mehrlander/web-tools-private/tree/main/user-calls)'s `user-calls/` folder, where `<session>` is the session id's first eight characters. `add` stamps `schema` (`user-call/1`), `id` (`<session>-<slug>`), `status` (`open`), `created` and `updated`. `close` sets `status` to `closed` and adds `closed`, {at, answer, note}.

Every call carries `session`, `slug`, `kind`, `question` and `brief`, what is at stake in plain words, which the Waiting view shows. Any call may carry `pr` and `materials`.

## `decision`

`decision` asks the owner to take the session's recommendation (`Take`) or change it (`Adjust`).

    {"session": "a4e46375", "slug": "tracker-verdict", "kind": "decision",
     "question": "Close the task as ...?", "brief": "what is at stake",
     "recommend": "Close it",          # the answer itself; the case for it is why
     "why": "one clause",              # optional
     "pr": "owner/repo#n", "materials": [<link>...]}

## `pick`

`pick` asks the owner to choose from a board of found images or of a design sprint's concepts. The answer is the picks, so a pick call has no `recommend`. For images, `board` sets the searches [`pages/image-board.html`](../../pages/image-board.html) runs:

    "board": {"q": ["gem", "crystal"],   # the searches
              "src": "icons",            # optional: icons (Iconify) or commons (Wikimedia Commons)
              "sets": ["game-icons"],    # optional: Iconify set prefixes
              "color": "0891b2",         # optional: the tint
              "group": "medium"}         # optional: how far to fold near-alike icons, off, tight, medium or loose

For concepts, `board` holds only `ideas`, an idea board's JSON pinned to a commit, which [`pages/idea-board.html`](../../pages/idea-board.html) opens: `{"ideas": "owner/repo@<commit>:path.json"}`.

## Materials

A material is a link, {kind, ref, label?, note?, answer?, field?}, of one of these kinds: `pr` (owner/repo#n), `branch` (owner/repo@branch), `file` (owner/repo@ref:path), `card` (`<n>`, an exchange in the session), `url`, `view` (a Web Tools app query, such as `view=map&tab=context`) or `task` (`owner/repo[@ref]:<path>/tracker/tasks/<id>.md`, a tracker task the call decides). Give a linked task `awaiting: user-call <call id>`, so each names the other.

A material with `answer: "Take"` comes up when Take is picked, so make it what taking approves: the PR, the change, the case. One with `field` is linked from that line of the call's tree: a decision's id (`two-steps`), its inquiry (`two-steps.inquiry`) or its instrument (`two-steps.instrument`).

Where a call names a `pr`, its page shows the PR's live state and comments each answer on it, which wakes a session subscribed to that PR.

## `tree`, `glossary` and `views`

Each of these optional fields names a JSON file as `owner/repo@ref:path.json`.

`tree` is a decision tree, which the card draws in place of the question and brief; those two stay readable in a tab, so write them to stand alone. Draw one only for a decision that serves another decision, has a ruled-out alternative worth showing, or shares its goal with other calls. The goal is the root, and each decision sits under the decision it serves, `open` or `closed`; a closed one names what it ruled out in `not`. A decision may carry an `inquiry`, what it waits to know, and the inquiry an `instrument`, how we find out; a decision to build an instrument is a decision of its own. Set `call` to this call's id on the decision the call settles, and write that decision's text as the call's question. A decision whose `call` names a call is drawn open or closed by that call's status.

    {"goal": {"text": "..."},
     "decisions": [{"id": "two-steps", "call": "<call id>", "state": "open", "text": "Switch to two steps?",
                    "paths": [{"letter": "A", "name": "one call"}],
                    "inquiry": {"text": "...", "result": "B 0.26 · A 0.30", "instrument": {"text": "..."}},
                    "decisions": [{"id": "...", "state": "closed", "text": "...", "not": "..."}]}]}

`glossary` explains the terms the question, brief and tree use. Have a reader other than the call's author write it, and mark a term only where a reader has a question at that spot. Each entity's `asks` is that question ("Which topics?", not "What is a topic?"), and its `aside` answers it in one clause of about 60 characters, in words a stranger knows, giving the missing fact itself without restating the term or editorializing. `home` is `here` when the call settles the meaning, or `elsewhere` with a `link`. A glossary can serve several calls, so each aside must read true beside each of them. `kinds`, optional, copies from its `source` the `name` and `gloss` of each kind of step the tree draws (`goal`, `decide`, `know`, `tool`).

    {"entities": [{"id": "answer-key", "terms": ["the answer key", "the key"], "home": "elsewhere",
                   "asks": "What answer key?", "aside": "...", "link": "URL or owner/repo@ref:path"}],
     "kinds": {"source": "owner/repo@ref:path#anchor",
               "steps": [{"step": "tool", "name": "Instrument", "gloss": "how we tell"}]}}

`views` holds commentary that makes the question easier to answer, each look a tab: `questions` anyone would ask, answered short; a `radio` opener, the question as a host would introduce it; and a `dialog` between the `cast`'s two speakers. A line's `see` names the slide shown with it (an answer, a material's label, Notes or Adjust), and `asides` comment on a slide while it shows.

    {"cast": {"pip": {"name": "Pip"}, "pap": {"name": "Pap"}},
     "questions": [{"q": "...", "a": "...", "see": "<a material's label>"}],
     "radio": {"title": "...", "lines": ["[stage direction]", "..."]},
     "dialog": [{"who": "pip", "line": "...", "see": "Notes"}],
     "asides": [{"on": "Adjust", "who": "pap", "line": "..."}]}

## Shape fields

Any call may carry five optional fields, the filing session's judgment, so that a list of calls reads by shape:

- `name`: a handle that holds the noun at stake ("Nine Ghost PRs", not "Spring Cleaning"), unique among open calls and kept once filed.
- `size`: the work the recommended answer sets off, on the [tracker's scale](../TRACKER.md) (`XS` to `XL`, or `?`). A merge is `XS`.
- `confidence`: `firm` when the session would act on its recommendation unasked, or `lean` when another option has a real case, which `why` names.
- `reversible`: false for an answer that cannot cheaply be undone, such as deleting, publishing or sending.
- `depends_on`: what has to happen first, each a PR (met once merged), a call id (met once answered or closed) or a task path (met once done).

## `documentation`

`documentation` asks which of a session's edits to one markdown or CSV document to keep. Review prose inside code, such as a docstring, on its PR instead. The call carries the edits, so it is the whole proposal.

    {"session": "a4e46375", "slug": "text-tools-tighten", "kind": "documentation",
     "question": "Apply 4 edits to docs/text-tools.md?", "brief": "what the edits do",
     "file": "owner/repo@branch:path",         # the document on the branch that holds the edits
     "base": "main",                           # the ref the edits were made against
     "edits": [{"from": "...", "to": "...",    # from: text the file holds once
                "why": "one clause",           # optional
                "background": "...",           # optional, with proposal
                "proposal": "...",
                "notes": [{"kind": "correct", "text": "one clause"}]}],   # optional
     "recommend": "Apply all four", "why": "one clause",                 # optional
     "pr": "owner/repo#n", "materials": [<link>...], "review": {...}}

- For edits not yet made, leave out `base`: the page stages them on `file`, and the answer's patch puts the kept ones in.
- A document the main branch does not hold yet carries `"new": true` and no edits. Its page shows the file whole, and the answer approves it.
- A note's `kind` is `correct` (the text as it stands is wrong) or `clarify` (it is right but reads poorly), or is left off.
- `background` says how the edit came up and `proposal` what it changes, in complete sentences. They may mark a name in **bold** or a file in `code`, and carry no links.

## Review

A documentation call's `review` holds the [peeves critic](../../skills/agents/peeves-critic.md)'s runs on its document, in order, as {runs}; `user-call.py review` writes it. A run holds:

| Field | Holds |
| --- | --- |
| `verdict` | `pass` (no trip inside an edit), `fail`, or `unknown` (the report had no Trips section to read) |
| `edits` | The spans the critic was given, E1, E2 and so on, each {lines, edit}: its first and last line in the text the run read, and the number of the call's edit it covers, or null |
| `trips` | The critic's findings |
| `clear` | The peeve ids the critic checked and found untripped |
| `candidates` | Patterns the critic proposed adding to the peeves list |
| `preexisting` | {peeve, text}: trips in text the edits leave alone |
| `changes` | {from, to, answers}: each change made after the run and before the next, numbered c1, c2 and so on, with the numbers of the trips it answers |
| `reflow` | The count of paragraphs whose only change was in their line breaks, which `changes` leaves out |
| `note` | One line on what the session did about the run |
| `report` | The critic's text as it came back |
| `at` | When the run was recorded |

A trip is {peeve, edit, where, quote, clause, answer, why, misquoted}. The first five come from the critic's line, `P<id> · E<n> · <where> · "<quote>" · <clause>`, with `edit` 0 for `E-`, a trip outside every span, which needs no answer. `answer` is `changed`, or `kept` with `why`. `misquoted` is true when the quote is not in the text the run read.

## Answers

Each answer is one JSON line in `<id>.answers.jsonl` beside the call, {answer, then?, note, at, by, comment?}, appended by the owner's browser and never edited; the latest line wins. An `Adjust` answer's note says what to change, and its `then` is `go` (make the change and carry on) or `return` (draft it and file a new call before acting).

A pick answer adds `picks`, [{id, href}], each id naming its source and item (`iconify game-icons:crystal-shine`, `commons File:...`, `idea 2 Build it up`), and, for an idea board, `notes`, [{on, note}], one per card the owner wrote on.

A documentation answer adds:

- `decisions`, one per edit in the call's order, each {edit, decision, note?}, where the decision is confirmed, discarded, amended, open, applied, stale, ambiguous or overlap;
- `notes`, [{on, note}], the owner's notes on text no edit touches, `on` being that text's first words;
- `call`, `file` and `base`, as the page read them;
- `target` and `commit`, when the edits were committed from the page;
- otherwise `patch`, the confirmed edits as a diff, with `apply: "session"`. Apply it with `user-call.py patch <id> | git apply` in a checkout of the file's repo, where its commit hook runs.
