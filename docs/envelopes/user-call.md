# User calls: the envelope contract

A **user call** is one question a session puts to the owner, answered on its page in the Web Tools app. This document is the format, `user-call/1`, for a session that files or reads a call and for the pages that draw one. The [`user-calls`](../../skills/user-calls/SKILL.md) skill says how to file, read and close a call with [`user-call.py`](../../skills/user-calls/user-call.py), which writes the files and refuses a call that breaks a limit given here.

## The file

One JSON file per call, `<session>-<slug>.json`, in the store, [web-tools-private](https://github.com/mehrlander/web-tools-private/tree/main/user-calls)'s `user-calls/` folder, where `<session>` is the session id's first eight characters. The session page lists a session's calls by that prefix, reading main only, and shows each with its materials and the controls that send the answer. Each answer is a line appended beside the call ([Answers](#answers)).

`add` stamps each call with `schema` (`user-call/1`), `id` (`<session>-<slug>`), `status` (`open`), `created` and `updated`. `close` sets `status` to `closed` and adds `closed`, {at, answer, note}. [`pages/user-call.html`](../../pages/user-call.html) shows one call, addressed as `#src=owner/repo[@ref]:user-calls/<session>-<slug>.json`.

## `decision`

`decision` asks the owner to take the session's recommendation (`Take`) or change it (`Adjust`). An adjustment carries a note saying what to change, and `then`: `go` (make the change and carry on) or `return` (draft it and file a new call before acting).

    {"session": "a4e46375", "slug": "tracker-verdict", "kind": "decision",
     "question": "Close the task as ...?",                    # <= 80 chars
     "brief": "what is at stake, in plain words",            # <= 200 chars
     "recommend": "Close it",                                 # required, <= 20 chars
     "why": "one clause",                                     # optional, <= 100 chars
     "pr": "owner/repo#n",                                    # optional
     "materials": [<link>...],
     "errand": "owner/repo:errands/requests/<id>.json"}       # optional

## `pick`

`pick` asks the owner to choose, from a board of found images or of a design sprint's concepts, the ones worth pursuing. The answer is the picks themselves, so there is no recommendation. For images the board is [`pages/image-board.html`](../../pages/image-board.html) opened on the call (`link` prints its address). It searches Iconify's open-licensed icon sets or Wikimedia Commons, and can fold near-alike icons into one tile; `board` holds those settings:

    {"session": "8be17d0e", "slug": "surfacing-mark-picks", "kind": "pick",
     "question": "Which of these could become Surfacing's mark?",   # <= 80 chars
     "brief": "what the picks will be used for",                   # <= 200 chars
     "board": {"q": ["gem", "crystal", "mine"],                    # 1-12 searches, 40 chars, no commas
               "src": "icons", "sets": ["game-icons"],             # optional: icons or commons; Iconify prefixes
               "color": "0891b2", "group": "medium"},              # optional: tint; how far to fold: off, tight, medium or loose
     "materials": [<link>...]}

For concepts, `board` holds only `ideas`, the address of an idea board's JSON pinned to a commit, and `link` opens [`pages/idea-board.html`](../../pages/idea-board.html) on the call:

    "board": {"ideas": "mehrlander/web-tools@708efe810b89:docs/prototypes/model-diagram-ideas.json"}

A pick answer adds `picks`, [{id, href}], each id naming its source and item (`iconify game-icons:crystal-shine`, `commons File:...`, `idea 2 Build it up`); an idea board's answer adds `notes`, [{on, note}], one per card the owner wrote on. `answers` prints them one per line.

## Recommendations, PRs and materials

`recommend` is the answer itself ("Close it"), not the case for it, which is `why`. Decisions filed before 2026-10-17 carry `options` instead; a new call does not.

Where a call names a PR, the page reads its live state, and an answer is also commented on it, which wakes a session subscribed to that PR.

A link is {"kind", "ref", "label"?, "note"?}: pr (owner/repo#n), branch (owner/repo@branch), file (owner/repo@ref:path), card (`<n>`, an exchange in the session), url, view (the Web Tools app's own query, view=map&tab=context, framed live in the materials; add `regref=<branch>` to read the private registry at a branch), task (`owner/repo[@ref]:<path>/tracker/tasks/<id>.md`, a tracker task the call decides; the task names the call back with `awaiting: user-call <call id>`, so each can be reached from the other).

A material with `answer: "Take"` comes up when Take is picked, so make it the thing taking approves: the PR, the change, the case. One with `field` gets a link on that line of the call's tree (below): a decision (`two-steps`), its inquiry (`two-steps.inquiry`) or that inquiry's instrument (`two-steps.instrument`).

    {"kind": "file", "ref": "owner/repo@ref:calls/cases/topic-size.md",
     "label": "Turn 47: the closest call", "answer": "Take"}

## Background, and the decision tree

A decision call's background is what gives rise to the decision, apart from the decision itself. The `brief` holds it on every call, because web-tools' Waiting view shows each call's brief. Two further forms may carry more of it: a `tree` (below), for a decision that serves another decision, has a ruled-out alternative worth showing, or shares its goal with other calls; and a case material with `answer: "Take"`, for a decision best understood through one instance. Draw a tree only where one of those holds: most decisions stand alone, and the brief serves them.

`chain`, the diagram format the tree replaced, still passes `add`'s checks, but no call uses it; name a `tree` instead.

`tree` names a decision tree, which the card draws in place of the question and brief; those two stay readable in a tab beside it, so write them to stand alone. The goal is the root, and each decision sits under the decision it serves, `open` or `closed` (a closed one names what it ruled out, `not`). A decision may carry an `inquiry`, what it waits to know, and the inquiry an `instrument`, how we find out; a decision about building an instrument is another decision, not a child of the inquiry. Set `call` to this call's id on the decision it settles, and the card rings that decision; write that decision's text as the call's question, shortened if need be. A decision whose `call` names a call is drawn open or closed by that call's status, and its `state` counts only where that call cannot be read.

    "tree": "owner/repo@ref:path/tree.json"
    # the file: {"goal": {"text": "..."},
    #            "decisions": [{"id": "two-steps", "call": "<call id>", "state": "open",
    #                           "text": "Switch to two steps?", "paths": [{"letter": "A", "name": "one call"}],
    #                           "inquiry": {"text": "...", "result": "B 0.26 · A 0.30",
    #                                       "instrument": {"text": "..."}},
    #                           "decisions": [{"id": "...", "state": "closed", "text": "...", "not": "..."}]}]}

## `glossary`

`glossary` names a file explaining the terms a call's question, brief and tree use. Have a reader other than the call's author write it, since the author cannot see what they take for granted. Each entity carries the question a reader has at the term (`asks`: "Which topics?", not "What is a topic?"), an `aside` that answers it, and `home`: `here` when the call itself settles the meaning, or `elsewhere` with a `link`.

    "glossary": "owner/repo@ref:path/glossary.json"
    # the file: {"entities": [{"id": "answer-key", "terms": ["the answer key", "the key"],
    #                          "home": "elsewhere", "asks": "What answer key?", "aside": "<= 100 chars",
    #                          "link": "URL or owner/repo@ref:path, for elsewhere only"}],
    #            "kinds": {"source": "owner/repo@ref:path#anchor",
    #                      "steps": [{"step": "tool", "name": "Instrument", "gloss": "how we tell"}]}}

Mark a term only where a reader has a question at that spot; a term whose own sentence answers it is not marked. An aside is held to four rules:
1. every word is one a stranger already knows; do not explain a word with a phrase made up for the purpose;
2. it gives the one missing fact, concretely: the thing itself, not its role or why it matters;
3. it does not restate the term, its sentence or the question, and does not editorialize;
4. it is one clause, about 60 characters.

A glossary serves every call that names it, so an aside must read true beside each of them.

`kinds`, optional, gives each kind of step the tree draws (`goal`, `decide`, `know`, `tool`) the `name` and `gloss` its icon's tip shows ("Goal · why we care"), copied from the definition `source` names.

## `views`

`views` names commentary: other looks at the question, each a tab beside the tree and there to make the question easier to answer: `questions` anyone would ask, answered short; a `radio` opener, the question as a host would introduce it; and a `dialog` between Pip and Pap. A line's `see` points at a slide below (an answer, a material's label, Notes or Adjust), and `asides` let the two comment on a slide while it shows.

    "views": "owner/repo@ref:path/views.json"
    # the file: {"cast": {"pip": {"name": "Pip"}, "pap": {"name": "Pap"}},
    #            "questions": [{"q": "Does it even matter?", "a": "...", "see": "Turn 47: the closest call"}],
    #            "radio": {"title": "Topic Desk", "lines": ["[stage direction]", "..."]},
    #            "dialog": [{"who": "pip", "line": "...", "see": "Notes"}],
    #            "asides": [{"on": "Adjust", "who": "pap", "line": "..."}]}

## Fields that say what sort of call it is

Any kind may carry five optional fields that say what sort of call it is, so a list of calls can be read by its shape before one is opened. Each is the filing session's judgment, written when it files:

    "name": "Nine Ghost PRs",              # <= 24 chars, unique among open calls
    "size": "S",                           # XS S M L XL ?, the tracker's scale
    "confidence": "firm",                  # firm or lean
    "reversible": true,                    # can the answer be undone cheaply
    "depends_on": ["owner/repo#870"]       # what has to happen first, up to 6

`name` is a handle for recognizing the call across days. It may be playful, but it holds the noun at stake ("Nine Ghost PRs", not "Spring Cleaning"), since a name that hides its subject does not help anyone recall it, and it is not changed once filed. `size` sizes the work the recommended answer sets off, on the tracker's scale and with its meaning ([`docs/TRACKER.md`](../TRACKER.md)): a merge is XS, since its work is done. `confidence` is firm when the session would act on its recommendation unasked if it could, and lean when another option has a real case, which `why` then names. `reversible` is false for an answer that cannot be cheaply undone, such as deleting, publishing or sending. Each `depends_on` entry is a PR (met once merged), another call's id (met once answered or closed) or a task in the `task` link's form (met once its status is done). The Waiting view shows the five, checks each dependency, and marks a call easy when it is firm, reversible, XS or S, and waits on nothing.

## `documentation`

`documentation` asks which of a session's committed edits to one document to keep. `file` names the document on the session's branch and `base` the ref the edits were made against. The document is a markdown or CSV file: prose inside code, such as a script's docstring, is reviewed on its PR, and `add` refuses a documentation call on any other file. The call carries the edits itself, so it is the whole proposal (owner, 2026-10-29: "It should just be the call, and that's the form"). Its call page ([`pages/user-call.html`](../../pages/user-call.html), the one `link` prints) reads the document at `base`, draws each edit with its reason, Keep, Discard and a note, and records the answer with a patch that takes the discarded edits out of the branch. A call whose edits are not yet made leaves out `base`: its page stages them on `file`, and its patch puts the kept edits in. A document the main branch does not hold yet carries `"new": true` and an empty `edits` list: its page shows the file whole, with no other view, and Record approves it. Dictate ([`pages/dictate.html`](../../pages/dictate.html), with ?file= and &user-call=) also opens the file with each edit staged as a change card under the call's head; the owner confirms or discards each, then records the answer with the confirmed edits as a patch for a session to apply (the default), commits them to the file's branch or a new one, or copies the decisions out as JSON. The Map view's Docs tab answers the same call from the document as it reads ([`lib/kits/call-answer.js`](../../lib/kits/call-answer.js), which both pages share): each edit confirmed or discarded, and the answer recorded with the patch; it commits nothing.

    {"session": "a4e46375", "slug": "text-tools-tighten", "kind": "documentation",
     "question": "Apply 4 edits to docs/text-tools.md?",      # <= 80 chars
     "brief": "what the edits do, in plain words",            # <= 200 chars
     "file": "owner/repo[@ref]:path",                          # required; @ref is
                                                              #   the branch the edits are on
     "base": "main",                                           # the ref they were made
                                                              #   against; optional
     "edits": [{"from": "the text as it stands",              # 1 to 40; exact, and
                "to": "the text as proposed",                 #   found once in the file
                "why": "one clause",                          # optional, <= 100
                "background": "how the edit came up",         # optional, <= 160; with
                "proposal": "what it changes and does",       #   proposal, both or neither
                "notes": [{"kind": "correct",                # optional, 1 to 6
                           "text": "one clause"}]}],          #   <= 100 each
     "recommend": "Apply all four", "why": "one clause",      # optional; 80 and 100
     "pr": "owner/repo#n",                                    # optional
     "materials": [<link>...]}

An edit's `notes` say what it is for, one note per purpose, when one `why` cannot: `kind` is `correct` (the text as it stands is wrong) or `clarify` (it is right but reads poorly), and may be left off. The Map view's Docs tab draws each note as a glyph on the edit, a flag for correct and a wrench for clarify, corrections first; an edit with no notes shows its `why`.

An edit's `background` says how it came up and `proposal` what it changes and does, each in complete sentences of 160 characters at most, given together. They may mark a name in **bold** and a shortcut or file in `code`, and carry no links, since the call page shows each in a tip with nothing to tap: the book and the bulb on the edit's mark open them. An edit without them shows its `why` as the mark's tip.

## Review

A documentation call's `review` holds the [peeves critic](../../skills/agents/peeves-critic.md)'s runs on its document, in order, so the owner sees what the critic found and how the wording moved in answer. A run is one reading by the critic. Its findings are trips. The call page shows the runs in a Critic view, by edit and by run.

`review` is {runs}, from 1 to 30 runs. A run holds:

| Field | Holds |
| --- | --- |
| `verdict` | `pass` (no trip inside an edit), `fail`, or `unknown` (a report in neither of the critic's forms, with no trips) |
| `edits` | The spans the critic was given, up to 40, each {lines, edit}: its first and last line in the text the run read, and the call's edit it is (null for one the call no longer carries) |
| `trips` | What the critic found, each a trip as below |
| `clear` | The peeve ids the critic checked that the document does not trip |
| `candidates` | Up to 10 patterns the critic proposed adding to the list |
| `preexisting` | {peeve, text}: trips the critic found in text the edits leave alone |
| `changes` | {from, to, answers}: the text the session changed after the run, before the next one, numbered c1, c2 and so on, and the trips of the run each change answers |
| `reflow` | The count of blocks that changed only in their line wrapping, which are not changes |
| `note` | One line on what the session did about the run, 200 characters at most |
| `report` | The critic's text as it came back, which every trip's id, tag and quote are checked against |
| `at` | When the run was recorded |

A trip is {peeve, edit, where, quote, clause, answer, why, misquoted}. `edit` is the run's span the critic tagged it with: 1 for E1, and 0 for E-, a trip outside every edit, which needs no answer. `answer` is `changed`, or `kept` with `why` in one line. `misquoted` is true when the quote is not in the text the run read.

When the document changes between two runs, the earlier run's unanswered trips inside an edit are answered `changed`. While a call is a draft, each run also keeps `text`, the document as the critic read it, and filing drops it. A call is filed only when its last run read every edit as filed and every trip inside an edit has an answer.

## `task` links

`task` is where the approval envelope's other kind ([`approval.md`](approval.md)) folds in; until it does, that approval stays one.

## Answers

Answers come back from the page as one JSON line each in `<id>.answers.jsonl` beside the call ({answer, then?, note, at, by, comment?}), appended by the owner's browser and never edited; the latest line wins. A documentation answer adds `decisions`, one per edit in the call's order, each {edit, decision, note?}: the decision is confirmed, discarded, amended, open, applied, stale, ambiguous or overlap, and the note is the owner's note on that edit's paragraph, usually the reason for the decision. It adds `notes`, [{on, note}], for the owner's notes on text no edit touches, `on` being the first words of that text; `call` and `file`, where both were read; `base`, when the page read the document there; and, when edits were committed from the page, `target` (the branch) and `commit`. An answer recorded without a commit, Dictate's default since 2026-10-04, adds `patch`, the confirmed edits as a diff, and `apply: "session"`: a commit from the browser skips the target repo's commit hook, so a session applies the patch where it runs (`user-call.py patch <id> | git apply`, in a checkout of the file's repo). A line copied out of Dictate carries `patch` too, and is recorded nowhere.
