# Content

Content governs how the owner's writing and pages read. The files the content program governs are declared under `programs` in [`.web-tools.json`](../../.web-tools.json) and listed in the Map view's [Programs tab](https://mehrlander.github.io/web-tools/app/?view=map&tab=programs); a program is defined in [CONSTELLATION.md](../../docs/CONSTELLATION.md#projects-and-research).

## Areas

| Area | Covers |
| --- | --- |
| Writing | the prose rules in [`QUALIFIED-WRITING.md`](../../docs/QUALIFIED-WRITING.md), the owner's [peeves](../../skills/peeves/SKILL.md), the [house policies](../../docs/house-policies.md), and the approval of documentation wording under [doc-craft](../../skills/doc-craft/SKILL.md) |
| Documents | each document's words and edits over time, in [`data/doc-growth/`](../../data/doc-growth/), and the prose repeated across files, in [`themes.csv`](../../docs/themes.csv) |
| Pages | how a page looks, in the [html-style](../../skills/html-style/SKILL.md) skill, and what a page is built from: the UI codebook in [`data/ui-units/`](../../data/ui-units/codebook.md), which names each page's parts and the layout its main region takes, and the browser modules in [`lib/kits/`](../../lib/kits/), indexed in [`kits.csv`](../../docs/kits.csv) |

## Processes

A process is a recurring question or duty the program answers for. A session hands one to the program's manager, an agent briefed by [`manager.md`](manager.md).

| Process | Starts when |
| --- | --- |
| Rule placement | a session is about to add a rule, convention or UI pattern to a living document and asks where that statement or unit already lives |

## Measures

None yet.

## Reviewers

A proposed change to a governed file goes to [owner-proxy](../../skills/agents/owner-proxy.md) and [peeves-critic](../../skills/agents/peeves-critic.md) before the owner sees it; a change to a page also goes to [house-style-critic](../../skills/agents/house-style-critic.md).

## Not this program's

- A reply and the links it hands over: the [Sessions](../sessions/README.md) program.
- Which documents exist and what each is for, kept in [`docs.csv`](../../docs/docs.csv): the [Organization](../organization/README.md) program.
