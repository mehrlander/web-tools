# Alignment

Alignment owns how the estate, the owner's repositories and everything in them, fits together and stays consistent, both as it stands and as proposed: where pages live, how the Web Tools app is assembled, how the repositories align, and where two files say the same thing.

It keeps the files that describe the owner's repositories and record the work done in them. The files the alignment program governs are declared under `programs` in [`.web-tools.json`](../../.web-tools.json) and listed in the Map view's [Programs tab](https://mehrlander.github.io/web-tools/app/?view=map&tab=programs). A program is defined in [CONSTELLATION.md](../../docs/CONSTELLATION.md#projects-and-research).

## Areas

| Area | Covers |
| --- | --- |
| Repositories | each repository's manifest, `.web-tools.json`, whose fields [`manifest-fields.csv`](../../docs/manifest-fields.csv) lists, and the app's views that browse a repository: [Repos](https://mehrlander.github.io/web-tools/app/?view=repos), [Branches](https://mehrlander.github.io/web-tools/app/?view=branches), [Files](https://mehrlander.github.io/web-tools/app/?view=files) and [Search](https://mehrlander.github.io/web-tools/app/?view=search) |
| Registries | the registries declared in [`registries.csv`](../../docs/registries.csv), under the model in [`registries.md`](../../docs/registries.md), with their columns in [`properties.csv`](../../docs/properties.csv) |
| Session records and chats | the record of each Claude Code session and the archive of exported chats, read in the [Sessions](https://mehrlander.github.io/web-tools/app/?view=sessions) and [Chats](https://mehrlander.github.io/web-tools/app/?view=chats) views |
| Trackers | each repository's task tracker, written to the schema in [`TRACKER.md`](../../docs/TRACKER.md) |
| Maps | current-state maps in [`current/`](current/), each checked against its data, and proposals to change them in [`future/`](future/). The first map covers [the estate's pages](current/pages.md) |
| Repeated prose | passages that two or more files state alike, found by [`duplicated-claims.py`](../../python/duplicated-claims.py), kept in [`themes.csv`](../../docs/themes.csv) and shown in the Map view's [Themes tab](https://mehrlander.github.io/web-tools/app/?view=map&tab=themes) |
| Lists | the [Lists](https://mehrlander.github.io/web-tools/app/?view=lists) view and the list files it reads and writes in web-tools-private's [`lists/`](https://github.com/mehrlander/web-tools-private/tree/main/lists), through [`kits/lists.js`](../../lib/kits/lists.js). A list's items belong to the program their subject belongs to |

## Processes

A process is a recurring question or duty the program answers for. A session hands one to the program's manager, an agent briefed by [`manager.md`](manager.md).

| Process | Starts when |
| --- | --- |
| Landing | the owner or a session asks whether earlier work landed, meaning that it reached `main` |
| Location | a session asks where a file, page or kind of content lives, or where a new one belongs |
| Ownership | a session asks which registry holds a property of a target or which document owns a topic, or two registries appear to hold the same property |
| Drift | the owner or a session asks which copies of a file or passage no longer match |

## Measures

| Process or area | Measure | Working means |
| --- | --- | --- |
| Landing | [`state/landings.json`](https://github.com/mehrlander/web-tools-private/blob/background/state/landings.json) on web-tools-private's `background` branch: each week's sessions in which the owner asks that question | fewer sessions open on it |
| Repositories | [`state/vendored.json`](https://github.com/mehrlander/web-tools-private/blob/background/state/vendored.json) on web-tools-private's `background` branch: cross-repo vendored copies compared with their upstream sources (`copies_edited`, `sources_ahead` and missing files) | downstream copies stay unedited and current with their sources |

## Reviewers

A proposed change to a governed file goes to [owner-proxy](../../skills/agents/owner-proxy.md) and [peeves-critic](../../skills/agents/peeves-critic.md) before the owner sees it.

## Not this program's

- How a session's work reaches the owner: the [Sessions](../sessions/README.md) program.
- The wording of documents and how pages look: the [Content](../content/README.md) program.
- Inquiry into topics and practices, and its write-ups: the [Discovery](../discovery/README.md) program.
