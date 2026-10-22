---
name: design-sprint
description: "Develop a page concept in three phases adapted from Google's Design Sprint Kit: establish the substance, explore competing ways to communicate it and select one, then refine and build. Use when a page or artifact is requested with the intention and topic known but the form left open, or when the user asks for a design sprint or concept options. Not for a page whose form is already specified."
---

# Design Sprint

Adapted from [Google Design Sprint Kit](https://designsprintkit.withgoogle.com/) for developing page concepts. html-style governs appearance; this skill covers how the concept is reached.

Start from an intention and topic. Each phase ends in a named output, shown in the reply under its own heading, so it can be inspected, corrected and carried forward.

| Phase | Output | Then |
|---|---|---|
| 1. Define | Brief | Stop for agreement |
| 2. Explore and select | Idea board | Continue, unless the build is costly to redo |
| 3. Refine and build | Concept sketch, then the page | Check, then hand over |

## 1. Define

**Output: Brief.** Intended result, subject map, analogies, boundaries, uncertainties. One or two lines per item; the brief is read on a phone.

- **Intended result.** One or two sentences readers should be able to say afterward, or a judgment they should be able to make. Ask "why?" of the request until it names the reader's gain, and "how?" until it is specific enough to explore.
- **Subject map.** Essential facts and distinctions; entities, relationships and dependencies; where the reader starts.
- **Analogies.** Two or three fields that solve a comparable problem, and what each could lend.
- **Boundaries.** Scope and exclusions.
- **Uncertainties.** What the material leaves open or the request does not settle.

Keep copy and presentation open. Map relationships within the material before deciding how readers should encounter them.

Stop for agreement or correction, unless the user requested the full run.

## 2. Explore and select

**Output: Idea board.** Eight alternatives, the selected concept, the rationale, and the assumptions it rests on.

Generate eight one-line alternatives before evaluating. Each names what readers encounter or do, what this helps them understand, and its principal difference: explanatory mechanism, information structure, metaphor or borrowed form. Cosmetic variations do not count.

Select against the intended result; combine compatible elements where useful. Keep two competing concepts only when a specific open question warrants testing both. State the assumptions the selection rests on as questions.

Write the idea board as JSON in the shape of [`pages/demos/idea-board.json`](https://github.com/mehrlander/web-tools/blob/main/pages/demos/idea-board.json), with a sketch for each alternative, and commit it beside the work it serves. Hand it over as `https://mehrlander.github.io/web-tools/pages/idea-board.html#gh=<owner>/<repo>@<sha>:<path>`, with the selection in one line. Addresses, fields and sketch rules are in [`docs/idea-board.md`](https://github.com/mehrlander/web-tools/blob/main/docs/idea-board.md). The reader's picks and notes return as pasted text.

Phases 2 and 3 run in one reply, so the idea board explains the choice rather than gating it. Pause after phase 2 instead when a wrong pick would be costly to rebuild, or when the user asks.

## 3. Refine and build

**Output: Concept sketch, then the page.** The sketch shows information structure, central mechanism and one representative example or interaction. For a concept-only request, stop at the sketch.

Resolve structure, sequence, wording, visuals and behavior together. Make the central mechanism concrete with real content. When the concept needs material that does not exist yet, such as a run of another skill or a measurement, produce it here and label it as produced for the page.

Walk through the result as the intended reader: where would they stall, what connections would they miss, and could they state the intended result afterward? Fix gaps. Keep untested assumptions explicit. Return to an earlier phase when development exposes a problem in it.

Open the hand-over with any departure from the agreed brief, such as a different subject or scope, before the work itself.

## Working with the user

Enter at the phase needed, citing earlier outputs rather than restating them, and fold reactions into the outputs. Bring concrete proposals with a recommendation, and carry decisions and unresolved questions forward. When asked for a scaffold, deliver a complete scaffold rather than a partial page.
