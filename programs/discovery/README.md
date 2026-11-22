# Discovery

Discovery is the owner's research, into their own work and into what others know. The files the discovery program governs are declared under `programs` in [`.web-tools.json`](../../.web-tools.json) and listed in the Map view's [Programs tab](https://mehrlander.github.io/web-tools/app/?view=map&tab=programs); a program is defined in [CONSTELLATION.md](../../docs/CONSTELLATION.md#projects-and-research).

## Areas

| Area | Covers |
| --- | --- |
| Probes | investigations that test the owner's tools, workflows, data or assumptions, often by building something and trying it. Each write-up is listed under `research` in its repository's `.web-tools.json` with the kind `probe`, kept in [web-tools-private `research/`](https://github.com/mehrlander/web-tools-private/tree/main/research) unless a project keeps its own, and shown in the Map's [Probes tab](https://mehrlander.github.io/web-tools/app/?view=map&tab=research). budget-drs's [probes](https://github.com/mehrlander/budget-drs/tree/main/data/design/probes) and home's [text project](https://github.com/mehrlander/home/tree/main/projects/text) keep their own |
| Provenance | how content, data and claims tie back to their sources. It covers material taken in from outside as [source bundles](../../docs/source-bundles.md), a probe's [sources](../../docs/probes.md#sources), the [source-anchoring](../../skills/source-anchoring/SKILL.md) skills, the [content registry](../../skills/content-registry/SKILL.md) of what produced each artifact, and [gold sets](../../skills/gold-set/SKILL.md), which test correctness against an independently labeled sample. [Provenance in practice](https://github.com/mehrlander/web-tools-private/blob/main/research/2026-11-20-provenance-in-practice/README.md) surveys current practice |
| Exploration | information gathered from outside sources, listed with the kind `exploration` and shown in the Map's [Exploration tab](https://mehrlander.github.io/web-tools/app/?view=map&tab=exploration), and the skills that gather it, such as [scour](../../skills/scour/SKILL.md) and [wayback](../../skills/wayback/SKILL.md) |

## Processes

A process is a recurring question or duty the program answers for. A session hands one to the program's manager, an agent briefed by [`manager.md`](manager.md).

| Process | Starts when |
| --- | --- |
| Prior work | a session or the owner asks what existing probes, explorations and gathered source files already establish on a subject before starting a new investigation |

## Measures

None yet.

## Reviewers

A proposed change to a governed file goes to [owner-proxy](../../skills/agents/owner-proxy.md) and [peeves-critic](../../skills/agents/peeves-critic.md) before the owner sees it.

## Not this program's

- Searching the owner's own files and records: the [Organization](../organization/README.md) program.
- The checks that guard code and data: the [Testing](../testing/README.md) program.
- The registry model in [`registries.md`](../../docs/registries.md), including its authored, derived and captured classes: the [Organization](../organization/README.md) program.
