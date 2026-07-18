# Board

_Generated from tasks/. Do not hand-edit._

## On deck
- Private-repo landing federation via the home registry next: co-design the home manifest schema once the integrated landing page lands
- Repo-level GitHub links in show-repo's shield dialog
- Integrate the stage with the surfacer's .surface format next: run in a session with both web-tools and the home repo, to read the surfacer's .surface files directly
- Backfill guide regions into old PR bodies and full-regenerate the merge guide
- Give show-repo the ability to edit a repo's .web-tools.json (`claude/skills-portable-conventions-8x1lua`) next: design a minimal config-edit surface in the show-repo shell; first use is a one-tap migrate of a legacy .show-repo.json to .web-tools.json
- Session-start nudge for unconfigured or legacy-manifest repos (`claude/skills-portable-conventions-8x1lua`) next: write a global SessionStart hook that checks repo state and injects a nudge; wire its install into the Claude Code web account setup script
- Repo-designated inbox and outbox in .web-tools.json (`claude/pr-219-review-22csrh`)
- Spike the snags log (friction learned the hard way) (`claude/pr-219-review-22csrh`)
- Collapse quickLinks into a projection of the repos manifest next: decide the projection rule (a flag on repos entries, or first-N) and migrate loadQuickLinks
- Estate activity signals from a registry activity cache next: design state/activity.json (recent commits, branches, PRs per repo) and the estate freshness treatment that reads it
- Finish GitHub jump-over coverage across show-repo views next: sweep the remaining views (stage rows, atlas, recent panel, compare) for missing one-tap GitHub links
- Update estate tests to the groupSections layout
- Converge the stage and surface item schemas

## In progress
- Singleton fab with toss-render integration (`claude/fab-render-toss-render-ua6p3p`) next: implement the stamp, guard, subject adoption, and file-scoped branch list

## Blocked
- (none)

## Done
- Stand up the project tracker (`claude/tracker-concept-assessment-yto1m1`)
- Automate the merge guide from PR bodies (`claude/task-tracker-discussion-wg27xv`)
- Speed up show-repo's cold load (`claude/speed-up-show-repo-load-3cdvl0`)
- Stage links and the main-area explorer in show-repo (`claude/task-tracker-discussion-wg27xv`)
- Extract drop-zone as a reusable Alpine component (`claude/tracker-summary-nu74te`)
- Add a task-tracker skill (`claude/agent-file-retrieval-skill-tv4can`)
- Build an agent-assisted file-retrieval skill (`claude/agent-file-retrieval-skill-tv4can`) next: build corpus_search.py (find) with a sources config and a file-per-document default, plus read_doc.py (read) and a SKILL.md that fixes the search-and-present flow; dogfood on this repo's content
- Branch-review view in show-repo (`claude/web-tools-branch-tracking-n1zawm`) next: session refreshes (show-repo thumbnail) at wrap-up, then review via PR #236
- History-safe shim for toss-render address-mode renders next: done; hash-routing pages now switch views inside toss #gh= renders
- Render files over 1 MB in toss-render and the shell viewers next: done — raw media type with git-blobs fallback landed in toss-render (ghText, showAddress, fetchShim) and gh-api.js get(); A/B headless test confirms the 5.9 MB DRS bundle is delivered where the old path returned blank
- Structural response decode + differentiated errors in toss-render next: done; renders survive every media-type labeling and the error panel names the failing stage
