---
name: skill-prefs
description: "Standing preferences for how a skill should be written. Use whenever creating, drafting, editing, or improving a skill, alongside the stock skill-creator rather than instead of it. Read this before writing the SKILL.md. It governs register, scope, output, and trigger strategy, the places where skill-creator's defaults produce skills you do not want."
---

# Skill Prefs

Read alongside skill-creator, not instead of it.

## The premise

skill-creator is useful but opinionated. Its defaults assume one kind of skill: ambient, meant to appear before you knew to ask, often imported without fully knowing what it does. Such a skill has to trigger on its own rather than wait to be asked.

For personal-use skills, the default guidance blurs scope and often gets in the way.

In Claude Code a skill can declare its mode in frontmatter (disable-model-invocation for summoned-only, user-invocable to hide it from the menu); here, skill-creator adopts a simpler skill concept, and that posture is largely the premise.

## The goal and output

The goal is to help yield a more effective and maintainable skill file that the user can upload.

## The process

This skill is a reference for you in drafting any skill.

## Key insights

- **Structure.** A set of default sections is given below, and demonstrated in this skill itself (the dog-food principle):
  - *Premise:* the situation the skill answers, a constraint or an opportunity. State the forces either way, so the skill's later choices read as consequences, and lead with what the skill enables rather than what the model lacks. The reader should come away understanding the situation, not the fix.
  - *Goal and output:* shape or behavior. If the skill produces artifacts with a fixed shape, name it; if it shapes behavior, say so, and invent no schema.
  - *Process:* how the work plays out. The skill may offer reference material only, to read and consider. If so, that's the process. However, it may include some sequenced process or interaction with the user that we would lay out here. A step exists only if it yields a named, inspectable artifact. A step that lives inside one generation is a disposition: it shapes output and cannot be verified or relied on as a stage. Only an output-to-output chain honestly claims to be a pipeline.
  - *Key insights:* the heart of a skill. Look up! For skill-prefs, the centrality of key insights is a key insight. Don't over-explain.
  - *Extending:* a growth path, when there is one. For example, a skill may address certain libraries and could address others. It's good to highlight parts that we intend to expand.

- **Kinds.** Five families give the library its spine: **support**, the largest (language, library, writing, and prompt support, plus kits, a kit being support scoped to one seam within a domain); **text processing**, output-to-output document pipelines; **surfacing**, self-contained display artifacts; **workflow documentation**, processes executed outside the session; and **agentic primitives**, governing meta-skills, this one included. Name the family a new skill joins. Support is the one-word premise for most.

- **Register.** Foremost, not your typical helpful and engaging voice.  Terse, dry, precise.  Key in the new session, do not show every room in the house.  Root out emphasis, especially casual why-this-point-matters ("usually", "most of the time", "is the first to go", etc.).  An intensifier is an unbacked frequency claim; the cure is specificity, name the mechanism, not a softer adverb.  No em dashes: a colon or a period.  The reader is a future session, capable, impatient, with eyes on a task.

- **Trigger.** The stock advice is to write the description pushy, which suits an ambient skill but misfires on a summoned one. The trigger should name the situation that summons the skill, never the material it produces. inspire-excellence is the cautionary case: a session built its trigger from the vocabulary of the prompts the skill writes, firing on its own output instead of the request that calls for it.

- **Packaging.** Prefer a single SKILL.md to a zip bundle: easier to see, edit, and swap. Add companion files only when the skill needs them, as daisy-alpine does. Edits here are a scratch copy and never reach the user's library on their own. While drafting, present the file as markdown after any change, for review and without asking each round whether it is done. When the user says it is done, present it as a .skill for them to import. A companion file is named in a Bundled section, the file and when to read it: an unnamed companion is invisible to the session and unprotected in a repack. The unit of update is the folder; repack whole, never a lone SKILL.md over a bundle.

- **Frontmatter.** Keep the YAML valid. A colon in the description can break parsing, since YAML reads it as a key; avoid colons there, or wrap the whole value in double quotes. Confirm it parses before handing over a .skill.

## Bundled

- `CATALOGUE.md`: the library map, family, type, and premise line per skill. Read when placing a new skill in a family or checking its neighbors.

This document has no Extending section, by its own rule: there is no growth path to document. The omission is the spec in practice.
