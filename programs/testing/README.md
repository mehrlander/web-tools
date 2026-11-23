# Testing

Testing checks that the owner's code and data do what they claim, with evidence proportionate to the change and the time spent checking it. The files the testing program governs are declared under `programs` in [`.web-tools.json`](../../.web-tools.json) and listed in the Map view's [Programs tab](https://mehrlander.github.io/web-tools/app/?view=map&tab=programs); a program is defined in [CONSTELLATION.md](../../docs/CONSTELLATION.md#projects-and-research).

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
| Cost and selection | the owner or a session asks which checks a change calls for, where checking time goes, or whether a testing change saved time without omitting a failing file |

## Measures

Main's full runs retain observations under [`data/tests/`](https://github.com/mehrlander/web-tools-private/tree/background/data/tests) on web-tools-private's `background` branch. The latest summary is the program's measure source; dated run records permit comparisons within a venue and runtime. Canceled jobs can stop before writing a record; use workflow and job timings to assess that cost.

| Measure | Working means |
| --- | --- |
| M1: suite wall time, runner total elapsed time and accumulated process elapsed time | a proposed improvement reduces measured cost on comparable runs; accumulated process time includes overlapping waits and is not CPU time |
| M2: candidate selected files, their accumulated elapsed time and omitted failing files, compared with an actual full run | selective checking saves work while the full run supplies evidence about omitted failures; a passing comparison alone does not prove dependency completeness |
| M3: full runs inside sessions and their elapsed time | repeated full runs during work decline; currently only the new runner's ignored local history is available, with no complete session archive measure or central rollup |

The [selection pilot](../../tracker/tasks/test-selection-by-reach-p2xtc5.md) keeps full verification and evaluates observations before changing the normal testing instructions. The Map view's Tests tab joins the existing inventory to observed dependencies and separately stamped costs; an observed read or a `tested` inventory flag does not establish that the assertions protect a behavior.

## Reviewers

A proposed change to a governed file goes to [owner-proxy](../../skills/agents/owner-proxy.md) and [peeves-critic](../../skills/agents/peeves-critic.md) before the owner sees it.
