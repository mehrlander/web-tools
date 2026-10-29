---
name: page-design-loop
description: "Develop a page through inspectable object models, populated sketches and versioned revisions. Use when the user wants to generate or compare information structures and page directions, operate explicit design actions, or revisit a page's underlying model. A specified layout can be implemented directly."
---

# Page design loop

Produce a useful, well designed page while keeping the structures, sketches
and decisions inspectable. The person sets the purpose and preferences. The
coordinating model chooses concrete actions within the task's effort allowance.

## Start the run

Create a run folder beside the work, or in the task's scratch location for an
experiment. Save the source material and a concise `run.json` containing:

- The intended reader gain, provisional scope, supplied evidence and visual
  preferences. Distinguish the inquiry's boundary from the source's coverage.
- Named criteria and checks. Make missing assumptions visible and continue
  with reversible choices where the request permits.
- A finite effort allowance suited to the request, recorded as a provisional
  allocation when the user supplied no limit. The unit is a worker job,
  not an unobserved provider API call. Leave branch counts open.
- Versioned artifact records, action records, check results and presented IDs.

Read [the action contracts](references/actions.md) before issuing actions and
[the check procedures](references/checks.md) when defining or running checks.
Choose the information model's JSON schema to suit the material; the run record
only standardizes coordination and provenance.

## Actors and jobs

| Actor or job | Responsibility |
|---|---|
| 👤 Person | State intentions and preferences; inspect structures, sketches and pages; redirect the work; assess the result. |
| 🤖 Coordinator | Maintain the brief and run record; issue actions; route feedback; make provisional choices and record reasons. |
| 🤖 Creator | Produce or revise the requested artifact using its named inputs. |
| 🤖 Tester | Run a named check and report evidence, failures and unknowns. |
| 🤖 Selector | Choose the next artifacts to develop using the brief and observed findings. The coordinator can perform this job. |
| ⚙️ Script | Validate records, render pages or measure declared mechanical properties. |

Jobs can share a model context. Use separate contexts for independent proposals
or checks when useful and authorized; preserve a selected worker's context for
revisions. Personas such as information architect or editorial designer supply
task expertise. Assign a concrete job, inputs and output to each worker.

## Issue explicit actions

Both the person and coordinator use these operations:

`create_structure` · `revise_structure` · `create_sketch` · `revise_sketch` ·
`build_page` · `revise_page` · `run_check` · `park` · `resume` · `present`

Every action names its target, consumed versions, reason, expected change,
verification criteria and allowance. Save the exact task request and original
response with the artifact. Record actions before dispatch, then record actual
outputs and usage. For concurrent work, the coordinator merges returned records
into the run; workers write to their own output folders.

Generate additional candidates to test named differences in organization or
presentation. A revision addresses a specific issue in an existing artifact.
Each model carries a reader question, useful relationships and populated cases.
Each sketch uses actual material to demonstrate a proposed presentation.

Look within the chosen scope for activities, events, states, flows and recurring
instances as well as entities. Try hierarchies, parallels and key distinctions
where the material supports them. Identify quantities and comparison dimensions
that could earn a visualization. Keep sourced facts, attributed claims and
proposed extensions distinguishable; include only structures that help the
reader's task.

Preserve existing examples during revision and state any coverage change. Store
new artifact versions separately. Record which model version each sketch uses
and which sketch each page uses. Revising a model flags its dependent views for
reconsideration; update or recheck those views before presenting them as current.

## Choose the next action

1. Carry out an explicit person request within the existing authorization.
2. Address an observed failure at its cause: evidence or relationships in the
   structure, arrangement in the sketch, behavior or rendering in the page.
3. Create an alternative when a named difference would resolve a live question.
4. Advance an existing direction into sketches or a page when its evidence and
   examples justify the next investment. Record the criterion and observation.
5. Present the requested artifacts when their declared checks are accounted for,
   or present the current state with unresolved findings when the allowance is
   reached. Preserve parked alternatives for later inspection.

These are decisions about the next action, with no fixed candidate count or
mandatory passage through every phase. Model and sketch actions can fan out.
Selection allocates further effort to particular artifacts. Later feedback can
return to any earlier version. Read [the flow diagram](references/actions.md#flow)
when describing or changing the choreography.

## Build, check and show

Follow the project's page conventions and the person's explicit preferences.
Where available, use the existing html-style, rendering, screenshot-review and
look-link tools. Keep the workflow's review controls outside the finished page.
For comparing alternatives, preserve shared view selection across a swipe deck
or tabs. For this user's review surfaces, use visible fields and tabs without
field expanders.

Use the bundled read-only checker:

```text
python scripts/validate_run.py PATH/TO/run.json
```

Resolve record errors before handing over a run. The checker verifies action
contracts, artifact files, effort accounting and version dependencies. Semantic
source checks, reader tasks and page quality require their own recorded evidence.
Return a page link plus a compact route to the models, sketches, prompts and
decisions. Surface unresolved findings and any use of an older dependency.
