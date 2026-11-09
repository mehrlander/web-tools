# Organization

Organization keeps the files that describe the owner's repositories and record the work done in them. The files the organization program governs are declared under `programs` in [`.web-tools.json`](../../.web-tools.json) and listed in the Map view's [Programs tab](https://mehrlander.github.io/web-tools/app/?view=map&tab=programs); a program is defined in [CONSTELLATION.md](../../docs/CONSTELLATION.md#projects-and-research).

## Areas

| Area | Covers |
| --- | --- |
| Repositories | each repository's manifest, `.web-tools.json`, whose fields [`manifest-fields.csv`](../../docs/manifest-fields.csv) lists, and the app's views that browse a repository: [Repos](https://mehrlander.github.io/web-tools/app/?view=repos), [Branches](https://mehrlander.github.io/web-tools/app/?view=branches), [Files](https://mehrlander.github.io/web-tools/app/?view=files) and [Search](https://mehrlander.github.io/web-tools/app/?view=search) |
| Registries | the registries declared in [`registries.csv`](../../docs/registries.csv), under the model in [`registries.md`](../../docs/registries.md), with their columns in [`properties.csv`](../../docs/properties.csv) |
| Session records and chats | the record of each Claude Code session and the archive of exported chats, read in the [Sessions](https://mehrlander.github.io/web-tools/app/?view=sessions) and [Chats](https://mehrlander.github.io/web-tools/app/?view=chats) views |
| Trackers | each repository's task tracker, written to the schema in [`TRACKER.md`](../../docs/TRACKER.md) |

## Measures

None yet.

## Reviewers

A proposed change to a governed file goes to [owner-proxy](../../skills/agents/owner-proxy.md) and [peeves-critic](../../skills/agents/peeves-critic.md) before the owner sees it.

## Not this program's

- How a session's work reaches the owner: the [Sessions](../sessions/README.md) program.
- The wording of documents and how pages look: the [Content](../content/README.md) program.
- Research write-ups: the [Discovery](../discovery/README.md) program.
