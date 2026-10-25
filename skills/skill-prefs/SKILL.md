---
name: skill-prefs
description: "Standing preferences for how a skill should be written. Use whenever creating, drafting, editing, or improving a skill, alongside the stock skill-creator rather than instead of it. Read this before writing the SKILL.md. It governs register, scope, output, and trigger strategy, the places where skill-creator's defaults produce skills you do not want."
---

# Skill Prefs

Read alongside skill-creator, not instead of it. The claude.ai account supplies skill-creator; where the host has no copy, read the [official skill folder](https://github.com/anthropics/skills/tree/683bc88e56f3e09ba94f7055977f3d3aa499f202/skills/skill-creator).

## The premise

The base skill-creator skill assumes one kind of skill: ambient, meant to appear before you knew to ask, often imported without fully knowing what it does. Such a skill has to trigger on its own rather than wait to be asked.

For personal-use skills, we want finer control.

In Claude Code a skill can declare its mode in frontmatter (disable-model-invocation for summoned-only, user-invocable to hide it from the menu); here, skill-creator adopts a simpler skill concept, and that posture is largely the premise.

## Key insights

- **Structure.** The default sections are below; omit one that would state nothing, as this skill omits Goal and output, Process, and Extending:
  - *Premise:* the situation the skill answers, a constraint or an opportunity. State the forces either way, so the skill's later choices read as consequences, and lead with what the skill enables rather than what the model lacks. The reader should come away understanding the situation, not the fix.
  - *Goal and output:* shape or behavior. If the skill produces artifacts with a fixed shape, name it; if it shapes behavior, say so, and invent no schema.
  - *Process:* how the work plays out, when the skill has a sequenced process or an interaction with the user; a skill that offers reference material only has none. A step exists only if it yields a named, inspectable artifact. A step that lives inside one generation is a disposition: it shapes output and cannot be verified or relied on as a stage. Only an output-to-output chain honestly claims to be a pipeline.
  - *Key insights:* the heart of a skill. Don't over-explain.
  - *Extending:* a growth path, when there is one. For example, a skill may address certain libraries and could address others. It's good to highlight parts that we intend to expand.

- **Kinds.** Five families give the library its spine: **support**, the largest (language, library, writing, and prompt support, plus kits, a kit being support scoped to one seam within a domain); **text processing**, output-to-output document pipelines; **surfacing**, self-contained display artifacts; **workflow documentation**, processes executed outside the session; and **agentic primitives**, governing meta-skills, this one included. Name the family a new skill joins. Support is the one-word premise for most.

- **Register.** Terse, dry, precise.  Key in the new session, do not show every room in the house.  Root out emphasis, especially casual why-this-point-matters ("usually", "most of the time", "is the first to go", etc.). No em dashes: a colon or a period.  The reader is a future session, capable, impatient, with eyes on a task.

- **Trigger.** The stock advice is to write the description pushy, but test this against the skill’s premise. The trigger should name the situation that summons the skill, never the material it produces. inspire-excellence is the cautionary case: a session built its trigger from the vocabulary of the prompts the skill writes, firing on its own output instead of the request that calls for it.

- **Packaging.** Prefer a single SKILL.md to a zip bundle: easier to see, edit, and swap. Add companion files only when the skill needs them, as html-style does. Edits here are a scratch copy and never reach the user's library on their own. While drafting, present the file as markdown after any change, for review and without asking each round whether it is done. When the user says it is done, present it as a .skill for them to import. A companion file is named in a Bundled section, the file and when to read it: an unnamed companion is invisible to the session and unprotected in a repack. The unit of update is the folder; repack whole, never a lone SKILL.md over a bundle.

- **Frontmatter.** Keep the YAML valid. A colon in the description can break parsing, since YAML reads it as a key; avoid colons there, or wrap the whole value in double quotes. Confirm it parses before handing over a .skill.
