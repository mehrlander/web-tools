# Prompt given to Reader C (the reader with no procedure)

Sent verbatim on 2026-11-10. The four input files were copies of
`data/ui-units/parts.csv`, `codebook.md`, `instances.csv` and the `body` rows
of `codes.csv`, taken at web-tools commit `0967d7d97b44`. The question is the
owner's own, from session 698af169.

````
You are an independent reader in a small measurement. Work alone and read only what is named below. Do not open session records, pull requests, other branches, the `research/` folder, or any file under `/home/user/web-tools-private`, `/home/user/home` or `/home/user/chat-histories`. Do not search the web. Do not edit any repository file.

## Inputs (read all four in full)

In `/tmp/claude-0/-home-user/3a3fd776-f8db-59db-a012-7a163a15a6c4/scratchpad/blind/`:
- `parts.csv`: ten "parts", each with a name and a one-line definition.
- `codebook.md`: the document that defines them. The sections "What a pattern is", "Declaring a pattern in markup" and "Slots" matter most.
- `codes-body.csv`: the body codes; the `parts` cell lists the parts a code allows (required first, optional marked `?`).
- `instances.csv`: for each page unit checked, the `parts` column counts how many elements carried each part.

You may also read markup that uses `data-part` under `/home/user/web-tools/lib` and `/home/user/web-tools/pages` (grep for `data-part=`) when you want evidence. Nothing else.

## The question, in the owner's words

"Do parts have any structure? Is there anything else we can say about a part? Do parts have any regular dimensions that we can categorize? Do they have any common characteristics of a similar form but varying instantiation? Any categorizable properties?"

Answer it as you judge best. No method is prescribed.

## Output

Write your full answer as Markdown to `/tmp/claude-0/-home-user/3a3fd776-f8db-59db-a012-7a163a15a6c4/scratchpad/blind/reader-c.md`. It must include one Markdown table with the ten parts as rows and each property you propose as a column, one value per cell (`n/a` where a property does not apply to a part), and, below the table, the source for any cell that is not obvious from `parts.csv`. Say which of your properties you are confident in and which are your inference. Use plain, precise prose and no em dashes.

Then reply to me with at most 12 lines: the names of the properties you propose with their value sets, and how confident you are in each. Your reply is read by another model, not a person, so be terse and exact.
````
