# Reduction swarm: round 2, role builder

The goal is the same passage for the same reader in fewer words. The source is
fixed and split into units `S1`, `S2`, and so on; you never edit it, you add to
the ledger. Numbers, names, commands, flags, environment variables, file paths
and quoted errors survive verbatim. A point may be carried implicitly where the
reader would still act the same way. Be bold: propose the cut or restructure a
cautious editor would not, and let the votes and the harvest sort it out.

Write JSON Lines, one object per line, to the output path named below. The
kinds:

- `{"tag":"core","anchors":["S3"],"text":"..."}`: a payload item, something
  the reader must still know or do after the reduction, in 15 words or fewer.
- `{"tag":"tactic","anchors":["S2","S3"],"text":"..."}`: a structural move and
  its expected saving in words.
- `{"tag":"draft","anchors":["S2","S3"],"text":"...","builds_on":["1.t2"]}`:
  replacement wording for those units, read in place of them.
- `{"tag":"word","anchors":["S5"],"from":"exact phrase","to":"shorter phrase"}`:
  a phrase swap; `from` must appear verbatim in the anchored unit, and `to`
  may be empty for a cut.
- `{"vote":"1.d2","v":1}` or `{"vote":"1.d2","v":-1,"why":"..."}`: a vote on
  an existing entry; a `-1` names what a reader would lose or do wrongly.

`anchors` lists unit ids in source order, or `["ALL"]` for the whole passage.
`builds_on` is optional and lists the ids of ledger entries, shown below, that
an entry extends; your own entries get ids when the round is merged. Write only
the kinds your role names. Before returning, run the check command named below
and fix every line it reports.

## Your role: builder

Turn open tactics into drafts, and combine drafts for adjacent units into one.
Vote `+1` on the entries the next harvest should use and `-1` on any entry,
including the current best's choices, that drops something a reader needs.
Challenge the payload too: `-1` a core item a reader would not miss, saying
why. Cast at least eight votes.

## Paths

- Output: `/home/user/web-tools/python/swarm/runs/subagents/r2-builder.jsonl`
- Check: `python3 /home/user/web-tools/python/swarm/swarm.py check /home/user/web-tools/python/swarm/runs/subagents /home/user/web-tools/python/swarm/runs/subagents/r2-builder.jsonl`

## Source (408 words)

- S1 (9w): ## Subagents share the container, not just the budget
- S2 (26w): A subagent reads a file the main loop just wrote and the reverse: same hostname, same boot, same `HTTPS_PROXY`, same user, same checkouts, branch and HEAD.
- S3 (37w): **What is separate is the context window, not the machine.** That single fact explains the shared search budget, the shared concurrency cap, and why agents can write directly into the repo for the main loop to commit.
- S4 (17w): The `Agent` tool's `isolation: "worktree"` and `isolation: "remote"` options are the exceptions; by default everything is shared.
- S5 (17w): **Concurrency caps at 20 subagents.** Larger dispatches partially fail with `Concurrent subagent limit reached`, raisable with `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`.
- S6 (27w): The cap's real cost is not the visible rejection but a **silent drop**: an item that was in the roster, never dispatched successfully, and therefore never reports.
- S7 (12w): Reconcile the roster against what actually launched, never against what was dispatched.
- S8 (6w): `ListAgents` settles it in one call.
- S9 (51w): **The Workflow tool's cap is a different number, and it is a function of the machine** *(measured 2026-09-06)*: min(16, CPUs minus 2) per run, per the authoring reference, and this container reported 4 CPUs (`nproc`), so a Workflow would have run two agents at a time against the Agent tool's twenty.
- S10 (21w): Read `nproc` before choosing the venue for a fan-out; on this box the Agent tool wins by a factor of ten.
- S11 (12w): From the same run of 124 agents (17 minutes at the cap):
- S12 (13w): - The Agent tool has no effort parameter; only Workflow's `agent()` takes one.
- S13 (10w): A "low effort" instruction has to travel in the prompt.
- S14 (46w): - **Output on disk is not agent done.** An agent that has written its file and run a checker still holds its slot until it returns, so a ledger kept from file arrivals overcounts free slots by one or two and the next launch is refused.
- S15 (14w): `ListAgents` is the count; the refusal is cheap and the relaunch is the fix.
- S16 (26w): - A validator the agent runs on its own output before returning, one script named in the prompt, made 124 of 124 outputs parse and conform.
- S17 (13w): It is the Agent-tool equivalent of Workflow's `schema` option, and it is committed.
- S18 (19w): - Cost lives in the transcripts, not the notification: each transcript line's `message.usage` block sums to the agent's spend.
- S19 (32w): That run: 91.3M tokens, of which 74.4M were cache reads of the shared prompt and 300k were output; readers averaged 105k tokens and about two minutes, skeptics 97k and about 90 seconds.

