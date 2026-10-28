# docs

<!-- GENERATED from docs/docs.csv by node/build/docs-readme.mjs; do not hand-edit. -->

Reference docs that don't belong at the repo root. This index is generated
from [`docs.csv`](docs.csv), the documentation registry, which also renders
live in [the Web Tools app's Map → Docs → Inventory](https://mehrlander.github.io/web-tools/app/?view=map&tab=docs).
A **record** preserves a moment and is
never rewritten: a later dated sentence corrects it; a **measured** doc carries dated
observations and is corrected by re-probing; everything else is living and
must stay correct.

**Reach** (derived by `node/build/docs-reach.mjs`, gated against the registry):
2 arrive in every session's context, 16 are named by CLAUDE.md,
20 by a skill, 42 by a page or component. The remaining 36 are
marked *(orphan)* below: nothing points at them except this index.

## docs/

- [`APP.md`](APP.md) — the Web Tools app: mission, durable goals, and the name split
- [`CONSTELLATION.md`](CONSTELLATION.md) — the portable kernel of the what-goes-where doctrine
- [`MARKETPLACE.md`](MARKETPLACE.md) — the plugin marketplace: how the set is published and subscribed to
- [`QUALIFIED-WRITING.md`](QUALIFIED-WRITING.md) — the prose rules: qualify noun phrases, introduce before you refer, no em dashes
- [`README.md`](README.md) — the docs folder's front door: the generated index of this registry
- [`TRACKER.md`](TRACKER.md) — the opt-in cross-session project tracker: schema, ids, board
- [`aims-initiatives.csv`](aims-initiatives.csv) — the five strategic initiatives the estate is pursuing
- [`aims-goals.csv`](aims-goals.csv) — the five goals the estate's material is held to
- [`aims-reading.csv`](aims-reading.csv) — the guided reading list Overview/Purpose offers a new reader
- [`aims.json`](aims.json) — the mission sentence the estate's material serves; its goals and reading list moved to the two aims CSVs
- [`app-routes.csv`](app-routes.csv) — the app's own destinations: every address, what it is for, and which files draw it
- [`artifacts.md`](artifacts.md) *(orphan)* — Claude Code artifacts and the link-choice matrix
- [`code-layers.md`](code-layers.md) — the code layers and the admission rule that sorts a new file into one of them
- [`column-primitives.md`](column-primitives.md) — the column primitives: which of four roles a column plays in its row (id, label, locator, value), the role axis and its crossing with position
- [`delivery.json`](delivery.json) *(measured)* — historical snapshots of the retired injection routes and an unshipped proposal; current content routes are in Map / Harness / Context
- [`diataxis.md`](diataxis.md) *(orphan)* — Diátaxis, the standard documentation framework: its two dimensions, four kinds, and what it asks of a writer
- [`doc-growth.md`](doc-growth.md) *(orphan)* — the doc-growth chart: what it plots, how to generate its data file for a repo, and what makes the chart misleading
- [`doc-kinds.md`](doc-kinds.md) *(orphan)* — the kinds of documentation the estate writes (guidance, app description, specification, API reference, finding) and how much detail each holds
- [`docs.csv`](docs.csv) — the documentation registry: what each file under docs/ is, on four axes
- [`estate-span.md`](estate-span.md) *(measured)* — what the hub knows about the rest of the estate: the outbound/inbound asymmetry, the three shapes a governed area takes, and the 2026-08-20 measurement behind the span column
- [`harness.csv`](harness.csv) — the harness registry: every script under node/, python/ and the platform folders (.githooks/, .github/workflows/, .claude/, skills/hooks/), its role, and how it is invoked
- [`headless-vendoring.md`](headless-vendoring.md) *(orphan)* — building with CDN libraries and rendering headless where the CDNs are blocked
- [`inbound.md`](inbound.md) *(measured, orphan)* — the inbound map: how work reaches a session, the push-versus-pull split across the estate's channels, and the one channel an outside agent can reach
- [`ios-haptics.md`](ios-haptics.md) *(orphan)* — whether a web page can fire iPhone haptics on its own gesture: measured, and no
- [`ios-sheet-drags.md`](ios-sheet-drags.md) — why a drag inside a sheet-presented in-app browser dismisses the sheet, and the two fixes, measured on device
- [`kits.csv`](kits.csv) — the kits registry: every module on the kit shelf, its namespace, its own headline, and who loads it
- [`loader.md`](loader.md) — the loader contract: the canonical head block, gh.load, the toss channels and the selection, timing rules, and the load-build duality
- [`manifest-fields.csv`](manifest-fields.csv) — the field registry for root .web-tools.json: every key's type, consumer, and effect
- [`manifest.md`](manifest.md) — the .web-tools.json manifest: the file's contract and the registry machinery (config cache, errands, proposals, editing from the shell)
- [`pdf-structure.md`](pdf-structure.md) *(orphan)* — recovering structure from a PDF in the browser: what the kit does and honestly does not
- [`portable.csv`](portable.csv) — the portable set: what travels to another repo, and how a consumer takes it
- [`properties.csv`](properties.csv) — every column of every registry: what it means, how it arises, and what it may hold
- [`registries.csv`](registries.csv) — every registry the estate declares: its file, target, scope, and gate
- [`registries.md`](registries.md) — the registry model: targets, keys, identity spaces, properties, assertions; one owner per assertion; how to add a registry and what the suite checks
- [`routes-kinds.csv`](routes-kinds.csv) — the content kinds: what a subject is, what opens it, and what a note can aim at inside it
- [`routes-modes.csv`](routes-modes.csv) — the delivery modes toss-render accepts, and the trust posture each buys
- [`routes-paste.csv`](routes-paste.csv) — what a paste becomes on each surface that reads the clipboard, and what each one declines to
- [`routes-routes.csv`](routes-routes.csv) — the toss routes: which content type opens in which renderer page
- [`routes.json`](routes.json) — what is left of the transport manifest once its three tables became CSVs: the address grammar, the parameter precedence, and the Showing tab's About text
- [`showing-mechanisms.csv`](showing-mechanisms.csv) — which link reaches which kind of change, and what each one silently misses
- [`showing.md`](showing.md) — the frame behind the Showing tab: what ?use= and a 🥏 toss each reach, what resists preview, and how subjects and kinds are typed
- [`stage.md`](stage.md) — the stage: bench and Saved, intake, the walkable preview and diff, Out, save-as-surface, and the #stage= link grammar
- [`tests.csv`](tests.csv) — the test registry: every check's test count, names, method and runner
- [`text-content.md`](text-content.md) *(measured, orphan)* — the estate's authored text: whether the data files holding it are organized, and how much never reached one
- [`text-fields.csv`](text-fields.csv) — the names a prose-bearing CSV column or JSON key may take
- [`text-tools.md`](text-tools.md) *(orphan)* — the FAB's Text tab: why it exists, why the join is the path rather than a term, and an assessment of what it is not
- [`themes.csv`](themes.csv) *(measured)* — the duplication graph as committed data: every pair of markdown files sharing at least three ten-word windows, weighted, with the repeated passages themselves. Clusters of it are the Map view's themes, and which clusters exist is a function of the weight threshold, so the payload carries every edge and the reader carries the dial
- [`tools.csv`](tools.csv) — which pages the Tools view shows, and the icon each is given
- [`venues.md`](venues.md) *(measured)* — the venue map: the places agent work can run, what each reaches, and which programs there run attended
- [`vocabularies.csv`](vocabularies.csv) — what each value of a closed domain means, one row per value
- [`direct-to-main.csv`](direct-to-main.csv) — the writers that commit straight to main, and the paths each one owns
- [`assistant-branches.csv`](assistant-branches.csv) — branches whose author is declared by a row, not read off a prefix or trailer, with the basis for each claim
- [`subjects.csv`](subjects.csv) — the object types: what is on screen, what carries each, and how the address gives it away
- [`annotation.md`](annotation.md) *(orphan)* — annotating a document: the standoff format, the audit page, the pass, and the edit rules, for any vocabulary
- [`run-methods.csv`](run-methods.csv) *(orphan)* — how a person runs an errand's script: the venues each method allows and how its output returns
- [`csv-census.md`](csv-census.md) — the per-repository tracked-CSV inventory: adoption, index measurements and Map reading
- [`locators.md`](locators.md) — locators: the kinds, the container-and-part canonical form, inbound lookup, and how a reference is tested (broken or changed, follow or pin, the hash cascade, verdicts, cost tiers)
- [`fab.md`](fab.md) — the FAB: what it signals, its sidebar's six tabs, its menus, and the one-per-viewport rule
- [`map-tabs.csv`](map-tabs.csv) — the Map view's per-address descriptions and the longer account of each tab
- [`context-sources.csv`](context-sources.csv) — the context registry: everything that enters a session, where it is defined, how it arrives, and who can change it
- [`context-topics.csv`](context-topics.csv) — the topics two or more context sources speak to, each with a verdict on whether the overlap is by design
- [`context.md`](context.md) *(orphan)* — where a context-registry row goes, how topics and tally join it, and what the gate checks
- [`showing-consolidation.md`](showing-consolidation.md) *(record, orphan)* — the 2026-09-27 to 09-29 plan and evidence log for selecting versions in a toss: scenarios, the frame-versus-top-mode comparison, the harness evidence, and the experiment ids (E1 to E12) that tests and code comments cite
- [`outposts.md`](outposts.md) — outposts: places outside git that hold estate material, and the four parts every one is held by (declared, observed, check, upkeep)
- [`outposts.csv`](outposts.csv) — the outposts registry: each place outside git that holds estate material, with its declaration, observation, check, record, outpost protocol and upkeep
- [`account-skills.csv`](account-skills.csv) — what the claude.ai account should hold: each skill on or off, and the plugin folder its copy should match
- [`upstream-skills.csv`](upstream-skills.csv) — the upstream registry: skills written elsewhere that the estate watches, studies, holds or copies, each with its pin and our copy
- [`agents.csv`](agents.csv) — the agent roster: every agent the hub ships as a definition file or spawns as a reader inside a skill, with its model, tools and preloads
- [`hook-legs.csv`](hook-legs.csv) — the commit hook's steps: what each watches, runs and writes, and whether the repair on main runs it
- [`writers.csv`](writers.csv) — every program that commits to an estate repository: what starts it, the machine it runs on, and where and how it sets
- [`context-links.csv`](context-links.csv) — the directed delivery connections between Context sources and the conditions on each connection
- [`idea-board.md`](idea-board.md) — the idea board form: one design-sprint Crazy 8s board, its addresses, fields and sketch rules
- [`house-policies.md`](house-policies.md) — the house policies: one entry per policy, each a preference with its scope, its shortcuts and a link to the document that holds its detail
- [`css-baseline.csv`](css-baseline.csv) *(measured)* — the CSS baseline: the most unexempt hand-written CSS declarations each file may carry, a ratchet on the house rule against vanilla CSS
- [`hook-events.csv`](hook-events.csv) — every event Claude Code accepts a hook on, with the summary its /hooks menu gives
- [`source-bundles.md`](source-bundles.md) *(orphan)* — the shared source-bundle convention: what a bundle is, its README frontmatter, the two tables and how a repository declares them
- [`CONVERSATION.md`](CONVERSATION.md) — the conversation rules: the chat-handoff mechanics every reply uses
- [`conversation.csv`](conversation.csv) — the gated index of the conversation rules CONVERSATION.md defines
- [`intents.csv`](intents.csv) — what you might want done, each as a path through the Set diagram from what starts it to where it lands
- [`icon-families.csv`](icon-families.csv) — the icon families: each set of icons the estate has settled on, the file that declares its members, and the passage that discusses them
- [`fab-signals.csv`](fab-signals.csv) — what the FAB says: each tint, glyph and badge it shows, when it shows, what it means and what a tap does
- [`tests-authored.csv`](tests-authored.csv) — whether each test checks behavior or is a gate, and what breaks if it is deleted

## docs/envelopes/

- [`README.md`](envelopes/README.md) *(orphan)* — the content-envelope family: members, shared grammar, and the sibling decision
- [`chat-results.md`](envelopes/chat-results.md) — the chat-results envelope contract
- [`data-view.md`](envelopes/data-view.md) *(orphan)* — the data-view envelope contract
- [`shorter.md`](envelopes/shorter.md) — the shorter envelope contract: a document and a shortening to adjudicate
- [`surface.md`](envelopes/surface.md) *(orphan)* — the surface format contract
- [`workbook-extract.md`](envelopes/workbook-extract.md) *(orphan)* — the workbook-extract envelope contract: sheet readings and individual modeled objects
- [`approval.md`](envelopes/approval.md) — the approval envelope: a surface that asks for a decision, and the verdict a commit gate resolves
- [`passage-reading.md`](envelopes/passage-reading.md) — the passage-reading envelope contract: one passage read sentence by sentence
- [`audit.md`](envelopes/audit.md) — the audit envelope contract: a document's units, each with a label from a declared vocabulary and a verdict

## docs/envelopes/schemas/

- [`surface-v2.schema.json`](envelopes/schemas/surface-v2.schema.json) *(orphan)* — the surface v2 JSON Schema
- [`workbook-extract-v1.schema.json`](envelopes/schemas/workbook-extract-v1.schema.json) *(orphan)* — the workbook-extract v1 JSON Schema
- [`workbook-extract-v2.schema.json`](envelopes/schemas/workbook-extract-v2.schema.json) *(orphan)* — the workbook-extract v2 JSON Schema for independent sheet and object choices
- [`passage-reading-v1.schema.json`](envelopes/schemas/passage-reading-v1.schema.json) *(orphan)* — the passage-reading v1 JSON Schema

## docs/envelopes/schemas/profiles/

- [`branch-review-v1.schema.json`](envelopes/schemas/profiles/branch-review-v1.schema.json) *(orphan)* — the branch-review profile schema
- [`inquiry-v1.schema.json`](envelopes/schemas/profiles/inquiry-v1.schema.json) *(orphan)* — the inquiry profile schema
- [`stage-v1.schema.json`](envelopes/schemas/profiles/stage-v1.schema.json) *(orphan)* — the stage profile schema
- [`approval-v1.schema.json`](envelopes/schemas/profiles/approval-v1.schema.json) *(orphan)* — the approval profile schema

## docs/environment/

- [`README.md`](environment/README.md) *(orphan)* — the environment docs' front door, and their update discipline
- [`capabilities.md`](environment/capabilities.md) *(measured)* — what the sandbox can run and reach
- [`container.md`](environment/container.md) *(measured)* — what the box is and what persists across sessions
- [`extending.md`](environment/extending.md) — the Claude Code component model, the hooks this repo and its plugin run, the settings they depend on, and the plugin's context cost
- [`testing.md`](environment/testing.md) *(measured)* — how to test HTML and JS in the sandbox
- [`antigravity-local.md`](environment/antigravity-local.md) *(measured, orphan)* — the Antigravity local host environment: daemon runtime, SQLite storage, and brain workspace
- [`harness-comparison.md`](environment/harness-comparison.md) *(measured, orphan)* — structural comparison of the Claude Code cloud harness and Antigravity local harness
- [`lifetimes.json`](environment/lifetimes.json) *(measured)* — the Map view's Lifetimes data: what each event does to each layer a web session runs on, every effect citing container.md

## docs/favicons/

- [`README.md`](favicons/README.md) — the favicon archive: active marks and retired ones

## docs/forms/

- [`README.md`](forms/README.md) *(orphan)* — what a form is, the five jobs a page does for the reader, and the answer each respond form asks for

## docs/github/

- [`README.md`](github/README.md) *(orphan)* — the github folder's front door: renderer, git treatment, MCP routing, surfacing
- [`github-surfacing.md`](github/github-surfacing.md) — GitHub-native surfaces for exposing work: branches, compares, drafts, permalinks
- [`markdown.md`](github/markdown.md) — what GitHub's static renderer turns markdown into
- [`mcp-server-routing.md`](github/mcp-server-routing.md) *(record, orphan)* — two GitHub MCP servers at once: the 2026-07-15 observation, superseded
- [`mcp.md`](github/mcp.md) *(measured, orphan)* — what the MCP layer does to a call and to the text it carries: which server answers, the 150-character write threshold, the HTML-stripping readback
- [`post-merge-branch-mutation.md`](github/post-merge-branch-mutation.md) *(orphan)* — why a merged branch stops being a live workspace: merged means closed

## docs/prototypes/

- [`md-edit-ideas.json`](prototypes/md-edit-ideas.json) *(record, orphan)* — the idea board for the Markdown section editor: eight concepts drawn over the Intake section of docs/stage.md, and the selection the two built editors came from
