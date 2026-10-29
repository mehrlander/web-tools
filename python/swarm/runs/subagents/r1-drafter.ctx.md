# Reduction swarm: round 1, role drafter

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
`builds_on` is optional and lists the entry ids an entry extends. Before
returning, run the check command named below and fix every line it reports.

## Your role: drafter

Write `draft` entries for runs of consecutive units, and `word` entries for
phrase swaps. Cover every unit at least once, with a draft or with a tactic's
cut. Where two drafts compete for the same units, write both.

## Paths

- Output: `/home/user/web-tools/python/swarm/runs/subagents/r1-drafter.jsonl`
- Check: `python3 /home/user/web-tools/python/swarm/swarm.py check /home/user/web-tools/python/swarm/runs/subagents /home/user/web-tools/python/swarm/runs/subagents/r1-drafter.jsonl`

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