## Ledger: core (34)

- 1.c1 [S1,S2,S3] (distiller, +0 -0): Subagents share the container (files, HTTPS_PROXY, checkouts, branch, HEAD); only context windows are separate.
- 1.c2 [S3] (distiller, +0 -0): Sharing explains the shared search budget and concurrency cap.
- 1.c3 [S3] (distiller, +0 -0): Agents can write directly into the repo for the main loop to commit.
- 1.c4 [S4] (distiller, +0 -0): Agent tool `isolation: "worktree"` and `isolation: "remote"` are the exceptions to sharing.
- 1.c5 [S5] (distiller, +0 -0): Agent concurrency caps at 20; larger dispatches partially fail with `Concurrent subagent limit reached`.
- 1.c6 [S5] (distiller, +0 -0): Raise the cap with `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`.
- 1.c7 [S6] (distiller, +0 -0): Cap's real cost is a silent drop: a rostered item never dispatched successfully never reports.
- 1.c8 [S7,S8] (distiller, +0 -0): Reconcile the roster against what launched, not what was dispatched; `ListAgents` settles it in one call.
- 1.c9 [S9] (distiller, +0 -0): Workflow cap is min(16, CPUs minus 2) per run (measured 2026-09-06).
- 1.c10 [S9] (distiller, +0 -0): This container reports 4 CPUs (`nproc`): Workflow would run two agents at a time.
- 1.c11 [S9,S10] (distiller, +0 -0): Read `nproc` before choosing a fan-out venue; here the Agent tool (20) beats Workflow tenfold.
- 1.c12 [S11] (distiller, +0 -0): Measurements below come from one run of 124 agents, 17 minutes at the cap.
- 1.c13 [S12,S13] (distiller, +0 -0): Agent tool has no effort parameter (only Workflow's `agent()` does); a low-effort instruction must go in the prompt.
- 1.c14 [S14] (distiller, +0 -0): Output on disk is not agent done: the agent holds its slot until it returns.
- 1.c15 [S14] (distiller, +0 -0): A ledger kept from file arrivals overcounts free slots by one or two.
- 1.c16 [S14,S15] (distiller, +0 -0): A refused launch is cheap: count slots with `ListAgents` and relaunch.
- 1.c17 [S16] (distiller, +0 -0): Prompt-named validator the agent runs on its own output made 124 of 124 outputs parse and conform.
- 1.c18 [S17] (distiller, +0 -0): The validator is the Agent-tool equivalent of Workflow's `schema` option, and it is committed.
- 1.c19 [S18] (distiller, +0 -0): Cost is in the transcripts: sum each line's `message.usage` block for the agent's spend, not the notification.
- 1.c20 [S19] (distiller, +0 -0): Run totals: 91.3M tokens, 74.4M cache reads of the shared prompt, 300k output.
- 1.c21 [S19] (distiller, +0 -0): Readers averaged 105k tokens and about two minutes; skeptics 97k and about 90 seconds.
- 1.c22 [S2,S3] (tactician, +0 -0): Subagents share the main loop's machine; only the context window is separate.
- 1.c23 [S3] (tactician, +0 -0): Shared search budget and concurrency cap follow; agents can write into the repo for the main loop to commit.
- 1.c24 [S4] (tactician, +0 -0): `Agent` tool `isolation: "worktree"` or `"remote"` opts out of sharing.
- 1.c25 [S5] (tactician, +0 -0): Agent tool caps at 20 subagents; `Concurrent subagent limit reached`; raise via `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`.
- 1.c26 [S6] (tactician, +0 -0): The cap also causes silent drops: rostered items never dispatched, so never reporting.
- 1.c27 [S7,S8] (tactician, +0 -0): Reconcile the roster against what launched, using `ListAgents`, not against dispatches.
- 1.c28 [S9,S10] (tactician, +0 -0): Workflow cap is min(16, CPUs minus 2); 4 CPUs here means two at a time (measured 2026-09-06).
- 1.c29 [S10] (tactician, +0 -0): Read `nproc` before choosing a fan-out venue; here the Agent tool wins.
- 1.c30 [S12,S13] (tactician, +0 -0): Agent tool has no effort parameter; a "low effort" instruction goes in the prompt.
- 1.c31 [S14,S15] (tactician, +0 -0): A finished output file does not free the slot; count with `ListAgents`, relaunch after refusal.
- 1.c32 [S16,S17] (tactician, +0 -0): A committed validator named in the prompt made 124 of 124 outputs conform; it is Workflow's `schema` equivalent.
- 1.c33 [S18] (tactician, +0 -0): Agent spend is the sum of each transcript line's `message.usage`, not the notification.
- 1.c34 [S19] (tactician, +0 -0): Run: 91.3M tokens, 74.4M cache reads, 300k output; readers 105k/2 min, skeptics 97k/90 s.

## Ledger: tactic (18)

- 1.t1 [S1] (drafter, +0 -0): Drop the heading's second clause; S3 already carries the budget point, saving about 4 words.
- 1.t2 [S3,S4] (drafter, +0 -0): Fold S3's claim into S2 and state the isolation exceptions as a trailing clause, dropping the repeated 'shared' framing, saving about 25 words.
- 1.t3 [S11,S12,S13] (drafter, +0 -0): Merge S12 and S13 into one bullet that states the fact and its consequence together, saving about 8 words.
- 1.t4 [S2,S3] (tactician, +0 -0): Merge: open with S3's bold claim (only the context window is separate), then S2's shared-items list as its evidence, and shrink S3's second sentence to a clause: 'so the search budget and concurrency cap are shared, and agents can write into the repo for the main loop to commit.' Removes 'That single fact explains', 'the shared' x2 and the S2 'reads a file the main loop just wrote and the reverse' lead. Saves about 18 words.
- 1.t5 [S2,S4] (tactician, +0 -0): Fold S4 into S2 as a qualifier: '... same checkouts, branch and HEAD, unless `Agent` is given `isolation: "worktree"` or `"remote"`.' S4's 'by default everything is shared' repeats S2 and goes. Saves about 8 words and removes a one-sentence unit.
- 1.t6 [S6,S7,S8] (tactician, +0 -0): Merge three units into one: 'The cap's cost is a **silent drop**: a rostered item never dispatched, so it never reports. Reconcile the roster against `ListAgents`, not against what was dispatched.' Cuts 'not the visible rejection', 'that was in the roster', 'and therefore', 'actually launched' and the S8 sentence frame. Saves about 22 words.
- 1.t7 [S5,S6,S7,S8,S9,S10,S14,S15] (tactician, +0 -0): Reorder: gather every cap item together as one bullet group under S5 (cap 20 and its error; silent drop plus reconcile; slot counting from S14-S15; Workflow's cap from S9-S10), instead of splitting them around the Workflow paragraph and the 124-agent list. S14-S15 are about the cap, so they move to where they are used. Net saving about 6 words, but it makes the next move possible.
- 1.t8 [S8,S15] (tactician, +0 -0): Conditional on the cap-group reorder: `ListAgents` is named in S8 and again in S15 ('is the count'). With S14 directly after the S6-S8 merge, state it once ('`ListAgents` counts running agents') and let S15 reduce to 'relaunch after a refusal'. Saves about 8 words.
- 1.t9 [S9,S10] (tactician, +0 -0): Merge: 'Workflow's cap is min(16, CPUs minus 2) per run *(measured 2026-09-06)*; this container reported 4 CPUs (`nproc`), so two at a time against the Agent tool's twenty. Read `nproc` before choosing a fan-out venue.' Drop 'per the authoring reference', 'is a different number, and it is a function of the machine' (the formula shows both), 'a Workflow would have run', and 'on this box the Agent tool wins by a factor of ten' (the 2-vs-20 comparison already says it). Saves about 25 words.
- 1.t10 [S11,S19] (tactician, +0 -0): Move S19's run totals up into S11's lead-in and drop 'That run:': 'From a run of 124 agents (17 minutes at the cap; 91.3M tokens, 74.4M of them cache reads of the shared prompt, 300k output):'. The per-role averages then ride with the cost bullet (S18). Saves about 6 words and puts the whole run in one place.
- 1.t11 [S12,S13] (tactician, +0 -0): Merge two units into one bullet: 'The Agent tool has no effort parameter (only Workflow's `agent()` takes one), so a "low effort" instruction travels in the prompt.' Saves about 6 words and removes a stranded one-line unit.
- 1.t12 [S16,S17] (tactician, +0 -0): Merge: 'A committed validator, one script named in the prompt and run by the agent on its own output before returning, made 124 of 124 outputs parse and conform; it stands in for Workflow's `schema` option.' Cuts 'It is the Agent-tool equivalent' and 'and it is committed' as a separate sentence. Saves about 8 words.
- 1.t13 [S18,S19] (tactician, +0 -0): Merge the cost bullet: 'Cost lives in the transcripts, not the notification: each line's `message.usage` block sums to the agent's spend; readers averaged 105k tokens and about two minutes, skeptics 97k and about 90 seconds.' Pairs with the S11/S19 move, which carries the run totals. Saves about 5 words.
- 1.t14 [S1] (tactician, +0 -0): Conditional on the S2-S3 merge keeping the budget clause: retitle to '## Subagents share the container'. 'not just the budget' is then said in the body. Saves 4 words.
- 1.t15 [S17] (tactician, +0 -0): Bold option: cut S17 whole and keep only 'Workflow's `schema` equivalent' as a five-word tail on S16. Saves about 8 words; loses only the remark that the validator is committed.
- 1.t16 [S19] (tactician, +0 -0): Bold option: reduce S19 to the totals alone (91.3M tokens, 74.4M cache reads, 300k output) and drop the per-role reader and skeptic averages as run-specific. Saves about 17 words; the reader loses the 105k/2 min and 97k/90 s planning figures.
- 1.t17 [ALL] (tactician, +0 -0): Reshape the whole passage from nineteen one-sentence units into three blocks: (1) a heading plus one short paragraph for sharing (S1-S4); (2) 'Concurrency' as a heading or bold lead with a four-bullet list for the 20 cap and error, silent drop and reconcile, slot counting, Workflow's cap and `nproc` (S5-S10, S14-S15); (3) 'From a 124-agent run' with a three-bullet list for effort-in-prompt, validator, cost (S11-S13, S16-S19). Bold lead-ins only on rules the reader acts on. The merges above then apply inside each block. Expected total about 270 words, saving about 135 of 408.
- 1.t18 [ALL] (tactician, +0 -0): Bolder: cut the passage's cause-and-effect narration everywhere and keep the imperative. Each bullet becomes rule plus its one number or name (cap 20; reconcile with `ListAgents`; Workflow min(16, CPUs minus 2); effort in prompt; validator; `message.usage`), with the because-clauses (S3's 'explains', S14's slot-overcount story, S9's 'would have run') shortened to a few words. Expected about 220 words, saving about 185, at the risk of the reader acting on a rule without knowing why.

