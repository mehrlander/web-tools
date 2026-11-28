# Discovery manager

The session holding the Discovery manager role, taken on with `/portable:programs discovery` ([programs skill](../../skills/programs/SKILL.md)), answers the processes [the README](README.md) lists as below.

First read the owner's rulings, the [notes](../../skills/notes/SKILL.md) addressed to `mehrlander/web-tools:programs/discovery/README.md`. Name any source you could not read.

## Prior work

Inputs: the subject and candidate repositories. Read three sources, starting with the manifests:

- **Declared research:** the `research` arrays in `.web-tools.json` across the named checkouts, together with [`research/README.md`](https://github.com/mehrlander/web-tools-private/blob/main/research/README.md) in web-tools-private, list declared write-ups and mark each `probe` or `exploration`.
- **Research and probe folders on disk:** `research/` and `probes/` directories on `origin/main` in those checkouts hold write-ups, scripts and CSV outputs not yet declared in `.web-tools.json`.
- **Gathered sources and readership:** fetched external material sits in three places. A [scour](../../skills/scour/SKILL.md) corpus keeps `roster.json` and `content/*.md`. A [wayback](../../skills/wayback/SKILL.md) run keeps capture lists and saved pages. Each checkout declares source bundles under `bundles` in `.web-tools.json`. [`state/doc-reads.json`](https://github.com/mehrlander/web-tools-private/blob/background/state/doc-reads.json) on web-tools-private's `background` branch shows whether later sessions opened a write-up.

Return one line for each matching write-up or source folder, newest first, or one `none found` line:

```
<probe | exploration | undeclared | gathered> · <repo:path> · <date or commit[:8]> · <code/data | prose only> · <finding or scope>
none found · <repositories searched>
```

## Bake-off

A bake-off judges a method by what it produces. It either gives several candidate methods the same task, or gives one candidate several varied subjects to find where it fails. A [design sprint](../../skills/design-sprint/SKILL.md) differs. It generates several competing outcomes and keeps one. Its methods matter only as sources of variety.

Inputs: the task, the candidates (skills, tools, prompts or processes), and two or more subjects.

1. **Vet every candidate.** Read its files. Report what it installs, which hosts it reaches and what it writes outside its output folder. Run the candidates whose reports raise no concern. Show the owner every report. A candidate left out can then be run at the owner's request.
2. **Add baselines.** Run a session given no method, and any method Claude already has for the task.
3. **Fix the brief.** Every run gets the same brief, its own folder and no installs beyond what vetting cleared. Each run logs its steps, minutes, tool calls and tokens.
4. **Choose subjects that differ** in the ways the method's real use will differ.
5. **Grade against the subjects' source material.** One grader agent per subject builds a checklist of facts from that material. It scores each output against the checklist, then ranks the outputs. The grader sees each candidate's name.
6. **Show everything.** The owner sees, for each candidate, its vetting report, every run's full log and output, and the grader's checklist, scores and reasoning. Use an [`inspection/1`](../../docs/envelopes/inspection.md) payload with one run per candidate and one output per subject. The owner's verdicts and notes then save back for the session to read.
7. **Recommend.** The write-up gives the method, a results table, the findings and the caveats, such as runs per candidate and the grader's model. It ends with the session's recommendation to adopt or drop each candidate. Where that decision is the owner's, file a [user call](../../skills/user-calls/SKILL.md) carrying the recommendation.

## Research inventory

The question is which probes, explorations and gathering runs exist, listed by repository, kind (`probe` or `exploration`), status (`living`, `measured` or `record`) or date. A gathering run is a [scour](../../skills/scour/SKILL.md) or [wayback](../../skills/wayback/SKILL.md) run that fetched outside material. The caller names the filters; with none, list everything. Three sources answer the question:

- **Cached declarations:** [`state/configs.json`](https://github.com/mehrlander/web-tools-private/blob/main/state/configs.json) in web-tools-private copies each repository's `.web-tools.json` as of its `generatedAt` time. Its `research` arrays give each declaration's path, label, kind and status. A checkout's own manifest on `origin/main` supersedes the copy.
- **Probe registries:** a declared probes folder's `probes.csv` gives one row per probe ([`probes.md`](../../docs/probes.md)).
- **Undeclared work and runs:** the folders that Prior work's second source names, and the `roster.json` or capture list each gathering run keeps.

Return one line for each item, newest first, or one `none found` line:

```
<probe | exploration | undeclared | run> · <repo:path> · <date or commit[:8]> · <status or none> · <label>
none found · <repositories searched>
```

Give the `generatedAt` time of `state/configs.json`.
