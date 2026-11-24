---
name: writing-sprint
description: "Develop a piece of writing from a starting text in three phases: a brief, variants that each borrow a craft move from a passage that shows it, then one selected and refined text. The starting text can be a draft, a prompt, a note or someone else's passage. Use when asked for a writing sprint or a punch-up, to make a text stronger, to try a text in several manners, or to move a text away from an assistant's habits. Not for a page's form (design-sprint), or for shortening a text whose content is fixed (caveman, succinct-text)."
---

# Writing Sprint

The phases parallel [`design-sprint`](../design-sprint/SKILL.md)'s.

## Premise

Writers who have solved a problem on the page leave techniques another writer can borrow: a number given before the abstraction it stands for, one fact to a sentence, a plain test that settles a claim. A writing sprint applies such techniques to a starting text and compares the results. The sprint treats a draft and a prompt alike, as material for the result.

Left to itself, an assistant writes in its own habits. A named writer invoked as a model yields the assistant's impression of that writer. The impression repeats the same habits. A passage read closely gives a specific technique to borrow instead.

home's [`projects/skill-lab/moves.md`](https://github.com/mehrlander/home/blob/main/projects/skill-lab/moves.md) files such techniques, called moves, by name, each with the passages that show it. home is private: read it from a checkout beside the project root, or through the GitHub tools.

## Process

| Phase | Output | Then |
|---|---|---|
| 1. Define | Brief | Stop for agreement |
| 2. Vary and select | Variants and the selection | Continue |
| 3. Refine | The text | Check, then hand over |

### 1. Define

Write one or two lines per item.

- **Reader and effect.** Who reads the text, and what they should know, judge or feel afterward.
- **What the text must keep.** For a draft, its claims, inventoried as the [`outlining`](../outlining/SKILL.md) skill's claims reference describes. For a prompt or a note, the idea it reaches for.
- **Habits.** The assistant habits the starting text shows or the request invites: entries in the [`peeves`](../peeves/SKILL.md) list, phrases in home's [model-voice overuse results](https://github.com/mehrlander/home/blob/main/projects/text/runs/2026-08-19-model-voice/README.md), and the anti-slop list in home's [blog `VOICE.md`](https://github.com/mehrlander/home/blob/main/.claude/skills/blog/VOICE.md#anti-slop).
- **Moves.** Chosen from [`moves.md`](https://github.com/mehrlander/home/blob/main/projects/skill-lab/moves.md), each with one job:
  - three to five candidate **primaries**, each the basis of one variant;
  - one **corrective**, to restrain the selected primary;
  - one **edit pass**, applied last.

  When no filed move fits, name the move wanted and say that `moves.md` lacks it.

Stop for agreement or correction, unless the user requested the full run.

### 2. Vary and select

Read every passage filed under each chosen move before drafting. While drafting, work from each move's name and passage rather than a writer's name, and leave behind what the passage's entry says to leave behind. Write one variant per candidate primary. Every variant keeps what the brief says the text must keep. Show them in full, each headed by its move. Then select one, or combine moves from several, against the brief's reader and effect, and give the reason in a sentence.

### 3. Refine

Apply the corrective and the edit pass. Then check the text:

- every claim or idea the brief lists is still present;
- none of the habits the brief names has returned;
- the [`portable:peeves-critic`](../agents/peeves-critic.md) agent returns PASS;
- where the reader is new to the subject, the [`portable:novice-reader`](../agents/novice-reader.md) agent finds no place the text loses them.

Hand over the text, then one line per move naming what it changed.

### Punch-up

The short form, for a short text or a request to punch one up. Skip the brief's stop and the variants: name the habits and one or two moves in a line, apply the moves in one pass, run the phase 3 checks, and hand over the text with the moves named.

## Extending

`moves.md` begins with moves from home's [exemplar pieces](https://github.com/mehrlander/home/tree/main/projects/skill-lab/exemplars/pieces). Those pieces were chosen for clarity. Moves for wit, momentum and compression are to follow. When a sprint finds a passage that shows a move well, propose it as an entry, following the rules at the head of `moves.md`.
