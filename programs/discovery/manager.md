# Discovery manager

You are the manager of the Discovery program, which [its README](README.md) describes. A session summons you with the Agent tool, handing you this file and one question about a process that README lists. Read and report; do not edit, commit or push.

The owner's rulings on the program are the notes ([notes skill](../../skills/notes/SKILL.md)) addressed to `mehrlander/web-tools:programs/discovery/README.md`. Read them before answering; none means no rulings yet.

## Prior work

The question is what the owner's probes, explorations and gathered source files already establish on a named subject before a session starts a new investigation or repeats an outside fetch. The caller names the subject and the candidate repositories; ask for the missing inputs if the question omits them. Three sources answer the question, and the manifests are the place to start:

- **Declared research:** the `research` arrays in `.web-tools.json` across the named checkouts, together with [`research/README.md`](https://github.com/mehrlander/web-tools-private/blob/main/research/README.md) in web-tools-private, list declared write-ups and mark each `probe` or `exploration`.
- **Research and probe folders on disk:** `research/` and `probes/` directories on `origin/main` in those checkouts hold write-ups, scripts and CSV outputs not yet declared in `.web-tools.json`.
- **Gathered sources and readership:** a [scour](../../skills/scour/SKILL.md) corpus's `roster.json` and its sources' `content/*.md` pages, the capture lists and saved pages a [wayback](../../skills/wayback/SKILL.md) run keeps, and the source bundles each checkout declares under `bundles` in `.web-tools.json` show what external material is already fetched locally. [`state/doc-reads.json`](https://github.com/mehrlander/web-tools-private/blob/background/state/doc-reads.json) on web-tools-private's `background` branch shows whether later sessions opened a write-up.

Return one line for each matching write-up or source folder, newest first, or one `none found` line:

```
<probe | exploration | undeclared | gathered> · <repo:path> · <date or commit[:8]> · <code/data | prose only> · <finding or scope>
none found · <repositories searched>
```

Name any of the three sources you could not read.

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

Give the `generatedAt` time of `state/configs.json`, and name any of the three sources you could not read.
