# Conventions delivery reading

One row per recorded session that carries `startup_context`, saying how that
session took delivery of the portable conventions: `import` (a resolved
`@`-import put `docs/SURFACING.md` in context), `invoke` (no import, and the
session called the Skill tool on the conventions skill), or `neither`.
Regenerate with
`python3 scripts/conventions-delivery.py <sessions-dir> --csv <path>`, which
prints the summary and writes the rows in one run. The script's own header owns
the definitions and the two traps behind them; this file records what the run
found.

A reading, not a registry: it records one pass over a private store on one day
and is not restamped, so it lives under `data/` beside the checks reading rather
than under `docs/`. Its source is `mehrlander/web-tools-private` at
`sessions/`, which no commit hook and no test in this repository can reach.

## 2026-09-13

168 sessions carried `startup_context`, and 166 of them had the hub checked out,
which is the figure that makes the change consequential: cutting the `@`-import
put nearly every session on the prod rather than a minority. Of the 168, 163
read `import`, 3 `invoke`, and 2 `neither`. Both `neither` sessions made no Skill
call of any kind, so they are the certain floor rather than a sampling artifact.

**The cutover is the only part of this reading that says anything about the new
channel.** `d5fd3cf` dropped both imports at 2026-09-13T04:35:48Z. Three sessions
have started since, all three read `invoke`, none carried `docs/SURFACING.md` in
context, and all three show the post-cutover `CLAUDE.md` at `833987242a3e`. The
prod worked in every session that has met it. Three is a sample that can rule a
channel broken and cannot establish a rate, so the next reading is the one worth
taking.

**Two limits, and the second was the reason for adding the columns.** The `calls`
list is sampled, so `neither` is an upper bound and the zero-Skill-calls count is
the floor; quote them together. And a reading is not a prod outcome: `import`
says the conventions arrived, not that the prod stayed silent. A session whose
checkout predates the cutover carries the old import and is prodded by the
current plugin, so both channels fire and only the first appears here.
`hub_claude_md_sha` separates those cases, since a checkout on the post-cutover
file cannot have imported anything. What no column can show is a directive that
failed to resolve, which leaves no trace in a record at all.
