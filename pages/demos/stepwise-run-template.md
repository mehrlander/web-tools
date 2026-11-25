# Staged writing run: the template

A run writes one text from the owner's words, in stages. After each reviewed stage, two reviewers read the stage's output and the writer revises before going on. The stepwise viewer shows every file.

Inputs, in the run folder: `request.md` (the owner's request, verbatim) and `decisions.md` (the owner's later decisions, verbatim quotes).

Rules for every stage: extreme succinctness; no filler; no em dashes.

## Stages

1. **Intent** (`intent-1.md`, reviewed, then `intent-2.md`). The writer's reading of the owner's words, in exactly this form:

   ```
   👤 **Asked**

   - <one idea>
   - <one idea>

   👤 **Wants**

   - <one idea>
   ```

   One idea per bullet, short. Settle what the request and decisions settle; list no open questions.

2. **Outline** (`outline-1.md`, reviewed, then `outline-2.md`). A `**Premise:**` line, one sentence, the core insight. Then at most four numbered points, one short line each. Plan only.

3. **Core** (`core-1.md`, reviewed, then `core-2.md`). The sentence, or two short ones, the text opens with: an instruction drawn from the premise.

4. **Growth** (`growth/01.md`, `02.md`, ..., `growth/notes.json`). Each step is the whole file. Step 01 is the title plus the core. Each later step adds or changes one thing: an outline point, a needed detail, or frontmatter. Stop when every outline point is covered; fewer steps is better. `notes.json` holds one short line per step: `NN: what it added and why`.

5. **Final** (the last growth step, reviewed, then `final.md`).

## Reviews

After stages 1, 2, 3 and 5, two independent subagents read the stage's file:

- **critic** (`portable:peeves-critic`): wording, against the owner's pet peeves.
- **proxy** (`portable:owner-proxy`): substance, whether the owner would accept it, given `request.md` and `decisions.md`.

Each returns only objections that would cost the owner something, one JSON object per line: `{"quoted": "<exact substring>", "peeve": "P<id>" (critic only), "payload": "<problem and fix>"}`. The comments are saved to `<stage>-critique.jsonl` with `"by"`. The writer answers each in `<stage>-answers.json`: `{"quoted", "answer": "changed" | "kept", "rationale"}`. The writer never writes a review.

## Changes to this template

An owner's change to this template starts a new run from the request. A change to the viewer does not.
