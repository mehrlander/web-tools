---
name: writing-sprint
description: "Develop a piece of writing from a starting text in three phases: a brief, variants that each borrow a craft move from a passage that shows it, then one selected and refined text. The starting text can be a draft, a prompt, a note or someone else's passage. Use when asked for a writing sprint or a punch-up, to make a text stronger, to try a text in several manners, or to move a text away from an assistant's habits. Not for a page's form (design-sprint), or for shortening a text whose content is fixed (caveman, succinct-text)."
---

# Writing Sprint

The phases parallel [`design-sprint`](../design-sprint/SKILL.md)'s.

## Premise

Writers who have solved a problem on the page leave techniques another writer can borrow: a number given before the abstraction it stands for, one fact to a sentence, a plain test that settles a claim. A writing sprint applies such techniques to a starting text and compares the results. The starting text can be a draft, a prompt, a note or another writer's passage; the sprint treats each as material for the result.

Left to itself, an assistant writes in its own habits, and a named writer invoked as a model yields the assistant's impression of that writer, which carries the same habits. A passage read closely gives a specific technique to borrow instead.

A **move** is such a technique, named as an instruction. home's [`projects/skill-lab/moves.md`](https://github.com/mehrlander/home/blob/main/projects/skill-lab/moves.md) files moves by name, each with passages that show it, quoted from home's exemplar pieces. home is private: read it from a checkout beside the project root, or through the GitHub tools.

## Process

| Phase | Output | Then |
|---|---|---|
| 1. Define | Brief | Stop for agreement |
| 2. Vary and select | Variants and the selection | Continue |
| 3. Refine | The text | Check, then hand over |

### 1. Define

**Output: Brief.** One or two lines per item.

- **Reader and effect.** Who reads the text, and what they should know, judge or feel afterward.
- **What the text must keep.** For a draft, its claims, inventoried as the [`outlining`](../outlining/SKILL.md) skill's claims reference describes. For a prompt or a note, the idea it reaches for.
- **Tells.** The assistant habits the starting text shows or the request invites: entries in the [`peeves`](../peeves/SKILL.md) list, phrases in home's [model-voice overuse results](https://github.com/mehrlander/home/blob/main/projects/text/runs/2026-08-19-model-voice/README.md), and the anti-slop list in home's [blog `VOICE.md`](https://github.com/mehrlander/home/blob/main/.claude/skills/blog/VOICE.md#anti-slop).
- **Moves.** Three or four moves from `moves.md`, each given one job: a **primary** that shapes the text, a **corrective** that restrains the primary, and an **edit pass** applied last. When no filed move fits, name the move wanted and say that `moves.md` lacks it.

Stop for agreement or correction, unless the user requested the full run.

### 2. Vary and select

**Output: Variants and the selection.**

Read every passage filed under each chosen move before drafting. Write three to five variants, each with a different move as its primary, each keeping what the brief says the text must keep. Show them in full, each headed by its move. Then select one, or combine moves from several, against the brief's reader and effect, and give the reason in a sentence.

### 3. Refine

**Output: The text.**

Apply the corrective and the edit pass. Then check the text:

- every claim or idea the brief lists is still present;
- none of the brief's tells has returned;
- the `portable:peeves-critic` agent returns PASS;
- where the reader is new to the subject, the `portable:novice-reader` agent finds no place the text loses them.

Hand over the text, then one line per move naming what it changed.

### Punch-up

The short form, for a short text or a request to punch one up. Skip the brief's stop and the variants: name the tells and one or two moves in a line, apply the moves in one pass, run the phase 3 checks, and hand over the text with the moves named.

## Key insights

- **Name the move, quote the passage.** While drafting, do not instruct yourself to write like a named writer. Hold the move's name and its passage instead.
- **Take the move, not the writer.** Each passage in `moves.md` says what not to take from its writer. Period diction, a genre's conventions and a writer's mannerisms do not transfer.
- **One job per move.** Moves given equal weight average into no manner in particular. The primary sets the manner; the corrective and the edit pass only restrain it.

## Extending

`moves.md` begins with moves found in home's exemplar pieces, chosen for clarity, and is meant to grow toward wit, momentum and compression. When a sprint finds a passage that shows a move well, propose it as an entry, following the rules at the head of `moves.md`. Punch-up may become its own skill if it is used apart from the sprint.
