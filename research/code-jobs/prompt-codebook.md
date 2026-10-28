# Step 2a: draft a job list

You will read one line per code unit from a JavaScript codebase that runs in a
browser:

    <unit id> <TAB> <job>; <job>; ...

Each job is a short phrase another reader wrote for what the unit does. The ids
name the file before the colon.

Draft a closed list of **job tags** that these units can be tagged with, so that
units doing the same job in different files end up with the same tag, and units
doing different jobs do not. Write it as one JSON object per line:

    {"tag": "<kebab-case-slug>", "gloss": "<the job, in one plain sentence>", "test": "<what a unit must do to take this tag>", "not": "<the nearest other tag, and how to tell them apart>"}

- **A tag names a job, not a place.** "parse-number-text" is a job; "pivot-view"
  is a place in one screen. A job that only one unit in one file does still
  gets a tag if it is a recognisable job, because the list must cover every unit.
- **Pitch tags where a programmer would say "we already have one of those."**
  Too broad ("render-ui", "handle-data") groups everything; too narrow
  ("render-the-pull-request-chip") groups nothing.
- **Do not aim for a number.** Use as many tags as the jobs need.
- **Every unit must be coverable** by at least one tag on the list.

Write only the JSON lines, nothing else.
