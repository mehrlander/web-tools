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
