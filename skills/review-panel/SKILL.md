---
name: review-panel
description: "Convene a general review panel over a document, page, plan or change: five reader seats defined by how they search (conservator, radical editor, source historian, novice reader, counterexample hunter), each blind to the others, then a closer who verifies and weighs their findings and states the decision. Use when the user asks for a panel, a review from several angles, a second opinion that is more than one voice, or a cold read of something important before it ships. Not for domain review chains with their own seats (the DRS budget seats in home), for cutting a document shorter (reduction-panel), or for a screenshot (screenshot-review)."
---

# Review panel

One reviewer brings one way of looking. A panel brings several, and its value
comes from two rules: the seats search differently, and they cannot see each
other's work. Seats built on the same model are correlated, so agreement among
them is evidence rather than proof; the closer is the seat that has to say
which.

The seats are agent definitions the plugin ships, under `skills/agents/` in
web-tools:

| Seat | Agent | Searches for |
| --- | --- | --- |
| Conservator | `portable:conservator` | what a change would lose |
| Radical editor | `portable:radical-editor` | the largest simplification the subject survives |
| Source historian | `portable:source-historian` | provenance and precedent, in git and dated records |
| Novice reader | `portable:novice-reader` | where a reader new to the repo gets lost |
| Counterexample hunter | `portable:counterexample-hunter` | the case where a claim does not hold |
| Closer | `portable:closer` | which findings hold, and the decision they leave |

## Protocol

1. **Name the subject** in one sentence, with paths: the file, the page and its
   screenshots, the diff, or the plan. Say what kind of decision it serves
   (ship it, merge it, rewrite it).
2. **Pick the seats.** All five readers by default. Drop a seat only when its
   lane is empty for this subject (no history worth tracing, nothing proposed
   to lose), and say which you dropped.
3. **Run the readers in parallel**, one Agent call each, every one given the
   same subject statement and nothing else: not the other seats' output, not
   your own view, not the conversation. Blind is the point.
4. **Run the closer** with the subject statement and every reader's output,
   labelled by seat.
5. **Report** the closer's Convergent, Kept, Rejected and Decision sections,
   then each seat's raw output folded below. Verify any finding you repeat as
   your own against the cited place first.

Where the plugin's agents are not installed, spawn a general-purpose subagent
per seat told to read that seat's definition file (`skills/agents/<seat>.md`
in web-tools) and act as that agent. The file is the seat; the plugin is only
how it travels.

## Cost and fit

Six agent runs, one of them on the strongest model. Worth it for something
about to ship, merge or be relied on; not for a draft the author is still
moving. For a narrower question, summon one seat by name instead of the panel.
