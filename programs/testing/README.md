# Testing

Testing checks that the owner's code and data do what they claim. The files the testing program governs are declared under `programs` in [`.web-tools.json`](../../.web-tools.json) and listed in the Map view's [Programs tab](https://mehrlander.github.io/web-tools/app/?view=map&tab=programs); a program is defined in [CONSTELLATION.md](../../docs/CONSTELLATION.md#projects-and-research).

## Areas

| Area | Covers |
| --- | --- |
| Suite | what the tests are and what each protects, starting from web-tools' [`node/test/`](../../node/test/) and its registries [`docs/tests.csv`](../../docs/tests.csv) and [`docs/tests-authored.csv`](../../docs/tests-authored.csv), shown in the Map view's [Tests tab](https://mehrlander.github.io/web-tools/app/?view=map&tab=tests) |
| Venues | which checks run in which [venue](../../docs/machines.md), such as GitHub's runners, the Home laptop and Anthropic's cloud; who starts each check and why; and whether one check runs in more than one venue |

## Processes

A process is a recurring question or duty the program answers for. A session hands one to the program's manager, an agent briefed by [`manager.md`](manager.md).

| Process | Starts when |
| --- | --- |
| Pull request checks | the owner or a session asks why a pull request lacks a green check, failed a check, or ran in one venue and not another |
| Coverage | the owner or a session asks which automated checks guard a file, page, kit or component, and where each check runs |

## Measures

None yet.

## Reviewers

A proposed change to a governed file goes to [owner-proxy](../../skills/agents/owner-proxy.md) and [peeves-critic](../../skills/agents/peeves-critic.md) before the owner sees it.