## Ledger: draft (21)

- 1.d1 [S1,S2,S3,S4] (drafter, +0 -0): ## Subagents share the container

A subagent sees files the main loop wrote and the reverse: same hostname, boot, `HTTPS_PROXY`, user, checkouts, branch and HEAD. Only the context window is separate, which is why the search budget and concurrency cap are shared and agents can write straight into the repo for the main loop to commit. The `Agent` tool's `isolation: "worktree"` and `isolation: "remote"` are the exceptions.
- 1.d2 [S2,S3,S4] (drafter, +0 -0): A subagent reads a file the main loop just wrote and the reverse: same hostname, boot, `HTTPS_PROXY`, user, checkouts, branch and HEAD. **Only the context window is separate**, so the search budget and concurrency cap are shared and agents can write directly into the repo for the main loop to commit. `Agent`'s `isolation: "worktree"` and `isolation: "remote"` are the exceptions.
- 1.d3 [S2,S3,S4] (drafter, +0 -0): Subagents and the main loop share hostname, boot, `HTTPS_PROXY`, user, checkouts, branch and HEAD, so a file written by one is readable by the other, and agents can write into the repo for the main loop to commit. Only the context window is separate; the search budget and concurrency cap are shared. Exceptions: `Agent`'s `isolation: "worktree"` and `isolation: "remote"`.
- 1.d4 [S5,S6,S7,S8] (drafter, +0 -0): **Concurrency caps at 20 subagents.** Larger dispatches partially fail with `Concurrent subagent limit reached`, raisable with `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`. The real cost is a **silent drop**: a rostered item never dispatched successfully, so it never reports. Reconcile the roster against what launched, not what was dispatched; `ListAgents` settles it in one call.
- 1.d5 [S5,S6,S7,S8] (drafter, +0 -0): **Concurrency caps at 20 subagents**; larger dispatches partially fail with `Concurrent subagent limit reached` (raise with `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`). A rejected item that is never relaunched is a **silent drop**: it never reports. Reconcile the roster against what launched, never what was dispatched, with one `ListAgents` call.
- 1.d6 [S9,S10] (drafter, +0 -0): **The Workflow tool's cap is a function of the machine** *(measured 2026-09-06)*: min(16, CPUs minus 2) per run. This container reported 4 CPUs (`nproc`), so a Workflow would run two agents at a time against the Agent tool's twenty. Read `nproc` before choosing the venue for a fan-out; on this box the Agent tool wins tenfold.
- 1.d7 [S9,S10] (drafter, +0 -0): **The Workflow tool's cap depends on the machine** *(measured 2026-09-06)*: min(16, CPUs minus 2) per run. With 4 CPUs (`nproc`) here, that is two agents at a time against the Agent tool's twenty, so on this box the Agent tool wins by a factor of ten. Read `nproc` before choosing a fan-out venue.
- 1.d8 [S11,S12,S13] (drafter, +0 -0): From the same run of 124 agents (17 minutes at the cap):

