# Judge: do these two units do the same job?

You will read numbered pairs of code units from one JavaScript codebase. Each
pair is headed `##### PAIR <n>`, and each of its two units is headed
`=== A: <id> | <name> ===` or `=== B: ... ===` followed by its code. A comment
such as `/* nested: renderTable, lines 120-180 */` marks an inner function that
was cut out; treat it as a call to a helper.

For every pair, decide one verdict:

- **`same`**: the two units do the same job for their callers, so one could
  replace the other, perhaps with a small change to arguments or wording. They
  need not share any code or names.
- **`related`**: they work on the same thing or at neighbouring steps (one
  builds what the other reads, one is a variant with a different purpose), but
  neither could replace the other.
- **`different`**: they do different jobs; any likeness is in the vocabulary.

Write one JSON object per pair, one per line:

    {"pair": <n>, "verdict": "same" | "related" | "different", "why": "<one sentence naming the job of each>"}

Judge from the code only. Do not open other files. Pairs were collected by
several methods and shuffled; nothing about a pair's number or position says
how it was found.
