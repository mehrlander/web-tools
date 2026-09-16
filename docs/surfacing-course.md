# The surfacing course

The guide-PR lifecycle: the PR body as a workstream's running record, and the phases it moves
through. [SURFACING.md](SURFACING.md) holds the primitives and is injected into every session;
this file is not, and is delivered by the `pr-subscribe-hint` hook at the moment a PR is opened,
which is when the course first applies.

Maintain the PR body as the workstream's current state and durable record. Open a draft PR on the first push.

## PR template

The guide region is bounded by `[//]: # (guide)` and `[//]: # (/guide)`. These are link labels rather than HTML comments, which the GitHub MCP strips on readback. Read either form and emit this one.

```markdown
## What this PR does
<One sentence stating the resulting capability.>
## Why this branch exists
<The motivating problem, user goal, and context needed to resume. Use plain prose,
plain paths, no link triplets, and render links for pages.>
## Open threads
1. 🟢 **<title>**: <current state and next step>
2. 🟡 **<title>**: <dependency>
3. ✅ **<title>**: <decision or result>
Use "0. None." when nothing remains.
## Risk
<Uncertainty, failing check, stale assumption, or "None.">
---
🌿 [Open the branch](<branch URL>) · 🥏 [Live page](<render URL>) · 🧭 [PR #N](<PR URL>)
```

## Content and automation

* Keep the guide region below about 250 lines.
* Do not list files, diff statistics, or CI results there.
* Put session context that belongs nowhere else in the guide or a PR comment, never in a tracker task.
* Make ✴️ asks in the reply and copy them into the PR body.
* Update the guide after every push that materially changes state, rewriting only between the markers with `update_pull_request`. Verify URLs first with `python3 scripts/mcp-link-safe.py --check body.md`.
* Ask binary decisions as **Question?** Yes / No, followed by the recommendation and consequence.
* Do not create your own action item. If automation can perform it, do it now; if only the user can, make it ✴️.
* Correct discovered facts immediately.
* Add a new thread, choice, or risk before continuing work on a new fork.
* Close threads as implemented or declined. Retain resolved decisions only when marked resolved.
* Rewrite stale PR-body narrative; do not treat it as authority.
* Merge current-branch changes from tool or agent updates, including subagent handoffs, before updating the guide.

## Lifecycle

Each phase begins only on the user's word.

1. **Plan.** State the recommendation, options, and risks. End 🆚.
2. **Apply.** Implement the chosen scope, update the guide and template, open a draft PR, and push. Wait for the checks the push started; do not close while they run. Continue until 🟢.
3. **Review.** Apply requested changes as they arrive. Propose merge only after confirming that no blocker, risk, or choice remains.
4. **Wrap.** After explicit agreement to wrap: inspect view, checks, and comments; resolve actionable failures and report external failures; sync the guide, commit, and push; stop before merge.
5. **Merge.** After an explicit merge request, merge and wait for the merge event before announcing it. Reply 🟣. If this was the last workstream, immediately follow with ⚫.
6. **Abandon.** After an explicit request, close the PR unmerged and reply 🔴.

Merging ends the branch. Open a new PR for further edits.
