# Content

Content governs how the owner's writing and pages read. The files the content program governs are declared under `programs` in [`.web-tools.json`](../../.web-tools.json) and listed in the Map view's [Programs tab](https://mehrlander.github.io/web-tools/app/?view=map&tab=programs); a program is defined in [CONSTELLATION.md](../../docs/CONSTELLATION.md#projects-and-research).

## Areas

| Area | Covers |
| --- | --- |
| Writing | the prose rules in [`QUALIFIED-WRITING.md`](../../docs/QUALIFIED-WRITING.md) and the approval of documentation wording under [doc-craft](../../skills/doc-craft/SKILL.md) |
| Documents | each document's words and edits over time, in [`data/doc-growth/`](../../data/doc-growth/) |
| Pages | how a page looks, in the [html-style](../../skills/html-style/SKILL.md) skill, and what a page is built from. The UI codebook in [`data/ui-units/`](../../data/ui-units/codebook.md) names each page's parts and the layout its main region takes. The browser modules in [`lib/kits/`](../../lib/kits/) are indexed in [`kits.csv`](../../docs/kits.csv). Observations about page design that are not yet rules collect in the Lists view's [UI insights](https://mehrlander.github.io/web-tools/app/?view=lists&tab=ui-insights) list |

## Processes

A process is a recurring question or duty the program answers for; [`manager.md`](manager.md) says how the manager answers each one.

| Process | Starts when |
| --- | --- |
| Rule placement | a session is about to add a rule, convention or UI pattern to a living document and asks where that statement or unit already lives |
| Pending sign-off | a session or the owner asks which documentation wording waits on the owner's approval |

## Measures

None yet.

## Reviewers

A proposed change to a governed file goes to [owner-proxy](../../skills/agents/owner-proxy.md) and [peeves-critic](../../skills/agents/peeves-critic.md) before the owner sees it; a change to a page also goes to [house-style-critic](../../skills/agents/house-style-critic.md).

## Not this program's

- A reply and the links it hands over: the [Sessions](../sessions/README.md) program.
- Which documents exist and what each is for, kept in [`docs.csv`](../../docs/docs.csv), and the prose two files repeat, kept in [`themes.csv`](../../docs/themes.csv): the [Alignment](../alignment/README.md) program.
