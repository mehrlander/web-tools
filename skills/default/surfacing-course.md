# The surfacing course

The guide-PR lifecycle: the PR body as a workstream's running record, and the phases it moves
through. [SURFACING.md](SURFACING.md) holds the primitives and is injected into every session;
this file is not, and is delivered by the `pr-subscribe-hint` hook at the moment a PR is opened,
which is when the course first applies.

## The two modes: GitHub flow and Real-time

We operate in two modes:

* **GitHub flow (Branch & PR):** The standard route for code, tooling, features, and documentation. Changes live on a branch, follow the PR guide lifecycle below, and merge via pull request.
* **Real-time (Direct to `main`):** For shared state that concurrent sessions and tools rely on as live truth: task trackers, personal capture lists, session telemetry, and crawl caches. These commit straight to `main` and push to GitHub as you go so everyone stays synchronized in real time. See [direct-to-main.csv](direct-to-main.csv) for the registry of writers and paths.

## Assistant identity and attribution

Four AI assistants contribute across this ecosystem. Each assistant identifies its work using its dedicated branch prefix and commit attribution so the Web Tools Activity view and automated crawlers can classify work accurately:

| Assistant | Branch Prefix | Commit Signature / Trailer | Notes |
| :--- | :--- | :--- | :--- |
| **Claude** | `claude/<slug>` | `Claude-Session: <url>` | Automated by Claude Code harness |
| **Codex** | `codex/<slug>` | `Co-Authored-By: Codex <codex@openai.com>` | Requested 2026-09-20; Codex commits carried no trailer before then, so the prefix was the only signal |
| **Gemini** | `gemini/<slug>` | `Co-Authored-By: Gemini <gemini@google.com>` | Include trailer on all commits |
| **Grok** | `grok/<slug>` | `Signed: Chief of Staff (Grok)` | Include signature on all commits |

A commit or branch that carries no assistant prefix or trailer is **unclassified**, not human. Read as human, it stated a finding the classifier never made: on 2026-09-18 four Gemini branches went out without the prefix and the Activity view reported them as a person's work. A branch that predates this table, or went out without its prefix, is declared by a row in [assistant-branches.csv](assistant-branches.csv) with the basis for the claim; the Activity view reads declarations only and guesses nothing.

Two rules hold for every assistant, whichever tool it runs in:

* **Preflight before a pull request.** In web-tools, `npm run preflight` (checkout setup, the derived-artifact refresh, then the suite). In home, `python3 tools/lint-conventions.py` and `bash tools/verify-artifacts.sh`. Twelve of fifteen Gemini branches in September 2026 ended red on the derived-artifact gate because the commit hook never ran in their checkout; the failing check names the command that repairs it. A red check is not mergeable, whoever opened the PR.
* **Batch output is a run, not a PR against the documents.** An overnight pass that proposes changes across many documents lands in home as a run under `projects/text/runs/<date>-<name>/`, where the Text collection admits it as proposals. It never opens a pull request that edits the documents it proposes changes to.

Maintain the PR body as the workstream's current state and durable record. Open a draft PR on the first push.
Body sync is manual: after each push that materially changes state, rewrite the guide region
through this course. No hook or CI keeps it synchronized.

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
