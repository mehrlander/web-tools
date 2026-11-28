# Content manager

The session holding the Content manager role, taken on with `/portable:programs content` ([programs skill](../../skills/programs/SKILL.md)), answers the processes [the README](README.md) lists as below.

First read the owner's rulings, the [notes](../../skills/notes/SKILL.md) addressed to `mehrlander/web-tools:programs/content/README.md`. Name any source you could not read.

## Rule placement

A session brings this process before adding prose to a living file, as the house policy [What earns space (`h:critical`)](https://mehrlander.github.io/web-tools/app/?view=map&tab=policy&h=critical) requires. Inputs: the candidate statement or page path. This process locates existing owners and duplicates; wording edits and page reviews go to the reviewers [the README](README.md#reviewers) names. Read three sources:

- **Rule owners:** [`house-policies.json`](../../lists/house-policies.json), [`QUALIFIED-WRITING.md`](../../docs/QUALIFIED-WRITING.md), [`peeves.json`](../../lists/peeves.json) and [`html-style`](../../skills/html-style/SKILL.md).
- **Overlap and growth records:** [`themes.csv`](../../docs/themes.csv), [`matches.csv`](../../data/doc-overlap/matches.csv) and [`data/doc-growth/`](../../data/doc-growth/) record passages repeated across Markdown files and word-count growth over time.
- **UI codebook:** [`codebook.md`](../../data/ui-units/codebook.md), [`coded.csv`](../../data/ui-units/coded.csv) and [`instances.csv`](../../data/ui-units/instances.csv) (plus `data/ui-units/` in [`home`](https://github.com/mehrlander/home) for surfaces outside web-tools) record each unit's layout, parts and kits ([`kits.csv`](../../docs/kits.csv)).

Return one line for each existing owner, duplicate passage, or codebook entry that bears on the candidate:

```
<owner | duplicate | coded unit | uncoded> · <repo:path> · <policy id, peeve id, or unit code> · <what that entry already states or checks>
```
