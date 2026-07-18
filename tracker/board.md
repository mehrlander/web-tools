# Board

_Generated from tasks/. Do not hand-edit._

## On deck
- 🎫 App views - designate a page as an estate-level view next: add appView/viewLabel to a pages entry; collect app views across configs via the config cache, the quickLink sibling; render live via toss-render #gh=
- 🎫 Backfill guide regions into old PR bodies and full-regenerate the merge guide
- 🎫 Collapse quickLinks into a projection of the repos manifest next: decide the projection rule (a flag on repos entries, or first-N) and migrate loadQuickLinks
- 🎫 Estate activity signals from a registry activity cache next: design state/activity.json (recent commits, branches, PRs per repo) and the estate freshness treatment that reads it
- 🎫 Update estate tests to the groupSections layout
- 🎫 Generalize the gallery to a per-repo pages catalog next: add a pages field to .web-tools.json and branch landingKind() on it; render tiles live via toss-render #gh= (no committed thumbs for private repos)
- 🎫 Finish GitHub jump-over coverage across show-repo views next: sweep the remaining views (stage rows, atlas, recent panel, compare) for missing one-tap GitHub links
- 🎫 Integrate the stage with the surfacer's .surface format next: run in a session with both web-tools and the home repo, to read the surfacer's .surface files directly
- 🎫 Private-repo landing federation via the home registry next: superseded by tasks generalize-gallery-pages-catalog-m3b8pa (gallery generalization) and app-views-estate-level-btp6m4 (app views); reassess whether any federation-specific work remains
- 🎫 Repo-designated inbox and outbox in .web-tools.json (`claude/pr-219-review-22csrh`)
- 🎫 Repo-level GitHub links in show-repo's shield dialog
- 🎫 Session-start nudge for unconfigured or legacy-manifest repos (`claude/skills-portable-conventions-8x1lua`) next: write a global SessionStart hook that checks repo state and injects a nudge; wire its install into the Claude Code web account setup script
- 🎫 Give show-repo the ability to edit a repo's .web-tools.json (`claude/skills-portable-conventions-8x1lua`) next: design a minimal config-edit surface in the show-repo shell; first use is a one-tap migrate of a legacy .show-repo.json to .web-tools.json
- 🎫 Spike the snags log (friction learned the hard way) (`claude/pr-219-review-22csrh`)
- 🎫 Converge the stage and surface item schemas

## In progress
- 🎫 Singleton fab with toss-render integration (`claude/fab-render-toss-render-ua6p3p`) next: live-confirm branchesForPath (GraphQL Commit.file) with a token, then wrap up PR #241

## Blocked
- (none)

## Done
- 🎫 Add a task-tracker skill (`claude/agent-file-retrieval-skill-tv4can`)
- 🎫 Build an agent-assisted file-retrieval skill (`claude/agent-file-retrieval-skill-tv4can`) next: build corpus_search.py (find) with a sources config and a file-per-document default, plus read_doc.py (read) and a SKILL.md that fixes the search-and-present flow; dogfood on this repo's content
- 🎫 Automate the merge guide from PR bodies (`claude/task-tracker-discussion-wg27xv`)
- 🎫 Branch-review view in show-repo (`claude/web-tools-branch-tracking-n1zawm`) next: session refreshes (show-repo thumbnail) at wrap-up, then review via PR #236
- 🎫 Extract drop-zone as a reusable Alpine component (`claude/tracker-summary-nu74te`)
- 🎫 History-safe shim for toss-render address-mode renders next: done; hash-routing pages now switch views inside toss #gh= renders
- 🎫 Render files over 1 MB in toss-render and the shell viewers next: done — raw media type with git-blobs fallback landed in toss-render (ghText, showAddress, fetchShim) and gh-api.js get(); A/B headless test confirms the 5.9 MB DRS bundle is delivered where the old path returned blank
- 🎫 Speed up show-repo's cold load (`claude/speed-up-show-repo-load-3cdvl0`)
- 🎫 Stage links and the main-area explorer in show-repo (`claude/task-tracker-discussion-wg27xv`)
- 🎫 Stand up the project tracker (`claude/tracker-concept-assessment-yto1m1`)
- 🎫 Structural response decode + differentiated errors in toss-render next: done; renders survive every media-type labeling and the error panel names the failing stage
