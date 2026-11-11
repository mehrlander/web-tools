# Prompt given to Reader M (the reader with a procedure)

Sent verbatim on 2026-11-10. The four input files were copies of
`data/ui-units/parts.csv`, `codebook.md`, `instances.csv` and the `body` rows
of `codes.csv`, taken at web-tools commit `0967d7d97b44`.

````
You are an independent reader in a small measurement. Work alone and read only what is named below. Do not open session records, pull requests, other branches, the `research/` folder, or any file under `/home/user/web-tools-private`, `/home/user/home` or `/home/user/chat-histories`. Do not search the web. Do not edit any repository file.

## Inputs (read all four in full)

In `/tmp/claude-0/-home-user/3a3fd776-f8db-59db-a012-7a163a15a6c4/scratchpad/blind/`:
- `parts.csv`: ten "parts", each with a name and a one-line definition.
- `codebook.md`: the document that defines them. The sections "What a pattern is", "Declaring a pattern in markup" and "Slots" matter most.
- `codes-body.csv`: the body codes; the `parts` cell lists the parts a code allows (required first, optional marked `?`).
- `instances.csv`: for each page unit checked, the `parts` column counts how many elements carried each part.

You may also read markup that uses `data-part` under `/home/user/web-tools/lib` and `/home/user/web-tools/pages` (grep for `data-part=`) when you need evidence for a cell. Nothing else.

## The question

Do the ten parts have regular dimensions: characteristics that each part takes a value on, of the same form across parts but varying from part to part? Find them, and say which hold up.

## Procedure to follow, in this order

1. **Split each definition.** For each of the ten parts, write the kind of thing its definition says it is and the words that set it apart from its nearest neighbours.
2. **Triads.** Take at least twelve triples of parts, chosen so every part appears in at least three. For each triple say how two are alike and differ from the third. Write each difference as a candidate characteristic: a plain question with its possible values.
3. **Code the table.** Code all ten parts on every candidate characteristic. Each cell is one value, or `n/a` where the question does not apply to that part, or several values joined with `;` where the sources allow several. For every cell that is not obvious from `parts.csv`, give the evidence: a quoted phrase from `codebook.md`, a `parts` cell of `codes-body.csv`, a count pattern in `instances.csv`, or a `file:line` of markup. A cell you could not ground in a source is marked `(no evidence)`.
4. **Test each characteristic**, and report the result of each test by name:
   - *constant*: it has one value wherever it applies, so it separates nothing;
   - *fixed by another*: its value follows from another characteristic's value on every part (say which);
   - *one value per part*: every part it applies to gets its own value, so it restates the definitions and groups nothing;
   - *narrow range*: it applies to fewer than all ten (say which parts);
   - *not single-valued*: some part takes several values;
   - *no evidence*: any of its cells is ungrounded;
   - *belongs to a relation*: its value depends on the part together with its parent or its pattern, not on the part alone.
5. **Unseparated pairs.** List every pair of parts that your surviving characteristics give identical values, and say what does separate them.
6. **Verdict.** List the characteristics you would keep, the ones you would drop and why, and anything that is better described as something other than a characteristic of a part (for example a rule about which part may sit inside which, or a count).

## Output

Write your full result as Markdown to `/tmp/claude-0/-home-user/3a3fd776-f8db-59db-a012-7a163a15a6c4/scratchpad/blind/reader-m.md`, with these sections: Definitions split; Triads; The table (one Markdown table, parts as rows, characteristics as columns); Evidence for non-obvious cells; Tests; Unseparated pairs; Verdict. Use plain, precise prose and no em dashes.

Then reply to me with at most 15 lines: the names of the characteristics you keep with their value sets, the ones you drop with the test each failed, and the unseparated pairs. Your reply is read by another model, not a person, so be terse and exact.
````
