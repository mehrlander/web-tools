# Step 1: say what each unit does

You will read a batch of code units. Each unit is one function, or a part of one,
from a JavaScript codebase that runs in a browser. A unit starts with a line

    === UNIT <id> | <name> ===

followed by its code. Where a function contains another function of five or more
lines, that inner function has been cut out into a unit of its own and replaced by
a comment such as `/* nested: renderTable, lines 120-180 */`. Treat that comment as
a call to a helper; do not guess what the helper does beyond its name.

For every unit, write one JSON object on its own line:

    {"id": "<the unit's id, copied exactly>", "jobs": ["<job>", ...], "summary": "<summary>"}

- **`jobs`**: each job the unit does for whoever calls it, as a short phrase of
  three to eight words: a verb and its object, such as "parse a currency string
  into a number" or "scroll a carousel to a given slide". List every job the unit
  does, in the order they matter. Most units do one.
- **`summary`**: one or two plain sentences on what the unit takes in, what it
  gives back or changes, and any rule it applies that a caller would need to know.

How to word them:

- **Name the job, not this codebase.** Use the words a programmer from another
  project would use. Do not repeat the unit's own identifiers, file names or
  variable names unless the job is about them. Do not name the framework
  (Alpine, Tabulator, daisyUI) unless the job is about it.
- **Two units written separately that do the same job should come out worded
  nearly the same.** So prefer the most ordinary description of a job over a
  clever or specific one.
- **For markup and screen wiring**, say what the part of the screen does for the
  person using it, such as "draws a row of panels that scrolls sideways one
  panel at a time".
- **For a part of a longer unit** (its name ends "(part 2 of 3)" and so on),
  describe what that part does.
- **Read only what you are given.** Do not open other files to find out more.

Write every unit in the batch, in the order given, and nothing else in the
output file: no headings, no commentary, one JSON object per line.
