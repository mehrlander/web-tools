# docs

<!-- GENERATED from docs/docs.csv by tools/build/docs-readme.mjs; do not hand-edit. -->

Reference docs that don't belong at the repo root. This index is generated
from [`docs.csv`](docs.csv), the documentation registry, which also renders
live in [the Web Tools app's Map → Docs → Inventory](https://mehrlander.github.io/web-tools/app/?view=map&tab=docs).
A **record** preserves a moment and is
corrected by markers, never rewritten; a **measured** doc carries dated
observations and is corrected by re-probing; everything else is living and
must stay correct.

**Reach** (derived by `tools/build/docs-reach.mjs`, gated against the registry):
2 arrive in every session's context, 19 are named by CLAUDE.md,
12 by a skill, 28 by a page or component. The remaining 77 are
marked *(orphan)* below: nothing points at them except this index.

## docs/

- [`APP.md`](APP.md) — the Web Tools app: mission, durable goals, and the name split
- [`CONSTELLATION.md`](CONSTELLATION.md) — the portable kernel of the what-goes-where doctrine
- [`HTML-STYLE.md`](HTML-STYLE.md) — a pointer to the house style, kept for the names the style guide is asked for: the rules themselves moved into the daisy-alpine skill on 2026-08-31, where they fire on page work unprompted, and the mechanics beside it
- [`MARKETPLACE.md`](MARKETPLACE.md) — the plugin marketplace: how the set is published and subscribed to
- [`QUALIFIED-WRITING.md`](QUALIFIED-WRITING.md) — the prose rules: qualify noun phrases, introduce before you refer, no em dashes
- [`README.md`](README.md) — the docs folder's front door: the generated index of this registry
- [`SNAGS.md`](SNAGS.md) — the friction log: one line per snag, symptom then corrected move
- [`SURFACING.md`](SURFACING.md) — the surfacing primitives: the chat-handoff mechanics every reply uses
- [`TRACKER.md`](TRACKER.md) — the opt-in cross-session project tracker: schema, ids, board
- [`aims-initiatives.csv`](aims-initiatives.csv) — the five strategic initiatives the estate is pursuing
- [`aims-goals.csv`](aims-goals.csv) — the five goals the estate's material is held to
- [`aims-reading.csv`](aims-reading.csv) — the guided reading list Docs/Purpose offers a new reader
- [`aims.json`](aims.json) — the mission sentence the estate's material serves; its goals and reading list moved to the two aims CSVs
- [`app-routes.csv`](app-routes.csv) — the app's own destinations: every address, what it is for, and which files draw it
- [`artifacts.md`](artifacts.md) *(orphan)* — Claude Code artifacts and the link-choice matrix
- [`branch-overlay.md`](branch-overlay.md) *(orphan)* — the branch overlay: the takeover, file substitution, the sidebar's second ref, and drop-on-a-branch
- [`code-layers.md`](code-layers.md) — the code layers and the admission rule that sorts a new file into one of them
- [`column-primitives.md`](column-primitives.md) *(orphan)* — the column primitives: what kind of thing a column holds (id, label, locator, value), the role axis and its crossing with position
- [`delivery.json`](delivery.json) *(measured)* — historical snapshots of the retired injection routes and an unshipped proposal; current content routes are in Map / Harness / Context
- [`doc-growth.md`](doc-growth.md) *(orphan)* — the doc-growth chart: what it plots, how to point it at a repo, and the traps that make it lie
- [`docs.csv`](docs.csv) — the documentation registry: what each file under docs/ is, on four axes
- [`estate-span.md`](estate-span.md) *(measured)* — what the hub knows about the rest of the estate: the outbound/inbound asymmetry, the three shapes a governed area takes, and the 2026-08-20 measurement behind the span column
- [`harness.csv`](harness.csv) — the harness registry: every tools/ and scripts/ file, its role, and how it is invoked
- [`headless-vendoring.md`](headless-vendoring.md) *(orphan)* — building with CDN libraries and rendering headless where the CDNs are blocked
- [`inbound.md`](inbound.md) *(measured)* — the inbound map: how work reaches a session, the push-versus-pull split across the estate's channels, and the one channel an outside agent can reach
- [`ios-haptics.md`](ios-haptics.md) *(orphan)* — whether a web page can fire iPhone haptics on its own gesture: measured, and no
- [`ios-sheet-drags.md`](ios-sheet-drags.md) — why a drag inside a sheet-presented in-app browser dismisses the sheet, and the two fixes, measured on device
- [`kits.csv`](kits.csv) — the kits registry: every module on the kit shelf, its namespace, its own headline, and who loads it
- [`loader.md`](loader.md) — the loader contract: the canonical head block, gh.load, timing rules, and the load-build duality
- [`manifest-fields.csv`](manifest-fields.csv) — the field registry for root .web-tools.json: every key's type, consumer, and effect
- [`manifest.md`](manifest.md) — the .web-tools.json manifest: the file's contract and the registry machinery (config cache, errands, proposals, editing from the shell)
- [`markdown-in-chat.md`](markdown-in-chat.md) *(measured)* — working visually with markdown in a chat client on a phone
- [`owners.csv`](owners.csv) — for a statement the coordination layer repeats, its one authoritative file
- [`pdf-structure.md`](pdf-structure.md) *(orphan)* — recovering structure from a PDF in the browser: what the kit does and honestly does not
- [`portable.csv`](portable.csv) — the portable set: what travels to another repo, and how a consumer takes it
- [`powershell-workspace.md`](powershell-workspace.md) *(orphan)* — the PowerShell Code workspace: exact browser drafts, pinned GitHub source, deliberate publication and installation handoff
- [`properties.csv`](properties.csv) — every column of every registry: what it means, how it arises, and what it may hold
- [`registries.csv`](registries.csv) — every registry the estate declares: its file, target, scope, and gate
- [`registries.md`](registries.md) — the registry model: targets, keys, identity spaces, properties, assertions; one owner per assertion; how to add a registry and what the suite checks
- [`repetitions.csv`](repetitions.csv) — where each registered statement is said again, how it relates, and what holds it
- [`routes-kinds.csv`](routes-kinds.csv) — the content kinds: what a subject is, what opens it, and what a note can aim at inside it
- [`routes-modes.csv`](routes-modes.csv) — the delivery modes toss-render accepts, and the trust posture each buys
- [`routes-paste.csv`](routes-paste.csv) — what a paste becomes on each surface that reads the clipboard, and what each one declines to
- [`routes-routes.csv`](routes-routes.csv) — the toss routes: which content type opens in which renderer page
- [`routes.json`](routes.json) — what is left of the transport manifest once its three tables became CSVs: the address grammar, the parameter precedence, and the showing frame
- [`show-repo.md`](show-repo.md) — the show-repo shell: routing, chrome, shared gestures, transfer and boundaries
- [`showing-mechanisms.csv`](showing-mechanisms.csv) — which link reaches which kind of change, and what each one silently misses
- [`showing.md`](showing.md) — why the showing boundaries sit where they are: the frame and the record behind routes.json
- [`snags.csv`](snags.csv) *(orphan)* — every snag SNAGS.md records: its slug, one-line symptom, sightings and the doc carrying the fix
- [`stage.md`](stage.md) — the stage: bench and Saved, intake, the walkable preview and diff, Out, save-as-surface, and the #stage= link grammar
- [`surfacing-course.md`](surfacing-course.md) — the guide-PR lifecycle: the PR body as a workstream’s running record, its template, and the six phases
- [`surfacing-extended.md`](surfacing-extended.md) — the ways of handing something over that most replies never reach: the artifact, stage, envelope, data, clipboard and shortcut routes, the task marker, the review link, the session diff, and the caption's fallbacks
- [`surfacing.csv`](surfacing.csv) — the gated index of the surfacing primitives SURFACING.md defines
- [`tests.csv`](tests.csv) — the test registry: every check, its kind, and what breaks if it is deleted
- [`text-content.md`](text-content.md) *(measured, orphan)* — the estate's authored text: whether the data files holding it are organized, and how much never reached one
- [`text-fields.csv`](text-fields.csv) — the names a prose-bearing CSV column or JSON key may take
- [`text-tools.md`](text-tools.md) *(orphan)* — the FAB's Text tab: why it exists, why the join is the path rather than a term, and an assessment of what it is not
- [`themes.csv`](themes.csv) *(measured)* — the duplication graph as committed data: every pair of markdown files sharing at least three ten-word windows, weighted, with the repeated passages themselves. Clusters of it are the Map view's themes, and which clusters exist is a function of the weight threshold, so the payload carries every edge and the reader carries the dial
- [`tools.csv`](tools.csv) — which pages the Tools view shows, and the icon each is given
- [`venues.md`](venues.md) *(measured)* — the venue map: where work can run besides the session reading it, what each reaches, and the attended-versus-unattended split
- [`vocabularies.csv`](vocabularies.csv) — what each value of a closed domain means, one row per value
- [`direct-to-main.csv`](direct-to-main.csv) *(orphan)* — the writers that commit straight to main, and the paths each one owns
- [`assistant-branches.csv`](assistant-branches.csv) — branches whose author is declared by a row, not read off a prefix or trailer, with the basis for each claim
- [`subjects.csv`](subjects.csv) — the object types: what is on screen, what carries each, and how the address gives it away
- [`DOC_CRAFT_STUDY.md`](DOC_CRAFT_STUDY.md) *(record, orphan)* — historical investigation of documentation problems and superseded drafting proposals
- [`annotation.md`](annotation.md) — annotating a document: the standoff format, the audit page, the pass, and the edit rules, for any vocabulary
- [`run-methods.csv`](run-methods.csv) *(orphan)* — how a person runs an errand's script: the venues each method allows and how its output returns

## docs/doc-craft-specimens/

- [`2026-09-08-naming-split.md`](doc-craft-specimens/2026-09-08-naming-split.md) *(record, orphan)* — a specimen from the doc-craft study: APP.md's naming-split history recast as a dated record
- [`APP_living_spec_replacement.md`](doc-craft-specimens/APP_living_spec_replacement.md) *(record, orphan)* — a specimen from the doc-craft study: APP.md rewritten as a living spec, not adopted

## docs/envelopes/

- [`README.md`](envelopes/README.md) *(orphan)* — the content-envelope family: members, shared grammar, and the sibling decision
- [`chat-results.md`](envelopes/chat-results.md) — the chat-results envelope contract
- [`data-view.md`](envelopes/data-view.md) *(orphan)* — the data-view envelope contract
- [`shorter.md`](envelopes/shorter.md) — the shorter envelope contract: a document and a shortening to adjudicate
- [`surface.md`](envelopes/surface.md) *(orphan)* — the surface format contract
- [`workbook-extract.md`](envelopes/workbook-extract.md) *(orphan)* — the workbook-extract envelope contract: sheet readings and individual modeled objects
- [`approval.md`](envelopes/approval.md) — the approval envelope: a surface that asks for a decision, and the verdict a commit gate resolves

## docs/envelopes/schemas/

- [`surface-v2.schema.json`](envelopes/schemas/surface-v2.schema.json) *(orphan)* — the surface v2 JSON Schema
- [`workbook-extract-v1.schema.json`](envelopes/schemas/workbook-extract-v1.schema.json) *(orphan)* — the workbook-extract v1 JSON Schema
- [`workbook-extract-v2.schema.json`](envelopes/schemas/workbook-extract-v2.schema.json) *(orphan)* — the workbook-extract v2 JSON Schema for independent sheet and object choices

## docs/envelopes/schemas/profiles/

- [`branch-review-v1.schema.json`](envelopes/schemas/profiles/branch-review-v1.schema.json) *(orphan)* — the branch-review profile schema
- [`inquiry-v1.schema.json`](envelopes/schemas/profiles/inquiry-v1.schema.json) *(orphan)* — the inquiry profile schema
- [`stage-v1.schema.json`](envelopes/schemas/profiles/stage-v1.schema.json) *(orphan)* — the stage profile schema
- [`approval-v1.schema.json`](envelopes/schemas/profiles/approval-v1.schema.json) *(orphan)* — the approval profile schema

## docs/environment/

- [`README.md`](environment/README.md) *(orphan)* — the environment docs' front door, and their update discipline
- [`capabilities.md`](environment/capabilities.md) *(measured)* — what the sandbox can run and reach
- [`container.md`](environment/container.md) *(measured)* — what the box is and what persists across sessions
- [`extending.md`](environment/extending.md) — the Claude Code component model and the hooks this repo runs
- [`testing.md`](environment/testing.md) *(measured)* — how to test HTML and JS in the sandbox

## docs/favicons/

- [`README.md`](favicons/README.md) *(orphan)* — the favicon archive: active marks and retired ones

## docs/forms/

- [`branch.md`](forms/branch.md) *(orphan)* — the branch form: the landed and stranded math behind a branch, and where the branch takeover is documented
- [`session.md`](forms/session.md) *(orphan)* — the session form: one session read as a conversation in the deck, and its page

## docs/github/

- [`README.md`](github/README.md) *(orphan)* — the github folder's front door: renderer, git treatment, MCP routing, surfacing
- [`github-surfacing.md`](github/github-surfacing.md) — GitHub-native surfaces for exposing work: branches, compares, drafts, permalinks
- [`markdown.md`](github/markdown.md) *(orphan)* — what GitHub's static renderer turns markdown into
- [`mcp-server-routing.md`](github/mcp-server-routing.md) *(record, orphan)* — two GitHub MCP servers at once: the 2026-07-15 observation, superseded
- [`mcp.md`](github/mcp.md) *(measured, orphan)* — what the MCP layer does to a call and to the text it carries: which server answers, the 150-character write threshold, the HTML-stripping readback
- [`post-merge-branch-mutation.md`](github/post-merge-branch-mutation.md) *(orphan)* — why a merged branch stops being a live workspace: merged means closed

## docs/research/excel-validation-2026-09-24/

- [`README.md`](research/excel-validation-2026-09-24/README.md) *(record, orphan)* — entry point to the September 24 native Excel validation research and frozen evidence

## docs/research/excel-validation-2026-09-24/source/

- [`browser-evidence.json`](research/excel-validation-2026-09-24/source/browser-evidence.json) *(record, orphan)* — dated Excel validation evidence or result: browser-evidence.json
- [`results.md`](research/excel-validation-2026-09-24/source/results.md) *(record, orphan)* — dated Excel validation evidence or result: results.md
- [`roundtrip-chart-browser-evidence.json`](research/excel-validation-2026-09-24/source/roundtrip-chart-browser-evidence.json) *(record, orphan)* — dated Excel validation evidence or result: roundtrip-chart-browser-evidence.json
- [`roundtrip-chart-browser-results.md`](research/excel-validation-2026-09-24/source/roundtrip-chart-browser-results.md) *(record, orphan)* — dated Excel validation evidence or result: roundtrip-chart-browser-results.md
- [`roundtrip-evidence.json`](research/excel-validation-2026-09-24/source/roundtrip-evidence.json) *(record, orphan)* — dated Excel validation evidence or result: roundtrip-evidence.json
- [`roundtrip-live-evidence.json`](research/excel-validation-2026-09-24/source/roundtrip-live-evidence.json) *(record, orphan)* — dated Excel validation evidence or result: roundtrip-live-evidence.json
- [`roundtrip-results.md`](research/excel-validation-2026-09-24/source/roundtrip-results.md) *(record, orphan)* — dated Excel validation evidence or result: roundtrip-results.md

## docs/research/excel-validation-2026-09-24/source/charts/

- [`chart-manifest.json`](research/excel-validation-2026-09-24/source/charts/chart-manifest.json) *(record, orphan)* — dated Excel validation evidence or result: charts/chart-manifest.json
- [`column-measurements.json`](research/excel-validation-2026-09-24/source/charts/column-measurements.json) *(record, orphan)* — dated Excel validation evidence or result: charts/column-measurements.json
- [`native-preview-evidence.json`](research/excel-validation-2026-09-24/source/charts/native-preview-evidence.json) *(record, orphan)* — dated Excel validation evidence or result: charts/native-preview-evidence.json
- [`results.md`](research/excel-validation-2026-09-24/source/charts/results.md) *(record, orphan)* — dated Excel validation evidence or result: charts/results.md

## docs/research/excel-validation-2026-09-24/source/technical/

- [`evidence-manifest.json`](research/excel-validation-2026-09-24/source/technical/evidence-manifest.json) *(record, orphan)* — SHA-256 inventory of the frozen Excel research evidence files
- [`NATIVE-EXCEL-WORKFLOW.md`](research/excel-validation-2026-09-24/source/technical/NATIVE-EXCEL-WORKFLOW.md) *(record, orphan)* — observed Excel UI inspection and native chart export procedure with failure recovery
- [`package-facts.json`](research/excel-validation-2026-09-24/source/technical/package-facts.json) *(record, orphan)* — read-only package audit of pivot inputs, reconciliation formulas, and chart blank cache
- [`README.md`](research/excel-validation-2026-09-24/source/technical/README.md) *(record, orphan)* — native Excel and PR 791 findings, workbook semantics, chart measurements, and next experiments
- [`REPRODUCTION.md`](research/excel-validation-2026-09-24/source/technical/REPRODUCTION.md) *(record, orphan)* — reproduction instructions, script dependencies, output behavior, and assertion limits
- [`script-index.json`](research/excel-validation-2026-09-24/source/technical/script-index.json) *(record, orphan)* — original paths and hashes of preserved research scripts, sources, and skill files

## docs/research/excel-validation-2026-09-24/source/technical/history/

- [`browser-evidence.json`](research/excel-validation-2026-09-24/source/technical/history/browser-evidence.json) *(record, orphan)* — dated Excel validation evidence or result: technical/history/browser-evidence.json
- [`browser-failure.json`](research/excel-validation-2026-09-24/source/technical/history/browser-failure.json) *(record, orphan)* — dated Excel validation evidence or result: technical/history/browser-failure.json
- [`capabilities.json`](research/excel-validation-2026-09-24/source/technical/history/capabilities.json) *(record, orphan)* — dated Excel validation evidence or result: technical/history/capabilities.json
- [`package-inventory.json`](research/excel-validation-2026-09-24/source/technical/history/package-inventory.json) *(record, orphan)* — dated Excel validation evidence or result: technical/history/package-inventory.json

## docs/research/excel-validation-2026-09-24/source/technical/history/chart-fixture/

- [`artifact-attempt-evidence.json`](research/excel-validation-2026-09-24/source/technical/history/chart-fixture/artifact-attempt-evidence.json) *(record, orphan)* — dated Excel validation evidence or result: technical/history/chart-fixture/artifact-attempt-evidence.json
- [`specification.json`](research/excel-validation-2026-09-24/source/technical/history/chart-fixture/specification.json) *(record, orphan)* — dated Excel validation evidence or result: technical/history/chart-fixture/specification.json

## docs/research/excel-validation-2026-09-24/source/technical/skill/

- [`SKILL.md`](research/excel-validation-2026-09-24/source/technical/skill/SKILL.md) *(record, orphan)* — historical validate-excel skill reference: technical/skill/SKILL.md

## docs/research/excel-validation-2026-09-24/source/technical/skill/references/

- [`local-evidence.md`](research/excel-validation-2026-09-24/source/technical/skill/references/local-evidence.md) *(record, orphan)* — historical validate-excel skill reference: technical/skill/references/local-evidence.md
- [`validation-cases.md`](research/excel-validation-2026-09-24/source/technical/skill/references/validation-cases.md) *(record, orphan)* — historical validate-excel skill reference: technical/skill/references/validation-cases.md
- [`windows-routes.md`](research/excel-validation-2026-09-24/source/technical/skill/references/windows-routes.md) *(record, orphan)* — historical validate-excel skill reference: technical/skill/references/windows-routes.md

## docs/research/excel-validation-2026-09-24/source/technical/source-cache/pr791-review/

- [`CLAUDE.md`](research/excel-validation-2026-09-24/source/technical/source-cache/pr791-review/CLAUDE.md) *(record, orphan)* — historical script/source reference: technical/source-cache/pr791-review/CLAUDE.md
- [`package.json`](research/excel-validation-2026-09-24/source/technical/source-cache/pr791-review/package.json) *(record, orphan)* — historical script/source reference: technical/source-cache/pr791-review/package.json

## docs/views/

- [`branches.md`](views/branches.md) *(orphan)* — the Branches view: every estate branch by scope and repo, its row, and the activity crawl behind it
- [`chats.md`](views/chats.md) *(orphan)* — the Chats view: the chat archive read one month at a time, with its staleness banner
- [`estate.md`](views/estate.md) *(orphan)* — the Repos view: estate membership, cards, hidden and unfiled repos, token gating and the repo dialog
- [`map.md`](views/map.md) *(orphan)* — the Map view: its tabs over the coordination layer (Distribution, Surfacing, Showing, Docs, Harness)
- [`project.md`](views/project.md) *(orphan)* — the Project view: a workspace's tabs, and the installation view on its Overview with the observations ledger
- [`search.md`](views/search.md) *(orphan)* — the Search view and the Files view: names, contents and sessions search, scopes, and reading a hit in place
- [`sessions.md`](views/sessions.md) *(orphan)* — the Sessions view and the sessions cache: recorded sessions, their counts, and file attention
- [`state.md`](views/state.md) *(orphan)* — the State view: every derived cache with its ages, Refresh, progress, calls and history
- [`todo.md`](views/todo.md) *(orphan)* — the Lists view: To-do, Jot and Pins, and the registry files behind them
- [`tools.md`](views/tools.md) *(orphan)* — the Tools view: the curated utility-page gallery from tools.csv
- [`writes.md`](views/writes.md) *(orphan)* — the Writes view: the estate's commit stream by kind, and what the app's own commit subjects mean

11 shared statements are registered in
[`owners.csv`](owners.csv), with each repetition in [`repetitions.csv`](repetitions.csv).