- The Agent tool has no effort parameter (only Workflow's `agent()` takes one); a "low effort" instruction has to travel in the prompt.
- 1.d9 [S11,S12,S13] (drafter, +0 -0): From the same run of 124 agents (17 minutes at the cap):

- Only Workflow's `agent()` takes an effort parameter; for the Agent tool, say "low effort" in the prompt.
- 1.d10 [S14,S15] (drafter, +0 -0): - **Output on disk is not agent done.** An agent that has written its file and run a checker holds its slot until it returns, so a ledger kept from file arrivals overcounts free slots by one or two and the next launch is refused. `ListAgents` is the count; the refusal is cheap, so relaunch.
- 1.d11 [S14,S15] (drafter, +0 -0): - **Output on disk is not agent done.** An agent holds its slot until it returns, even after writing its file and running a checker, so counting file arrivals overcounts free slots by one or two and the next launch is refused. Count with `ListAgents`; relaunching after a refusal is cheap.
- 1.d12 [S16,S17] (drafter, +0 -0): - A validator the agent runs on its own output before returning, one script named in the prompt, made 124 of 124 outputs parse and conform. It is the Agent-tool equivalent of Workflow's `schema` option, and it is committed.
- 1.d13 [S16,S17] (drafter, +0 -0): - One committed validator script, named in the prompt and run by each agent on its own output before returning, made 124 of 124 outputs parse and conform: the Agent-tool equivalent of Workflow's `schema` option.
- 1.d14 [S18,S19] (drafter, +0 -0): - Cost lives in the transcripts, not the notification: each line's `message.usage` block sums to the agent's spend. That run: 91.3M tokens, 74.4M of them cache reads of the shared prompt and 300k output; readers averaged 105k tokens and about two minutes, skeptics 97k and about 90 seconds.
- 1.d15 [S18,S19] (drafter, +0 -0): - Cost is in the transcripts, not the notification: sum each line's `message.usage`. This run: 91.3M tokens (74.4M cache reads of the shared prompt, 300k output); readers averaged 105k tokens and about two minutes, skeptics 97k and about 90 seconds.
- 1.d16 [S2,S3,S4] (tactician, +0 -0): **Only the context window is separate.** A subagent and the main loop have the same hostname, boot, `HTTPS_PROXY`, user, checkouts, branch and HEAD, so each reads what the other writes, and the search budget and concurrency cap are shared. Agents can write straight into the repo for the main loop to commit. `Agent` with `isolation: "worktree"` or `"remote"` is the exception.
- 1.d17 [S6,S7,S8] (tactician, +0 -0): The cap's real cost is a **silent drop**: a rostered item never dispatched, so it never reports. Reconcile the roster against `ListAgents`, not against what was dispatched.
- 1.d18 [S9,S10] (tactician, +0 -0): **Workflow's cap is min(16, CPUs minus 2) per run** *(measured 2026-09-06)*; this container reported 4 CPUs (`nproc`), so two agents at a time against the Agent tool's twenty. Read `nproc` before choosing the venue for a fan-out.
- 1.d19 [S12,S13] (tactician, +0 -0): - The Agent tool has no effort parameter (only Workflow's `agent()` takes one), so a "low effort" instruction travels in the prompt.
- 1.d20 [S16,S17] (tactician, +0 -0): - A committed validator, one script named in the prompt and run by the agent on its own output before returning, made 124 of 124 outputs parse and conform; it stands in for Workflow's `schema` option.
- 1.d21 [ALL] (tactician, +0 -0): ## Subagents share the container

**Only the context window is separate.** A subagent and the main loop have the same hostname, boot, `HTTPS_PROXY`, user, checkouts, branch and HEAD, so each reads what the other writes, and the search budget and concurrency cap are shared. Agents can write straight into the repo for the main loop to commit. `Agent` with `isolation: "worktree"` or `"remote"` is the exception.

**Concurrency caps at 20 subagents.** Larger dispatches partially fail with `Concurrent subagent limit reached`, raisable with `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`.
- The real cost is a **silent drop**: a rostered item never dispatched, so it never reports. Reconcile the roster against `ListAgents`, not against what was dispatched.
- **Output on disk is not agent done.** An agent holds its slot until it returns, so a ledger kept from file arrivals overcounts free slots by one or two and the next launch is refused. `ListAgents` is the count; relaunch after a refusal.
- **Workflow's cap is min(16, CPUs minus 2) per run** *(measured 2026-09-06)*; this container reported 4 CPUs (`nproc`), so two agents at a time against the Agent tool's twenty. Read `nproc` before choosing the venue for a fan-out.

From a run of 124 agents (17 minutes at the cap; 91.3M tokens, 74.4M of them cache reads of the shared prompt, 300k output):
- The Agent tool has no effort parameter (only Workflow's `agent()` takes one), so a "low effort" instruction travels in the prompt.
- A committed validator, one script named in the prompt and run by the agent on its own output before returning, made 124 of 124 outputs parse and conform; it stands in for Workflow's `schema` option.
- Cost lives in the transcripts, not the notification: each line's `message.usage` block sums to the agent's spend. Readers averaged 105k tokens and about two minutes, skeptics 97k and about 90 seconds.

## Ledger: word (15)

- 1.w1 [S1] (drafter, +0 -0): ", not just the budget" -> ""
- 1.w2 [S2] (drafter, +0 -0): "same hostname, same boot, same `HTTPS_PROXY`, same user, same checkouts" -> "same hostname, boot, `HTTPS_PROXY`, user, checkouts"
- 1.w3 [S3] (drafter, +0 -0): "**What is separate is the context window, not the machine.** That single fact explains the shared search budget, the shared concurrency cap, and why agents can write" -> "**Only the context window is separate.** Hence the shared search budget, the shared concurrency cap, and why agents can write"
- 1.w4 [S6] (drafter, +0 -0): "The cap's real cost is not the visible rejection but a **silent drop**: an item that was in the roster, never dispatched successfully, and therefore never reports." -> "The cap's real cost is a **silent drop**: a rostered item never dispatched successfully, so it never reports."
- 1.w5 [S9] (drafter, +0 -0): "per the authoring reference, and this container reported 4 CPUs (`nproc`), so a Workflow would have run two agents" -> "and this container reported 4 CPUs (`nproc`), so a Workflow would run two agents"
- 1.w6 [S14] (drafter, +0 -0): "An agent that has written its file and run a checker still holds its slot until it returns" -> "An agent that has written its file and run a checker holds its slot until it returns"
- 1.w7 [S19] (drafter, +0 -0): "That run: " -> ""
- 1.w8 [S1] (tactician, +0 -0): ", not just the budget" -> ""
- 1.w9 [S6] (tactician, +0 -0): "The cap's real cost is not the visible rejection but a " -> "The cap's real cost is a "
- 1.w10 [S9] (tactician, +0 -0): ", per the authoring reference" -> ""
- 1.w11 [S10] (tactician, +0 -0): "; on this box the Agent tool wins by a factor of ten" -> "; here the Agent tool wins"
- 1.w12 [S11] (tactician, +0 -0): "From the same run of 124 agents (17 minutes at the cap):" -> "Same 124-agent run (17 minutes at the cap):"
- 1.w13 [S14] (tactician, +0 -0): "An agent that has written its file and run a checker still holds its slot" -> "An agent holds its slot"
- 1.w14 [S17] (tactician, +0 -0): "It is the Agent-tool equivalent of Workflow's `schema` option, and it is committed." -> "It is committed, and stands in for Workflow's `schema` option."
- 1.w15 [S19] (tactician, +0 -0): "That run: " -> ""

## Current best: round 1, 302 words, core 34/34

## Subagents share the container

**Only the context window is separate.** Subagents and the main loop share hostname, boot, `HTTPS_PROXY`, user, checkouts, branch and HEAD, so each reads what the other writes, and the search budget and concurrency cap are shared. Agents can write straight into the repo for the main loop to commit. `Agent` with `isolation: "worktree"` or `"remote"` is the exception.

**Concurrency caps at 20 subagents.** Larger dispatches partially fail with `Concurrent subagent limit reached`, raisable with `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`.
- The cap's real cost is a **silent drop**: a rostered item never dispatched, so it never reports. Reconcile the roster against what launched, not what was dispatched; `ListAgents` settles it.
- **Output on disk is not agent done.** An agent holds its slot until it returns, so counting file arrivals overcounts free slots by one or two and the next launch is refused. Count with `ListAgents`; a refusal is cheap, so relaunch.
- **Workflow's cap is min(16, CPUs minus 2) per run** *(measured 2026-09-06)*; this container reported 4 CPUs (`nproc`), so two agents at a time against the Agent tool's twenty. Read `nproc` before choosing a fan-out venue.

From a run of 124 agents (17 minutes at the cap; 91.3M tokens, 74.4M of them cache reads of the shared prompt, 300k output):
- The Agent tool has no effort parameter (only Workflow's `agent()` takes one), so a "low effort" instruction travels in the prompt.
- A committed validator script, named in the prompt and run by each agent on its own output before returning, made 124 of 124 outputs parse and conform; it stands in for Workflow's `schema` option.
- Cost lives in the transcripts, not the notification: each line's `message.usage` block sums to the agent's spend. Readers averaged 105k tokens and about two minutes, skeptics 97k and about 90 seconds.

Dropped units: none
