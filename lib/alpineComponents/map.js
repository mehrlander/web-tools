document.addEventListener('alpine:init', function() {
  Alpine.data('map', function() {
    // The Map view: the estate's coordination layer made inspectable. It is the
    // operational face of the constellation doctrine (home's
    // created/2026-06-27-constellation-architecture.md, kernel at the hub's
    // docs/CONSTELLATION.md), in four top-level tabs, each a strip of
    // subviews; TABS and SUBVIEWS below are the list.
    //   Distribution the crosswalk from the hub's committed portable manifest
    //               (docs/portable.csv) into the inventories that own each
    //               artifact. It groups by HOW something travels, identifies
    //               WHAT it is, and points back to Skills, Docs, or Automation
    //               for the canonical description. Labelled "The set" until
    //               2026-08-07 and "Portable" until 2026-09-17. The URL key
    //               stays `set`, so old ?tab=set links keep resolving.
    //   Surfacing   the primitives that make session work visible in chat,
    //               indexed from docs/surfacing.csv. Ownership runs the other
    //               way from every other tab: SURFACING.md is authoritative
    //               (sessions load and follow the prose) and the manifest is
    //               its gated index (membership two-way,
    //               surfacing-manifest.test.mjs). Surfacing decides what to
    //               hand over; Showing is what makes it openable.
    //   Showing     how content moves, renders, and gets looked at, read from
    //               four hub files: the Showing table (which link
    //               reaches which kind of change), the shared
    //               owner/repo[@ref]:path address grammar, the delivery modes
    //               toss-render accepts (inline payload versus fetched
    //               reference, and the trust posture each one buys), and the
    //               toss routes mapping a content type to its renderer page.
    //               Named Transport until 2026-08-04; renamed because
    //               SURFACING.md already uses "transport" for the stage link,
    //               and the lead section here was titled Showing all along.
    //   Owners      who owns a statement that lives in several places, read
    //               from docs/owners.csv + docs/repetitions.csv. Its own file since 2026-08-09;
    //               ?tab=claims still resolves here.
    //   Docs/Purpose the estate's mission, goals, and reading paths, beginning
    //               with the repo README, agent contract, and docs index. The
    //               `aims` URL key survives its move from the top strip.
    //   Docs/Growth a corpus as a moving picture: pages/doc-growth.html framed,
    //               every markdown file a bubble over the repo's history. Docs
    //               answers "is this document growing", one row at a time; this
    //               answers "what is the whole corpus doing". FEDERATED: the
    //               repo is a control, fed by each repo's own `growth` key, and
    //               the chart is one instrument pointed at whichever corpus is
    //               selected. It was two top-level app views until 2026-08-28,
    //               one per repo, which rendered as the word "Doc Growth" twice
    //               in the nav with nothing to tell them apart. It moved from
    //               the Map's top strip into Docs on 2026-09-11.
    //   Docs/Inventory the documentation registry, read from the hub's
    //               docs/docs.csv: every doc's subject, status (living claims
    //               current truth, record preserves a moment, measured carries
    //               dated observations and is corrected by re-probing), reach,
    //               and maintenance. It also reads the doc-growth payload,
    //               turning its `words` snapshot into a trend, per row and
    //               per folder. Optional by construction, since that payload is
    //               refreshed on demand rather than by a hook; without it this
    //               reading renders exactly as it did before. Laid out as a
    //               folder rail beside the
    //               selected folder's files (2026-08-07); the flat
    //               directory-grid it replaced rendered docs/envelopes/schemas
    //               as a peer of docs and hid the hierarchy. A row's title
    //               opens the document in the house swipe deck, paging the
    //               selected folder's files, rather than navigating to the
    //               files view; its GitHub icon, inline with the badges,
    //               carries the source peek for the desktop glance, and the
    //               rendition helpers are SourcePeek's own exports so deck
    //               and peek cannot drift. A details toggle on the reach
    //               strip shows every row's maintenance at once. Reach is the one field here that is
    //               DERIVED rather than authored: node/build/docs-reach.mjs
    //               reads the skills and the app to see what names each doc,
    //               and docs-registry.test.mjs holds the registry's copy to it.
    //               It is the tab's headline because it is the number that
    //               moves when the estate improves, and it has already moved
    //               twice from being looked at: stripping comments from the app
    //               corpus (a mention is not a channel) and then adding the
    //               CLAUDE.md channel, which showed twelve docs the repo's own
    //               instructions name and the first cut had called orphans.
    //               Beside reach, each row carries its READERSHIP: the distinct
    //               sessions that opened the file, folded in the private
    //               registry's sessions cache (docAttention) and read here with
    //               the viewer's token, absent without one. Reach says who can
    //               get to a doc and this says who did, which is the pair worth
    //               reading together: an orphan nobody opens and an orphan
    //               opened in nine sessions are different problems. The column
    //               carries its caveats in the strip above it, because they are
    //               load-bearing rather than decorative: the two injected docs
    //               are the most-read files in the estate and are precisely the
    //               two no file tool can count. From 2026-08-27 the column
    //               shows TWO numbers, presence and access, from two rollups
    //               that are never summed: `startupAttention` (what was in
    //               context before the conversation began, from the record's
    //               startup_context) beside `docAttention` (what a file tool
    //               opened). The word "injected" survives only as the fallback
    //               for a cache older than that field, which is the whole
    //               difference: the exception used to be the mechanism.
    // Scope and adoption were a third tab here until 2026-08-03. They are facts
    // about a REPO, and the estate's Repos cards are where a repo is described,
    // so a second grid of the same repos with different columns was a copy of
    // the roster. They moved onto the card (alpineComponents/estate.js), which
    // also ended the drift this view suffered from keeping its own roster: a
    // repo joined the estate and never reached the Map's list.
    //
    // WHAT IS LEFT HERE IS WHAT NO SINGLE REPO OWNS, which is not the same as
    // what mentions no single repo. The line used to read that second way, and
    // Skills crossed it on 2026-08-20 and Growth on 2026-08-28: both render
    // per-repo rows, and both are collections no repo owns, assembled from
    // declarations each repo makes in its own manifest. A FEDERATED TAB is the
    // shape that keeps the charter true: the hub aggregates what repos
    // declare, or what the hourly crawl derives from them into the private
    // registry (the file and document indexes, since 2026-10-07), and never
    // reads a repo's tree from a view; the repo is a control on the tab rather
    // than a duplicate of the tab. A fact about ONE repo still belongs on that
    // repo's card, which is what moved in August.
    // The hub's own halves are public (the hub repo is public); the federated
    // ones read the private registry's crawl and are token-gated.
    const KIND = {
      skill:  { icon: 'ph-lightning',  label: 'Skill' },
      doc:    { icon: 'ph-book-open',  label: 'Document' },
      dir:    { icon: 'ph-folder',     label: 'Directory' },
      script: { icon: 'ph-file-code',  label: 'Standalone tool' },
      agent:  { icon: 'ph-robot',      label: 'Agent' },
    };
    // Delivery-mode rows lead with their trust posture: a sandboxed payload cannot
    // reach this origin's token, an address-mode fetch is same-origin and can,
    // which is why one is allowlisted and the other is not.
    const MODE_ICON = {
      untrusted: 'ph-shield-check',
      trusted:   'ph-key',
      'n/a':     'ph-arrow-bend-down-right',
    };
    // Which ref this view's MANIFESTS are read at. ?use= pins the code a page
    // loads; these two files are the code's committed data, and they version
    // with it, so a preview has to read them at the same ref. Pinned to 'main'
    // they lie in both directions: a branch that edits a manifest shows main's
    // copy, and a branch that ADDS one 404s (which is how this was found, on
    // docs/routes.json, from a ?use= link handed over before it was opened).
    // No ?use= is the deployed case and stays on main. The selection comes
    // first, which also covers a renderer's implied web-tools version.
    const useRef = () => {
      try { return window.GH?.refFor?.('mehrlander/web-tools') || new URLSearchParams(location.search).get('use') || 'main'; }
      catch { return 'main'; }
    };
    // Another repository's ref: what the selection names for it, else main.
    const selRef = (repo, path) => window.GH?.refFor?.(repo, path) || 'main';
    // The doctrine's portable kernel, opened in the shell viewer from the set
    // header. The full home-specific doctrine is linked from that doc.
    const DOCTRINE_PATH = 'docs/CONSTELLATION.md';
    // The two manifests this view is a projection of. Named rather than inlined
    // because each is now said three times in a header (the link, its peek, its
    // tooltip), and a header that disagrees with itself about which file it
    // opens is the exact confusion this pass is fixing.
    // The Docs/Purpose subview. The mission the estate's material serves and
    // the goals it is held to. Not a registry: the suite holds a registry to being a CSV, and
    // five goals classify nothing, so this reads like routes.json rather than
    // like the eight manifests the other tabs render.
    const AIMS_MANIFEST = 'docs/aims.json';
    const AIMS_GOALS = 'docs/aims-goals.csv';
    const AIMS_INITIATIVES = 'docs/aims-initiatives.csv';
    const AIMS_READING = 'docs/aims-reading.csv';

    const SET_MANIFEST = 'docs/portable.csv';
    // Six files, assembled into the one object the Showing tab renders.
    // The three tables are their own CSV registries; routes.json keeps only
    // what is not a table (the grammar, the precedence, the showing frame), so
    // the header's curate link still has one file to open.
    const ROUTES_MANIFEST = 'docs/routes.json';
    const ROUTES_MODES = 'docs/routes-modes.csv';
    const ROUTES_ROUTES = 'docs/routes-routes.csv';
    const SHOWING_MECHANISMS = 'docs/showing-mechanisms.csv';
    // What the subject IS, which is the axis above read one level down. Added
    // 2026-08-31, when three pieces of code were found each answering it
    // privately and disagreeing.
    const ROUTES_KINDS = 'docs/routes-kinds.csv';
    // The subject axis itself, as a registry: what is on screen, typed. Two
    // tables key into it, which is why it left routes.json (2026-09-22).
    const SUBJECTS = 'docs/subjects.csv';
    const ROUTES_PASTE = 'docs/routes-paste.csv';
    const DOCS_MANIFEST = 'docs/docs.csv';
    const POLICIES_MANIFEST = 'docs/policies.csv';
    const POLICY_TOPICS_MANIFEST = 'docs/policy-topics.csv';
    // The Docs tab reads `words` as a snapshot. This is the same measure over
    // time, so a row can say whether a document is growing rather than only how
    // big it is now. Generated by python/doc-growth.py and rendered whole by
    // pages/doc-growth.html; here it is a second column on a table that already
    // exists. Optional by construction: it is refreshed on demand, not by a
    // hook, so the tab must render without it.
    const GROWTH_PAYLOAD = 'data/doc-growth/web-tools.json';
    // The Owners tab. Its own file since 2026-08-09: the table used to be a
    // second `claims` block inside docs/docs.csv, which the registry model
    // forbids (a registry does not live inside another registry's file), and
    // "claim" was spending a word the estate already uses three other ways. The
    // ?tab=claims URL key is unchanged, the way ?tab=set outlived "The set".
    // Two files since 2026-08-16: a repetition is a different target from the
    // statement it repeats, so it is its own registry. The tab rejoins them.
    const OWNERS_MANIFEST = 'docs/owners.csv';
    const OWNERS_REPS = 'docs/repetitions.csv';
    const THEMES_GRAPH = 'docs/themes.csv';
    // The Related lens: passage embeddings beside the shingle graph, written by
    // python/doc-overlap.py (by hand; it needs a model the hook does not have).
    // Offsets only, in UTF-16 units: the passage text is sliced from the file
    // itself, and a file whose hash moved says so instead of showing a stale cut.
    const OVERLAP_DOCS = 'data/doc-overlap/docs.csv';
    const OVERLAP_MATCHES = 'data/doc-overlap/matches.csv';
    // The Showing tab's prose frame: the argument behind the manifest, linked
    // from the tab header the way the set header links the doctrine.
    const SHOWING_FRAME = 'docs/showing.md';
    // Surfacing inverts the ownership: SURFACING.md is authoritative (it is
    // what sessions load and follow) and the manifest is its gated index, so
    // the header leads with the doc and the Curate link edits the index.
    const SURF_MANIFEST = 'docs/surfacing.csv';
    const SURF_DOC = 'docs/SURFACING.md';
    // THE REST OF THE SYSTEM, and when each part reaches a session. The cards
    // below index one document, the primitives, which is the only one injected.
    // Its siblings are separate FILES rather than regions of it, and the split
    // is the point: a document that idles until a pull request exists should
    // not ride every session's context. The course left SURFACING.md on
    // 2026-09-10 for that reason.
    //
    // Declared rather than derived, which is a reversal. The doors used to be
    // read off the doc's own h2 headings, and that stopped working the moment
    // a region became a file: headings cannot name a sibling. The gate moved
    // with the shape, so node/test/map-view.test.mjs now checks every declared
    // path exists rather than checking every gloss names a heading.
    const SURF_SIBLINGS = [
      { path: 'docs/surfacing-course.md', heading: 'The surfacing course',
        gloss: 'arrives when a pull request is created' },
    ];
    // The Docs tab's reach dimension, derived in the registry by
    // node/build/docs-reach.mjs and gated against it. Ordered strongest first,
    // which is also worst-last: the orphan count is the number this tab exists
    // to make impossible to ignore, so it carries the only warning tone.
    const REACH = {
      injected: { label: 'injected', tone: 'badge-success', hint:
        'In every session\'s context without being asked for: the session-start hook fetches these and CLAUDE.md imports them.' },
      project: { label: 'in context', tone: 'badge-secondary', hint:
        'Named by a document already in every session\'s context: the repo\'s own CLAUDE.md, or one of the injected two. One hop away, no invocation.' },
      skill: { label: 'by a skill', tone: 'badge-info', hint:
        'Named by a skill, so invoking that skill pulls the doc into context.' },
      app: { label: 'by the app', tone: 'badge-primary', hint:
        'Named in lib/ or pages/ code, so a page loads it at runtime or opens it in the viewer. A mention in a comment does not count.' },
      orphan: { label: 'orphan', tone: 'badge-warning', hint:
        'Nothing points here. Not dead: the generated docs index lists it, and that index is the only thing reaching it.' },
    };
    const REACH_ORDER = ['injected', 'project', 'skill', 'app', 'orphan'];
    const REACH_BUILDER = 'node/build/docs-reach.mjs';
    // The Tests subview. Same shape as Docs one axis over: the registry says what
    // each check is and what it protects, and the counts are derived.
    const TESTS_MANIFEST = 'docs/tests.csv';
    // The Agents subview. One row per agent the hub ships as a definition file
    // (skills/agents/, listed in the marketplace entry) or spawns as a reader
    // whose prompt is written into a skill. Another repo's own agents are not
    // rows: each repo declares them under `agents` in its .web-tools.json and
    // the estate half reads them through the crawl, as the Skills tab's estate
    // set does, so a private repo's agents stay behind the token.
    const AGENTS_MANIFEST = 'docs/agents.csv';
    // The Peeves subview. The list ships in the plugin, so it is public; the
    // owner's own words behind each row are not, and are read from the
    // private registry with a token, the way the estate sets are.
    const PEEVES_LIST = 'skills/peeves/peeves.csv';
    const PEEVES_EVIDENCE = 'sessions/peeves/evidence.csv';
    const TESTS_BUILDER = 'node/build/tests-index.mjs';
    // Ordered by how much a passing assertion is worth, strongest first. A
    // gate failing means a committed claim is false; a boot
    // smoke check passing means the component still mounts. Both are worth
    // having and they are not the same evidence, which is the whole reason
    // this tab cuts the total by kind instead of reporting it.
    const KIND_ORDER = ['gate', 'behavior'];
    // The comparison-grain reading beside the registry. A test file usually
    // makes several comparisons, each with its own source of expected value
    // and its own operation, and the registry's one row per file cannot say
    // which; this file can, one row per comparison, authored from the code:
    // the recognized kind, the requirement, the two objects and how each is
    // produced, the plausible failure, and what agreement does not establish.
    // Provisional and dated (2026-09-05), which is why it lives under data/
    // and has no registries.csv row yet: the kind column closes into a domain
    // when the rows stop needing new words, and the file becomes a registry
    // then. Optional by construction, like the Docs tab's growth payload: the
    // tab renders exactly as before without it.
    const TESTS_EXPLAIN = 'data/checks-reading/explanations.csv';
    // FEDERATED, on the Growth subview's precedent: a repo declares a `checking`
    // key in its .web-tools.json ({files, comparisons}, two CSV paths), the
    // config crawl carries it, and the tab reads both files through the
    // viewer's token. `files` is the repo's own list of check-bearing files
    // (so "no comparison rows yet" can be told from "not a check at all"),
    // `comparisons` its rows in the shape above. A branch the crawl has not
    // seen yet can be laid over with ?checking=owner/repo@ref:files,comparisons
    // (`;` between repos), the way doc-growth takes ?src=.
    const CHECKING_KEY = 'checking';
    // Read once, when this file loads: the shell rewrites the address from a
    // whitelist on every sync, so by the time the tab opens the override may
    // be gone from location.search. The value at load is the one the reader
    // arrived with.
    const CHECKING_AT_LOAD = (() => {
      try { return new URLSearchParams(location.search).get(CHECKING_KEY) || ''; } catch { return ''; }
    })();
    // The Harness tab's Automation subview. (Not "Tools": that word is the
    // curated gallery of utility PAGES, the app's Tools view and
    // docs/tools.csv, and the tab
    // must not collide with it.) The registry the lib-kits migration argued for:
    // docs/code-layers.md names node/ and python/ as layers but could not
    // account for the files below them; docs/harness.csv is the accounting
    // (docs/tools.csv was taken: the curated Tools gallery manifest).
    // `role` and the layer glossary are authored, everything else is stamped
    // by the builder, and node/test/ is absent on purpose (docs/tests.csv
    // owns that folder; one file must not answer to two registries).
    const TOOLS_MANIFEST = 'docs/harness.csv';
    // The commit hook's steps, one row each, stamped by the same builder from
    // .githooks/pre-commit's own `# --- leg` headers. The harness registry has
    // one row for the hook; this is what that row opens to.
    const HOOK_LEGS = 'docs/hook-legs.csv';
    const HOOK_PATH = '.githooks/pre-commit';
    // The Registries tab. The other seven each render ONE manifest; this one
    // renders the table that says what a manifest is, so it is the index the
    // rack hangs off rather than an eighth peer. Added 2026-08-10, once the
    // reconciliation had made it worth reading: each registry with a target
    // grain, a scope, a gate, and two enforcement layers behind it. (No count
    // here on purpose: two prose copies of the count sat one behind the table
    // within a week of being written, so the total is this tab's to derive.)
    // Each row also shows WHERE THE REGISTRY RENDERS: `renders_in`, the app
    // files that name its path, derived by registries-reach.mjs. A registry
    // with none wears the warning badge, because the registry audits keep
    // finding the same law (an authored claim nothing reads goes wrong), and a
    // registry no surface renders is that exposure one level up. Same
    // instrument as the Docs tab's reach column, which improved the estate
    // twice just by being looked at.
    // The registry pair. One file per registry since 2026-08-16: CSV cannot hold
    // two tables, which is what makes "a registry is a file" true by construction
    // and what retired the carrier/rows/format trio for a single `path`.
    const PROPS_MANIFEST = 'docs/registries.csv';
    // The tab ledes, and each tab's longer account, one row per address.
    // The keys stay in TABS and SUBVIEWS below; the prose lives here so a
    // lede links to the row that holds it (docs/registries.md, "in code, as an
    // authoritative array": the sentences left the array, not copied out of it).
    const TAB_LEDES = 'docs/map-tabs.csv';
    const PROPS_DECLS = 'docs/properties.csv';
    // The third file of the pair's own family: what each value of a closed
    // domain means, which the domain column can only list. Read here so the tab
    // can define its own columns from data rather than from a paragraph above
    // them. That is the whole reason the legend exists: registries.md carried a
    // vocabulary table whose rows glossed columns already glossed here, and a
    // second copy of a definition is a definition that will disagree with
    // itself.
    const PROPS_VOCAB = 'docs/vocabularies.csv';
    // The prose-field vocabulary. Joined onto a property so a column name says
    // which KIND of prose it holds, collapsing 127 column names to 13 kinds.
    // NOT a lint: text-vocabulary-conformance.test.mjs gates only the unclaimed
    // class and passes an alias deliberately, because the vocabulary stating
    // what an old name means is what lets a file conform without a rename
    // across the estate. Eighteen names here are aliases, and every one of them
    // is conforming; rendering them as warnings would invent 18 defects.
    const TEXT_FIELDS = 'docs/text-fields.csv';
    // The skill roster as served to other repos. Until 2026-09-27 this was a
    // separate on-demand library, disjoint from the plugin's skills under
    // .claude/skills/. The portable plugin now takes its source from skills/
    // and carries every skill listed here, so the Library and Plugin sets
    // describe one population from two files.
    const SKILLS_MANIFEST = 'skills/manifest.csv';
    // Skills written elsewhere that the estate follows, the reverse of an
    // outpost (docs/outposts.md). The Outside set renders it, and a copied
    // skill's Plugin or Library row carries its origin by joining `ours`.
    const UPSTREAM_SKILLS = 'docs/upstream-skills.csv';
    const PROPS_DOC = 'docs/registries.md';
    // The span column's own document: what the hub knows about the rest of the
    // estate, the three shapes a governed area takes, and the measurement. It
    // hangs here rather than in CLAUDE.md because the tab is where a reader
    // meets the column, and because CLAUDE.md is at its word ceiling and the
    // fix for that is extraction rather than shaving.
    const SPAN_DOC = 'docs/estate-span.md';
    const TOOLS_BUILDER = 'node/build/tools-index.mjs';
    // The kit shelf's registry authors nothing: every field is read off the
    // tree by the builder, and the kit's own header comment is the doc the
    // gloss is lifted from (lib/kits/README.md says the header is the
    // authoritative account of each kit, so the tab reads it rather than
    // keeping a second sentence that would age beside it).
    const KITS_MANIFEST = 'docs/kits.csv';
    // The Outposts tab: places outside git that hold estate material, each
    // with its declaration, observation, check and upkeep (docs/outposts.md).
    // The account outpost adds its declaration, and with a token the last
    // observation a session wrote to the registry repo. That file carries each
    // state's label and attention flag, so the tab holds no wording of its own
    // for states the check names.
    const OUTPOSTS_MANIFEST = 'docs/outposts.csv';
    const ACCOUNT_SKILLS_MANIFEST = 'docs/account-skills.csv';
    const OUTPOSTS_DOC = 'docs/outposts.md';
    const ACCOUNT_OBSERVED = 'environment/account-skills.csv';
    const OUTPOST_PARTS = [
      ['declared', 'Declared'], ['observed', 'Observed'], ['check', 'Check'],
      ['upkeep', 'Upkeep'], ['record', 'Record'],
    ];
    // The Context tab: what enters a session, by where it is defined. Two
    // halves of one schema. The public half lives here; the private half
    // (the claude.ai account, the environment, user scope, the private repos)
    // lives in the registry repo and is read only with a token, so a reader
    // without one sees the public circles and is told what is missing.
    const CTX_MANIFEST = 'docs/context-sources.csv';
    const CTX_TOPICS = 'docs/context-topics.csv';
    const CTX_PRIVATE = 'environment/context-sources.csv';
    // The private half is read at main unless ?regref= names another ref, so
    // a registry change can be shown before it merges (a call's proof frames
    // this tab at the branch that makes the claim).
    const ctxPrivRef = () => {
      try { return new URLSearchParams(location.search).get('regref') || 'main'; } catch (e) { return 'main'; }
    };
    // Outermost first.
    const CTX_CIRCLES = [
      { key: 'account', label: 'claude.ai account', priv: true },
      { key: 'environment', label: 'Cloud environment', priv: true },
      { key: 'user', label: 'User scope', priv: true },
      { key: 'plugin', label: 'Portable plugin', priv: false },
      { key: 'repo', label: 'Checked-out repos', priv: false },
      { key: 'session', label: 'The session', priv: false },
    ];
    // The When lens's columns, in session order.
    const CTX_MOMENTS = [
      { key: 'build', label: 'Environment build' },
      { key: 'start', label: 'Session start' },
      { key: 'invoke', label: 'When invoked' },
      { key: 'turn', label: 'Every turn' },
      { key: 'event', label: 'On an event' },
    ];
    // Evidence as one glyph: receipt and record are observed.
    const CTX_EVIDENCE = { receipt: '●', recorded: '●', reconstructed: '◇', none: '∅' };
    const CTX_VERDICTS = {
      conflicting: { tone: 'badge-error', order: 0, gloss: 'two sources disagree, and either may win' },
      transitional: { tone: 'badge-warning', order: 1, gloss: 'an old and a new source both run until a replacement lands' },
      redundant: { tone: 'badge-warning', order: 2, gloss: 'the same thing is stated in more than one place' },
      layered: { tone: 'badge-info', order: 3, gloss: 'several sources on purpose, each a backstop for another' },
    };
    const KITS_BUILDER = 'node/build/kits-index.mjs';
    const KITS_README = 'lib/kits/README.md';
    const KITS_DEMOS = 'lib/kits/demos/';
    // The UI units tables (data/ui-units/README.md): the codes a unit is coded
    // with, the units both apps show, and each unit's coding. Rows naming files
    // in the private home repo live in home's own data/ui-units/ and are read
    // with a token, through a client that names no ref, so a link's refs=
    // selection reaches a branch of home before it merges.
    const UI_CODES = 'data/ui-units/codes.csv';
    const UI_UNITS = 'data/ui-units/units.csv';
    const UI_CODED = 'data/ui-units/coded.csv';
    const UI_CODEBOOK = 'data/ui-units/codebook.md';
    // A body code with parts is an interface a unit's markup can declare
    // (codebook.md, "Declaring a pattern in markup"). parts.csv names and
    // glosses each part; instances.csv, beside each store's coded.csv, holds what
    // node/build/ui-instances.mjs found when it checked the declarations.
    const UI_PARTS = 'data/ui-units/parts.csv';
    // The dimensions the units are coded on, one row each, in the order the
    // Dimensions subview draws them; a dimension's codes are codes.csv's rows
    // whose axis names it.
    const UI_DIMS = 'data/ui-units/dimensions.csv';
    const UI_INSTANCES = 'data/ui-units/instances.csv';
    const UI_UNITS_TOOL = 'node/ui-units.mjs';
    const UI_PRIVATE = 'mehrlander/home';
    // Each unit's shots: a manifest beside them names the files. The public
    // units' shots are committed here and load as plain images; budget-drs
    // units' shots live in the private registry's thumbs/ (its README says why)
    // and are fetched under a token. node/build/ui-shots.mjs writes both.
    // A UI unit's anatomy, drawn. One small wireframe per body code and one per
    // phone code, each a sketch of the code's gloss in codes.csv, so the deck
    // slide shows the arrangement before it names it. Bars are rows of text,
    // boxes are regions, and the primary tint marks the thing the code turns
    // on: the picked row, the opened card, the chart. A code without a sketch
    // (a reader's new: proposal) draws its icon instead.
    const sk = {
      bar: (c = '') => `<span class="block rounded-[2px] bg-base-content/25 ${c}"></span>`,
      box: (c = '') => `<span class="block rounded-[3px] bg-base-content/15 ${c}"></span>`,
      ink: (c = '') => `<span class="block rounded-[3px] bg-primary/40 ${c}"></span>`,
      n: (k, f) => Array.from({ length: k }, (_, i) => f(i)).join(''),
      col: (inner, c = '') => `<span class="flex flex-col gap-[3px] ${c}">${inner}</span>`,
      row: (inner, c = '') => `<span class="flex gap-[3px] ${c}">${inner}</span>`,
    };
    const BODY_SKETCH = {
      list: () => sk.col(sk.n(5, () => sk.bar('h-[5px]')), 'w-full'),
      grid: () => sk.col(sk.bar('h-[5px] bg-base-content/45')
        + sk.n(4, () => `<span class="grid grid-cols-3 gap-[2px]">${sk.n(3, () => sk.bar('h-[5px]'))}</span>`), 'w-full'),
      'card-grid': () => `<span class="grid grid-cols-3 gap-[3px] w-full">${sk.n(6, () => sk.box('h-[17px]'))}</span>`,
      'list-detail': () => sk.row(sk.col(sk.n(5, (i) => i === 1 ? sk.ink('h-[5px]') : sk.bar('h-[5px]')), 'w-[38%]')
        + sk.box('flex-1'), 'w-full h-full'),
      'linked-swiper': () => sk.row(sk.col(sk.n(4, (i) => i === 0 ? sk.ink('h-[5px]') : sk.bar('h-[5px]')), 'w-[30%]')
        + sk.row(sk.ink('w-[60%] shrink-0') + sk.box('w-[60%] shrink-0'), 'flex-1 overflow-hidden'), 'w-full h-full'),
      'header-swiper': () => sk.col(sk.box('h-[14px] bg-base-content/25')
        + sk.row(sk.n(3, () => sk.box('w-[42%] shrink-0')), 'flex-1 overflow-hidden'), 'w-full h-full'),
      'source-beside': () => sk.row(sk.col(sk.n(5, (i) => sk.bar('h-[4px]' + (i % 2 ? ' w-4/5' : ''))), 'flex-1')
        + '<span class="w-px bg-base-content/35"></span>' + sk.col(sk.ink('h-[5px] w-3/4') + sk.box('flex-1'), 'flex-1'), 'w-full h-full'),
      figure: () => `<span class="flex items-end gap-[3px] w-full h-full">${[40, 70, 55, 90, 30, 65].map(h => sk.ink(`flex-1 h-[${h}%]`)).join('')}</span>`,
      fields: () => sk.col(sk.n(4, () => sk.row(sk.bar('h-[5px] w-[32%] bg-base-content/45') + sk.bar('h-[5px] flex-1'))), 'w-full'),
      document: () => sk.col(sk.bar('h-[6px] w-3/5 bg-base-content/45') + sk.n(4, (i) => sk.bar('h-[4px]' + (i === 3 ? ' w-2/3' : ''))), 'w-full'),
      tool: () => sk.col('<span class="block h-[11px] rounded-[3px] border border-base-content/45"></span>'
        + sk.ink('h-[5px] w-1/3') + sk.box('flex-1'), 'w-full h-full'),
      'app-split': () => sk.row(sk.n(2, () => sk.col(sk.bar('h-[5px] bg-base-content/45') + sk.box('flex-1'), 'flex-1')), 'w-full h-full'),
      host: () => `<span class="block w-full h-full rounded-[3px] border border-base-content/35 p-[3px]">${sk.box('w-full h-full')}</span>`,
      'list-stack': () => sk.col(sk.n(3, () => sk.bar('h-[4px]')) + '<span class="h-px bg-base-content/35"></span>'
        + sk.n(3, () => sk.bar('h-[4px]')), 'w-full'),
      'deck-page': () => sk.col(sk.ink('flex-1') + `<span class="flex justify-center gap-[3px]">${sk.n(4, (i) =>
        `<span class="size-[4px] rounded-full ${i === 1 ? 'bg-primary/60' : 'bg-base-content/25'}"></span>`)}</span>`, 'w-full h-full'),
    };
    const PHONE_SKETCH = {
      same: () => sk.bar('h-[6px] bg-base-content/45') + sk.n(6, () => sk.bar('h-[5px]')),
      stack: () => sk.box('h-[38%]') + sk.box('flex-1'),
      hide: () => sk.bar('h-[6px] bg-base-content/45') + sk.n(4, () => sk.bar('h-[5px]'))
        + '<span class="block flex-1 rounded-[3px] border border-dashed border-base-content/30"></span>',
      switch: () => `<span class="flex gap-[2px] p-[2px] rounded-full bg-base-content/10">${sk.ink('h-[5px] flex-1 rounded-full')}<span class="block h-[5px] flex-1"></span></span>`
        + sk.box('flex-1'),
      takeover: () => `<span class="flex-1 rounded-[4px] bg-primary/25 p-[3px] flex flex-col gap-[3px]"><span class="block size-[5px] rounded-full bg-base-content/40"></span>${sk.n(3, () => sk.bar('h-[4px]'))}</span>`,
      'wrap-cost': () => sk.n(4, () => sk.row(sk.n(3, () => sk.bar('h-[5px] flex-1')))) + sk.box('h-[18%] mt-auto'),
      squeeze: () => sk.row(sk.box('w-[64%]') + sk.col(sk.n(7, () => sk.bar('h-[3px]')), 'flex-1'), 'flex-1'),
    };
    // A body sketch in its frame, a phone sketch in a phone.
    const bodySketch = (code, icon) => `<span class="w-[5.5rem] h-[3.75rem] shrink-0 rounded-md border border-base-300 bg-base-200/60 p-[5px] flex items-start">${
      BODY_SKETCH[code] ? BODY_SKETCH[code]() : `<i class="ph ${icon || 'ph-square'} text-2xl text-base-content/40 m-auto"></i>`}</span>`;
    const phoneSketch = (code, icon) => `<span class="w-[4.25rem] h-[7.5rem] shrink-0 rounded-[11px] border-2 border-base-content/30 bg-base-100 p-[5px] flex flex-col gap-[3px]">${
      PHONE_SKETCH[code] ? PHONE_SKETCH[code]() : `<i class="ph ${icon || 'ph-device-mobile'} text-2xl text-base-content/40 m-auto"></i>`}</span>`;
    const UI_THUMBS = 'data/ui-units/thumbs/';
    const UI_THUMBS_PRIVATE = 'thumbs/mehrlander/home/ui-units/';
    // How a harness file gets run. The axis decides whether "nothing names
    // it" matters: a driver is passed by path to npm run shot --script, so no
    // other route will ever name one, while "none found" is a file with no
    // visible way to run at all, which is the warning state.
    const INVOKE_TONE = {
      npm: 'badge-success', driver: 'badge-info', imported: 'badge-secondary',
      argv: 'badge-primary', env: 'badge-accent', git: 'badge-accent', session: 'badge-accent',
      hook: 'badge-accent', ci: 'badge-accent', 'none found': 'badge-warning',
    };
    // The invocation families whose values carry a payload after the colon,
    // folded to one pill each on the Harness strip.
    const PREFIXED_INVOKE = ['npm', 'env', 'git', 'session', 'hook', 'ci'];
    const KIND_TONE = { gate: 'badge-success', behavior: 'badge-secondary' };
    // How a check reaches its subject, which decides how much its pass proves.
    const METHOD_HINT = {
      kit: 'the kit runs in the Node realm',
      alpine: 'booted in jsdom and driven',
      spawn: 'run as a process, output asserted',
      read: 'the file is read and asserted on',
      pure: 'the function is called directly',
    };
    const METHOD_ORDER = ['kit', 'alpine', 'spawn', 'read', 'pure'];
    // The three closed vocabularies a row belongs to, each a separate question,
    // each filtering on its own axis and composing with the others. They are
    // labeled in the strip because they were not, and a reader had no way to
    // tell whether two pills competed or combined.
    //
    // Only `kind` carries tone, and the asymmetry is deliberate rather than
    // left over: the kind badge repeats on every row, so a color lets a chip be
    // matched to the rows it selects. Method is the section heading and runner
    // is the row icon; coloring either would invent a mapping the rows do not
    // show.
    //
    // What is NOT here is boot smoke. It was a chip until 2026-08-10 and did
    // not belong: a kind, a method, and a runner are each exactly one value per
    // file, while a boot check is a property of an individual assertion. The
    // chip had to pick a level to count and could not say which it picked, and
    // both readings happened to be 19. It is marked in the assertion list now,
    // on the one line it is true of.
    const RUNNER_HINT = {
      suite: 'globbed by node --test, so CI runs it on every pull request',
      browser: 'driven by a real browser, so it is named without .test. and node --test never globs it. It asserts in its own harness, which is why it reports no assertion count and why the suite\'s pass total does not speak for it',
    };
    // Each dimension asks its question; each VALUE explains itself. The
    // per-value gloss is the one the reader wants (what is a `gate`?), and the
    // kind vocabulary's copy is the registry's own, read live rather than
    // restated here.
    //
    // Tone in the strip is a small marker, kind only, and both halves of that
    // are deliberate. It was a tinted badge around the file count until
    // 2026-08-10, which made one dimension's chips a different SHAPE from the
    // other two and read as arbitrary. A dot separates the colour from the
    // number: the colour keys the row badges below, the number is just a count.
    // And it stays kind-only because tinting method and runner was tried and is
    // worse: those colours decode to nothing, since no row anywhere wears them.
    const DIMENSIONS = [
      // `dot` opts this dimension into the tone marker, and only this one can
      // have it: colour decodes to a kind because the per-row badge is tinted by
      // kind and nothing else. It stays a dimension-level opt-in rather than a
      // lookup per value, which is the shape that survives a domain gaining a
      // value another dimension already spends. The collision that forced it is
      // gone, since `kit` was a kind and a method at once until the kinds closed
      // on two, and a per-value KIND_TONE hit would have tinted the method chip
      // with a meaning it did not have.
      { key: 'kind', label: 'kind', question: 'what does this check claim', dot: true,
        values: KIND_ORDER, of: t => t.kind, hint: (v, reg) => reg?.kinds?.[v] || '' },
      { key: 'method', label: 'method', question: 'how does it reach its subject',
        values: METHOD_ORDER, of: t => t.method, hint: v => METHOD_HINT[v] || '' },
      { key: 'runner', label: 'runner', question: 'what runs the file',
        values: ['suite', 'browser'], of: t => (t.runner === 'suite' ? 'suite' : 'browser'),
        hint: v => RUNNER_HINT[v] || '' },
    ];
    // Files and words are both shown because on this folder they disagree, and
    // the disagreement is the finding. Orphans are 40% of the files and 17% of
    // the words; one reachable document is 22% on its own. A strip carrying
    // only counts sends every reader to the tail.
    const kw = n => n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M'
      : n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n);
    // A path's folder, '' at the root. The hub's documents all sit under
    // docs/, so the slice that used to stand in for this never met a root file;
    // another repo's README.md is one.
    const docDirOf = (p) => { const i = String(p || '').lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i); };
    const DOC_ROWS = 300;

    // ── The doc deck's rendition ─────────────────────────────────────────
    // Full-length sibling of the peek's excerpt: same kind decision, same
    // frontmatter fencing, same JSON pretty-print, through SourcePeek's
    // exported pure helpers so the two can never disagree about what a file
    // looks like, with plain fallbacks for a page that never loaded the peek.
    const docCache = new Map();  // ref:path -> raw text
    // One recursive tree per repository/ref, shared by every slide. A rendered
    // document can then distinguish a repository file from code-shaped prose
    // without turning every backticked filename into a speculative link.
    const repoPathCache = new Map();
    // Escaping is window.esc from vanilla-bundle.js, first in the boot chain.
    const esc = s => window.esc(s);
    let sheetMarkedP = null;
    const sheetMarked = () => sheetMarkedP ||= window.marked ? Promise.resolve() :
      new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/marked/lib/marked.umd.js';
        s.onload = res; s.onerror = () => rej(new Error('marked failed to load'));
        document.head.appendChild(s);
      });
    // kits/md-doc.js, lazily and once, beside marked: it is what puts a wide
    // table in its own scroller and a copy control on every heading, and a
    // deck that never opens a markdown file should not pay for it.
    let mdDocP = null;
    const sheetMdDoc = () => mdDocP ||= window.mdDoc ? Promise.resolve()
      : (window.gh?.load
          ? window.gh.load('kits/src-doc.js')
              .then(() => window.gh.load('kits/md-doc.js')).catch(() => {})
          : Promise.resolve());

    // A registry as a markdown table. The estate's CSVs are one record per line
    // by construction (kits/csv.js says so, and every registry keeps its prose
    // single-line to hold that), which is what makes a line-oriented conversion
    // safe: no cell can carry the newline that would break a row in half.
    //
    // A CELL IS DATA, so its markdown is escaped rather than run. The pipe has
    // to move because it is the table's own delimiter; the rest move because a
    // registry that describes markdown is full of markdown, and the first
    // rendering turned surfacing.csv's own `[caption](url)` into a link reading
    // "caption". A reader looking at the file has to be able to see the
    // brackets. Backslash escapes render as the bare character, so nothing is
    // added to what is on screen, and emoji are untouched.
    //
    // Ragged rows are PADDED to the widest, never truncated to the header: a
    // row with an extra field is a file that has drifted from its header, and
    // dropping the field would hide exactly the thing worth seeing.
    const csvToMarkdown = (text) => {
      const lines = String(text || '').split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) return null;
      const rows = lines.map(l => window.Csv.parseLine(l));
      const cols = Math.max(...rows.map(r => r.length));
      if (cols < 2) return null;
      const cell = (v) => String(v ?? '').trim()
        .replace(/[\\`*_[\]|]/g, (c) => '\\' + c) || ' ';
      const line = (r) => '| ' + Array.from({ length: cols }, (_, i) => cell(r[i])).join(' | ') + ' |';
      return [line(rows[0]), '|' + ' --- |'.repeat(cols), ...rows.slice(1).map(line)].join('\n');
    };

    // MOUNTED, not returned as a string. The section controls are listeners on
    // real nodes, and a string handed to innerHTML would drop them; the deck's
    // slide renderer therefore hands this the box to fill rather than asking it
    // for markup. The non-markdown branches still build a node, so the two
    // paths have one shape.
    async function renderDoc(host, path, text, addr, reading = 'rendered'){
      const sp = window.SourcePeek;
      let kind = sp?.kindOf ? sp.kindOf(path)
        : (/\.(md|markdown)$/i.test(path) ? 'markdown' : /\.json$/i.test(path) ? 'json' : 'source');
      // SOURCE MEANS THE FILE'S OWN BYTES-AS-TEXT. It must happen before CSV
      // conversion, Markdown frontmatter fencing, and JSON pretty-printing or
      // the switch would show a second presentation rather than the raw file.
      if (reading === 'source') {
        host.innerHTML = '<pre data-deck-source class="text-sm font-mono whitespace-pre-wrap m-0">' + esc(text) + '</pre>';
        return 'source';
      }
      // A CSV IS A TABLE, and until 2026-09-04 every one of them arrived here as
      // wrapped raw text: SourcePeek.kindOf answers markdown / json / source,
      // which is the right set for a 28-line hover excerpt and the wrong one for
      // a full read. The Docs tab's deck pages docs/, which holds a dozen
      // registries, so the wall was the ordinary case rather than an edge.
      //
      // Converted to a MARKDOWN table rather than built as one. Everything the
      // rendition needs already rides the markdown path: md-doc puts a wide
      // table in its own scroller, the house prose styling applies, and the
      // section controls work. A table built here would be a second table
      // treatment to keep in step with that one.
      //
      // kindOf is left alone deliberately. Widening it would change the PEEK
      // too, and a hover card is a glance at the head of a file where the raw
      // line is what a reader recognizes. The extension test lives here because
      // the decision does.
      const asCsv = kind === 'source' && /\.csv$/i.test(path) && window.Csv?.parseLine;
      if (asCsv) { text = csvToMarkdown(text); kind = 'markdown'; }
      if (kind === 'markdown') {
        try {
          await sheetMarked();
          await sheetMdDoc();
          // Fenced FIRST, and the split runs on the fenced text, so the
          // sections the controls cut and the headings the reader sees come
          // from one parse. Fencing swaps `---` for ``` and keeps the block's
          // line count, so the line numbers in a copied reference still point
          // at the file the reader would open.
          const fenced = sp?.fenceFrontmatter ? sp.fenceFrontmatter(text) : text;
          if (window.mdDoc) { window.mdDoc.render(host, fenced, { addr }); return 'rendered'; }
          host.innerHTML = '<div class="prose prose-sm !max-w-none break-words prose-pre:bg-base-200 prose-pre:text-base-content">'
            + window.marked.parse(fenced) + '</div>';
          return 'rendered';
        } catch { /* marked unavailable: fall through to source */ }
      }
      const body = (kind === 'json' && sp?.jsonText) ? sp.jsonText(text) : text;
      host.innerHTML = '<pre class="text-sm font-mono whitespace-pre-wrap m-0">' + esc(body) + '</pre>';
      return 'source';
    }

    // ── The registry chip ─────────────────────────────────────────────────
    // One mark, one meaning: THIS TAB RENDERS THAT REGISTRY FILE. The glyph is
    // ph-stack, the Registries tab's own icon, so the mark and the tab that
    // lists every registry read as the same thing without a word of
    // explanation; the filename is the link and carries the source peek.
    //
    // It replaced a "Curate" button (2026-08-26). Two things were wrong with
    // that button and only one of them was the word. The word named an act
    // nobody performs, since the link opens a GitHub blob and edits nothing.
    // And a button says what you may DO, where the thing worth showing is what
    // the tab IS a rendering of, which is why the chip leads with the filename
    // and the four tabs that already led with theirs (Docs, Tests, Harness,
    // Registries) needed only their uppercase word dropped.
    // Every tab names the file it reads, and until 2026-08-31 it did so three
    // different ways: a bordered chip for a registry, an 11px 40%-opacity link
    // for anything else, and on two tabs an uppercase word in front of it. The
    // distinction those carried, registry against measurement, is real and worth
    // keeping; carrying it as SIZE was not, since it made a measurement look
    // like a footnote and put the actual meaning in a title attribute, which the
    // house style reserves for labels nothing depends on.
    //
    // One shape, three flavours, the flavour in the icon:
    //   registry  a committed inventory, one row per thing (docs/registries.csv)
    //   measured  a derived or dated reading; no rule decides its membership
    //   renders   the page this tab describes, rather than a file it reads
    const CHIP_KIND = {
      registry: ['ph-stack', 'The registry this tab renders'],
      measured: ['ph-ruler', 'A measurement, not a registry'],
      renders: ['ph-app-window', 'The page this tab describes'],
    };
    const chip = (expr, kind = 'registry') => {
      const [icon, title] = CHIP_KIND[kind];
      return `
              <a x-blob="peek(${expr})"
                 class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-base-300 bg-base-200/50 font-mono text-sm text-base-content/70 hover:text-primary hover:border-primary/50 hover:bg-base-200 transition-colors"
                 :title="'${title} (' + ${expr} + ')'">
                <i class="ph ${icon} text-base opacity-50"></i><span x-text="${expr}"></span><i class="ph ph-github-logo opacity-40"></i></a>`;
    };
    const regChip = (expr) => chip(expr, 'registry');

    // Quotes are evidence for a pair, sometimes an entire duplicated document.
    // Keep the first excerpt in the flow and expand the evidence in place.
    const themePassage = `
      <div x-data="{ passageOpen: false }" class="min-w-0">
        <template x-for="(quote, qi) in (passageOpen ? e.quoted : e.quoted.slice(0, 1))" :key="qi">
          <p class="text-base text-base-content/70 leading-6 mt-1 break-words">&ldquo;<span x-text="passageOpen ? quote : themeExcerpt(quote)"></span>&rdquo;</p>
        </template>
        <button type="button" x-show="e.quoted.length > 1 || (e.quoted[0] || '').length > 180"
                @click="passageOpen = !passageOpen" :aria-expanded="passageOpen"
                class="text-sm text-primary py-1 text-left hover:underline"
                x-text="passageOpen ? 'Collapse shared text' : (e.quoted.length > 1 ? 'Show all ' + e.quoted.length + ' passages' : 'Show full passage')"></button>
      </div>`;

    return {
      description: 'Map view: the coordination layer made inspectable, in top-level tabs whose subviews each read a committed registry or payload. What each tab shows is one row per address in docs/map-tabs.csv: its gloss column is the lede under the strip, and its narrative column is the longer account of the tab.',

      template: `
        <div class="w-full">
          <!-- The tab strip. Who carries what is a property of each repo, so
               that lives on the Repos cards, not here. -->
          <!-- data-slot names the unit slot an element fills (data/ui-units/
               codebook.md, "Slots"): this strip is the Tabs of every Map tab,
               the sub-strip the Second-level switch of a tab that has one, and
               the sentence under them each tab's Lede. -->
          <!-- Below lg, one row that scrolls sideways rather than wrapping: on a
               phone the thirteen tabs this strip held until 2026-10-07 took
               five rows before the tab's own content. From lg up it wraps
               again, since a hidden scrollbar would hide the last tabs from a
               mouse. The four tabs since then fit a 390px phone only without
               their icons, so below sm the labels stand alone. -->
          <div class="flex items-center gap-0.5 rounded-lg bg-base-200/60 p-0.5 mb-2 w-fit max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex-wrap" role="tablist" data-slot="frame:tabs">
            <!-- A tab opens the route it names. Docs therefore lands on its
                 Inventory, the concrete index; Purpose and Growth remain
                 adjacent readings under the Docs subview strip. -->
            <template x-for="t in TABS" :key="t.k">
              <button role="tab" @click="setTab(t.k)"
                      :aria-selected="displayTab === t.k"
                      x-effect="displayTab === t.k && $nextTick(() => revealTab($el))"
                      class="shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 rounded-md text-base font-medium transition-colors"
                      :class="displayTab === t.k ? 'bg-base-100 text-primary shadow-sm' : 'text-base-content/60 hover:text-base-content'">
                <i class="ph text-lg max-sm:hidden" :class="t.i"></i><span x-text="t.n"></span></button>
            </template>
          </div>
          <!-- Wraps rather than scrolls: on a phone a scrolling strip, its
               scrollbar hidden, kept three of Docs' six out of sight. -->
          <template x-if="subviews.length">
            <div class="flex flex-wrap items-center gap-0.5 rounded-lg bg-base-200/40 p-0.5 mb-2 w-fit max-w-full"
                 role="tablist" :aria-label="displayTab + ' views'" data-slot="frame:subtabs">
              <template x-for="s in subviews" :key="s.k">
                <button role="tab" @click="setTab(s.k)" :aria-selected="mapTab === s.k"
                        x-effect="mapTab === s.k && $nextTick(() => revealTab($el))"
                        class="shrink-0 whitespace-nowrap flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium transition-colors"
                        :class="mapTab === s.k ? 'bg-base-100 text-primary shadow-sm' : 'text-base-content/50 hover:text-base-content'">
                  <i class="ph text-base" :class="s.i"></i><span x-text="s.n"></span></button>
              </template>
            </div>
          </template>
          <!-- NO text-balance. CSS text-wrap:balance evens the line lengths of
               a short block by NARROWING the measure, so a two-line lede sat in
               half the pane with the other half empty, and the tab that reads
               longest was the one that looked most cramped. The house rule is
               the opposite one: text takes the width it is given. -->
          <!-- min-h holds one line while docs/map-tabs.csv arrives, so the
               cards below do not jump when the sentence lands. -->
          <p class="text-base text-base-content/60 mb-3 leading-6 min-h-6" data-slot="frame:lede"><template x-for="(s, i) in ledeParts" :key="mapTab + i"><span><template x-if="!s.to"><span x-text="s.t"></span></template><template x-if="s.to"><button type="button" @click="openRef(s.to)"
                    class="hover:text-primary cursor-pointer"
                    :data-title-tip="refTip(s.to) || s.to" :data-title-tip-lead="refTip(s.to) ? s.to : null" x-text="s.t"></button></template></span></template>
            <button type="button" x-show="tabGloss" @click="openLedeRow()"
                    class="text-base-content/30 hover:text-primary align-baseline ml-1"
                    :aria-label="'Open this sentence in ' + TAB_LEDES + ', row ' + mapTab"
                    :data-title-tip="TAB_LEDES + ' · ' + mapTab"><i class="ph ph-arrow-up-right"></i></button></p>
          <!-- ── Docs / Purpose ─────────────────────────── -->
          <section x-show="mapTab==='aims'">
            <div class="flex items-center gap-2 flex-wrap mb-3">
              ${chip('AIMS_MANIFEST', 'measured')}
              <div class="grow"></div>
              <button type="button" @click="copyAimsMd()" :disabled="!aims"
                      class="flex items-center gap-1.5 text-base text-base-content/60 hover:text-primary px-2 py-1 rounded-lg hover:bg-base-200 transition-colors disabled:opacity-40">
                <i class="ph ph-clipboard-text text-lg"></i>Copy as Markdown</button>
            </div>
            <template x-if="aimsErr">
              <div class="text-error text-sm mb-4" x-text="aimsErr"></div>
            </template>
            <template x-if="aims">
              <div class="flex flex-col gap-10" data-pattern="fields">
                <div class="grid gap-x-8 gap-y-3 lg:grid-cols-[7rem_1fr]">
                  <div class="text-sm uppercase tracking-widest text-base-content/40">Mission</div>
                  <p class="text-2xl leading-9 font-medium" x-text="aims.mission"></p>
                </div>
                <div class="grid gap-x-8 gap-y-3 lg:grid-cols-[7rem_1fr]">
                  <div class="text-sm uppercase tracking-widest text-base-content/40">Goals</div>
                  <ol class="flex flex-col gap-5">
                    <template x-for="(g, i) in aims.goals" :key="g.key">
                      <li class="grid grid-cols-[2rem_1fr] items-baseline">
                        <span class="text-sm tabular-nums text-base-content/40" x-text="i + 1"></span>
                        <div class="text-xl leading-8">
                          <span class="font-semibold" x-text="g.name + '.'"></span>
                          <span x-text="' ' + g.gloss"></span>
                        </div>
                      </li>
                    </template>
                  </ol>
                </div>
                <div class="grid gap-x-8 gap-y-3 lg:grid-cols-[7rem_1fr]" x-show="aims.initiatives?.length">
                  <div class="text-sm uppercase tracking-widest text-base-content/40">Initiatives</div>
                  <ol class="flex flex-col gap-5">
                    <template x-for="(init, i) in aims.initiatives" :key="init.key">
                      <li class="grid grid-cols-[2rem_1fr] items-baseline">
                        <span class="text-sm tabular-nums text-base-content/40" x-text="i + 1"></span>
                        <div class="text-xl leading-8">
                          <span class="font-semibold" x-text="init.name + '.'"></span>
                          <span x-text="' ' + init.gloss"></span>
                        </div>
                      </li>
                    </template>
                  </ol>
                </div>
                <div class="grid gap-x-8 gap-y-3 lg:grid-cols-[7rem_1fr]">
                  <div class="text-sm uppercase tracking-widest text-base-content/40">Reading</div>
                  <div class="flex flex-col gap-3">
                    <template x-for="r in aims.reading" :key="r.path">
                      <div class="text-lg leading-7">
                        <a :href="readingUrl(r)" target="_blank" rel="noopener"
                           class="font-mono text-sm underline underline-offset-4 decoration-[var(--color-base-300)] hover:text-primary"
                           x-text="(r.repo ? r.repo.split('/')[1] + ' ' : '') + r.path"></a>
                        <span x-show="r.private" class="text-sm uppercase tracking-widest text-base-content/40"> private</span>
                        <span class="text-base-content/70" x-text="' ' + r.gloss"></span>
                      </div>
                    </template>
                    <button type="button" @click="goRepos()"
                            class="self-start flex items-center gap-1.5 text-base text-base-content/60 hover:text-primary px-2 py-1 -ml-2 rounded-lg hover:bg-base-200 transition-colors"
                            title="Each repo's own scope statement, on its card">
                      <i class="ph ph-squares-four text-lg"></i>What each repo is for</button>
                  </div>
                </div>
              </div>
            </template>
          </section>
          <!-- ── Reach: the hub, its delivery routes, the set, the outposts ── -->
          <!-- A diagram drawn from data, with no prose. Nodes are the hub's
               own .web-tools.json, every estate repository in the crawled
               config cache (with a token), and docs/outposts.csv; a repository
               an outpost names that no manifest read supplies is drawn as
               named, not read. Edges are docs/portable.csv rows counted by
               their use column. Layout is a grid, so type stays at reading
               size and the phone gets a stack; the SVG layer only draws lines
               between boxes the grid placed, measured in reachMeasure(). -->
          <section x-show="mapTab==='reach'" x-effect="mapTab === 'reach' && $nextTick(() => reachMeasure())">
            <div class="flex items-center gap-x-4 gap-y-2 mb-6 flex-wrap text-sm text-base-content/50">
${regChip('SET_MANIFEST')}
${regChip('OUTPOSTS_MANIFEST')}
              <div class="grow"></div>
              <span class="flex items-center gap-1.5"><span class="inline-block w-4 h-3 rounded border-2 border-base-content/40"></span>public</span>
              <span class="flex items-center gap-1.5"><span class="inline-block w-4 h-3 rounded border-2 border-dashed border-base-content/40"></span>private</span>
              <span class="flex items-center gap-1.5"><span class="inline-block w-4 h-3 rounded border-2 border-dotted border-base-content/25"></span>unknown</span>
            </div>
            <div x-show="reachLoading && !reachRepos" class="flex justify-center py-10">
              <span class="loading loading-dots loading-md opacity-30"></span>
            </div>
            <div x-ref="reach" x-show="reachRepos" data-reach
                 x-init="window.ResizeObserver && new ResizeObserver(() => reachMeasure()).observe($el)"
                 class="relative grid grid-cols-1 gap-y-5 @3xl:gap-y-0 @3xl:items-center @3xl:grid-cols-[minmax(9rem,auto)_minmax(7rem,1fr)_minmax(13rem,auto)_minmax(3rem,0.7fr)_minmax(12rem,auto)]">
              <!-- Markup, not x-for: a <template> inside <svg> is an SVG element,
                   not an HTML template, so Alpine cannot loop over it. Clicks
                   and hovers are delegated from the paths' data-route. -->
              <svg class="absolute inset-0 w-full h-full overflow-visible pointer-events-none" aria-hidden="true"
                   x-html="reachSvg" @click="$event.target.dataset?.route && reachEdgeClick($event.target.dataset.route)"
                   @mouseover="reachHot = $event.target.dataset?.route || ''" @mouseout="reachHot = ''"></svg>
              <!-- The hub -->
              <div class="relative @3xl:col-start-1 justify-self-start" data-reach-node="hub">
                <template x-for="r in reachRepos?.filter(r => r.hub) || []" :key="r.repo">
                  <button type="button" class="flex items-center gap-2 px-3 py-2 rounded-box bg-base-100 border-2 hover:border-primary"
                          data-reach-hub data-reach-tip :class="reachVisClass(r)" :aria-expanded="reachTipIs('repo', r.repo)"
                          @click="toggleReachTip('repo', r.repo, $el)" @mouseenter="hoverReachTip('repo', r.repo, $el)" @mouseleave="leaveReachTip()">
                    <i class="ph text-xl text-primary" :class="r.icon || 'ph-git-branch'"></i>
                    <span class="text-lg font-semibold" x-text="r.name"></span>
                    <i x-show="r.vis === 'private'" class="ph ph-lock-simple text-base-content/40"></i>
                  </button>
                </template>
              </div>
              <!-- The routes: one per use value, counted -->
              <div class="relative @3xl:col-start-2 flex flex-row flex-wrap gap-2 @3xl:flex-col @3xl:items-center @3xl:gap-3 @3xl:py-4">
                <template x-for="rt in reachRoutes" :key="rt.use">
                  <button type="button" :data-reach-route="rt.use" data-reach-tip :aria-expanded="reachTipIs('route', rt.use)"
                          @click="toggleReachTip('route', rt.use, $el)"
                          @mouseenter="reachHot = rt.use; hoverReachTip('route', rt.use, $el)" @mouseleave="reachHot = ''; leaveReachTip()"
                          class="flex items-baseline gap-2 px-2.5 py-1 rounded-full border bg-base-100 transition-colors"
                          :class="reachHot === rt.use ? 'border-primary text-primary' : 'border-base-300 text-base-content/70 hover:border-primary hover:text-primary'">
                    <span class="font-mono text-sm" x-text="rt.use"></span>
                    <span class="text-base font-semibold tabular-nums" x-text="rt.n"></span>
                  </button>
                </template>
              </div>
              <!-- The set: every repository a manifest read supplies -->
              <div class="relative @3xl:col-start-3 rounded-box border border-base-300 bg-base-200/40 p-3 flex flex-col gap-2" data-reach-set>
                <template x-for="r in reachRepos?.filter(r => !r.hub) || []" :key="r.repo">
                  <button type="button" class="flex items-center gap-2 px-3 py-1.5 rounded-box bg-base-100 border-2 text-left hover:border-primary"
                          :data-reach-repo="r.repo" data-reach-tip :class="reachVisClass(r)" :aria-expanded="reachTipIs('repo', r.repo)"
                          @click="toggleReachTip('repo', r.repo, $el)" @mouseenter="hoverReachTip('repo', r.repo, $el)" @mouseleave="leaveReachTip()">
                    <i class="ph text-lg" :class="(r.icon || 'ph-git-branch') + (r.read ? ' text-base-content/70' : ' text-base-content/30')"></i>
                    <span class="text-base" :class="r.read ? 'font-medium' : 'text-base-content/50'" x-text="r.name"></span>
                    <i x-show="r.vis === 'private'" class="ph ph-lock-simple text-base-content/40"></i>
                  </button>
                </template>
                <span x-show="reachRepos && !reachRepos.some(r => !r.hub)" class="text-sm text-base-content/40 px-1">0</span>
              </div>
              <!-- The outposts -->
              <div class="relative @3xl:col-start-5 flex flex-col gap-2">
                <template x-for="o in reachOutposts" :key="o.id">
                  <button type="button" :data-reach-outpost="o.id" data-reach-tip :aria-expanded="reachTipIs('outpost', o.id)"
                          @click="toggleReachTip('outpost', o.id, $el)" @mouseenter="hoverReachTip('outpost', o.id, $el)" @mouseleave="leaveReachTip()"
                          class="flex items-center gap-2 px-3 py-1.5 rounded-box border border-dashed border-base-content/25 text-left hover:border-primary hover:text-primary">
                    <i class="ph ph-flag-pennant text-lg text-base-content/50"></i>
                    <span class="text-base" x-text="o.title"></span>
                    <span class="font-mono text-sm text-base-content/40 @3xl:hidden" x-text="o.from.split('/')[1]"></span>
                  </button>
                </template>
              </div>
            </div>
            <!-- z-[60], under the swipe deck's z-[70]: a file opened from the
                 panel covers it, and closing the deck finds it still pinned. -->
            <!-- The node panel-tip: what a node holds, read in place, so the
                 diagram stays in view. Hover opens it where the pointer is
                 fine; a click pins it, and on touch every tap does.
                 kits/panel-tip.js owns the way out. A file row opens the
                 swipe deck at that file; leaving the diagram is the quiet
                 link at the panel's foot, never the default. -->
            <div x-ref="reachTip" x-show="reachTip" role="dialog" :aria-label="reachTipBody?.title || 'Node'"
                 @mouseenter="clearTimeout(_reachTipT)" @mouseleave="leaveReachTip()"
                 class="fixed z-[60] rounded-xl border border-base-300 bg-base-100 shadow-lg px-4 py-3 text-sm leading-6 max-h-[min(70vh,32rem)] overflow-y-auto"
                 :style="reachTip ? 'left:' + reachTip.x + 'px;top:' + reachTip.y + 'px;width:' + reachTip.w + 'px' : ''">
              <div x-html="reachTipClose"></div>
              <template x-if="reachTipBody">
                <div class="flex flex-col gap-3" :class="reachTipClose && 'pr-6'">
                  <!-- One header for every kind: what it is, then its ways out,
                       at the top beside the ✕ rather than in a footer. -->
                  <div class="flex items-center gap-2 min-w-0">
                    <i class="ph text-xl shrink-0" :class="reachTipBody.icon + (reachTipBody.kind === 'repo' ? ' text-primary' : ' text-base-content/60')"></i>
                    <span class="text-base font-semibold truncate" :class="reachTipBody.kind === 'repo' && 'font-mono'" x-text="reachTipBody.title"></span>
                    <span x-show="reachTipBody.badge" class="font-mono text-xs text-base-content/50 shrink-0" x-text="reachTipBody.badge"></span>
                    <div class="grow"></div>
                    <template x-for="l in reachTipBody.links" :key="l.label">
                      <a :href="l.href || null" :target="l.href ? '_blank' : null" rel="noopener" :aria-label="l.label"
                         @click="l.go && ($event.preventDefault(), closeReachTip(), l.go())"
                         class="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md cursor-pointer text-base-content/50 hover:text-primary hover:bg-base-200">
                        <i class="ph text-base" :class="l.icon"></i><span x-show="l.text" class="text-sm" x-text="l.text"></span></a>
                    </template>
                  </div>

                  <!-- A repository: the Repos card's grammar. Its one-line note,
                       the alignment verdict and its checks as chips, and one row
                       of icon counts. -->
                  <template x-if="reachTipBody.kind === 'repo'">
                    <div class="flex flex-col gap-2.5">
                      <p x-show="reachTipBody.note" class="text-base text-base-content/80 text-pretty" x-text="reachTipBody.note"></p>
                      <div x-show="reachTipBody.verdict || reachTipBody.checks.length" class="flex flex-wrap items-center gap-1.5">
                        <span x-show="reachTipBody.verdict" class="badge badge-sm" :class="reachTipBody.verdict === 'aligned' || reachTipBody.verdict === 'source' ? 'badge-success' : 'badge-warning'" x-text="reachTipBody.verdict"></span>
                        <template x-for="c in reachTipBody.checks" :key="c.label">
                          <span class="badge badge-sm gap-1" :class="c.on ? 'badge-outline' : 'badge-ghost text-base-content/40'">
                            <i class="ph text-xs" :class="c.on ? 'ph-check' : 'ph-x'"></i><span x-text="c.label"></span></span>
                        </template>
                      </div>
                      <code x-show="reachTipBody.install" class="self-start font-mono text-xs bg-base-200 rounded px-2 py-1" x-text="reachTipBody.install"></code>
                      <div x-show="reachTipBody.facts.length" class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-base-content/60">
                        <template x-for="f in reachTipBody.facts" :key="f.icon">
                          <span class="inline-flex items-center gap-1.5"><i class="ph text-base" :class="f.icon"></i><span x-text="f.text"></span></span>
                        </template>
                      </div>
                    </div>
                  </template>

                  <!-- A route: its files grouped by kind, each a count over
                       wrapped name chips, in a bounded box that scrolls. -->
                  <template x-if="reachTipBody.kind === 'route'">
                    <div class="flex flex-col gap-2.5 max-h-72 overflow-y-auto -mx-1 px-1">
                      <template x-for="g in reachTipBody.groups" :key="g.kind">
                        <div class="flex flex-col gap-1">
                          <div class="flex items-center gap-1.5 font-mono text-xs text-base-content/50">
                            <i class="ph" :class="g.icon"></i><span x-text="g.kind"></span><span x-text="g.rows.length"></span>
                          </div>
                          <div class="flex flex-wrap gap-1">
                            <template x-for="it in g.rows" :key="it.path">
                              <button type="button" class="px-2 py-0.5 rounded-md bg-base-200/70 hover:bg-primary/10 hover:text-primary"
                                      @click="openReachRow(it)" x-text="it.title || it.path"></button>
                            </template>
                          </div>
                        </div>
                      </template>
                    </div>
                  </template>

                  <!-- An outpost: where it is, then its mechanism drawn as one.
                       The declaration and the observation side by side, the
                       check that compares them, the record it writes. -->
                  <template x-if="reachTipBody.kind === 'outpost'">
                    <div class="flex flex-col gap-2.5">
                      <p class="text-base text-base-content/80 text-pretty" x-text="reachTipBody.where"></p>
                      <div class="grid grid-cols-2 gap-1.5">
                        <template x-for="b in [['declared', 'ph-file-text', reachTipBody.declared], ['observed', 'ph-eye', reachTipBody.observed]]" :key="b[0]">
                          <div class="rounded-lg border border-base-300 px-2.5 py-1.5 min-w-0">
                            <div class="flex items-center gap-1 font-mono text-xs text-base-content/50"><i class="ph" :class="b[1]"></i><span x-text="b[0]"></span></div>
                            <div class="text-sm break-words" :class="b[2].loc && 'font-mono text-xs mt-0.5'" x-text="b[2].text"></div>
                          </div>
                        </template>
                        <div class="col-span-2 flex justify-center text-base-content/30 -my-1"><i class="ph ph-arrows-in-line-vertical"></i></div>
                        <div class="col-span-2 rounded-lg border border-base-300 bg-base-200/40 px-2.5 py-1.5">
                          <div class="flex items-center gap-1 font-mono text-xs text-base-content/50"><i class="ph ph-check-circle"></i><span>check</span>
                            <span class="ml-auto font-sans" x-text="reachTipBody.cadence"></span></div>
                          <div class="font-mono text-xs mt-0.5 break-words" x-text="reachTipBody.check"></div>
                        </div>
                        <div x-show="reachTipBody.record" class="col-span-2 flex items-start gap-1.5 px-1 text-sm text-base-content/60">
                          <i class="ph ph-notebook mt-0.5"></i><span class="font-mono text-xs break-words" x-text="reachTipBody.record"></span>
                        </div>
                      </div>
                    </div>
                  </template>
                </div>
              </template>
            </div>
            <div x-show="reachErr" class="mt-4 text-base text-error font-mono" x-text="reachErr"></div>
          </section>

          <!-- ── Distribution ────────────────────────────────────────────── -->
          <section x-show="mapTab==='set'">
            <div class="flex items-center gap-2 mb-4 flex-wrap">
${regChip('SET_MANIFEST')}
              <code class="text-sm text-base-content/50">/plugin install portable@web-tools</code>
              <div class="grow"></div>
              <button type="button" @click="openDoctrine()"
                      class="flex items-center gap-1.5 text-base text-base-content/60 hover:text-primary px-2 py-1 rounded-lg hover:bg-base-200 transition-colors"
                      title="The constellation doctrine: what goes where, and why">
                <i class="ph ph-compass"></i><span>The theory</span>
              </button>
            </div>
            <!-- This is a delivery crosswalk, not a fourth inventory. The
                 owning tabs carry the canonical descriptions and controls;
                 these doors make that relationship explicit before the rows
                 repeat it one artifact at a time. -->
            <div class="flex items-baseline gap-x-3 gap-y-1 mb-4 flex-wrap text-sm text-base-content/50">
              <span>Canonical inventories:</span>
              <button type="button" @click="setTab('skills')"
                      class="font-semibold text-base-content/70 hover:text-primary">Skills</button>
              <button type="button" @click="setTab('docs')"
                      class="font-semibold text-base-content/70 hover:text-primary">Docs</button>
              <button type="button" @click="setTab('harness')"
                      class="font-semibold text-base-content/70 hover:text-primary">Automation</button>
            </div>
            <div x-show="setLoading" class="flex justify-center py-10">
              <span class="loading loading-dots loading-md opacity-30"></span>
            </div>
            <div x-show="manifest" class="flex items-center gap-3 flex-wrap mb-4">
              <label class="input input-sm input-bordered flex items-center gap-2 grow max-w-md" data-slot="frame:search">
                <i class="ph ph-magnifying-glass opacity-40"></i>
                <!-- One tab is visible at a time, so the shell's bare-key
                     router can safely prefer this local search over its
                     sidebar finder. -->
                <input type="search" class="grow"
                       placeholder="search title, path, command, or role"
                       data-find-box x-model="setQ">
              </label>
              <span class="text-sm">
                <span class="font-semibold text-lg" x-text="setTally.shown"></span>
                <span class="text-base-content/50"
                      x-text="setTally.shown === setTally.total ? ' artifacts' : ' of ' + setTally.total + ' artifacts'"></span>
              </span>
              <button type="button" x-show="setUse" @click="setUse = ''"
                      class="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-primary text-primary text-sm">
                <span class="text-base-content/50">use</span><span class="font-mono" x-text="setUse"></span><i class="ph ph-x"></i></button>
            </div>
            <!-- Container widths, not viewport ones: this grid has to answer to
                 the pane it is in, which the dock can make 416px wide while the
                 window stays 1440. See the @container note on <main>. -->
            <!-- Declared a List with named parts (data/ui-units/codebook.md,
                 "Declaring a pattern in markup"); nothing at runtime reads the
                 attributes. Each delivery route's heading is a group; the
                 sentence under it glosses the group, not an item. -->
            <div class="grid gap-x-8 gap-y-6 @3xl:grid-cols-2 @5xl:grid-cols-3"
                 data-pattern="list" data-part="list">
              <template x-for="sec in setSections" :key="sec.key">
                <div>
                  <div class="flex items-baseline gap-2 mb-2" data-part="group">
                    <h3 class="text-sm font-semibold uppercase tracking-wide text-base-content/40" x-text="sec.label"></h3>
                    <span class="text-sm tabular-nums text-base-content/30" data-part="meta" x-text="sec.items.length"></span>
                  </div>
                  <p class="text-sm text-base-content/50 mb-2" data-part="summary" x-text="sec.gloss"></p>
                  <div class="flex flex-col gap-1">
                    <template x-for="it in sec.items" :key="it.path">
                      <div class="flex items-start gap-2.5 px-2 py-1.5 rounded-lg hover:bg-base-200/60 group" data-part="item">
                        <i class="ph mt-1 text-base-content/40 shrink-0" data-part="meta" :class="kindIcon(it)"></i>
                        <div class="min-w-0 flex-1">
                          <div class="flex items-center gap-2 flex-wrap">
                            <button type="button" class="text-base font-medium hover:text-primary text-left"
                                    @click="openItem(it)" data-part="title" x-text="it.title"></button>
                            <code x-show="it.command" class="text-sm text-base-content/50" data-part="meta" x-text="it.command"></code>
                            <span class="badge badge-outline badge-sm" data-part="meta" x-text="kindLabel(it)"></span>
                            <!-- Inline with the badges, always visible, the way
                                 the Docs tab already carries it. Parked at the
                                 row's far edge under opacity-0 plus
                                 group-hover:opacity-100 it did not exist until
                                 hovered and then sat at 30%, so the peek behind
                                 it went undiscovered: reported 2026-08-20 as
                                 "the GitHub icon buttons are quite faint", by a
                                 reader who had not known the peek was there. A
                                 hover-only affordance also has no touch
                                 equivalent, which is the other half.
                                 NO BACKTICKS IN HERE: the template is itself a
                                 template literal, so a code span closes it. -->
                            <a :href="itemGh(it)" :data-peek="it.kind === 'dir' ? null : peek(it.path)"
                               target="_blank" rel="noopener" title="Open on GitHub" data-part="actions"
                               class="text-base-content/30 hover:text-primary">
                              <i class="ph ph-github-logo"></i></a>
                            <button type="button" @click="openSetOwner(it)" data-part="links"
                                    class="inline-flex items-center gap-1 text-sm text-base-content/50 hover:text-primary"
                                    :title="'Open in ' + setOwner(it).label">
                              <span x-text="setOwner(it).label"></span><i class="ph ph-arrow-right"></i></button>
                          </div>
                          <code class="block text-xs text-base-content/40 truncate" data-part="meta" x-text="it.path"></code>
                          <p class="text-base text-base-content/60" data-part="summary" x-text="setRole(it)"></p>
                        </div>
                      </div>
                    </template>
                  </div>
                </div>
              </template>
            </div>
            <p x-show="manifest && !setTally.shown" class="text-base text-base-content/50 py-6">
              No distribution entries match this search.</p>
            <div x-show="setErr" class="text-base text-error font-mono" x-text="setErr"></div>
          </section>

          <!-- ── Surfacing: what to hand over, and how ────────────────────── -->
          <!-- Ownership runs the other way here: SURFACING.md is authoritative
               (sessions load and follow the prose) and the manifest is its
               gated index, so the header leads with the doc. Surfacing decides
               what to hand over; Showing is what makes it openable. -->
          <section x-show="mapTab==='surfacing'">
            <!-- "Primitives, indexed from", NOT "The doc (authoritative)". The
                 old label made the ownership claim (prose over index) in a
                 wording that read as a coverage claim, and the cards under it
                 are one region of four. The ownership survives in the comment
                 above; the label now says what the cards are. -->
            <div class="flex items-center gap-2 mb-2 flex-wrap">
              <span class="text-sm font-semibold uppercase tracking-wide text-base-content/40">Primitives, indexed from</span>
              <code class="text-sm text-base-content/50" x-text="SURF_DOC"></code>
              <a x-blob="peek(SURF_DOC)"
                 class="text-base-content/40 hover:text-primary" :title="SURF_DOC + ' on GitHub'">
                <i class="ph ph-github-logo"></i></a>
              <!-- THE HOUSE DECK DOOR, not a button of this tab's own. It was
                   a book glyph beside the word "Read", which named the act
                   twice and matched nothing else in the estate; every other
                   surface with a reader (branch-brief, session-brief,
                   search-view, the viewer's records) wears swipeDeck.entry's
                   one glyph, one wording, one hit target. The classes and the
                   title are that function's, held to it by test
                   (node/test/deck-entry-parity.test.mjs), because the kit
                   loads on demand and is not on the page at first paint.
                   Ghost, since the cards below are what this tab is: the deck
                   is one lens, the way it is in the shared viewer's header. -->
              <button type="button" @click="openSurfDeck()"
                      class="btn btn-square btn-sm max-sm:h-11 max-sm:w-11 btn-ghost hover:text-primary"
                      :title="'Read ' + plural(surfDeckFiles.length, 'file') + ' one at a time'">
                <i class="ph ph-cards-three text-lg max-sm:text-xl"></i></button>
${regChip('SURF_MANIFEST')}
              <div class="grow"></div>
            </div>
            <!-- THE DOC'S OTHER REGIONS, as doors rather than as a second block
                 type: the course is a template and the handoff a closing line,
                 neither one row per thing, so neither is a card. A door opens
                 the deck at that heading, the way a card's title opens it at
                 the bullet, and the gloss says when the region reaches a
                 session. Content routes are in the Session context page. -->
            <div x-show="surf && surf.regions.length"
                 class="flex items-baseline gap-x-3 gap-y-1 mb-3 flex-wrap text-sm text-base-content/50">
              <span>Also in the system:</span>
              <template x-for="r in (surf ? surf.regions : [])" :key="r.heading">
                <span class="inline-flex items-baseline gap-1">
                  <button type="button" class="font-semibold text-left text-base-content/70 hover:text-primary"
                          :title="'Open ' + r.path"
                          @click="showRegion(r)" x-text="r.heading"></button>
                  <span x-show="r.gloss" x-text="'· ' + r.gloss"></span>
                </span>
              </template>
            </div>
            <div x-show="surfLoading" class="flex justify-center py-10">
              <span class="loading loading-dots loading-md opacity-30"></span>
            </div>
            <div x-show="surfErr" class="text-base text-error font-mono" x-text="surfErr"></div>
            <template x-if="surf">
              <!-- Declared a Card grid with named parts (data/ui-units/codebook.md,
                   "Declaring a pattern in markup"); nothing at runtime reads the
                   attributes. The region doors above are the frame's. -->
              <div class="grid gap-2 lg:grid-cols-2 max-w-6xl"
                   data-pattern="card-grid" data-part="list">
                <template x-for="p in surf.primitives" :key="p.key">
                  <div class="border border-base-300 rounded-lg p-3 bg-base-100" data-part="item">
                    <div class="flex items-baseline gap-2 flex-wrap">
                      <span x-show="p.glyph" data-part="meta" x-text="p.glyph"></span>
                      <!-- THE TITLE IS THE DOOR, which is the idiom this view
                           already runs: a Docs row's title opens the deck on
                           that file, and a card's title opens it on the bullet
                           this card paraphrases. The whole card was the other
                           candidate and it takes the reader's text selection
                           away from the form and boundary lines, which are the
                           two things anyone copies out of here. -->
                      <button type="button" class="font-semibold text-left hover:text-primary"
                              :title="'Show ' + p.title + ' in ' + SURF_DOC"
                              @click="showPrimitive(p, $event.currentTarget.closest('div.border'))"
                              data-part="title" x-text="p.title"></button>
                    </div>
                    <p class="text-base text-base-content/70 mt-1" data-part="summary" x-text="p.use"></p>
                    <code x-show="p.form" class="text-sm text-primary break-all block mt-1" data-part="body" x-text="p.form"></code>
                    <p x-show="p.boundary" class="text-sm text-base-content/50 mt-1" data-part="body" x-text="p.boundary"></p>
                  </div>
                </template>
              </div>
            </template>
          </section>

          <!-- ── Showing: how content moves, renders, and gets looked at ──── -->
          <section x-show="mapTab==='showing'">
            <!-- Four files meet in this header and the reader has to be able
                 to tell them apart. The RENDERER is the runtime the tab
                 describes, under its own label. The three registry chips are
                 the rows: showing-mechanisms, routes-modes, routes-routes.
                 And docs/routes.json, faint at the end, is what was left when
                 those three became CSVs of their own on 2026-08-18: the address
                 grammar, the parameter precedence, and the showing frame (the
                 three axes and the picker rules). Its showing block is
                 structured, so this is not "prose versus data"; it is that no
                 part of it is one row per thing, which is why it has no row in
                 docs/registries.csv and gets no chip. docs/showing.md is the
                 other half of that frame, behind The frame button, and the two
                 do not overlap: routes.json holds the reference layer,
                 showing.md holds why the boundaries sit where they do.
                 routes-manifest.test.mjs gates the split in both directions.
                 routes.json carried the lone Curate button until 2026-08-26, so
                 the one file the button opened held none of the rows. -->
            <div class="flex items-center gap-2 mb-3 flex-wrap">
${chip('rendererPath', 'renders')}${regChip('SHOWING_MECHANISMS')}${regChip('ROUTES_MODES')}${regChip('ROUTES_ROUTES')}${regChip('ROUTES_PASTE')}${chip('ROUTES_MANIFEST', 'measured')}
              <div class="grow"></div>
              <button type="button" @click="openHubFile(SHOWING_FRAME)"
                      class="flex items-center gap-1.5 text-base text-base-content/60 hover:text-primary px-2 py-1 rounded-lg hover:bg-base-200 transition-colors"
                      :title="'Why the boundaries sit where they are (' + SHOWING_FRAME + ')'">
                <i class="ph ph-book-open"></i><span>The frame</span>
              </button>
            </div>
            <div x-show="routesLoading" class="flex justify-center py-10">
              <span class="loading loading-dots loading-md opacity-30"></span>
            </div>
            <div x-show="routesErr" class="text-base text-error font-mono" x-text="routesErr"></div>
            <template x-if="routes">
              <div class="flex flex-col gap-4">

                <!-- Showing: which mechanism gets a subject in front of a
                     viewer. This leads Transport because it is the question
                     everything below serves, and it is the one that used to be
                     answered by 1,589 words in CLAUDE.md that were in context
                     during the session that still handed over the wrong link.
                     A rule nobody can hold is a rule the app should hold: the
                     rows are read from docs/showing-mechanisms.csv, so the
                     reference and the router cannot drift, and the doc points
                     here rather than restating it. -->
                <div x-show="routes.showing">
                  <h3 class="text-sm font-semibold uppercase tracking-wide text-base-content/40 mb-2">Showing</h3>
                  <p class="text-base text-base-content/60 mb-3" x-text="routes.showing?.note"></p>

                  <!-- The three axes, since the mechanism table below is a
                       lookup over them and reads as an arbitrary list without
                       them stated first. -->
                  <div class="grid gap-2 sm:grid-cols-3 mb-4">
                    <template x-for="[axis, vals] in Object.entries(routes.showing?.axes || {})" :key="axis">
                      <div class="border border-base-300 rounded-lg p-2.5 bg-base-100">
                        <div class="text-base font-semibold uppercase tracking-wide text-base-content/40" x-text="axis"></div>
                        <ul class="mt-1 flex flex-col gap-0.5">
                          <template x-for="v in vals" :key="v">
                            <li class="text-base text-base-content/60" x-text="v"></li>
                          </template>
                        </ul>
                      </div>
                    </template>
                  </div>

                  <!-- Declared a Card grid with named parts (data/ui-units/codebook.md,
                       "Declaring a pattern in markup"); nothing at runtime reads
                       the attributes. Only the mechanism cards: the axis cards
                       above are their key, and Kinds and the sections below are
                       regions of their own, left undeclared. -->
                  <div class="flex flex-col gap-2"
                       data-pattern="card-grid" data-part="list">
                    <template x-for="m in (routes.showing?.mechanisms || [])" :key="m.key">
                      <div class="border border-base-300 rounded-lg p-3 bg-base-100"
                           :class="m.key === 'none' && 'border-dashed'" data-part="item">
                        <div class="flex items-baseline gap-2 flex-wrap">
                          <span class="font-semibold" data-part="title" x-text="m.label"></span>
                          <code x-show="m.form" class="text-base text-primary break-all" data-part="body" x-text="m.form"></code>
                        </div>
                        <p class="text-base text-base-content/70 mt-1.5" data-part="summary" x-text="m.use"></p>
                        <div class="grid gap-x-4 gap-y-0.5 sm:grid-cols-2 mt-2" data-part="body">
                          <p x-show="m.reaches" class="text-base text-success/80">
                            <span class="font-semibold">reaches</span> <span x-text="m.reaches"></span></p>
                          <p x-show="m.misses" class="text-base text-error/70">
                            <span class="font-semibold">misses</span> <span x-text="m.misses"></span></p>
                        </div>
                        <p x-show="m.trap" class="text-base text-warning mt-1.5 flex items-start gap-1.5" data-part="body">
                          <i class="ph ph-warning shrink-0 mt-0.5"></i><span x-text="m.trap"></span></p>
                        <div class="flex flex-wrap gap-1.5 mt-2">
                          <template x-for="t in (m.subject || '').split(';').filter(Boolean)" :key="t">
                            <span class="badge badge-ghost badge-sm" data-part="meta" :data-title-tip="subjectGloss(t)" x-text="'subject: ' + t"></span>
                          </template>
                          <span class="badge badge-ghost badge-sm" data-part="meta" x-text="'version: ' + m.version"></span>
                          <span class="badge badge-ghost badge-sm" data-part="meta" x-text="'viewer: ' + m.viewer"></span>
                        </div>
                      </div>
                    </template>
                  </div>

                  <!-- The picker: the choice follows from a branch's changed
                       files, so it is derivable rather than remembered. -->
                  <div x-show="routes.showing?.picker" class="mt-3 border border-base-300 rounded-lg p-3 bg-base-200/40">
                    <p class="text-base text-base-content/60 mb-2" x-text="routes.showing?.picker?.note"></p>
                    <template x-for="r in (routes.showing?.picker?.rules || [])" :key="r.when">
                      <div class="text-base flex items-baseline gap-2">
                        <span class="text-base-content/50 shrink-0">if</span>
                        <span x-text="r.when"></span>
                        <span class="text-base-content/30">&rarr;</span>
                        <code class="text-primary" x-text="r.then"></code>
                      </div>
                    </template>
                  </div>
                </div>

                <!-- Kinds: the subject axis above, one level down. The axis
                     says a file needs a renderer; this says which file, which
                     renderer, and what you can do once it is open. It sits here
                     rather than on a tab of its own because it is the same
                     question the axes ask: three pieces of code were answering
                     it privately (ViewRegistry.READ_MODE, the toss routes, and
                     md-doc's declaration) and the row is what joins them. The
                     subject and shown_by cells are checked against the two
                     tables above by routes-manifest.test.mjs, so the columns are
                     a join rather than a resemblance. -->
                <div x-show="routes.kinds?.length">
                  <h3 class="text-sm font-semibold uppercase tracking-wide text-base-content/40 mb-2">Kinds</h3>
                  <p class="text-base text-base-content/60 mb-3">What the subject IS, one level under the axis above: how it is recognized, which viewer mode it opens in, and what a note can be pinned to inside it. An empty aim cell means the universal three (page, element, region) and nothing more.</p>
                  <div class="grid gap-2 sm:grid-cols-2">
                    <template x-for="k in routes.kinds" :key="k.kind">
                      <div class="border border-base-300 rounded-lg p-2.5 bg-base-100 flex flex-col gap-1.5">
                        <div class="flex items-baseline gap-2 flex-wrap">
                          <span class="text-base font-semibold" x-text="k.label"></span>
                          <code class="text-[11px] text-base-content/40" x-text="k.kind"></code>
                          <div class="grow"></div>
                          <span class="badge badge-ghost badge-sm" :data-title-tip="subjectGloss(k.subject)" x-text="k.subject"></span>
                        </div>
                        <div class="text-base text-base-content/60">
                          <span class="text-base-content/40">recognized by</span>
                          <span x-text="k.detect"></span>
                          <span x-show="k.exclusive" class="text-base-content/40" data-title-tip="An exclusive module: it outranks any default mode a host sets."> (exclusive)</span>
                        </div>
                        <div class="flex flex-wrap items-center gap-1">
                          <span x-show="k.view" class="badge badge-sm badge-outline" :data-title-tip="'Opens in the ' + k.view + ' viewer mode'" x-text="'view: ' + k.view"></span>
                          <span x-show="k.route" class="badge badge-sm badge-outline" :data-title-tip="'Addressed by the ' + k.route + ' toss route'" x-text="'#' + k.route + '='"></span>
                          <template x-for="m in (k.shown_by || '').split(';').filter(Boolean)" :key="m">
                            <span class="badge badge-sm badge-ghost" data-title-tip="A showing mechanism from the table above" x-text="m"></span>
                          </template>
                        </div>
                        <div x-show="k.unit" class="text-base text-base-content/60">
                          <span class="text-base-content/40">unit</span>
                          <span x-text="k.unit"></span>
                          <span x-show="k.address" class="text-base-content/40">, reads as</span>
                          <code x-show="k.address" class="text-primary" x-text="k.address"></code>
                        </div>
                        <div x-show="k.kit" class="text-base">
                          <a x-blob="peek(k.kit)"
                             class="font-mono text-[11px] opacity-50 hover:opacity-90 hover:text-primary"
                             title="The kit that defines this kind's units" x-text="k.kit"></a>
                        </div>
                        <div x-show="k.aim" class="border-t border-base-200 pt-1.5">
                          <span class="badge badge-sm badge-primary badge-outline" x-text="k.aim_label"></span>
                          <span class="text-base text-base-content/60" x-text="k.aim_hint"></span>
                        </div>
                      </div>
                    </template>
                  </div>
                </div>

                <!-- The shared address: one way to name a file in any repo. -->
                <div>
                  <h3 class="text-sm font-semibold uppercase tracking-wide text-base-content/40 mb-2">Address grammar</h3>
                  <code class="text-base text-primary break-all" x-text="routes.grammar.form"></code>
                  <p class="text-base text-base-content/60 mt-1" x-text="routes.grammar.role"></p>
                  <div class="flex flex-wrap gap-1.5 mt-2.5">
                    <template x-for="u in routes.grammar.usedBy" :key="u.where">
                      <button type="button" @click="openHubFile(u.path)" :title="u.path"
                              class="badge badge-ghost badge-sm hover:badge-primary transition-colors"
                              x-text="u.where"></button>
                    </template>
                  </div>
                </div>

                <!-- What each delivery mode carries, and the trust it buys. -->
                <div>
                  <h3 class="text-sm font-semibold uppercase tracking-wide text-base-content/40 mb-2">Delivery modes</h3>
                  <p x-show="routes.precedence" class="text-base text-base-content/60 mb-2.5" x-text="routes.precedence"></p>
                  <div class="flex flex-col gap-1">
                    <template x-for="m in routes.modes" :key="m.form">
                      <div class="flex items-start gap-2.5 px-2 py-1.5 rounded-lg hover:bg-base-200/60">
                        <i class="ph mt-1 text-base-content/40 shrink-0" :class="modeIcon(m)" data-title-tip-bare :data-title-tip="m.trust"></i>
                        <div class="min-w-0 flex-1">
                          <div class="flex items-center gap-2 flex-wrap">
                            <code class="text-base font-medium break-all" x-text="m.form"></code>
                            <span class="badge badge-ghost badge-sm" x-text="m.carries"></span>
                          </div>
                          <p class="text-base text-base-content/60" x-text="m.note"></p>
                          <p class="text-sm text-base-content/40" x-text="m.sandbox + ' · ' + m.reach"></p>
                        </div>
                      </div>
                    </template>
                  </div>
                </div>

                <!-- The typed tosses: a content type to the page that renders it. -->
                <div>
                  <h3 class="text-sm font-semibold uppercase tracking-wide text-base-content/40 mb-2">Toss routes</h3>
                  <div class="flex flex-col gap-1">
                    <template x-for="r in routes.routes" :key="r.key">
                      <div class="flex items-start gap-2.5 px-2 py-1.5 rounded-lg hover:bg-base-200/60 group">
                        <i class="ph ph-disc mt-1 text-base-content/40 shrink-0"></i>
                        <div class="min-w-0 flex-1">
                          <div class="flex items-center gap-2 flex-wrap">
                            <code class="text-base font-medium text-primary" x-text="'#' + r.key + '='"></code>
                            <i class="ph ph-arrow-right text-base-content/30"></i>
                            <button type="button" class="text-base font-medium hover:text-primary text-left"
                                    @click="openRouteRenderer(r)" x-text="r.path"></button>
                            <span x-show="r.ref !== 'main'" class="badge badge-ghost badge-sm" x-text="r.ref"></span>
                          </div>
                          <p class="text-base text-base-content/60" x-text="r.renders"></p>
                          <div class="flex items-center gap-3 flex-wrap mt-0.5">
                            <code class="text-sm text-base-content/40 break-all" x-text="r.example"></code>
                            <button type="button" x-show="r.doc" @click="openHubFile(r.doc)"
                                    class="text-sm text-primary/70 hover:text-primary inline-flex items-center gap-1 shrink-0">
                              <i class="ph ph-book-open"></i><span x-text="r.doc"></span></button>
                          </div>
                        </div>
                        <a :href="routeGh(r)" :data-peek="routePeek(r)"
                           target="_blank" rel="noopener" title="Open the renderer on GitHub"
                           class="opacity-0 group-hover:opacity-100 focus:opacity-100 text-base-content/30 hover:text-primary transition-opacity shrink-0 mt-1">
                          <i class="ph ph-github-logo"></i></a>
                      </div>
                    </template>
                  </div>
                </div>

                <!-- Paste: the address grammar read backwards. Every section
                     above is about MINTING a link; this is the one place the
                     estate reads one back, and it is the half nobody had
                     written down. Three surfaces took a paste and each answered
                     differently, which is fine, but nothing said so, so the
                     estate app's answer (everything is content) went unexamined
                     until 2026-08-28 while toss-render two clicks away had been
                     routing by shape since it was written. What a paste becomes
                     is a property of the surface, so one row per surface, and
                     the declines_to column is the load-bearing one: a surface
                     that recognizes an address has to say what happens to
                     everything it does not. -->
                <div x-show="routes.paste?.length">
                  <h3 class="text-sm font-semibold uppercase tracking-wide text-base-content/40 mb-2">Paste</h3>
                  <p class="text-base text-base-content/60 mb-2.5">
                    Where the grammar is read rather than written: what a pasted thing becomes,
                    per surface, and what each one declines to.</p>
                  <div class="flex flex-col gap-1">
                    <template x-for="p in routes.paste" :key="p.surface">
                      <div class="flex items-start gap-2.5 px-2 py-1.5 rounded-lg hover:bg-base-200/60 group">
                        <i class="ph ph-clipboard-text mt-1 text-base-content/40 shrink-0"></i>
                        <div class="min-w-0 flex-1">
                          <div class="flex items-center gap-2 flex-wrap">
                            <span class="text-base font-medium" x-text="p.surface"></span>
                            <code x-show="p.path" class="text-sm text-base-content/40 break-all" x-text="p.path"></code>
                          </div>
                          <p class="text-base text-base-content/60" x-text="p.recognizes"></p>
                          <p class="text-base text-base-content/70 mt-0.5">
                            <i class="ph ph-arrow-right align-[-1px] text-base-content/30"></i>
                            <span x-text="p.becomes"></span></p>
                          <p x-show="p.declines_to" class="text-sm text-base-content/40 mt-0.5">
                            declines to <span x-text="p.declines_to"></span></p>
                        </div>
                        <button type="button" x-show="p.gate" @click="openHubFile(p.gate)"
                                :title="'The check that holds this (' + p.gate + ')'"
                                class="opacity-0 group-hover:opacity-100 focus:opacity-100 text-base-content/30 hover:text-primary transition-opacity shrink-0 mt-1">
                          <i class="ph ph-shield-check"></i></button>
                        <a x-show="p.path" x-blob="peek(p.path)" title="Open the surface on GitHub"
                           class="opacity-0 group-hover:opacity-100 focus:opacity-100 text-base-content/30 hover:text-primary transition-opacity shrink-0 mt-1">
                          <i class="ph ph-github-logo"></i></a>
                      </div>
                    </template>
                  </div>
                </div>

              </div>
            </template>
          </section>

          <!-- ── Growth: a corpus as a moving picture ────────────────────────
               The chart is a page, not a component, so this frames it rather
               than porting it. Docs shows the trend per row, one file at a
               time; this shows every file at once, moving.

               The corpus is a CONTROL, not a tab of its own: every repo that
               declares a growth payload is a subject this one instrument can
               be pointed at. One repo declaring one is the ordinary case and
               renders no control, which is why the strip is conditional rather
               than always present. -->
          <section x-show="mapTab==='growth'" class="flex flex-col gap-3">
            <div class="flex items-center gap-2 flex-wrap">
              <!-- The corpus strip, in the shape the Skills tab uses for its
                   sets: this is the same question one axis over, which of
                   several declared collections you are reading. -->
              <template x-if="estateGrowth && estateGrowth.length > 1">
                <div class="flex items-center gap-0.5 rounded-lg bg-base-200/60 p-0.5 w-fit flex-wrap" data-slot="frame:selector">
                  <template x-for="g in estateGrowth" :key="g.repo">
                    <button @click="selectGrowthRepo(g.repo)"
                            class="px-3 py-1 rounded-md text-base font-medium transition-colors"
                            :class="growthSubject && growthSubject.repo === g.repo
                                    ? 'bg-base-100 text-primary shadow-sm'
                                    : 'text-base-content/60 hover:text-base-content'"
                            :title="g.repo + ': ' + g.path">
                      <span x-text="g.short"></span></button>
                  </template>
                </div>
              </template>
              <span class="text-sm font-semibold uppercase tracking-wide text-base-content/40">Payload</span>
              <a :href="growthPayloadUrl" target="_blank" rel="noopener"
                 class="inline-flex items-center gap-1.5 font-mono text-sm text-base-content/60 hover:text-primary"
                 title="The payload this chart reads">
                <span x-text="growthPayloadLabel"></span><i class="ph ph-github-logo"></i></a>
              <div class="grow"></div>
              <a :href="growthUrl" target="_blank" rel="noopener"
                 class="inline-flex items-center gap-1.5 text-sm text-base-content/50 hover:text-primary px-2 py-1 rounded-lg hover:bg-base-200"
                 title="Open the chart full-page">
                <i class="ph ph-arrow-square-out"></i><span>full page</span></a>
            </div>
            <!-- One x-for doing two jobs, neither of which x-show can do.
                 Zero items until the tab is opened, so arriving at the Map on
                 another tab never fetches a payload nobody asked to see. And
                 keyed on the ADDRESS, so switching corpus destroys the frame
                 and builds a new one: a new iframe's first load replaces,
                 where re-pointing a live one pushes, and the reader would owe
                 the browser a back tap for every corpus they looked at. -->
            <template x-for="u in (growthSeen ? [growthUrl] : [])" :key="u">
              <iframe :src="u" loading="lazy" data-pattern="figure"
                      class="w-full rounded-xl border border-base-300 bg-base-100"
                      style="height:clamp(460px,74vh,900px)"
                      sandbox="allow-scripts allow-same-origin allow-popups"></iframe>
            </template>
          </section>

          <!-- ── Docs: the documentation registry ───────────────────────────── -->
          <!-- The documents table from docs/docs.csv: what each file under
               docs/ is (subject, living/record, maintenance), complete by
               construction (the registry test), laid out as a folder rail
               beside the selected folder's files so the hierarchy reads as
               one. The registry's other table renders on the Claims tab. -->
          <section x-show="mapTab==='docs'">
            <!-- One repo at a time: the hub's curated registry first, then
                 every estate repo the crawl has indexed. Scrolls rather than
                 wraps on a phone, as the Map's own strips do. -->
            <div x-show="docRepos.length > 1" role="tablist" data-slot="frame:selector"
                 class="flex flex-nowrap items-center gap-0.5 rounded-lg bg-base-200/60 p-0.5 mb-3 w-fit max-w-full overflow-x-auto">
              <template x-for="r in docRepos" :key="r.repo">
                <button type="button" role="tab" :aria-selected="(docRepo || hub()) === r.repo" @click="selectDocRepo(r.repo)"
                        class="shrink-0 px-3 py-1 rounded-md text-base font-medium transition-colors"
                        :class="(docRepo || hub()) === r.repo ? 'bg-base-100 text-primary shadow-sm' : 'text-base-content/60 hover:text-base-content'">
                  <span x-text="r.short"></span></button>
              </template>
            </div>
            <div x-show="!docRepo" class="flex items-center gap-2 mb-3 flex-wrap">
              ${regChip('DOCS_MANIFEST')}
              <button type="button" @click="setTab('context')"
                      class="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                <span>Session context</span><i class="ph ph-arrow-right" aria-hidden="true"></i></button>
              <a x-blob="peek(REACH_BUILDER)"
                 class="text-base-content/30 hover:text-primary"
                 title="node/build/docs-reach.mjs stamps reach and words; every other field is authored">
                <i class="ph ph-function"></i></a>
              <template x-if="docGrowth">
                <a :href="hubUrl(GROWTH_PAYLOAD)" target="_blank" rel="noopener"
                   class="inline-flex items-center gap-1.5 text-sm text-base-content/40 hover:text-primary"
                   title="The trend behind each row, from python/doc-growth.py. The whole picture is the Doc Growth view.">
                  <i class="ph ph-chart-line"></i><span>trend</span></a>
              </template>
            </div>
            <div x-show="docsLoading" class="flex justify-center py-10">
              <span class="loading loading-dots loading-md opacity-30"></span>
            </div>
            <div x-show="docsErr" class="text-base text-error font-mono" x-text="docsErr"></div>
            <template x-if="docsReg">
              <!-- A CONTAINER, so this tab reflows on the width it actually
                   has rather than on the window's. The two are the same thing
                   until the deck docks, and then they are not: docking narrows
                   the app's content pane through --deck-dock-left while the
                   window stays 1280 wide, so every lg: and xl: rule below went
                   on believing it had a desktop. The rail kept its 20rem side
                   column, the files column was pushed under the deck and
                   clipped, and the pane scrolled sideways to reach content it
                   could simply have stacked. A viewport breakpoint cannot see a
                   pane; a container query is the only thing that can. -->
              <div class="@container flex flex-col gap-4">

                <div class="flex items-center gap-3 flex-wrap">
                  <label class="input input-sm input-bordered flex items-center gap-2 grow max-w-md" data-slot="frame:search">
                    <i class="ph ph-magnifying-glass opacity-40"></i>
                    <input type="search" class="grow" placeholder="search path or subject"
                           data-find-box x-model="docQ" @input="docSearchDir = ''">
                  </label>
                  <span class="text-sm">
                    <span class="font-semibold text-lg" x-text="docTally.shown"></span>
                    <span class="text-base-content/50"
                          x-text="docTally.shown === docTally.total ? ' documents' : ' of ' + docTally.total + ' documents'"></span>
                  </span>
                </div>

                <!-- Reach strip: the five channels with their counts, each a
                     filter. The registry answers what a doc is; this answers
                     whether anyone can get to it, which is the axis that moves
                     when the estate improves.
                     No standing paragraph under it, deliberately. The labels
                     already say what the counts mean, so a sentence saying "how
                     a reader reaches each file" only restates the controls, and
                     a caveat on the word "orphan" sitting permanently under all
                     five is filed where nobody reading about the other four
                     needs it. The gloss appears on selection instead: tap a
                     channel and that channel explains itself. A title attribute
                     would not do, since it never fires on a phone. -->
                <div>
                  <div class="flex items-center gap-2 flex-wrap" data-slot="frame:count-chips">
                    <template x-for="r in docReachCounts" :key="r.key">
                      <button type="button" x-show="!docRepo" @click="toggleReach(r.key)" :title="r.hint"
                              class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-colors"
                              :class="docReach === r.key ? 'border-primary bg-primary/10' : 'border-base-300 hover:bg-base-200'">
                        <span class="badge badge-sm" :class="r.tone" x-text="r.n"></span>
                        <span class="text-base" x-text="r.label"></span>
                        <span class="text-sm text-base-content/40 tabular-nums" x-text="r.share + '%'"></span>
                      </button>
                    </template>
                    <button type="button" x-show="docReach" @click="docReach = ''"
                            class="text-sm text-base-content/50 hover:text-primary px-2 py-1">show all</button>
                    <!-- Documents with edits waiting on them, across every
                         folder while on (loadDocPending). Absent until the
                         read lands, and while nothing waits. -->
                    <button type="button" x-show="docPendingCount" @click="toggleDocPending()" data-doc-pending-filter
                            class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-colors"
                            :class="docPendingOnly ? 'border-warning bg-warning/10' : 'border-base-300 hover:bg-base-200'">
                      <span class="badge badge-sm badge-warning tabular-nums" x-text="docPendingCount"></span>
                      <span class="text-base">with proposed edits</span>
                    </button>
                    <div class="grow"></div>
                    <span class="text-sm text-base-content/40 tabular-nums"
                          :data-title-tip="'Every ' + (docRepo ? 'Markdown file in ' + docRepo.split('/').pop() : 'file under docs/') + ', counted as whitespace-delimited tokens'"
                          x-text="docWordTotal.toLocaleString() + ' words'"></span>
                    <!-- The same measure over time. Absent rather than zeroed
                         when the payload is missing, since "no movement" and
                         "no data" are different answers. -->
                    <template x-if="docGrowthTotal">
                      <span class="text-sm font-medium tabular-nums text-base-content/70"
                            :data-title-tip="docGrowthTotal.n + ' of these files are in the growth payload, which starts ' + docGrowthTotal.from"
                            x-text="(docGrowthTotal.delta > 0 ? '+' : '\u2212') + Math.abs(docGrowthTotal.delta).toLocaleString() + ' since ' + docGrowthTotal.from"></span>
                    </template>
                    <!-- One toggle for the whole registry, not a per-row
                         disclosure: maintenance is either the question you are
                         asking (show it everywhere) or noise (show it nowhere). -->
                    <button type="button" x-show="!docRepo" @click="docDetails = !docDetails"
                            class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-colors text-base"
                            :class="docDetails ? 'border-primary bg-primary/10' : 'border-base-300 hover:bg-base-200'"
                            title="Show each row's maintenance: who regenerates or edits the file">
                      <i class="ph ph-info"></i><span>details</span></button>
                    <!-- Only where the readership it sorts on is actually
                         loaded: a sort control over a column a tokenless reader
                         cannot see would reorder rows by nothing. -->
                    <button type="button" x-show="docReads" @click="cycleDocSort()"
                            class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-colors text-base"
                            :class="docSort ? 'border-primary bg-primary/10' : 'border-base-300 hover:bg-base-200'"
                            title="Order the file list by how many sessions opened each file. An injected doc sorts on its presence count, since no file tool reads one.">
                      <i class="ph" :class="docSort === 'cold' ? 'ph-sort-ascending' : 'ph-sort-descending'"></i>
                      <span x-text="docSortLabel()"></span></button>
                  </div>
                  <p x-show="docReach" class="text-sm text-base-content/50 mt-2"
                     x-text="reachMeta(docReach).hint"></p>
                  <!-- Reads that hit nothing. Sits under the strip because it is
                       a fact about the whole folder rather than about any row,
                       and there is no row it could hang off: the path is not in
                       the registry, which is what makes it worth showing. -->
                  <template x-if="docPhantoms.length">
                    <div class="mt-2 text-sm">
                      <button type="button" @click="docPhantomsOpen = !docPhantomsOpen"
                              class="flex items-center gap-1.5 text-base-content/50 hover:text-base-content/80"
                              title="Paths a session opened under docs/ that no registry row has ever carried: a doc since deleted, or a name someone guessed wrong. A misspelling here is a document that could not be found by the name a reader reached for.">
                        <i class="ph" :class="docPhantomsOpen ? 'ph-caret-down' : 'ph-caret-right'"></i>
                        <span x-text="docPhantoms.length + ' unresolved ' + (docPhantoms.length === 1 ? 'read' : 'reads')"></span>
                      </button>
                      <div x-show="docPhantomsOpen" class="mt-1 ml-5 flex flex-col gap-0.5">
                        <template x-for="p in docPhantoms" :key="p.path">
                          <div class="flex items-baseline gap-2 flex-wrap">
                            <code class="text-sm text-base-content/70" x-text="p.path"></code>
                            <span class="text-sm text-base-content/40 tabular-nums"
                                  x-text="p.sessions + (p.sessions === 1 ? ' session' : ' sessions')
                                          + ', last ' + (p.last || '').slice(0, 10)"></span>
                          </div>
                        </template>
                      </div>
                    </div>
                  </template>
                </div>

                <!-- @2xl (42rem) is the rail's 20rem plus the 2rem gap plus
                     room for a filename and its subject; below it the rail
                     stacks above the files rather than squeezing beside them. -->
                <div class="flex flex-col @2xl:flex-row gap-x-8 gap-y-4">
                  <!-- Folder rail: the registry's directories as a tree, rolled
                       up (a folder's count and words include everything below
                       it). Always expanded: seven folders do not earn collapse
                       state. The GitHub icon stays visible rather than
                       hover-revealed, because hover drops on touch and the
                       folder link is a first-class destination here. -->
                  <nav class="@2xl:w-80 shrink-0" aria-label="docs folders" data-slot="frame:rail-filter">
                    <div class="flex flex-col gap-0.5">
                      <!-- A query begins across the corpus, regardless of the
                           folder that happened to be selected before typing.
                           The rail then becomes an optional scope over those
                           matches rather than a silent pre-filter. -->
                      <button type="button" x-show="docQ.trim()" @click="docSearchDir = ''"
                              class="flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors"
                              :class="!docSearchDir ? 'bg-primary/10 text-primary' : 'hover:bg-base-200'">
                        <i class="ph ph-folders"></i><span class="text-base font-medium">All matching folders</span>
                        <span class="ml-auto text-sm tabular-nums"
                              :class="!docSearchDir ? 'text-primary/70' : 'text-base-content/40'"
                              x-text="docQueryRows.length"></span>
                      </button>
                      <template x-for="f in docFolders" :key="f.dir">
                        <div class="flex items-center gap-1" :style="'margin-left:' + f.depth + 'rem'">
                          <button type="button" @click="selectDocFolder(f.dir)"
                                  class="flex items-center gap-2 px-2 py-1.5 rounded-lg flex-1 min-w-0 text-left transition-colors"
                                  :class="docFolderSelected(f.dir) ? 'bg-primary/10 text-primary' : (f.n ? 'hover:bg-base-200' : 'opacity-40 hover:bg-base-200')">
                            <i class="ph shrink-0" :class="docFolderSelected(f.dir) ? 'ph-folder-open' : 'ph-folder'"></i>
                            <span class="text-base font-medium truncate" x-text="f.name"></span>
                            <span class="ml-auto text-sm tabular-nums shrink-0"
                                  :class="docFolderSelected(f.dir) ? 'text-primary/70' : 'text-base-content/40'"
                                  x-text="f.n"></span>
                            <span class="text-sm text-base-content/30 tabular-nums shrink-0 w-10 text-right"
                                  :title="f.words.toLocaleString() + ' words at or below this folder'"
                                  x-text="fmtWords(f.words)"></span>
                            <span class="text-sm tabular-nums shrink-0 w-10 text-right"
                                  x-show="folderGrowth(f.dir)"
                                  :class="folderGrowth(f.dir) > 0 ? 'text-base-content/60' : 'text-success'"
                                  :title="'net change at or below this folder, over the span the payload covers'"
                                  x-text="(folderGrowth(f.dir) > 0 ? '+' : '\u2212') + fmtWords(Math.abs(folderGrowth(f.dir)))"></span>
                          </button>
                          <a :href="folderGh(f.dir)" target="_blank" rel="noopener"
                             :title="'Open ' + f.dir + ' on GitHub'"
                             class="text-base-content/30 hover:text-primary shrink-0 px-1">
                            <i class="ph ph-github-logo"></i></a>
                        </div>
                      </template>
                    </div>
                  </nav>

                  <!-- The selected folder: its README's registry subject as the
                       gloss (read unfiltered, so the description survives a
                       reach filter that hides the README itself), then its own
                       direct files; subfolders are one tap away in the rail.
                       Maintenance sits behind the info toggle: it is the
                       least-read field and was most of every row's height. -->
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 flex-wrap mb-1">
                      <h3 class="text-sm font-semibold uppercase tracking-wide text-base-content/40" x-text="docResultHeading"></h3>
                      <a x-show="!docQ.trim() || docSearchDir" :href="folderGh(docQ.trim() ? docSearchDir : docDir)" target="_blank" rel="noopener"
                         :title="'Open ' + (docQ.trim() ? docSearchDir : docDir) + ' on GitHub'"
                         class="text-base-content/30 hover:text-primary"><i class="ph ph-github-logo"></i></a>
                      <!-- The door into the whole folder. Every row's title has
                           opened the deck since the deck existed, which is a
                           GESTURE: it works, and a reader who has not tried it
                           is never told the folder can be read one file at a
                           time. swipeDeck.entry's own note names that the case
                           it exists for, and this header had no visible way in.
                           Opens at the first row, in the order and under the
                           filters on screen, so the deck pages what the reader
                           is looking at. -->
                      <button type="button" x-show="docDirFiles.length"
                              @click="openDocDeck(docDirFiles[0])"
                              class="btn btn-square btn-sm max-sm:h-11 max-sm:w-11 btn-ghost hover:text-primary"
                              :title="'Read ' + plural(docDirFiles.length, 'file') + ' one at a time'">
                        <i class="ph ph-cards-three text-lg max-sm:text-xl"></i></button>
                    </div>
                    <p x-show="docDirGloss" class="text-base text-base-content/60 mb-3" x-text="docDirGloss"></p>
                    <!-- Two columns above @5xl (64rem) so a wide PANE is used
                         rather than left as a gutter; one column below it. Read
                         off the container for the same reason as the row above,
                         and 64rem is the rail plus two readable file columns. -->
                    <!-- Declared a List with named parts (data/ui-units/codebook.md,
                         "Declaring a pattern in markup"); nothing at runtime
                         reads the attributes. The folder rail is the frame's
                         filter, not part of the list. -->
                    <div class="grid grid-cols-1 @5xl:grid-cols-2 gap-x-8 gap-y-1"
                         data-pattern="list" data-part="list">
                      <template x-for="d in docDirShown" :key="d.path">
                        <div class="flex items-start gap-2.5 px-2 py-1.5 rounded-lg hover:bg-base-200/60" data-part="item">
                          <i class="ph mt-1 text-base-content/40 shrink-0"
                             :class="d.status === 'record' ? 'ph-archive' : 'ph-file-text'" data-title-tip-bare :data-title-tip="d.status"></i>
                          <div class="min-w-0 flex-1">
                            <div class="flex items-center gap-2 flex-wrap">
                              <button type="button" class="text-base font-medium hover:text-primary text-left"
                                      :title="'Read ' + d.path + ' here'" data-part="title"
                                      @click="openDocDeck(d)" x-text="docResultTitle(d)"></button>
                              <span x-show="d.status" class="badge badge-ghost badge-sm" data-part="meta" x-text="d.status"></span>
                              <span x-show="d.reach" class="badge badge-sm badge-outline" data-part="meta" :class="reachMeta(d.reach).tone"
                                    :data-title-tip="reachMeta(d.reach).hint" x-text="reachMeta(d.reach).label"></span>
                              <!-- What waits on this document: an open user
                                   call naming it, and the proposed edits
                                   Dictate would stage. Each opens Dictate on
                                   the file with them staged. -->
                              <template x-if="pendingOf(d)">
                                <span class="inline-flex items-center gap-1.5" data-doc-pending>
                                  <template x-for="c in pendingOf(d).calls" :key="c.id">
                                    <a :href="userCallHref(c)" target="_blank" rel="noopener" data-doc-pending-call
                                       class="badge badge-sm badge-warning gap-1" :data-title-tip="c.question">
                                      <i class="ph ph-pencil-line"></i><span>user call</span></a>
                                  </template>
                                  <a x-show="pendingOf(d).staged" :href="proposedHref(d)" target="_blank" rel="noopener" data-doc-pending-staged
                                     class="badge badge-sm badge-warning gap-1 tabular-nums" :data-title-tip="pendingTip(d)">
                                    <i class="ph ph-pencil-simple"></i><span x-text="pendingOf(d).staged + ' proposed'"></span></a>
                                </span>
                              </template>
                              <!-- Size and trend break together or not at all:
                                   a sparkline that wraps away from the number
                                   it qualifies reads as a mark about the row
                                   below it. -->
                              <span class="inline-flex items-center gap-2 shrink-0" data-part="meta">
                              <span class="text-sm tabular-nums"
                                    :class="docShare(d) >= 5 ? 'text-warning' : 'text-base-content/40'"
                                    :data-title-tip="d.words.toLocaleString() + ' words, ' + docShare(d) + '% of ' + (docRepo ? docRepo.split('/').pop() : 'docs/')"
                                    x-text="docSize(d)"></span>
                              <!-- Shape, then the number. The sparkline is
                                   normalized to this file's own range, so it
                                   says grew / held / was cut and never how big
                                   the file is; the size beside it already
                                   answers that. -->
                              <template x-if="growthOf(d.path)">
                                <span class="inline-flex items-center gap-1" :data-title-tip="growthHint(d.path)">
                                  <svg viewBox="0 0 44 12" width="44" height="12" class="shrink-0 overflow-visible"
                                       aria-hidden="true">
                                    <polyline :points="spark(d.path)" fill="none" stroke="currentColor"
                                              stroke-width="1.75" stroke-linejoin="round" stroke-linecap="round"
                                              :class="growthOf(d.path).delta > 0 ? 'text-warning' : 'text-success'"></polyline>
                                  </svg>
                                  <span class="text-sm tabular-nums"
                                        :class="growthOf(d.path).delta > 0 ? 'text-base-content/70' : 'text-success'"
                                        x-text="growthDelta(d.path)"></span>
                                </span>
                              </template>
                              </span>
                              <!-- Inline with the badges, always visible: this
                                   icon carries the source peek, and parked at
                                   the row's far edge it read as furniture. -->
                              <a x-blob="docPeek(d)" title="Open on GitHub" data-part="actions"
                                 class="text-base-content/30 hover:text-primary">
                                <i class="ph ph-github-logo"></i></a>
                            </div>
                            <!-- Readership rides the subject line as an italic
                                 tail ("9 reads"), not an eye icon in the badge
                                 row and not a standing paragraph of caveats:
                                 the words say what the number is, and the
                                 title carries the caveats for whoever asks.
                                 Absent entirely without a token, since the
                                 count lives in the private registry and an
                                 empty column would read as "nobody opened
                                 it". -->
                            <p class="text-base text-base-content/60" data-part="summary">
                              <span x-text="d.subject"></span><em x-show="docReads && docReadLabel(d)"
                                 class="text-sm text-base-content/40 ml-1.5"
                                 :data-title-tip="docReadHint(d)" x-text="docReadLabel(d)"></em>
                            </p>
                            <p x-show="docDetails" class="text-sm text-base-content/40" x-text="d.maintenance"></p>
                          </div>
                        </div>
                      </template>
                    </div>
                    <button type="button" x-show="docDirFiles.length > docDirShown.length" @click="docShowAll = true"
                            class="text-sm text-base-content/50 hover:text-primary px-2 py-2"
                            x-text="(docDirFiles.length - docDirShown.length).toLocaleString() + ' more'"></button>
                    <!-- Another repo's folder often holds only folders; the
                         rail beside it already shows them, so it says nothing. -->
                    <p x-show="!docDirFiles.length && (docQ.trim() || !docRepo)" class="text-base text-base-content/50 py-4">
                      <span x-text="docQ.trim()
                        ? 'No documents match this search in the selected scope.'
                        : 'No files in this folder match the selected reach filter.'"></span></p>
                  </div>
                </div>

              </div>
            </template>

            <!-- Reading a row happens in the house swipe deck (swipe-deck.js,
                 loaded on demand from the pre-build cache), built imperatively
                 by openDocDeck, so there is no markup for it here. An earlier
                 cut used a sheetModal with the content slotted in; the deck
                 replaced it because paging the folder beats one doc per open,
                 and because it sidesteps the moved-slot hazard recorded in
                 sheet-modal.js's header. -->
          </section>

          <!-- ── Docs / Policy ─────────────────────────── -->
          <!-- The rules the documentation settles, one card each. Started as a
               Gemini prototype (web-tools #850), carried onto main 2026-10-01
               with a first fill from Haiku readers over the living docs. Every
               row quotes the passage it rests on; node/test/policies-registry
               .test.mjs holds the quote to its document. Origin (who set the
               rule) is unknown for most rows, and the badge says so rather than
               guessing. -->
          <section x-show="mapTab==='policy'">
            <div class="flex items-center gap-2 flex-wrap mb-4">
              ${chip('POLICIES_MANIFEST', 'registry')}
              ${chip('POLICY_TOPICS_MANIFEST', 'registry')}
              <div class="grow"></div>
              <label class="input input-sm w-full sm:w-64" data-slot="frame:search">
                <i class="ph ph-magnifying-glass opacity-50"></i>
                <input type="search" x-model="policyQ" placeholder="Filter rules" />
              </label>
            </div>

            <div class="flex items-center gap-x-4 gap-y-2 flex-wrap mb-3 text-sm" data-slot="frame:count-chips">
              <div class="flex items-center gap-1 flex-wrap">
                <span class="text-base-content/60 mr-1">Level</span>
                <template x-for="o in policyLevelOpts" :key="o.k">
                  <button type="button" @click="policyLevel = o.k"
                          class="btn btn-xs" :class="policyLevel === o.k ? 'btn-neutral' : 'btn-ghost'">
                    <span x-text="o.n"></span><span class="opacity-60 tabular-nums" x-text="o.c"></span>
                  </button>
                </template>
              </div>
              <div class="flex items-center gap-1 flex-wrap">
                <span class="text-base-content/60 mr-1">Origin</span>
                <template x-for="o in policyIntentOpts" :key="o.k">
                  <button type="button" @click="policyIntent = o.k"
                          class="btn btn-xs" :class="policyIntent === o.k ? 'btn-neutral' : 'btn-ghost'">
                    <span x-text="o.n"></span><span class="opacity-60 tabular-nums" x-text="o.c"></span>
                  </button>
                </template>
              </div>
              <div class="grow"></div>
              <span class="text-base-content/60 tabular-nums"><span x-text="filteredPolicies.length"></span> of <span x-text="policies?.length || 0"></span></span>
            </div>

            <template x-if="policiesLoading">
              <div class="flex items-center gap-2 text-base-content/60 py-8">
                <span class="loading loading-spinner loading-sm"></span> Loading rules
              </div>
            </template>
            <template x-if="policiesErr">
              <div class="text-error text-sm py-4 font-mono" x-text="policiesErr"></div>
            </template>

            <template x-if="!policiesLoading && policies">
              <div class="grid grid-cols-1 lg:grid-cols-[18rem_1fr] gap-4 items-start">
                <!-- Below lg the topic rail folds into a toggle, so the cards
                     come first on a phone (Gemini's drawer, #850). -->
                <div class="lg:hidden flex items-center justify-between gap-2 p-3 rounded-box bg-base-200/50 border border-base-300">
                  <button type="button" @click="policyTopicsOpen = !policyTopicsOpen"
                          class="flex items-center gap-2 text-sm min-w-0">
                    <i class="ph ph-tree-structure"></i>
                    <span class="truncate">Topic: <span class="font-semibold" x-text="policyActiveTopicTitle"></span></span>
                    <i class="ph text-xs opacity-60" :class="policyTopicsOpen ? 'ph-caret-up' : 'ph-caret-down'"></i>
                  </button>
                  <button type="button" @click="policyTopic = 'all'; policyTopicsOpen = false"
                          class="text-xs link link-primary shrink-0" x-show="policyTopic !== 'all'">Show all</button>
                </div>

                <nav class="flex-col gap-3 bg-base-200/40 p-3 rounded-box border border-base-300 lg:sticky lg:top-4" data-slot="frame:rail-filter"
                     :class="policyTopicsOpen ? 'flex' : 'hidden lg:flex'">
                  <button type="button" @click="policyTopic = 'all'; policyTopicsOpen = false"
                          class="flex items-center justify-between px-2.5 py-1.5 rounded-field text-sm text-left"
                          :class="policyTopic === 'all' ? 'bg-primary text-primary-content font-medium' : 'hover:bg-base-200'">
                    <span>All topics</span>
                    <span class="tabular-nums opacity-70" x-text="policies.length"></span>
                  </button>
                  <template x-for="dom in policyDomainGroups" :key="dom.domain">
                    <div class="flex flex-col gap-0.5">
                      <div class="text-xs font-semibold text-base-content/60 uppercase tracking-wide px-2 pt-1" x-text="dom.domain"></div>
                      <template x-for="t in dom.topics" :key="t.topic_id">
                        <button type="button" @click="policyTopic = t.topic_id; policyTopicsOpen = false" :title="t.gloss"
                                class="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-field text-sm text-left"
                                :class="policyTopic === t.topic_id ? 'bg-primary text-primary-content font-medium' : 'hover:bg-base-200 text-base-content/80'">
                          <span class="truncate" x-text="t.title"></span>
                          <span class="tabular-nums opacity-70 shrink-0" x-text="t.count"></span>
                        </button>
                      </template>
                    </div>
                  </template>
                </nav>

                <!-- Declared a Card grid with named parts (data/ui-units/codebook.md,
                     "Declaring a pattern in markup"); nothing at runtime reads the
                     attributes. The topic rail, chips and search are the frame's
                     filters. The rule's id is its name; its statement, the gloss. -->
                <div class="flex flex-col gap-3 min-w-0"
                     data-pattern="card-grid" data-part="list">
                  <div x-show="!filteredPolicies.length" class="text-base-content/60 py-12 text-center">
                    No rule matches the topic, filters and search.
                  </div>
                  <template x-for="p in filteredPolicies" :key="p.policy_id">
                    <article class="rounded-box border border-base-300 bg-base-100 p-4 flex flex-col gap-3" data-part="item">
                      <div class="flex items-start justify-between gap-2 flex-wrap">
                        <div class="text-xs font-mono text-base-content/60 flex items-center gap-1.5 flex-wrap min-w-0">
                          <span data-part="meta" x-text="p.topic_id"></span><span>·</span><span data-part="title" x-text="p.policy_id"></span>
                        </div>
                        <div class="flex items-center gap-1.5 flex-wrap">
                          <span class="badge badge-sm badge-outline" data-part="meta" x-text="p.level"></span>
                          <span class="badge badge-sm" data-part="meta" :class="policyIntentBadge(p.intent_class)" x-text="p.intent_class"></span>
                          <span class="badge badge-sm badge-ghost" data-part="meta" :title="policyStatusTip(p.status)" x-text="p.status"></span>
                        </div>
                      </div>

                      <p class="text-base leading-relaxed" data-part="summary" x-text="p.statement"></p>

                      <blockquote x-show="p.quoted" class="border-l-2 border-base-300 pl-3 text-sm text-base-content/80" data-part="body">
                        <span x-text="'“' + p.quoted + '”'"></span>
                        <a x-blob="peek(p.canonical_doc)" class="font-mono text-xs link link-primary ml-1 whitespace-nowrap" data-part="links" x-text="p.canonical_doc"></a>
                      </blockquote>

                      <template x-if="p.user_prompt_quote">
                        <div class="rounded-field bg-base-200/60 border-l-2 border-primary p-2.5 text-sm flex flex-col gap-1" data-part="body">
                          <div class="flex items-center gap-1.5 text-xs text-base-content/60">
                            <i class="ph ph-chat-circle-text"></i><span>Session prompt</span>
                            <span class="font-mono ml-auto" data-part="meta" x-text="p.origin_session"></span>
                          </div>
                          <p class="italic" x-text="'“' + p.user_prompt_quote + '”'"></p>
                        </div>
                      </template>

                      <div x-show="p.enforcement" class="text-xs text-base-content/60 flex items-center gap-1.5 flex-wrap">
                        <span>Enforced by</span>
                        <code class="bg-base-200 px-1.5 py-0.5 rounded" data-part="meta" x-text="p.enforcement"></code>
                      </div>
                    </article>
                  </template>
                </div>
              </div>
            </template>
          </section>

          <!-- ── Themes: what the estate says twice, and who owns it ──────── -->
          <!-- Its own tab (2026-08-07) as Owners, because it keys on STATEMENTS
               rather than files. Renamed Themes on 2026-08-31 and given the
               derived half it never had; ?tab=claims still resolves here, the
               way ?tab=set outlived "The set".

               THE TWO HALVES ANSWER THE SAME QUESTION FROM OPPOSITE ENDS. The
               registry (the Owners lens) knows WHY a repetition exists and what
               holds it, and its coverage is curated, so it can never say what it
               has missed. The graph knows EVERY repetition and nothing about
               why. Measured the day the graph landed: 48 pairs across 119
               markdown files, of which the registry named both ends of 2 of the
               20 heaviest, and not the largest in the repo. Putting them on one
               tab makes that the default reading rather than a claim somebody
               has to make.

               THE THRESHOLD IS THE FIRST CONTROL because a cluster is what it
               makes: at 3 the graph is one blob of 32 files, at 30 it is
               isolated pairs, and around 12 it resolves into clusters that are
               each a theme a person would name. No sentence conveys that;
               dragging it does, which is the whole argument for a dial over a
               paragraph.

               The accent means one thing everywhere here: the owners registry
               names neither end of this pair. The filter's two segments carry
               their own counts so the second one defines itself, and the legend
               names the file rather than a word for it. -->
          <section x-show="mapTab==='claims'">
            <div class="flex items-center gap-2 mb-4 flex-wrap">
              <div class="flex items-center gap-0.5 rounded-lg bg-base-200/60 p-0.5 flex-wrap" role="tablist" data-slot="frame:subtabs">
                <template x-for="l in THEME_LENSES" :key="l.k">
                  <button role="tab" @click="lens = l.k"
                          class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-base font-medium transition-colors"
                          :class="lens === l.k ? 'bg-base-100 text-primary shadow-sm' : 'text-base-content/60 hover:text-base-content'">
                    <i class="ph text-lg" :class="l.i"></i><span x-text="l.n"></span>
                  </button>
                </template>
              </div>
              <div class="grow"></div>
              <template x-if="lens === 'owners'">
                <div class="flex items-center gap-2 flex-wrap">${regChip('OWNERS_MANIFEST')}${regChip('OWNERS_REPS')}</div>
              </template>
              <template x-if="lens !== 'owners' && lens !== 'related'">
                <div>${chip('THEMES_GRAPH', 'measured')}</div>
              </template>
              <template x-if="lens === 'related'">
                <div>${chip('OVERLAP_MATCHES', 'measured')}</div>
              </template>
            </div>

            <!-- The dial and the filter, above every derived lens because all
                 four read the same two. -->
            <!-- x-if, not x-show: an <input type=range> created while :max is
                 still 1 has its DOM value clamped by the browser, and x-model
                 then writes the clamp back, so the thumb and the readout part
                 company for the life of the page. Create it once the graph is
                 in hand and it is born with the right range. -->
            <template x-if="themeGraph && lens !== 'owners' && lens !== 'related'">
            <div class="flex items-center gap-3 mb-4 min-w-0 flex-wrap">
              <span class="text-base text-base-content/50 shrink-0 tabular-nums">
                <span class="text-base-content font-semibold" x-text="themeTh"></span>+ shared
              </span>
              <input type="range" class="range range-xs range-primary w-full min-w-0 grow" data-slot="frame:dial"
                     min="3" :max="themeMaxW" step="1" x-model.number="themeTh"
                     aria-label="minimum shared word-windows for a pair to count"/>
              <div class="flex items-center gap-0.5 rounded-lg bg-base-200/60 p-0.5 shrink-0">
                <button @click="themeConcern = 'review'"
                        class="px-2.5 py-1 rounded-md text-base transition-colors tabular-nums"
                        :class="themeConcern === 'review' ? 'bg-base-100 text-primary shadow-sm' : 'text-base-content/60'">
                  <span class="font-semibold" x-text="themeTally.review"></span> to review</button>
                <button @click="themeConcern = 'unlisted'"
                        class="px-2.5 py-1 rounded-md text-base transition-colors tabular-nums"
                        :class="themeConcern === 'unlisted' ? 'bg-base-100 text-primary shadow-sm' : 'text-base-content/60'">
                  <span class="font-semibold" x-text="themeTally.unlisted"></span> not in owners.csv</button>
              </div>
            </div>
            </template>

            <div x-show="themesLoading || ownersLoading" class="flex justify-center py-10">
              <span class="loading loading-dots loading-md opacity-30"></span>
            </div>
            <div x-show="themesErr" class="text-base text-error font-mono" x-text="themesErr"></div>
            <div x-show="ownersErr" class="text-base text-error font-mono" x-text="ownersErr"></div>

            <!-- Clusters: what the dial makes -->
            <!-- Declared a Card grid with named parts (data/ui-units/codebook.md,
                 "Declaring a pattern in markup"); nothing at runtime reads the
                 attributes. Only this lens, the one the tab is coded on; the
                 Owners cards below are another lens, left undeclared. A
                 cluster's files are its name, and each shared passage a row
                 of its body. -->
            <section x-show="lens === 'clusters' && themeGraph" class="flex flex-col gap-2"
                      data-pattern="card-grid" data-part="list">
              <p class="text-sm text-base-content/60 mb-1">Groups of files connected by repeated text.</p>
              <template x-for="(c, ci) in themeClusters" :key="ci">
                <div class="border border-base-300 rounded-lg p-3 bg-base-100" data-part="item">
                  <div class="flex items-baseline gap-2 flex-wrap mb-2" data-part="title">
                    <template x-for="(f, fi) in c.files" :key="f">
                      <span class="text-base">
                        <span x-show="fi" class="text-base-content/20">·</span>
                        <a x-blob="peek(f)"
                           class="hover:text-primary">
                          <span class="text-base-content/40" x-text="themeDir(f)"></span><span class="font-medium" x-text="themeBase(f)"></span></a>
                      </span>
                    </template>
                  </div>
                  <template x-for="e in c.edges" :key="e.a + e.b">
                    <div class="flex items-baseline gap-2 py-0.5" data-part="body">
                      <span class="tabular-nums text-sm shrink-0 w-7 text-right" data-part="meta"
                            :class="themeMarked(e) ? 'text-primary font-semibold' : 'text-base-content/30'" x-text="e.w"></span>
                      ${themePassage}
                    </div>
                  </template>
                </div>
              </template>
              <div x-show="themeGraph && !themeClusters.length" class="text-base text-base-content/40 py-10 text-center">
                nothing shares that much
              </div>
            </section>

            <!-- Arcs: the graph itself, files down and shared prose across -->
            <section x-show="lens === 'arcs' && themeGraph" class="">
              <p class="text-sm text-base-content/60 mb-3">Each arc connects two files that repeat text. Thicker arcs mean more overlap.</p>
              <div class="flex items-stretch gap-2">
                <div class="shrink-0 text-base-content" x-html="themeArcs()"></div>
                <div class="grow min-w-0">
                  <template x-for="f in themeOrdered" :key="f">
                    <div class="flex items-center gap-2" style="height:30px">
                      <span class="w-1.5 h-1.5 rounded-full shrink-0"
                            :class="themeEdges.some(e => themeMarked(e) && (e.a === f || e.b === f))
                                    ? 'bg-primary' : 'bg-base-content/20'"></span>
                      <a x-blob="peek(f)"
                         class="text-base truncate min-w-0 hover:text-primary">
                        <span class="text-base-content/40" x-text="themeDir(f)"></span><span x-text="themeBase(f)"></span></a>
                    </div>
                  </template>
                </div>
              </div>
            </section>

            <!-- Atoms: the repeated passages themselves -->
            <section x-show="lens === 'atoms' && themeGraph" class="flex flex-col gap-3">
              <p class="text-sm text-base-content/60">Repeated passages by file pair, largest overlaps first.</p>
              <template x-for="e in themeEdges" :key="e.a + e.b">
                <div class="border-l-2 pl-3" :class="themeMarked(e) ? 'border-primary' : 'border-base-300'">
                  <div class="flex items-baseline gap-2 flex-wrap">
                    <span class="tabular-nums text-sm shrink-0"
                          :class="themeMarked(e) ? 'text-primary font-semibold' : 'text-base-content/30'" x-text="e.w"></span>
                    <span class="text-base"><span class="text-base-content/40" x-text="themeDir(e.a)"></span><span x-text="themeBase(e.a)"></span></span>
                    <i class="ph ph-arrows-left-right text-base-content/20"></i>
                    <span class="text-base"><span class="text-base-content/40" x-text="themeDir(e.b)"></span><span x-text="themeBase(e.b)"></span></span>
                  </div>
                  ${themePassage}
                </div>
              </template>
            </section>

            <!-- Matrix first; the selected pair's compact evidence follows.
                 Key the readout by pair so a new selection starts collapsed. -->
            <section x-show="lens === 'matrix' && themeGraph" class="">
              <p class="text-sm text-base-content/60 mb-3">Each square compares two files. Select a colored square to read their shared text below.</p>
              <div class="overflow-x-auto">
                <div class="flex items-start gap-2 w-fit">
                  <div class="shrink-0">
                    <template x-for="f in themeOrdered" :key="f">
                      <div class="text-sm text-base-content/60 text-right truncate max-w-[9rem]"
                           style="height:15px;line-height:15px" :title="f" x-text="themeBase(f)"></div>
                    </template>
                  </div>
                  <div class="inline-grid gap-px shrink-0"
                       :style="'grid-template-columns: repeat(' + themeOrdered.length + ', 14px)'">
                    <template x-for="(cell, ci) in themeCells" :key="ci">
                      <button type="button" @click="themePick = cell.e"
                              @pointerenter="noteEnter(cell, $event)" @pointerleave="noteLeave()"
                              class="w-[14px] h-[14px] rounded-[2px]"
                              :class="cell.e ? (themeMarked(cell.e) ? 'bg-primary' : 'bg-base-content')
                                             : (cell.diag ? 'bg-base-300' : 'bg-base-200/50')"
                              :style="cell.e ? 'opacity:' + (0.3 + 0.7 * cell.e.w / themeMaxW) : ''"
                              :aria-label="cell.e ? cell.e.a + ' and ' + cell.e.b + ', ' + cell.e.w + ' shared'
                                                 : cell.row + ' and ' + cell.col + ', nothing shared'"></button>
                    </template>
                  </div>
                </div>
              </div>
              <template x-for="e in (themeShown ? [themeShown] : [])" :key="e.a + ':' + e.b">
                <div class="border-l-2 pl-3 mt-4 min-w-0"
                     :class="themeMarked(e) ? 'border-primary' : 'border-base-300'">
                  <p class="text-sm text-base-content/60 mb-1" x-text="themePick ? 'Selected pair · shared text' : 'Largest overlap · shared text'"></p>
                  <div class="flex items-baseline gap-2 flex-wrap">
                    <span class="tabular-nums text-sm shrink-0"
                          :class="themeMarked(e) ? 'text-primary font-semibold' : 'text-base-content/30'" x-text="e.w"></span>
                    <span class="text-base break-all"><span class="text-base-content/40" x-text="themeDir(e.a)"></span><span x-text="themeBase(e.a)"></span></span>
                    <i class="ph ph-arrows-left-right text-base-content/20"></i>
                    <span class="text-base break-all"><span class="text-base-content/40" x-text="themeDir(e.b)"></span><span x-text="themeBase(e.b)"></span></span>
                  </div>
                  ${themePassage}
                </div>
              </template>
            </section>

            <!-- Owners: the curated half, unchanged in what it says -->
            <section x-show="lens === 'owners'" class="">
              <template x-if="ownersReg">
                <div class="flex flex-col gap-2">
                  <template x-for="c in (ownersReg.owners || [])" :key="c.subject">
                    <div class="border border-base-300 rounded-lg p-3 bg-base-100">
                      <div class="flex items-baseline gap-2 flex-wrap">
                        <span class="font-semibold" x-text="c.subject"></span>
                        <span x-show="c.kind === 'family'" class="badge badge-ghost badge-sm" :data-title-tip="c.applies_to">family rule</span>
                      </div>
                      <p class="text-base text-base-content/70 mt-1">
                        <span class="font-semibold text-base-content/50">owner</span> <span x-text="c.authoritative"></span></p>
                      <div class="flex flex-col gap-1 mt-2">
                        <template x-for="r in c.repetitions" :key="r.where">
                          <div class="text-base flex items-start gap-2 flex-wrap">
                            <span class="badge badge-ghost badge-sm shrink-0" x-text="r.relation"></span>
                            <span class="text-base-content/70" x-text="r.where"></span>
                            <span :class="checkTone(r)" x-text="checkText(r)"></span>
                          </div>
                        </template>
                      </div>
                    </div>
                  </template>
                </div>
              </template>
            </section>

            <!-- Related: file pairs whose passages embed close together, kept
                 apart from the shingle lenses because it is a different
                 measurement. Two shares per pair and per measure, since a short
                 file can be half inside a long one that is barely inside it.
                 It feeds neither concern count above: a cosine nominates two
                 passages for reading and cannot say they agree. -->
            <section x-show="lens === 'related'" x-effect="lens === 'related' && loadOverlap()">
              <div x-show="overlapErr" class="text-base text-error font-mono" x-text="overlapErr"></div>
              <template x-if="overlap">
                <div>
                  <div class="flex items-center gap-3 mb-4 min-w-0 flex-wrap">
                    <span class="text-base text-base-content/50 shrink-0 tabular-nums"
                          data-title-tip-lead="Passage embeddings"
                          data-title-tip="Potion-8M vector per paragraph (up to 120 words); each passage keeps its best match in the other file. Share = matched passage words ÷ the file's analyzed words, per direction. At 0.85+ a match is marked likely restating.">
                      <span class="text-base-content font-semibold" x-text="overlapCut.toFixed(2)"></span>+ cosine
                      · <span x-text="overlapPairs.length"></span> of <span x-text="overlapPairsAll"></span> pairs
                    </span>
                    <input type="range" class="range range-xs range-primary w-full min-w-0 grow"
                           min="0.75" max="0.95" step="0.01" x-model.number="overlapCut"
                           aria-label="minimum cosine for two passages to match"/>
                    <label class="flex items-center gap-1.5 text-sm text-base-content/50 shrink-0 cursor-pointer"
                           data-title-tip-lead="Short passages"
                           data-title-tip="Pairs where either passage is under 20 words. In the gold set 44% of them were unrelated, mostly identical boilerplate lines introducing different content.">
                      <input type="checkbox" class="toggle toggle-xs" x-model="overlapShort"/> under 20 words</label>
                  </div>
                  <div class="flex flex-col">
                    <template x-for="q in overlapPairs" :key="q.key">
                      <div class="border-b border-base-300 py-2">
                        <button type="button" class="w-full text-left" @click="overlapPick = overlapPick === q.key ? null : q.key">
                          <div class="flex items-baseline gap-2 flex-wrap text-base">
                            <span><span class="text-base-content/40" x-text="themeDir(q.a)"></span><span x-text="themeBase(q.a)"></span></span>
                            <i class="ph ph-arrows-left-right text-base-content/20"></i>
                            <span><span class="text-base-content/40" x-text="themeDir(q.b)"></span><span x-text="themeBase(q.b)"></span></span>
                          </div>
                          <div class="flex items-baseline gap-4 flex-wrap text-sm text-base-content/60 tabular-nums">
                            <span><span class="text-base-content/40">passages</span>
                              <span class="text-primary font-semibold" x-text="pct(q.semA)"></span> · <span class="text-primary font-semibold" x-text="pct(q.semB)"></span></span>
                            <template x-if="q.restates"><span class="text-primary">likely restates</span></template>
                            <span data-title-tip-lead="Shingles" data-title-tip="10-word shingles, exact match. Share = shared ÷ the file's own shingles, per direction.">
                              <span class="text-base-content/40">shingles</span>
                              <span x-text="q.w"></span><template x-if="q.w"><span> (<span x-text="pct(q.litA)"></span> · <span x-text="pct(q.litB)"></span>)</span></template></span>
                          </div>
                        </button>
                        <template x-if="overlapPick === q.key">
                          <div class="flex flex-col gap-3 mt-3">
                            <template x-for="m in q.matches" :key="m.source + m.start + m.target_start">
                              <div class="grid grid-cols-1 md:grid-cols-2 gap-3 border-l-2 border-primary/40 pl-3">
                                <div class="min-w-0">
                                  <div class="text-sm text-base-content/40 tabular-nums">
                                    <button type="button" class="hover:text-primary" @click="openRef(m.source)" x-text="themeBase(m.source) + ' L' + m.line"></button>
                                    · cosine <span x-text="m.cosine.toFixed(3)"></span><template x-if="m.cosine >= overlapRestates"><span class="text-primary"> · likely restates</span></template></div>
                                  <p class="text-base leading-7 whitespace-pre-wrap break-words" x-text="overlapSlice(m.source, m.start, m.end)"></p>
                                </div>
                                <div class="min-w-0">
                                  <div class="text-sm text-base-content/40 tabular-nums">
                                    <button type="button" class="hover:text-primary" @click="openRef(m.target)" x-text="themeBase(m.target) + ' L' + m.target_line"></button></div>
                                  <p class="text-base leading-7 whitespace-pre-wrap break-words" x-text="overlapSlice(m.target, m.target_start, m.target_end)"></p>
                                </div>
                              </div>
                            </template>
                          </div>
                        </template>
                      </div>
                    </template>
                  </div>
                </div>
              </template>
            </section>

            <!-- The legend names the file, not a word for it: "unlisted" is
                 only meaningful if the reader can open the list. -->
            <div x-show="lens !== 'owners' && lens !== 'related' && themeGraph"
                 class="flex items-center gap-4 flex-wrap mt-4 pt-3 border-t border-base-300 text-sm text-base-content/50">
              <!-- The legend is the label for the encoding, so it turns over with
                   it. Naming the file rather than a word for it: "unlisted" only
                   means something to a reader who can open the list. -->
              <span class="flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-sm bg-primary shrink-0"></span>
                <span x-show="themeConcern === 'review'">states a rule, and both files leave this repo
                  (<a :href="hubUrl('docs/portable.csv')" target="_blank" rel="noopener"
                     class="underline decoration-dotted hover:text-primary">portable.csv</a> or a skill)</span>
                <span x-show="themeConcern === 'unlisted'">in neither
                  <a :href="hubUrl(OWNERS_MANIFEST)" target="_blank" rel="noopener"
                     class="underline decoration-dotted hover:text-primary">owners.csv</a> nor
                  <a :href="hubUrl(OWNERS_REPS)" target="_blank" rel="noopener"
                     class="underline decoration-dotted hover:text-primary">repetitions.csv</a></span>
              </span>
              <span class="flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-sm bg-base-content/30 shrink-0"></span>
                <span x-show="themeConcern === 'review'">a description repeated, or repeated where one reader sees both</span>
                <span x-show="themeConcern === 'unlisted'">both files listed there</span>
              </span>
              <span class="tabular-nums" x-show="themeGraph">
                <span x-text="themeGraph?.scanned"></span> markdown files ·
                <span x-text="themeGraph?.shingle"></span>-word windows
              </span>
            </div>
          </section>

          <!-- ── Skills: every set a skill can reach a session from ──────────
               The one registry whose absence was mistaken for coverage: the
               plugin's 16 and a DISJOINT library of 35, so "the plugin section
               covers skills" was true of a set it does not contain.

               THREE SETS ON ONE AXIS since 2026-08-28, where the tab used to be
               the library, then the estate stacked under it, then a paragraph
               saying a third set lived on another tab. The sets differ in how a
               skill arrives (installed and auto-firing, loaded on request, or
               one repo's own), which decides what having one costs, so it is a
               control carrying a gloss rather than prose describing a layout.
               The search runs across all three whatever is selected, because a
               reader asking "is there a skill for X" does not care which set
               answers. Matching is on the name and the trigger description, the
               words of the task rather than the slug. -->
          <section x-show="mapTab==='skills'">
            <!-- The chip is absent on Estate, and that is the honest reading:
                 the other two sets each render one committed file, and the
                 estate is every repo's own manifest, which is not a file to
                 link. The gloss says where those rows come from. -->
            <div class="flex items-center gap-2 mb-4 flex-wrap" x-show="skillSet !== 'estate'">
              ${regChip('skillManifestPath')}
            </div>

            <div x-show="skillsLoading" class="flex justify-center py-10">
              <span class="loading loading-dots loading-md opacity-30"></span>
            </div>
            <div x-show="skillsErr" class="text-base text-error font-mono" x-text="skillsErr"></div>

            <template x-if="skillsReg">
              <!-- Declared a Card grid with named parts (data/ui-units/codebook.md,
                   "Declaring a pattern in markup"); nothing at runtime reads the
                   attributes. One grid across the sets, each set heading a
                   group; the search, tally, set control and subject chips at
                   its head are the frame's, so the declaration starts below
                   them, and In the estate, chips rather than cards, is left
                   undeclared. -->
              <div class="">
                <div class="flex items-center gap-3 flex-wrap mb-3">
                  <label class="input input-sm input-bordered flex items-center gap-2 grow max-w-md" data-slot="frame:search">
                    <i class="ph ph-magnifying-glass opacity-40"></i>
                    <!-- data-find-box: the Skills tab's own search, so a bare
                         keystroke narrows the skills rather than opening the
                         sidebar finder (the shell's wireAppTypeahead). -->
                    <input type="search" class="grow" placeholder="search name and trigger text"
                           data-find-box x-model="skillQ">
                  </label>
                  <span class="text-sm">
                    <span class="font-semibold text-lg" x-text="skillTally.shown"></span>
                    <span class="text-base-content/50"
                          x-text="skillTally.shown === skillTally.total ? ' skills' : ' of ' + skillTally.total + ' skills'"></span>
                  </span>
                </div>

                <!-- The set control: the primary axis, so it is a segmented
                     control rather than the badge strip the subject groups
                     use. Its gloss is the only prose on the tab, and it says
                     what the selected set costs a session. -->
                <div class="flex items-center gap-0.5 rounded-lg bg-base-200/60 p-0.5 mb-1 w-fit flex-wrap" data-slot="frame:count-chips">
                  <button @click="skillSet = ''"
                          class="px-3 py-1 rounded-md text-base font-medium transition-colors"
                          :class="!skillSet ? 'bg-base-100 text-primary shadow-sm' : 'text-base-content/60 hover:text-base-content'">
                    All</button>
                  <template x-for="c in skillSetCounts" :key="c.key">
                    <button @click="skillSet = (skillSet === c.key ? '' : c.key)"
                            class="flex items-center gap-1.5 px-3 py-1 rounded-md text-base font-medium transition-colors"
                            :class="skillSet === c.key ? 'bg-base-100 text-primary shadow-sm'
                                    : (c.n ? 'text-base-content/60 hover:text-base-content' : 'text-base-content/30')"
                            :title="c.gloss">
                      <span x-text="c.label"></span>
                      <span class="opacity-50" x-text="c.n"></span></button>
                  </template>
                </div>
                <p class="text-sm text-base-content/50 mb-4" x-text="skillSetGloss(skillSet)"></p>

                <!-- The subject groups. They are the LIBRARY's axis, authored
                     on its manifest, so the strip goes away when the library is
                     out of view rather than sitting there cutting nothing.
                     Counts re-weight under the query, so a search shows WHERE
                     its matches live before you read one, and a group at nought
                     is dimmed rather than dropped: a disappearing strip is a
                     moving target to click at. -->
                <div class="flex flex-wrap items-center gap-1.5 mb-4" x-show="showSkillSet('library')" data-slot="frame:count-chips">
                  <button @click="skillGroup = ''"
                          class="badge badge-sm cursor-pointer transition-colors"
                          :class="!skillGroup ? 'badge-primary' : 'badge-ghost hover:badge-neutral'">
                    All <span class="ml-1 opacity-60" x-text="(skillsReg || []).length"></span></button>
                  <template x-for="g in skillGroupCounts" :key="g.key">
                    <button @click="skillGroup = (skillGroup === g.key ? '' : g.key)"
                            class="badge badge-sm cursor-pointer transition-colors"
                            :class="skillGroup === g.key ? 'badge-primary'
                                    : (g.n ? 'badge-ghost hover:badge-neutral' : 'badge-ghost opacity-30')"
                            :title="g.gloss">
                      <span x-text="g.label"></span>
                      <span class="ml-1 opacity-60" x-text="g.n"></span></button>
                  </template>
                </div>

                <!-- One empty state, over whatever sets are in view. It used
                     to be two, split on whether the library or the estate had
                     answered, which was a way of saying "a miss in one set is
                     not a gap" before the sets were a control that says so. -->
                <div x-show="!skillTally.shown" class="text-base text-base-content/40 py-6">
                  Nothing matches<span x-show="skillSet" x-text="' in the ' + skillSetLabel(skillSet).toLowerCase()"></span>.
                  The trigger text is what a session reads, so a miss here is a real gap rather
                  than a naming problem.
                </div>

                <div data-pattern="card-grid" data-part="list">
                <!-- Plugin. Rows come from Distribution's manifest, so the
                     command is the one a session actually types and the role is
                     that registry's one-liner rather than a second copy here. -->
                <div class="flex flex-col gap-2 mb-4"
                     x-show="showSkillSet('plugin') && pluginSkillRows.length">
                  <div class="flex items-baseline gap-2 flex-wrap" data-part="group">
                    <span class="text-sm font-semibold uppercase tracking-wide text-base-content/50">In the plugin</span>
                    <span class="text-sm text-base-content/30" data-part="meta" x-text="pluginSkillRows.length"></span>
                    <span class="text-sm text-base-content/40 grow min-w-0 truncate" data-part="summary">installed in every session, and firing on its own</span>
                  </div>
                  <template x-for="s in pluginSkillRows" :key="s.path">
                    <div class="border border-base-300 rounded-lg p-3 bg-base-100" data-part="item">
                      <div class="flex items-baseline gap-2 flex-wrap">
                        <a x-blob="peek(s.path)" data-part="title"
                           class="font-mono font-semibold hover:text-primary" x-text="s.title"></a>
                        <em x-show="skillUseLabel(s.command)" class="text-sm not-italic text-base-content/40" data-part="meta"
                            :class="skillUse(s.command) ? '' : 'text-warning/70'"
                            :data-title-tip="skillUseHint(s.command)" x-text="skillUseLabel(s.command)"></em>
                        <a x-show="upstreamOf(s.title)" :href="upstreamHref(upstreamOf(s.title))" target="_blank" rel="noopener"
                           class="text-sm text-base-content/50 hover:text-primary" data-part="links"
                           x-text="upstreamOf(s.title) ? upstreamVocab(upstreamOf(s.title).status, 'label').toLowerCase() + ' from ' + upstreamOf(s.title).id.split('/')[0] : ''"></a>
                        <span class="grow"></span>
                        <code class="text-sm text-primary/80" data-part="meta" x-text="s.command"></code>
                      </div>
                      <p class="text-base text-base-content/60 mt-1" data-part="summary" x-text="setRole(s)"></p>
                    </div>
                  </template>
                </div>

                <div class="flex flex-col gap-4" x-show="showSkillSet('library')">
                  <template x-for="sec in skillSections" :key="sec.key">
                    <div>
                      <div class="flex items-baseline gap-2 flex-wrap mb-2" data-part="group">
                        <span class="text-sm font-semibold uppercase tracking-wide text-base-content/50"
                              x-text="sec.label"></span>
                        <span class="text-sm text-base-content/30" data-part="meta" x-text="sec.rows.length"></span>
                        <span class="text-sm text-base-content/40 grow min-w-0 truncate" data-part="summary" x-text="sec.gloss"></span>
                      </div>
                      <div class="flex flex-col gap-2">
                        <template x-for="s in sec.rows" :key="s.name">
                          <div class="border border-base-300 rounded-lg p-3 bg-base-100" data-part="item">
                            <div class="flex items-baseline gap-2 flex-wrap">
                              <a x-blob="peek('skills/' + s.name + '/SKILL.md')" data-part="title"
                                 class="font-mono font-semibold hover:text-primary" x-text="s.name"></a>
                              <em x-show="skillUseLabel(s.name)" class="text-sm not-italic text-base-content/40" data-part="meta"
                                  :class="skillUse(s.name) ? '' : 'text-warning/70'"
                                  :data-title-tip="skillUseHint(s.name)" x-text="skillUseLabel(s.name)"></em>
                              <a x-show="upstreamOf(s.name)" :href="upstreamHref(upstreamOf(s.name))" target="_blank" rel="noopener"
                                 class="text-sm text-base-content/50 hover:text-primary" data-part="links"
                                 x-text="upstreamOf(s.name) ? upstreamVocab(upstreamOf(s.name).status, 'label').toLowerCase() + ' from ' + upstreamOf(s.name).id.split('/')[0] : ''"></a>
                              <span class="grow"></span>
                              <code class="text-sm text-primary/80" data-part="meta" x-text="'/load-skill ' + s.name"></code>
                            </div>
                            <p class="text-base text-base-content/60 mt-1" data-part="summary" x-text="s.description"></p>
                          </div>
                        </template>
                      </div>
                    </div>
                  </template>
                </div>

                <!-- The estate set. No description column, and not an
                     oversight: a trigger description lives in each SKILL.md,
                     and fetching a dozen files across the estate to fill a
                     column is the cost the manifest declaration exists to
                     avoid. The name links the file, which is one tap.

                     The empty estate is two different facts, and rendering
                     nothing said neither: the tab then read exactly as it did
                     before the estate existed, which is how a reader concludes
                     a change did not land. The gloss above already says where
                     these come from, so it is not repeated here. -->
                <div x-show="showSkillSet('estate') && !hasToken()" class="mt-5 text-sm text-base-content/40">
                  <span class="font-semibold uppercase tracking-wide text-base-content/40">In the estate</span>
                  <p class="mt-1">Sign in to read what other repos have committed. The plugin and the library
                  are public; the estate reads the private registry's crawl.</p>
                </div>
                <div x-show="showSkillSet('estate') && hasToken() && estateSkills && !estateSkills.length"
                     class="mt-5 text-sm text-base-content/40">
                  <span class="font-semibold uppercase tracking-wide text-base-content/40">In the estate</span>
                  <p class="mt-1">No repo declares a <code>skills</code> key in its .web-tools.json yet, so the
                  crawl has nothing to collect. Each repo declares its own, and the aggregate appears
                  here once the crawl next runs.</p>
                </div>

                <template x-if="showSkillSet('estate') && estateSkills && estateSkills.length">
                  <div class="mt-5">
                    <div class="flex items-center gap-3 flex-wrap mb-3">
                      <span class="text-sm font-semibold uppercase tracking-wide text-base-content/40">In the estate</span>
                      <span class="text-sm text-base-content/50">
                        <span class="font-semibold text-lg" x-text="estateSkillTotals.skills"></span>
                        <span x-text="' across ' + estateSkillTotals.repos +
                                      (estateSkillTotals.repos === 1 ? ' repo' : ' repos')"></span></span>
                      <span x-show="estateSkillTotals.forked" class="badge badge-warning badge-sm"
                            data-title-tip="A copy of a hub skill. The plugin ships the current version to that repo already, so the committed copy is what fires and what ages.">
                        <span x-text="estateSkillTotals.forked"></span> forked</span>
                    </div>
                    <div class="flex flex-col gap-3">
                      <template x-for="g in estateSkillGroups" :key="g.repo">
                        <div>
                          <a :href="'https://github.com/' + g.repo + '/tree/main/.claude/skills'"
                             target="_blank" rel="noopener"
                             class="font-mono text-sm text-base-content/60 hover:text-primary inline-flex items-center gap-1.5">
                            <i class="ph ph-folder"></i><span x-text="g.short"></span>
                            <span class="opacity-40" x-text="g.skills.length"></span></a>
                          <div class="flex flex-wrap gap-1.5 mt-1">
                            <template x-for="s in g.skills" :key="s.name">
                              <a :href="'https://github.com/' + s.repo + '/blob/main/.claude/skills/' + s.name + '/SKILL.md'"
                                 target="_blank" rel="noopener"
                                 class="badge badge-sm font-mono hover:badge-primary transition-colors"
                                 :class="s.origin === 'forked' ? 'badge-warning' : 'badge-ghost'"
                                 :title="s.origin === 'forked'
                                   ? 'A copy of a hub skill, so it fires instead of the current version and ages against it.'
                                   : 'Grown in this repo. Its subject is local, so the hub does not ship it and should not.'"
                                 x-text="s.name"></a>
                            </template>
                          </div>
                        </div>
                      </template>
                      <p x-show="skillQ.trim() && !estateSkillGroups.length"
                         class="text-base text-base-content/40">No estate skill matches.</p>
                    </div>
                  </div>
                </template>
                <!-- Outside: skills written elsewhere (docs/upstream-skills.csv).
                     The status is the row's tone and its first word; the
                     rationale is the content; the copy and the pin are links. -->
                <div x-show="showSkillSet('outside') && upstreamRows.length" class="mt-5 flex flex-col gap-2">
                  <div class="flex items-baseline gap-2 flex-wrap" data-part="group">
                    <span class="text-sm font-semibold uppercase tracking-wide text-base-content/50">Outside</span>
                    <span class="text-sm text-base-content/30" data-part="meta" x-text="upstreamRows.length"></span>
                  </div>
                  <template x-for="r in upstreamRows" :key="r.id">
                    <div class="border border-base-300 rounded-lg p-3 bg-base-100" data-part="item">
                      <div class="flex items-baseline gap-2 flex-wrap">
                        <a :href="upstreamHref(r)" target="_blank" rel="noopener" data-part="title"
                           class="font-mono font-semibold hover:text-primary" x-text="r.id"></a>
                        <span class="badge badge-sm" data-part="meta"
                              :class="['vendored', 'adapted'].includes(r.status) ? 'badge-primary badge-outline' : 'badge-ghost'"
                              :data-title-tip="upstreamVocab(r.status, 'gloss')" x-text="upstreamVocab(r.status, 'label')"></span>
                        <span class="text-sm text-base-content/50" data-part="meta" x-text="r.author"></span>
                        <span class="grow"></span>
                        <a x-show="r.ours" x-blob="peek(r.ours + '/SKILL.md')" class="font-mono text-sm hover:text-primary" data-part="links" x-text="r.ours"></a>
                        <a x-show="r.held" x-blob="peek(r.held + '/SKILL.md')" class="font-mono text-sm hover:text-primary" data-part="links" x-text="r.held"></a>
                        <span x-show="r.pinned" class="font-mono text-sm text-base-content/40" data-part="meta"
                              :data-title-tip="'pinned at upstream commit ' + r.pinned + ', fingerprint ' + r.digest" x-text="'@' + r.pinned"></span>
                      </div>
                      <p class="text-base text-base-content/60 mt-1 text-pretty" data-part="summary" x-text="r.rationale"></p>
                    </div>
                  </template>
                </div>
                </div>
              </div>
            </template>
          </section>

          <section x-show="mapTab==='agents'">
            <div class="flex items-center gap-2 mb-4 flex-wrap">
              ${regChip('AGENTS_MANIFEST')}
            </div>
            <div x-show="agentsLoading" class="flex justify-center py-10">
              <span class="loading loading-dots loading-md opacity-30"></span>
            </div>
            <div x-show="agentsErr" class="text-base text-error font-mono" x-text="agentsErr"></div>

            <template x-if="agentsReg">
              <!-- One set at a time, picked by the tab row: critics, the
                   review panel's seats, the readers written inside skills,
                   and other repos' own agents. Sets differ in where an
                   agent's prompt lives, which is where it can be changed, so
                   they are tabs rather than headings down one long column.
                   The search narrows the open tab, and a tab with nothing
                   matching dims, so a query shows where its matches are
                   without a count badge on every tab. -->
              <div>
                <div class="flex items-center gap-3 flex-wrap mb-3">
                  <label class="input input-sm input-bordered flex items-center gap-2 grow max-w-md" data-slot="frame:search">
                    <i class="ph ph-magnifying-glass opacity-40"></i>
                    <input type="search" class="grow" placeholder="search name, role and model"
                           data-find-box x-model="agentQ">
                  </label>
                </div>

                <div class="flex items-center gap-0.5 rounded-lg bg-base-200/60 p-0.5 mb-5 w-fit flex-wrap" role="tablist" data-slot="frame:count-chips">
                  <template x-for="c in agentSetCounts" :key="c.key">
                    <button type="button" role="tab" :aria-selected="agentSet === c.key" @click="agentSet = c.key"
                            class="flex items-center gap-1.5 px-3 py-1 rounded-md text-base font-medium transition-colors"
                            :class="agentSet === c.key ? 'bg-base-100 text-primary shadow-sm'
                                    : (c.n ? 'text-base-content/60 hover:text-base-content' : 'text-base-content/30')">
                      <i class="ph" :class="c.icon"></i>
                      <span x-text="c.label"></span></button>
                  </template>
                </div>

                <!-- Critics and panel seats: definition files the platform
                     loads and a session calls by name. The icon is the
                     agent's face; the preloads are its backing documentation,
                     the skills injected whole at startup. -->
                <template x-if="agentSet === 'critic' || agentSet === 'panel'">
                  <div>
                    <a x-show="agentSet === 'panel'" x-blob="peek('skills/review-panel/SKILL.md')"
                       class="inline-flex items-center gap-1.5 text-sm font-mono text-base-content/60 hover:text-primary mb-3">
                      <i class="ph ph-sparkle"></i><span>review-panel</span></a>
                    <div class="grid gap-3 lg:grid-cols-2" data-pattern="card-grid" data-part="list">
                      <template x-for="a in agentDefs" :key="a.id">
                        <div class="border border-base-300 rounded-lg p-3 bg-base-100 flex gap-3 items-start" data-part="item">
                          <img x-show="agentIcons[a.id]" :src="agentIcons[a.id]" alt="" class="w-10 h-10 shrink-0 mt-0.5">
                          <i x-show="!agentIcons[a.id]" class="ph ph-robot text-4xl text-base-content/30 shrink-0"></i>
                          <div class="min-w-0 grow">
                            <div class="flex items-baseline gap-2 flex-wrap">
                              <a x-blob="peek(a.path)" data-part="title"
                                 class="font-mono font-semibold hover:text-primary" x-text="a.id.split(':')[1]"></a>
                              <span x-show="a.model" class="text-sm text-base-content/50" data-part="meta" x-text="a.model"></span>
                            </div>
                            <p class="text-base text-base-content/70 mt-1 text-balance" data-part="summary" x-text="a.role"></p>
                            <div class="flex flex-wrap items-baseline gap-x-5 gap-y-1 mt-2 text-sm" data-part="meta">
                              <span x-show="a.preloads"><span class="text-base-content/50">preloads </span><template
                                    x-for="sk in (a.preloads || '').split(';').filter(Boolean)" :key="sk"><a
                                    x-blob="peek('skills/' + sk.split(':').pop() + '/SKILL.md')"
                                    class="font-mono hover:text-primary mr-2" x-text="sk"></a></template></span>
                              <span x-show="a.memory"><span class="text-base-content/50">memory </span><span
                                    class="font-mono" x-text="a.memory"></span></span>
                              <span x-show="a.tools"><span class="text-base-content/50">tools </span><span
                                    class="font-mono" x-text="(a.tools || '').split(';').join(', ')"></span></span>
                            </div>
                          </div>
                        </div>
                      </template>
                    </div>
                  </div>
                </template>

                <!-- Readers inside skills, grouped under the skill that spawns
                     them: the prompt is that skill's text, so the skill is the
                     only place a reader can be changed, and the platform knows
                     no name for it. One row per reader, not a card: a reader is
                     a role in a protocol rather than something called by name. -->
                <template x-if="agentSet === 'inline'">
                  <div class="grid gap-x-8 gap-y-5 lg:grid-cols-2" data-part="list">
                    <template x-for="g in agentInlineGroups" :key="g.skill">
                      <div>
                        <a x-blob="peek('skills/' + g.skill + '/SKILL.md')"
                           class="font-mono text-base font-semibold text-base-content/80 hover:text-primary inline-flex items-center gap-1.5">
                          <i class="ph ph-sparkle text-base-content/40"></i><span x-text="g.skill"></span></a>
                        <div class="mt-1.5 flex flex-col divide-y divide-[var(--color-base-200)] border-l-2 border-base-300 pl-3">
                          <template x-for="a in g.rows" :key="a.id">
                            <div class="py-1.5" data-part="item">
                              <div class="flex items-baseline gap-2">
                                <a x-blob="peek(a.path)" data-part="title"
                                   class="font-mono font-semibold hover:text-primary" x-text="a.name"></a>
                                <span x-show="a.model" class="text-sm text-base-content/50" data-part="meta" x-text="a.model"></span>
                              </div>
                              <p class="text-base text-base-content/70 text-pretty" data-part="summary" x-text="a.role"></p>
                            </div>
                          </template>
                        </div>
                      </div>
                    </template>
                  </div>
                </template>

                <!-- The estate set: names only, each linking its file, for the
                     reason the estate skills give: the manifest declaration
                     exists so the hub does not go fetching every repo's tree. -->
                <template x-if="agentSet === 'estate'">
                  <div>
                    <p x-show="!hasToken()" class="text-base text-base-content/50">Sign in to read other repos' own agents.</p>
                    <p x-show="hasToken() && estateAgents && !estateAgents.length" class="text-base text-base-content/50">No repo declares an <code>agents</code> key yet.</p>
                    <div class="flex flex-col gap-4">
                      <template x-for="g in estateAgentGroups" :key="g.repo">
                        <div>
                          <a :href="'https://github.com/' + g.repo + '/tree/main/.claude/agents'"
                             target="_blank" rel="noopener"
                             class="font-mono text-base font-semibold text-base-content/80 hover:text-primary inline-flex items-center gap-1.5">
                            <i class="ph ph-folder text-base-content/40"></i><span x-text="g.short"></span></a>
                          <div class="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                            <template x-for="a in g.agents" :key="a.name">
                              <a :href="'https://github.com/' + a.repo + '/blob/main/.claude/agents/' + a.name + '.md'"
                                 target="_blank" rel="noopener"
                                 class="font-mono text-base hover:text-primary" x-text="a.name"></a>
                            </template>
                          </div>
                        </div>
                      </template>
                    </div>
                  </div>
                </template>

                <p x-show="agentQ.trim() && !agentShownN" class="text-base text-base-content/50 py-4">Nothing in this tab matches.</p>
              </div>
            </template>
          </section>

          <section x-show="mapTab==='peeves'">
            <div class="flex items-center gap-2 mb-4 flex-wrap">
              ${regChip('PEEVES_LIST')}
            </div>
            <div x-show="peevesLoading" class="flex justify-center py-10">
              <span class="loading loading-dots loading-md opacity-30"></span>
            </div>
            <div x-show="peevesErr" class="text-base text-error font-mono" x-text="peevesErr"></div>

            <template x-if="peevesReg">
              <!-- Every group at once, since the comparison between groups is
                   what the bars are for; CSS columns balance the uneven group
                   sizes. A row opens in place to its statement, what tripping
                   it looks like, where it is written, and, with a token, the
                   owner's words from the sessions it was drawn from. -->
              <div>
                <div class="flex items-center gap-3 flex-wrap mb-4">
                  <label class="input input-sm input-bordered flex items-center gap-2 grow max-w-md" data-slot="frame:search">
                    <i class="ph ph-magnifying-glass opacity-40"></i>
                    <input type="search" class="grow" placeholder="search peeves"
                           data-find-box x-model="peeveQ">
                  </label>
                  <div class="flex items-center gap-0.5 rounded-lg bg-base-200/60 p-0.5 w-fit" role="tablist" data-slot="frame:count-chips">
                    <template x-for="a in PEEVE_AXES" :key="a.key">
                      <button type="button" role="tab" :aria-selected="peeveAxis === a.key" @click="peeveAxis = a.key"
                              class="flex items-center gap-1.5 px-3 py-1 rounded-md text-base font-medium transition-colors"
                              :class="peeveAxis === a.key ? 'bg-base-100 text-primary shadow-sm' : 'text-base-content/60 hover:text-base-content'">
                        <i class="ph" :class="a.icon"></i><span x-text="a.label"></span></button>
                    </template>
                  </div>
                </div>

                <div class="columns-1 lg:columns-2 2xl:columns-3 gap-10" data-part="list">
                  <template x-for="g in peeveGroups" :key="peeveAxis + g.key">
                    <div class="break-inside-avoid mb-6">
                      <div class="flex items-baseline gap-2 px-2 pb-1 mb-1.5 border-b border-base-300/70">
                        <i x-show="g.icon" class="ph text-base-content/40" :class="g.icon"></i>
                        <h3 class="text-base font-semibold" :data-title-tip="g.gloss || null" x-text="g.label"></h3>
                      </div>
                      <template x-for="p in g.rows" :key="p.id">
                        <div data-part="item">
                          <button type="button" @click="peeveOpen = peeveOpen === p.id ? '' : p.id" :aria-expanded="peeveOpen === p.id"
                                  class="w-full grid grid-cols-[4rem_1.75rem_minmax(0,1fr)_auto] items-center gap-2 px-2 py-1 rounded text-left hover:bg-base-200/60"
                                  :class="peeveOpen === p.id ? 'bg-base-200/60' : ''">
                            <span class="h-2 rounded-full bg-base-200 overflow-hidden" data-part="meta">
                              <span class="block h-full rounded-full bg-primary/60" :style="'width:' + (100 * p.n / peeveMax) + '%'"></span></span>
                            <span class="font-mono text-xs text-base-content/50 text-right" data-part="meta" x-text="p.n"></span>
                            <span class="text-base truncate" data-part="title" x-text="p.name"></span>
                            <span class="flex items-center gap-1.5 font-mono text-xs text-base-content/40" data-part="meta">
                              <i x-show="peeveAxis === 'area' && peeveWritten(p) === 'doc'" class="ph ph-file-text" data-title-tip="Stated in a document"></i>
                              <i x-show="peeveAxis === 'area' && peeveWritten(p) === 'check'" class="ph ph-gear-six" data-title-tip="Checked by a script"></i>
                              <span x-text="p.id"></span>
                            </span>
                          </button>
                          <div x-show="peeveOpen === p.id" class="pl-2 sm:pl-[6.75rem] pr-2 pt-1 pb-3 flex flex-col gap-2">
                            <p class="text-base text-pretty" data-part="summary" x-text="p.peeve"></p>
                            <div class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
                              <span class="text-base-content/50">looks like</span>
                              <span class="text-pretty" x-text="p.look_for"></span>
                              <template x-if="p.owner">
                                <span class="text-base-content/50">written in</span>
                              </template>
                              <template x-if="p.owner">
                                <span class="text-pretty"><template x-for="(part, i) in peeveOwnerParts(p.owner)" :key="i"><span><a
                                      x-show="part.path" x-blob="peek(part.path)" class="font-mono hover:text-primary" x-text="part.t"></a><span
                                      x-show="!part.path" x-text="part.t"></span></span></template></span>
                              </template>
                              <span class="text-base-content/50">caught by</span>
                              <span x-text="peeveVocab('detector', p.detector, 'gloss') || p.detector"></span>
                            </div>
                            <div x-show="peeveQuotes?.[p.id]?.length" class="flex flex-col gap-1.5 border-l-2 border-base-300 pl-3">
                              <template x-for="(q, i) in (peeveQuotes?.[p.id] || [])" :key="i">
                                <a :href="peeveQuoteHref(q)" class="text-sm text-base-content/70 hover:text-primary text-pretty">
                                  <span x-text="q.quote"></span>
                                  <span class="font-mono text-xs text-base-content/40 whitespace-nowrap" x-text="q.session.slice(0, 10)"></span></a>
                              </template>
                            </div>
                          </div>
                        </div>
                      </template>
                    </div>
                  </template>
                </div>
                <p x-show="peeveQ.trim() && !peeveGroups.length" class="text-base text-base-content/50 py-4">No peeve matches.</p>
              </div>
            </template>
          </section>

          <!-- ── Data: declared CSV inventories, one fetch per repository ── -->
          <section x-show="mapTab==='data'" class="min-w-0">
            <div class="flex flex-wrap items-center gap-2 mb-4">
              <a x-blob="peek('docs/csv-census.md')" class="text-sm text-base-content/50 hover:text-primary inline-flex items-center gap-1" aria-label="CSV census contract">
                <i class="ph ph-book-open-text text-lg"></i>Contract</a>
              <select class="select select-bordered select-sm w-full shrink-0 sm:w-auto sm:shrink max-w-full" aria-label="Repository scope"
                      x-model="dataScope">
                <option value="" x-text="hasToken() ? 'All repositories' : 'Public hub'"></option>
                <template x-for="s in dataCensus || []" :key="s.repo">
                  <option :value="s.repo" x-text="s.repo"></option>
                </template>
              </select>
              <label class="input input-bordered input-sm flex items-center gap-2 min-w-0 w-full shrink-0 sm:w-auto sm:shrink sm:flex-1 sm:max-w-sm" data-slot="frame:search">
                <i class="ph ph-magnifying-glass text-base-content/40"></i>
                <input type="search" class="min-w-0 grow" placeholder="Repository, path, or header"
                       aria-label="Search CSV inventory" x-model="dataQ">
              </label>
              <span class="text-sm tabular-nums text-base-content/50" x-show="dataCensus"
                    x-text="dataMatches.length + ' files'"></span>
              <button type="button" class="btn btn-ghost btn-sm" @click="loadDataCensus(true)"
                      :disabled="dataLoading" x-text="dataNeedsRetry ? 'Retry' : 'Refresh'"></button>
            </div>
            <p x-show="dataLoading" class="text-base text-base-content/50 py-6">Loading CSV inventories…</p>
            <p x-show="dataErr" class="text-sm text-warning mb-3" x-text="dataErr"></p>
            <!-- Declared a List with named parts (data/ui-units/codebook.md,
                 "Declaring a pattern in markup"); nothing at runtime reads the
                 attributes. The repository line at its head is the frame's
                 scope filter, so the declaration is the folders below it. -->
            <div x-show="dataCensus" class="min-w-0">
              <div class="flex flex-wrap gap-x-5 gap-y-1 border-y border-base-300 py-2 mb-4 text-sm" data-slot="frame:count-chips">
                <template x-for="s in dataSources" :key="s.repo">
                  <button type="button" @click="dataScope = s.repo"
                          class="flex items-center gap-1.5 max-w-full hover:text-primary text-left"
                          :class="s.state === 'unavailable' ? 'text-warning' : 'text-base-content/60'">
                    <span class="font-medium truncate" x-text="s.repo"></span>
                    <span class="shrink-0" x-text="dataStateLabel(s)"></span>
                  </button>
                </template>
              </div>
              <template x-for="s in dataSources.filter(s => s.error)" :key="s.repo">
                <p class="text-sm text-warning mb-3 break-words" x-text="s.repo + ': ' + s.error"></p>
              </template>
              <div data-pattern="list" data-part="list">
              <template x-for="g in dataFolders" :key="g.repo + ':' + g.folder">
                <div class="mb-3 min-w-0">
                  <div class="flex items-center gap-2 text-sm font-medium border-b border-base-300 pb-1 mb-1 min-w-0" data-part="group">
                    <i class="ph ph-folder text-base-content/50 shrink-0"></i>
                    <span class="truncate" x-text="(dataScope ? '' : g.repo + ' / ') + g.folder"></span>
                    <span class="ml-auto tabular-nums text-base-content/40" data-part="meta" x-text="g.files.length"></span>
                  </div>
                  <template x-for="f in g.files" :key="f.repo + ':' + f.path">
                    <button type="button" @click="openDataFile(f)" data-part="item"
                            class="w-full min-w-0 grid grid-cols-3 sm:grid-cols-[minmax(0,1fr)_5rem_5rem_6rem] gap-x-3 gap-y-1 px-2 py-2 text-left rounded hover:bg-base-200 focus-visible:outline focus-visible:outline-[var(--color-primary)] border-b border-base-200">
                      <span class="min-w-0 col-span-3 sm:col-span-1">
                        <span class="flex items-start gap-1.5 text-base font-medium min-w-0">
                          <i class="ph ph-file-csv text-lg text-base-content/50 shrink-0" data-part="meta"></i>
                          <span class="break-all" data-part="title" x-text="f.path.slice(f.path.lastIndexOf('/') + 1)"></span>
                        </span>
                        <span class="block text-sm text-base-content/50 break-all pl-6" data-part="summary" x-text="f.headers.join(' · ')"></span>
                      </span>
                      <span class="text-sm tabular-nums text-base-content/60 sm:text-right" data-part="meta"><span x-text="f.rows.toLocaleString()"></span> rows</span>
                      <span class="text-sm tabular-nums text-base-content/60 sm:text-right" data-part="meta"><span x-text="f.columns.toLocaleString()"></span> cols</span>
                      <span class="text-sm tabular-nums text-base-content/60 sm:text-right" data-part="meta" x-text="dataSize(f.bytes)"></span>
                    </button>
                  </template>
                </div>
              </template>
              </div>
              <p x-show="!dataMatches.length" class="text-base text-base-content/50 py-5">No matching CSV files.</p>
              <button type="button" x-show="dataMatches.length > dataLimit" @click="dataLimit += 200"
                      class="btn btn-ghost btn-sm mb-4" x-text="'Show 200 more of ' + dataMatches.length"></button>
            </div>
          </section>

          <!-- ── Registries: the table the other seven tabs hang off ───────
               Every other tab renders ONE manifest. This renders the table
               that says what a manifest IS: its file, target grain, scope,
               gate, and the two enforcement layers. It is the index, not an
               eighth peer, which is why it sits last and why each row links
               out to the tab that renders it where one exists.
               No backticks anywhere in this template: it is a JS template
               literal, and one would end it mid-markup. -->
          <section x-show="mapTab==='registries'">
            <div class="flex items-center gap-2 mb-3 flex-wrap">
              ${regChip('PROPS_MANIFEST')}
${regChip('PROPS_DECLS')}${regChip('PROPS_VOCAB')}
              <a x-blob="peek(PROPS_DOC)"
                 class="text-base-content/30 hover:text-primary"
                 title="docs/registries.md: the model, and what reconciliation found">
                <i class="ph ph-book-open-text"></i></a>
              <a x-blob="peek(SPAN_DOC)"
                 class="text-base-content/30 hover:text-primary"
                 title="docs/estate-span.md: what the hub knows about the rest of the estate, and the measurement behind the span column">
                <i class="ph ph-globe-hemisphere-west"></i></a>
            </div>
            <p class="text-sm text-base-content/50 mb-3">
              A registry is one committed file holding a row per thing it describes, and one
              property about one thing answers to exactly one registry. Every field defines
              itself: the index governs its own registries, so what a column means and what it
              may hold are rows in it rather than prose somewhere else.
            </p>

            <!-- The legend, and the reason it is a component rather than a
                 paragraph: every line of it is committed data with a gate
                 behind it. A prose version was maintained in registries.md and
                 its rows duplicated glosses committed in the pair, which is the
                 copy that drifts. Closed by default on both grains, since a
                 reader who knows the model should meet the cards first. -->
            <div class="flex flex-col gap-1 mb-3">
              <template x-for="lg in [
                  { key: 'reg', label: 'What a registry row records', rows: registryLegend, file: PROPS_MANIFEST },
                  { key: 'prop', label: 'What a property chip records', rows: propertyLegend, file: PROPS_DECLS }
                ]" :key="lg.key">
                <details class="border border-base-300 rounded-lg bg-base-100/60">
                  <summary class="cursor-pointer px-3 py-2 text-sm text-base-content/60 hover:text-base-content flex items-baseline gap-2">
                    <span x-text="lg.label"></span>
                    <span class="badge badge-ghost badge-sm font-mono" x-text="lg.rows.length"></span>
                    <span class="grow"></span>
                    <span class="font-mono text-[11px] opacity-40" x-text="lg.file"></span>
                  </summary>
                  <div class="px-3 pb-3 flex flex-col gap-2">
                    <template x-for="d in lg.rows" :key="d.property">
                      <div class="text-sm">
                        <span class="font-mono font-semibold text-base-content/70" x-text="d.property"></span>
                        <span class="badge badge-ghost badge-sm ml-1.5" x-text="d.mode"></span>
                        <span class="badge badge-ghost badge-sm" x-text="d.required"></span>
                        <div class="text-base-content/60" x-text="d.gloss"></div>
                        <!-- A closed domain's values, each with the gloss the
                             domain column cannot carry. This is the layer that
                             was living in prose: what computed means against
                             curated, what value means against counted. -->
                        <div x-show="d.domain.length" class="mt-1 flex flex-col gap-0.5 pl-3 border-l border-base-300">
                          <template x-for="v in d.domain" :key="v.value">
                            <div>
                              <span class="font-mono text-sm text-primary/80" x-text="v.label"></span>
                              <span x-show="v.gloss" class="text-sm text-base-content/50" x-text="' ' + v.gloss"></span>
                            </div>
                          </template>
                        </div>
                      </div>
                    </template>
                  </div>
                </details>
              </template>
            </div>
            <div x-show="propsLoading" class="flex justify-center py-10">
              <span class="loading loading-dots loading-md opacity-30"></span>
            </div>
            <div x-show="propsErr" class="text-base text-error font-mono" x-text="propsErr"></div>
            <template x-if="propsReg">
              <!-- Declared a Card grid with named parts (data/ui-units/codebook.md,
                   "Declaring a pattern in markup"); nothing at runtime reads the
                   attributes. Each area's heading is a group and its rule the
                   group's gloss; the totals line at the head is the frame's. -->
              <div class="" data-pattern="card-grid" data-part="list">
                <div class="flex items-center gap-4 flex-wrap mb-3 text-sm">
                  <span><span class="font-semibold text-lg" x-text="registryTotals.registries"></span> registries</span>
                  <span class="text-base-content/50"><span x-text="registryTotals.computed"></span> computed / <span x-text="registryTotals.curated"></span> curated</span>
                  <span x-show="registryTotals.inheriting" class="text-base-content/50"><span x-text="registryTotals.inheriting"></span> inheriting</span>
                  <span class="text-base-content/50"><span x-text="registryTotals.gated"></span> gated</span>
                  <span class="text-base-content/50"
                        data-title-tip="Registries whose population extends past this repository, so this checkout is an aggregate rather than the whole set. The rest are bounded by this repo and say nothing about the estate.">
                    <span x-text="registryTotals.estate"></span> of <span x-text="registryTotals.registries"></span> span the estate</span>
                  <span class="text-base-content/50"><span x-text="registryTotals.decls"></span> properties, <span x-text="registryTotals.closed"></span> with a closed domain</span>
                  <span x-show="registryTotals.unrendered" class="text-warning"
                        data-title-tip="Registry files no code under lib/, pages/ or app/ names: committed and gated, read by nobody. The number this tab exists to make impossible to ignore.">
                    <span x-text="registryTotals.unrendered"></span> with no app surface</span>
                </div>
                <template x-for="area in registryAreas" :key="area.key">
                  <div class="mb-4">
                    <div class="flex items-baseline gap-2 mb-1" data-part="group">
                      <h3 class="text-sm font-semibold uppercase tracking-wide text-base-content/40" x-text="area.label"></h3>
                      <span class="badge badge-ghost badge-sm font-mono" data-part="meta" x-text="area.rows.length"></span>
                    </div>
                    <p class="text-sm text-base-content/50 mb-3" data-part="summary" x-text="area.rule"></p>
                    <div class="flex flex-col gap-3">
                      <template x-for="r in area.rows" :key="r.id">
                        <div class="border border-base-300 rounded-lg p-3 bg-base-100" data-part="item">
                          <div class="flex items-baseline gap-2 flex-wrap">
                            <span class="font-semibold" data-part="title" x-text="r.title"></span>
                            <span class="badge badge-sm" data-part="meta" :class="r.membership === 'computed' ? 'badge-success' : 'badge-info'" x-text="r.membership"></span>
                            <span x-show="r.inherits" class="badge badge-sm badge-ghost" data-part="meta"
                                  data-title-tip-bare :data-title-tip="'descriptions inherited from ' + r.inherits"
                                  x-text="'inherits ' + r.inherits"></span>
                            <!-- Only estate gets a badge. Hub is the default
                                 and eighteen of twenty-two, so badging it would
                                 be noise on every card; the strip above carries
                                 both counts, which is where a reader compares. -->
                            <span x-show="r.span === 'estate'" class="badge badge-sm badge-accent" data-part="meta"
                                  data-title-tip="The population extends past this repository, so this registry is an aggregate and a complete enumeration needs the other repos read.">estate</span>
                            <span class="grow"></span>
                            <span x-show="!(r.renders_in || []).length" class="badge badge-warning badge-sm" data-part="meta"
                                  data-title-tip="No file under lib/, pages/ or app/ names this registry's file in code, so nothing in the app reads or shows it. A GitHub-rendered projection or a runtime-configured read does not count, and may be the honest answer; the badge asks the question rather than settling it.">no app surface</span>
                            <!-- The word none is a VALUE here, not an absence:
                                 CSV cannot tell a blank from an empty string, so
                                 the domain spells out checked-and-nothing-holds-
                                 it. A truthiness test reads that as a gate and
                                 links a file of that name; the totals strip had
                                 it right and this did not, which is the argument
                                 for one predicate over two readings of one
                                 column. -->
                            <a x-show="hasGate(r)" x-blob="peek(r.gate)" data-part="links"
                               class="text-base-content/30 hover:text-primary" :title="'Gated by ' + r.gate">
                              <i class="ph ph-shield-check text-lg"></i></a>
                            <span x-show="!hasGate(r)" class="badge badge-warning badge-sm" data-part="meta"
                                  data-title-tip="Nothing fails when this registry and the repo disagree">no gate</span>
                          </div>
                          <p class="text-base text-base-content/70 mt-1" data-part="summary" x-text="r.gloss"></p>
                          <div class="flex items-baseline gap-2 flex-wrap mt-2">
                            <span class="font-mono text-sm text-base-content/30" data-part="meta" x-text="r.id"></span>
                            <a x-blob="peek(r.file)" data-part="actions"
                               class="font-mono text-sm text-base-content/60 hover:text-primary" x-text="r.file"></a>
                          </div>
                          <!-- The identity line: which column names a row, and
                               which name space that column resolves into. It is
                               here because the ownership rule is only checkable
                               with it (the same page is annotate.html to the
                               page gallery and pages/annotate.html to the Tools
                               gallery), and a card showing that rule's warnings
                               while hiding the field it runs on was asking the
                               reader to take the gate on faith. A blank identity
                               is a real answer, not a gap: an opaque key never
                               collides, so the row says so. -->
                          <div class="flex items-baseline gap-2 flex-wrap mt-1 text-sm" data-part="body">
                            <span class="font-semibold text-base-content/40">keyed by</span>
                            <span class="font-mono text-base-content/70" x-text="r.key"></span>
                            <span class="text-base-content/40" x-text="r.identity
                              ? 'in ' + r.identity
                              : 'opaque, comparable to nothing'"></span>
                            <span x-show="r.fields !== 'governed'" class="badge badge-warning badge-sm"
                                  :data-title-tip="'fields: ' + r.fields" x-text="r.fields"></span>
                          </div>
                          <!-- Where the registry's contents reach a reader: the derived
                               renders_in list, each file a peekable GitHub jump. Short name
                               shown, full path in the title, because every app file's tail
                               is unique here and the row is already dense. -->
                          <div x-show="(r.renders_in || []).length" class="flex items-baseline gap-1.5 flex-wrap mt-1" data-part="links">
                            <span class="text-sm font-semibold text-base-content/40">renders in</span>
                            <template x-for="f in (r.renders_in || [])" :key="f">
                              <a x-blob="peek(f)"
                                 class="badge badge-ghost badge-sm font-mono hover:badge-primary transition-colors"
                                 :title="f" x-text="f.split('/').pop()"></a>
                            </template>
                          </div>
                          <p class="text-sm text-base-content/50 mt-1" data-part="body">
                            <span class="font-semibold text-base-content/40">asserts about</span> <span x-text="r.target"></span></p>
                          <p class="text-sm text-base-content/50 mt-0.5" data-part="body" x-text="r.scope"></p>
                          <div class="flex items-center gap-3 mt-2 text-sm text-base-content/50 flex-wrap">
                            <span data-part="meta"><span class="font-semibold text-base-content/70" x-text="r.decls.length"></span> properties</span>
                            <span x-show="r.nValue" data-part="meta"><span x-text="r.nValue"></span> required</span>
                            <span x-show="r.nCounted" data-part="meta"><span x-text="r.nCounted"></span> counted</span>
                            <span x-show="r.nClosed" data-part="meta"><span x-text="r.nClosed"></span> closed domain</span>
                            <span x-show="r.nComputed" data-part="meta"><span x-text="r.nComputed"></span> computed</span>
                          </div>
                          <!-- The properties themselves, defined rather than
                               counted. They were chips carrying their gloss in a
                               title attribute, which is no affordance at all on
                               a touch device and one hover at a time on a
                               desktop: the definition was committed, rendered,
                               and unreachable. A median registry declares six
                               and the longest fourteen, so there was never a
                               room problem, only an assumption that a name is
                               enough. -->
                          <div class="flex flex-col gap-0.5 mt-2 pl-2 border-l border-base-300" data-part="body">
                            <template x-for="d in r.decls" :key="d.property">
                              <div class="text-sm leading-snug">
                                <span class="font-mono font-semibold text-base-content/70" x-text="d.property"></span>
                                <span x-show="d.mode === 'computed'"
                                      class="badge badge-success badge-xs align-middle ml-1">computed</span>
                                <span x-show="d.required === 'none'"
                                      class="badge badge-ghost badge-xs align-middle ml-1"
                                      data-title-tip="optional, or filled by practice with no gate behind it">optional</span>
                                <!-- Which KIND of prose the column holds, from
                                     the text-field vocabulary. An alias resolves
                                     to its kind and is shown the same way,
                                     because an alias conforms: the tab has no
                                     business inventing a warning the gate
                                     deliberately does not raise. -->
                                <span x-show="d.textKind" class="badge badge-outline badge-xs align-middle ml-1"
                                      data-title-tip-bare :data-title-tip="'a ' + d.textKind + '-kind prose field (docs/text-fields.csv)'"
                                      x-text="d.textKind"></span>
                                <span class="text-base-content/50" x-text="' ' + d.gloss"></span>
                                <span x-show="d.values" class="text-primary/70 font-mono"
                                      x-text="d.values ? ' [' + d.values.join(' | ') + ']' : ''"></span>
                              </div>
                            </template>
                          </div>
                        </div>
                      </template>
                    </div>
                  </div>
                </template>
              </div>
            </template>
          </section>

          <!-- ── Tests ───────────────────────────────────────────────────────
               The documents registry pointed at the suite. The runner reports a
               pass total that cannot distinguish a boot-smoke check from an
               adversarial gate, so the count alone sends nobody anywhere. The
               strip cuts the same total by KIND, which is the axis that says
               what a pass is worth, and each count filters.
               Two figures are deliberately not summed into a headline: a
               browser check's assertions (null, not zero, since test() is not
               its unit) and boot smoke (reported beside the total rather than
               subtracted from it, because a boot check is cheap evidence, not
               no evidence).
               No backticks anywhere in this template: it is a JS template
               literal, and one would end it mid-markup. -->
          <section x-show="mapTab==='tests'">
            <div class="flex items-center gap-2 mb-3 flex-wrap">
              ${regChip('TESTS_MANIFEST')}
              <a x-blob="peek(TESTS_BUILDER)"
                 class="text-base-content/30 hover:text-primary"
                 title="node/build/tests-index.mjs stamps assertions, method, runner and boot_smoke; kind and protects are authored">
                <i class="ph ph-function"></i></a>
              <!-- The door into the suite as the strip has cut it: the deck
                   pages what the filters left, in the order the groups render,
                   so a reader who has picked "gate" reads the gates. -->
              <button type="button" x-show="testShown.length"
                      @click="openTestDeck(testShown[0])"
                      class="btn btn-square btn-sm max-sm:h-11 max-sm:w-11 btn-ghost hover:text-primary"
                      :title="'Read ' + plural(testShown.length, 'check') + ' one at a time'">
                <i class="ph ph-cards-three text-lg max-sm:text-xl"></i></button>
            </div>
            <div x-show="testsLoading" class="flex justify-center py-10">
              <span class="loading loading-dots loading-md opacity-30"></span>
            </div>
            <div x-show="testsErr" class="text-base text-error font-mono" x-text="testsErr"></div>
            <template x-if="testsReg">
              <div class="flex flex-col gap-4">

                <div class="flex flex-col gap-2">
                  <!-- The header line: what is true of the whole registry. The
                       names toggle lives here, not in the filter block below,
                       because it does not narrow anything; it was read as a
                       third filter row when it sat among the chips and wrapped. -->
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-sm text-base-content/40 tabular-nums"
                          :data-title-tip="'Top-level test() calls across the suite. Browser checks are excluded: they assert with their own harness, so test() is not their unit.'"
                          x-text="testTotals.files + ' files · ' + testTotals.assertions.toLocaleString() + ' assertions'"></span>
                    <div class="grow"></div>
                    <button type="button" x-show="testPicked.length" @click="clearDims()"
                            class="text-sm text-base-content/50 hover:text-primary px-2 py-1">clear filters</button>
                    <!-- One toggle for the whole registry, the same call the docs
                         registry makes about maintenance: the assertion list is
                         either the question you are asking or it is noise, and a
                         per-row disclosure would mean tapping 119 times. -->
                    <button type="button" @click="testNames = !testNames"
                            class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-colors text-base"
                            :class="testNames ? 'border-primary bg-primary/10' : 'border-base-300 hover:bg-base-200'"
                            title="Show what each file's assertions are named, read from its test() calls">
                      <i class="ph ph-list-bullets"></i><span>names</span></button>
                    <!-- The comparison-grain reading, where one exists for a
                         file. Same call as names: the detail is the question
                         being asked or it is noise, so one toggle for all. -->
                    <button type="button" x-show="testExplain" @click="testExplained = !testExplained"
                            class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-colors text-base"
                            :class="testExplained ? 'border-primary bg-primary/10' : 'border-base-300 hover:bg-base-200'"
                            title="Show each comparison a file makes: the kind, the requirement, the two objects and how each is produced, the plausible failure, and what agreement leaves open">
                      <i class="ph ph-scales"></i><span>compared</span>
                      <span class="text-xs tabular-nums text-base-content/50" x-text="testExplainCount"></span></button>
                  </div>
                  <!-- The counts the toggle stands behind, in the unit each is
                       counted in: comparison rows attached under registry files,
                       and how many registry files carry none. A row whose script
                       is no registry path is counted and named as unattached
                       rather than folded into either figure. -->
                  <div x-show="testExplain" class="text-sm text-base-content/40">
                    <span x-text="testExplainTotals.attached + ' comparisons under ' + testExplainTotals.files + ' files'"></span>
                    <span x-show="testExplainAsOf" x-text="' · read ' + testExplainAsOf"></span>
                    <span x-show="testExplainChanged && testExplainChanged.size" class="text-warning"
                          x-text="' · ' + (testExplainChanged?.size || 0) + ' explained files changed since'"></span>
                    <span x-text="' · ' + testExplainTotals.unexplained + ' files not yet explained'"></span>
                    <span x-show="testExplainTotals.rows !== testExplainTotals.attached" class="text-warning"
                          x-text="' · ' + (testExplainTotals.rows - testExplainTotals.attached) + ' rows name no registry file'"></span>
                  </div>

                  <!-- One labeled row per dimension. The label is the fix for
                       two strips of pills that looked like rivals: they are
                       different questions and they compose.
                       A block-level legend naming the two counts sat here until
                       2026-08-10 and was retired: it could sit beside neither
                       number, so it asked the reader to hold an order in their
                       head across a wrapping strip. Each number names itself on
                       hover instead. Not a slash either way: 13/69 reads as "13
                       of 69", a ratio between like things, and these are counts
                       of two different units. -->
                  <template x-for="d in testDimensions" :key="d.key">
                    <div class="flex items-baseline gap-2 flex-wrap" data-slot="frame:count-chips">
                      <span class="text-sm uppercase tracking-wide text-base-content/30 w-16 shrink-0"
                            :data-title-tip="d.question" x-text="d.label"></span>
                      <template x-for="c in d.chips" :key="c.value">
                        <button type="button" @click="toggleDim(d.key, c.value)" :title="c.hint"
                                class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-colors"
                                :class="testPick[d.key] === c.value ? 'border-primary bg-primary/10' : 'border-base-300 hover:bg-base-200'">
                          <!-- The tone marker, kind only. It reads as a colour
                               key rather than as a tinted number, which is what
                               the badge it replaced had become: the badge made
                               one dimension's chips a different shape from the
                               other two, for a colour the word beside it already
                               carried. -->
                          <span x-show="c.dot" class="w-2 h-2 rounded-full shrink-0" :class="c.dot"></span>
                          <span class="text-base" x-text="c.value"></span>
                          <!-- The two counts are different units, so they read as
                               one tight pair and each names itself on hover. That
                               is what retired the legend above the block: a label
                               naming both, once, could sit beside neither. They
                               sit at badge scale, a step below the value they
                               qualify, so the word being picked stays what the
                               chip leads with. -->
                          <span class="flex items-baseline gap-0.5">
                            <span class="text-xs tabular-nums text-base-content/50"
                                  :title="c.files + ' files'" x-text="c.files"></span>
                            <span class="text-xs text-base-content/40 px-0.5">|</span>
                            <span class="text-xs tabular-nums text-base-content/40"
                                  :title="c.counted ? c.assertions + ' assertions' : 'No assertion count: driven by a real browser and asserting in its own harness, so test() is not its unit'"
                                  x-text="c.counted ? c.assertions : 'n/a'"></span>
                          </span>
                        </button>
                      </template>
                    </div>
                  </template>

                  <template x-for="d in testPicked" :key="d.key">
                    <p class="text-sm text-base-content/50">
                      <span class="text-base-content/30" x-text="d.label + ' ' + testPick[d.key] + ': '"></span><span
                            x-text="d.hint(testPick[d.key], testsReg)"></span>
                    </p>
                  </template>
                </div>

                <!-- Declared a List with named parts (data/ui-units/codebook.md,
                     "Declaring a pattern in markup"); nothing at runtime reads the
                     attributes. The chip rows above are the frame's filters.
                     What the names and compared toggles expand inside an item
                     is its body; In the estate below is a separate list, left
                     undeclared. -->
                <div class="grid gap-x-8 gap-y-6 lg:grid-cols-2"
                     data-pattern="list" data-part="list">
                  <template x-for="grp in testGroups" :key="grp.method">
                    <div>
                      <h3 class="text-sm font-semibold uppercase tracking-wide text-base-content/40 mb-2" data-part="group">
<!-- Say which axis this is. The badge on every row below is a KIND,
                             and a bare "KIT" heading over a row badged "behavior"
                             reads as a contradiction rather than as two
                             orthogonal classifications. -->
                        <span class="font-normal text-base-content/30">method</span>
                        <span x-text="grp.method"></span>
                        <span class="font-normal normal-case text-base-content/30" data-part="summary" x-text="'· ' + grp.hint"></span>
                      </h3>
                      <div class="flex flex-col gap-1">
                        <template x-for="t in grp.tests" :key="t.path">
                          <div class="flex items-start gap-2.5 px-2 py-1.5 rounded-lg hover:bg-base-200/60 group" data-part="item">
                            <i class="ph mt-1 text-base-content/40 shrink-0" data-part="meta"
                               :class="t.runner === 'suite' ? 'ph-flask' : 'ph-browser'" data-title-tip-bare :data-title-tip="t.runner"></i>
                            <div class="min-w-0 flex-1">
                              <div class="flex items-center gap-2 flex-wrap">
                                <button type="button" class="text-base font-medium hover:text-primary text-left"
                                        :title="'Read ' + t.path + ' here'" data-part="title"
                                        @click="openTestDeck(t)" x-text="testTitle(t)"></button>
                                <span class="badge badge-sm badge-outline" data-part="meta" :class="kindTone(t.kind)" x-text="t.kind"></span>
                                <span class="text-sm tabular-nums text-base-content/40" data-part="meta"
                                      x-text="t.assertions === null ? 'browser' : t.assertions"></span>
                                <!-- Guard on length, not on the array: boot_smoke
                                     became a list of indices and an empty array
                                     is truthy, so a bare x-show would badge every
                                     row in the registry. -->
                                <span x-show="testExplained && changedSince(t.path)" class="text-sm text-warning/70" data-part="meta"
                                      data-title-tip="This file's contents changed after its comparisons were written; the rows describe an older version">changed since read</span>
                                <span x-show="t.boot_smoke?.length" class="text-sm text-warning/70 tabular-nums" data-part="meta"
                                      :data-title-tip="'assertions that only check the component mounts; turn on names to see which'"
                                      x-text="t.boot_smoke?.length + ' smoke'"></span>
                              </div>
                              <p class="text-base text-base-content/60" data-part="summary" x-text="t.protects"></p>
                              <!-- One block per comparison the file makes, read
                                   from the code rather than the registry. The
                                   kind leads because it is the word an expert
                                   would reach for; the two objects follow with
                                   how each is produced, since that decides what
                                   agreement establishes; the failure and the
                                   limit close, in that order, so the last line
                                   under every comparison is what it does NOT
                                   prove. -->
                              <div x-show="testExplained && explainOf(t).length" data-part="body"
                                   class="mt-2 flex flex-col gap-3 border-l border-primary/40 pl-3">
                                <template x-for="grp in groupsOf(explainOf(t))" :key="grp.kind">
                                <div class="flex flex-col gap-2">
                                  <div class="flex items-baseline gap-2 flex-wrap">
                                    <span class="font-medium" x-text="grp.kind"></span>
                                    <span class="text-sm text-base-content/50" x-text="grp.term"></span>
                                    <span x-show="grp.rows.length > 1" class="text-xs tabular-nums text-base-content/40" x-text="grp.rows.length + ' comparisons'"></span>
                                  </div>
                                <template x-for="(c, i) in grp.rows" :key="i">
                                  <div class="flex flex-col gap-0.5 text-base pl-2 border-l border-base-300">
                                    <p class="text-sm text-base-content/40" x-show="c.where" x-text="c.where"></p>
                                    <p class="text-base-content/80" x-text="c.requirement"></p>
                                    <p class="text-base-content/70">
                                      <span x-text="c.a"></span>
                                      <span class="text-sm text-base-content/40" x-text="'(' + c.a_mode + ')'"></span>
                                      <span class="text-base-content/40"> against </span>
                                      <span x-text="c.b"></span>
                                      <span class="text-sm text-base-content/40" x-text="'(' + c.b_mode + ')'"></span>
                                    </p>
                                    <p class="text-base-content/70"><span class="text-base-content/40">fails when </span><span x-text="c.failure"></span></p>
                                    <p class="text-base-content/70"><span class="text-base-content/40">does not establish </span><span x-text="c.limit"></span></p>
                                  </div>
                                </template>
                                </div>
                                </template>
                              </div>
                              <!-- The file's own account of its coverage. Read
                                   from the test() calls rather than authored, so
                                   it cannot drift from the file the way the
                                   sentence above can. A name carrying a template
                                   interpolation stands for several runtime
                                   tests, which is why this row's count can read
                                   lower than what the runner reports. -->
                              <ol x-show="testNames && t.assertion_names" data-part="body"
                                  class="mt-1.5 flex flex-col gap-1 border-l border-base-300 pl-3">
                                <template x-for="(n, i) in (t.assertion_names || [])" :key="i">
                                  <li class="flex gap-2 text-sm"
                                      :class="smokeSet(t).has(i) ? 'text-base-content/40' : 'text-base-content/70'">
                                    <span class="tabular-nums text-base-content/20 shrink-0" x-text="i + 1"></span>
                                    <span x-text="n"></span>
                                    <!-- Marked on the line it is true of. A boot
                                         check is a property of THIS assertion,
                                         not of the file, and the file-level chip
                                         it replaced could not say whether its
                                         number counted files or assertions. -->
                                    <span x-show="smokeSet(t).has(i)"
                                          class="text-warning/70 shrink-0"
                                          data-title-tip="A boot check: it proves the component mounted and logged nothing, and nothing more.">smoke</span>
                                  </li>
                                </template>
                              </ol>
                              <p x-show="t.runner !== 'suite'" class="text-sm text-base-content/40" data-part="meta">
                                <code x-text="t.runner"></code></p>
                            </div>
                            <a x-blob="peek(t.path)" title="Open on GitHub" data-part="actions"
                               class="opacity-0 group-hover:opacity-100 focus:opacity-100 text-base-content/30 hover:text-primary transition-opacity shrink-0 mt-1">
                              <i class="ph ph-github-logo"></i></a>
                          </div>
                        </template>
                      </div>
                    </div>
                  </template>
                </div>

                <!-- ── In the estate ──────────────────────────────────────
                     Other repos' checks, each read from the file that repo
                     declares under its manifest's checking key. They have no
                     row in the hub's registry, so the shape differs on purpose:
                     the repo's own reading supplies the file facts, and the
                     caption carries that repo's counting unit, never summed
                     with the hub's test() calls. -->
                <div x-show="!hasToken() && !estateChecking" class="text-sm text-base-content/40">
                  <span class="font-semibold uppercase tracking-wide text-base-content/40">In the estate</span>
                  <p class="mt-1">Sign in to read the checks other repos declare. The hub's suite is public; a repo's
                  own reading of its builders and verify scripts is read through the crawl.</p>
                </div>
                <div x-show="hasToken() && estateChecking && !estateChecking.length" class="text-sm text-base-content/40">
                  <span class="font-semibold uppercase tracking-wide text-base-content/40">In the estate</span>
                  <p class="mt-1">No repo declares a <code>checking</code> key in its .web-tools.json yet.</p>
                </div>
                <template x-if="estateChecking && estateChecking.length">
                  <div class="flex flex-col gap-4">
                    <template x-for="g in estateChecking" :key="g.repo">
                      <div>
                        <div class="flex items-baseline gap-3 flex-wrap mb-2">
                          <span class="text-sm font-semibold uppercase tracking-wide text-base-content/40">In the estate</span>
                          <a :href="'https://github.com/' + g.repo + '/blob/' + g.ref + '/' + g.comparisonsPath" target="_blank" rel="noopener"
                             class="font-mono text-sm text-base-content/60 hover:text-primary" x-text="g.short + (g.ref !== 'main' ? '@' + g.ref.slice(0, 7) : '')"></a>
                          <span x-show="g.from === 'query'" class="text-xs text-base-content/40">laid over from the address, not the crawl</span>
                        </div>
                        <p x-show="g.err" class="text-base text-error font-mono" x-text="'could not read ' + g.repo + ': ' + g.err"></p>
                        <template x-if="!g.err">
                          <div class="flex flex-col gap-4">
                            <p class="text-sm text-base-content/40"
                               x-text="checkingView(g).comparisons + ' comparisons under ' + checkingView(g).explained.length + ' files'
                                       + (checkingView(g).filesRead ? ' · ' + checkingView(g).filesRead + ' files in its reading' : '')
                                       + ' · unit: ' + (checkingView(g).units.join(', ') || 'unstated')
                                       + (g.asOf ? ' · read ' + g.asOf : ' · read date undeclared')
                                       + (g.changed && g.changed.size ? ' · ' + g.changed.size + ' explained files changed since' : '')"></p>
                            <div class="flex flex-col gap-1">
                              <template x-for="f in checkingView(g).explained" :key="f.path">
                                <div class="px-2 py-1.5 rounded-lg hover:bg-base-200/60 group">
                                  <div class="flex items-center gap-2 flex-wrap">
                                    <a :href="'https://github.com/' + g.repo + '/blob/' + g.ref + '/' + f.path" target="_blank" rel="noopener"
                                       class="text-base font-medium hover:text-primary" x-text="f.path.split('/').pop()"></a>
                                    <span class="text-sm text-base-content/40 font-mono" x-text="f.path.split('/').slice(0, -1).join('/')"></span>
                                    <template x-if="f.reading">
                                      <span class="flex items-center gap-2 text-sm text-base-content/40">
                                        <span x-text="f.reading.oracle"></span>
                                        <span x-text="f.reading.scope"></span>
                                        <span x-text="f.reading.blocks"></span>
                                        <span class="tabular-nums" x-text="f.reading.stop_sites + ' stop sites'"></span>
                                      </span>
                                    </template>
                                    <span x-show="!f.reading" class="text-sm text-base-content/40">not in this repo's reading</span>
                                    <span x-show="g.changed && g.changed.has(f.path)" class="text-sm text-warning/70"
                                          data-title-tip="This file's contents changed after its comparisons were written; the rows describe an older version">changed since read</span>
                                  </div>
                                  <p x-show="f.reading" class="text-base text-base-content/60" x-text="f.reading && f.reading.expert_reading"></p>
                                  <div x-show="testExplained" class="mt-2 flex flex-col gap-3 border-l border-primary/40 pl-3">
                                    <template x-for="grp in groupsOf(f.rows)" :key="grp.kind">
                                    <div class="flex flex-col gap-2">
                                      <div class="flex items-baseline gap-2 flex-wrap">
                                        <span class="font-medium" x-text="grp.kind"></span>
                                        <span class="text-sm text-base-content/50" x-text="grp.term"></span>
                                        <span x-show="grp.rows.length > 1" class="text-xs tabular-nums text-base-content/40" x-text="grp.rows.length + ' comparisons'"></span>
                                      </div>
                                    <template x-for="(c, i) in grp.rows" :key="i">
                                      <div class="flex flex-col gap-0.5 text-base pl-2 border-l border-base-300">
                                        <p class="text-sm text-base-content/40" x-show="c.where" x-text="c.where"></p>
                                        <p class="text-base-content/80" x-text="c.requirement"></p>
                                        <p class="text-base-content/70">
                                          <span x-text="c.a"></span>
                                          <span class="text-sm text-base-content/40" x-text="'(' + c.a_mode + ')'"></span>
                                          <span class="text-base-content/40"> against </span>
                                          <span x-text="c.b"></span>
                                          <span class="text-sm text-base-content/40" x-text="'(' + c.b_mode + ')'"></span>
                                        </p>
                                        <p class="text-base-content/70"><span class="text-base-content/40">fails when </span><span x-text="c.failure"></span></p>
                                        <p class="text-base-content/70"><span class="text-base-content/40">does not establish </span><span x-text="c.limit"></span></p>
                                      </div>
                                    </template>
                                    </div>
                                    </template>
                                  </div>
                                </div>
                              </template>
                            </div>
                            <!-- The two absences, told apart and counted in files. -->
                            <p class="text-sm text-base-content/40" x-show="checkingView(g).unexplained.length"
                               x-text="checkingView(g).unexplained.length + ' files in the reading have no comparison rows yet'"></p>
                            <p class="text-sm text-base-content/40" x-show="checkingView(g).noCheck.length">
                              <span x-text="checkingView(g).noCheck.length + ' files stop nowhere, so there is nothing to compare: '"></span>
                              <span class="font-mono" x-text="checkingView(g).noCheck.map(x => x.path.split('/').pop()).join(', ')"></span>
                            </p>
                          </div>
                        </template>
                      </div>
                    </template>
                  </div>
                </template>

              </div>
            </template>
          </section>

          <!-- ── Context ────────────────────────────────────────────────────
               Everything that enters a session. The tab opens on Delivery,
               fifteen mechanisms placed by scope and discretion tier, listed
               in ctxSpectraMechanisms rather than read from the registry.
               Beside it, two lenses over the registry: the overlaps, where two
               or more sources speak to one topic and the verdict says whether
               that is by design; and the measured tally from the session
               store. Circles (sources by where they are defined, outermost
               first) and When (each source by when it arrives) remain as
               alternate views. The private circles and the tally need a token,
               and say so on the circle rather than rendering empty. No
               backticks anywhere. -->
          <section x-show="mapTab==='context'">
            <div x-show="ctxLoading" class="flex justify-center py-10">
              <span class="loading loading-dots loading-md opacity-30"></span>
            </div>
            <div x-show="ctxErr" class="text-base text-error font-mono" x-text="ctxErr"></div>
            <p x-show="ctxPrivateErr" class="text-sm text-error/80 border border-dashed border-base-300 rounded-lg p-3 mb-4" x-text="ctxPrivateErr"></p>

            <template x-if="ctxReg">
              <div>
                <div class="flex items-center gap-1 mb-4 flex-wrap">
                  <div class="flex items-center gap-0.5 rounded-lg bg-base-200/60 p-0.5 w-fit flex-wrap" data-slot="frame:subtabs">
                    <template x-for="l in [{k:'delivery',n:'Delivery',i:'ph-tray'},{k:'overlaps',n:'Overlaps',i:'ph-intersect'},{k:'measured',n:'Measured',i:'ph-ruler'}]" :key="l.k">
                      <button @click="ctxLens = l.k"
                              class="flex items-center gap-1.5 px-3 py-1 rounded-md text-base font-medium transition-colors cursor-pointer"
                              :class="ctxLens === l.k ? 'bg-base-100 text-primary shadow-sm' : 'text-base-content/60 hover:text-base-content'">
                        <i class="ph" :class="l.i"></i><span x-text="l.n"></span>
                        <span x-show="l.k === 'overlaps'" class="opacity-50" x-text="ctxOverlapsAll"></span></button>
                    </template>
                  </div>
                  <div class="flex items-center gap-2 ml-auto text-xs text-base-content/40 flex-wrap">
                    <span class="hidden sm:inline">Alternate views:</span>
                    <button type="button" @click="ctxLens = 'circles'" class="hover:text-primary transition-colors cursor-pointer" :class="ctxLens === 'circles' ? 'text-primary font-bold underline' : ''">Circles</button>
                    <span>·</span>
                    <button type="button" @click="ctxLens = 'when'" class="hover:text-primary transition-colors cursor-pointer" :class="ctxLens === 'when' ? 'text-primary font-bold underline' : ''">When</button>
                    <span class="text-base-content/20">|</span>
                    <button type="button" @click="openCtxRegistry(0)" class="hover:text-primary transition-colors cursor-pointer inline-flex items-center gap-1" title="Inspect raw docs/context-sources.csv in file deck"><i class="ph ph-file-csv"></i><span class="hidden md:inline">sources.csv</span></button>
                    <button type="button" @click="openCtxRegistry(1)" class="hover:text-primary transition-colors cursor-pointer inline-flex items-center gap-1" title="Inspect raw docs/context-topics.csv in file deck"><i class="ph ph-file-csv"></i><span class="hidden md:inline">topics.csv</span></button>
                    <span x-show="ctxPrivate && ctxPrivate.length" class="text-success inline-flex items-center gap-0.5" title="Private sources unlocked via token"><i class="ph ph-lock-key-open"></i></span>
                    <span x-show="!hasToken()" class="text-base-content/30 inline-flex items-center gap-0.5" title="Private account sources require token"><i class="ph ph-lock-simple"></i></span>
                  </div>
                </div>

                <!-- Circles -->
                <div x-show="ctxLens === 'circles'">
                  <div class="flex flex-wrap items-center gap-1.5 mb-3" data-slot="frame:count-chips">
                    <button @click="ctxCircle = ''" class="badge badge-sm cursor-pointer"
                            :class="!ctxCircle ? 'badge-primary' : 'badge-ghost hover:badge-neutral'">
                      All <span class="ml-1 opacity-60" x-text="ctxAll.length"></span></button>
                    <template x-for="c in ctxCircleCounts" :key="c.key">
                      <button @click="ctxCircle = (ctxCircle === c.key ? '' : c.key)" class="badge badge-sm cursor-pointer"
                              :class="ctxCircle === c.key ? 'badge-primary' : (c.n ? 'badge-ghost hover:badge-neutral' : 'badge-ghost opacity-50')">
                        <span x-text="c.label"></span><span class="ml-1 opacity-60" x-text="c.n"></span></button>
                    </template>
                  </div>

                  <!-- Declared a Card grid with named parts (data/ui-units/codebook.md,
                       "Declaring a pattern in markup"); nothing at runtime reads
                       the attributes. Only the Circles lens, the one the tab is
                       coded on; each numbered circle heading is a group, and the
                       badge line above is the frame's filter. -->
                  <div class="flex flex-col gap-7"
                       data-pattern="card-grid" data-part="list">
                    <template x-for="(c, ci) in ctxCircles" :key="c.key">
                      <div>
                        <div class="flex items-baseline gap-2 flex-wrap mb-2" data-part="group">
                          <span class="font-mono text-sm text-base-content/30" data-part="meta" x-text="ci + 1"></span>
                          <span class="text-sm font-semibold uppercase tracking-wide text-base-content/60" x-text="c.label"></span>
                          <span class="text-sm text-base-content/30" data-part="meta" x-text="c.rows.length || ''"></span>
                          <span x-show="ctxGap(c)" class="text-sm text-base-content/40" data-part="summary" x-text="ctxGap(c)"></span>
                        </div>
                        <div class="flex flex-col gap-2">
                          <template x-for="r in c.rows" :key="r.id">
                            <div class="border border-base-300 rounded-lg p-3 bg-base-100" data-part="item"
                                 :class="r.status === 'retiring' ? 'opacity-70 border-dashed' : ''">
                              <div class="flex items-baseline gap-2 flex-wrap">
                                <button x-show="ctxFile(r)" @click="openCtxDeck(r)" class="font-semibold text-left hover:text-primary" data-part="title" x-text="r.item"></button>
                                <span x-show="!ctxFile(r)" class="font-semibold" data-part="title" x-text="r.item"></span>
                                <span x-show="r.status === 'retiring'" class="badge badge-sm badge-soft badge-warning" data-part="meta">retiring</span>
                                <span class="grow"></span>
                                <em class="text-sm not-italic text-base-content/50" data-part="meta" x-text="ctxTally(r)"></em>
                              </div>
                              <p class="text-base text-base-content/60 mt-1" data-part="summary" x-text="r.gloss"></p>
                              <div class="text-sm text-base-content/45 mt-2" data-part="meta" x-text="ctxMeta(r)"></div>
                              <a x-show="r.link" :href="r.link" target="_blank" rel="noopener" data-part="links"
                                 class="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-1">
                                <span x-text="r.defined_in || 'Settings'"></span><i class="ph ph-arrow-square-out"></i></a>
                              <div x-show="!r.link && r.defined_in && !ctxFile(r)" class="text-sm text-base-content/45 mt-1" data-part="meta" x-text="r.defined_in"></div>
                              <div x-show="r.topicList.length" class="text-sm mt-1" data-part="links">
                                <span class="text-base-content/45">Also said in:</span>
                                <template x-for="(k, ki) in r.topicList" :key="k">
                                  <span><span x-show="ki" class="text-base-content/30"> · </span><button @click="openCtxTopic(k)"
                                        class="text-primary hover:underline" x-text="ctxTopicLabel(k)"></button></span>
                                </template>
                              </div>
                            </div>
                          </template>
                        </div>
                      </div>
                    </template>
                  </div>
                </div>

                <!-- When: circles by arrival moment; a picked topic lights its
                     sources. Stacks below lg. -->
                <div x-show="ctxLens === 'when'">
                  <div class="flex items-center gap-3 mb-4 flex-wrap text-sm">
                    <label class="flex items-center gap-2">
                      <span class="text-base-content/60">Topic</span>
                      <select class="select select-sm min-w-48" x-model="ctxTopic" aria-label="Light one overlap topic">
                        <option value="">none</option>
                        <template x-for="t in ctxTopicsLive" :key="t.topic">
                          <option :value="t.topic" :selected="ctxTopic === t.topic" x-text="t.label + ' · ' + t.verdict"></option>
                        </template>
                      </select>
                    </label>
                    <span x-show="ctxTopic" class="text-base-content/50" x-text="ctxWhenSummary"></span>
                    <span class="grow"></span>
                    <span class="text-base-content/50">● recorded · ◇ reconstructed · ∅ nothing records it</span>
                  </div>
                  <div class="grid grid-cols-1 lg:grid-cols-[9rem_repeat(5,minmax(0,1fr))] gap-y-3 lg:gap-y-0 lg:border-t lg:border-base-300">
                    <div class="hidden lg:block"></div>
                    <template x-for="m in ctxMomentDefs" :key="m.key">
                      <div class="hidden lg:block px-2 py-2 text-sm font-semibold uppercase tracking-wide text-base-content/60" x-text="m.label"></div>
                    </template>
                    <template x-for="c in ctxWhen" :key="c.key">
                      <div class="contents">
                        <div class="pt-2 border-t border-base-300 lg:py-3">
                          <div class="font-semibold" x-text="c.label"></div>
                          <div class="text-sm text-base-content/45" x-text="ctxGap(c) || (c.n + (c.n === 1 ? ' source' : ' sources'))"></div>
                        </div>
                        <template x-for="cell in c.cells" :key="c.key + cell.key">
                          <div class="lg:border-t lg:border-l lg:border-base-300 lg:px-2 lg:py-3"
                               :class="cell.rows.length ? '' : 'hidden lg:block'">
                            <div class="lg:hidden text-sm text-base-content/50 mb-1" x-text="cell.label"></div>
                            <div class="flex flex-wrap gap-1.5">
                              <template x-for="r in cell.rows" :key="r.id">
                                <button type="button" @click="ctxFile(r) ? openCtxDeck(r) : null"
                                        :data-title-tip="r.gloss"
                                        class="inline-flex items-baseline gap-1.5 rounded-md border px-2 py-0.5 text-sm text-left transition-colors"
                                        :class="ctxWhenTone(r)">
                                  <span class="font-mono text-xs opacity-60" x-text="ctxEvidence(r)"></span><span x-text="r.item"></span></button>
                              </template>
                            </div>
                          </div>
                        </template>
                      </div>
                    </template>
                  </div>
                </div>

                <!-- Context Delivery: Unified Scope x Discretion Matrix & Interactive Gauges -->
                <div x-show="ctxLens === 'delivery' || ctxLens === 'spectra'">
                  <div class="flex items-center gap-3 mb-4 flex-wrap text-sm">
                    <!-- Estate Filter -->
                    <div class="flex items-center gap-1" data-slot="frame:count-chips">
                      <button type="button" @click="ctxSpectraEnv = 'all'" class="badge badge-sm cursor-pointer gap-1"
                              :class="ctxSpectraEnv === 'all' ? 'badge-primary' : 'badge-ghost hover:badge-neutral'">
                        <span>All</span> <span class="opacity-60 text-[10px]" x-text="ctxSpectraMechanisms.length"></span>
                      </button>
                      <button type="button" @click="ctxSpectraEnv = 'claude'" class="badge badge-sm cursor-pointer gap-1"
                              :class="ctxSpectraEnv === 'claude' ? 'badge-warning' : 'badge-ghost hover:badge-neutral'">
                        <span class="inline-flex items-center" x-html="ctxSpectraAssistantMark('claude', 'w-3 h-3')"></span>
                        <span class="hidden sm:inline">Claude</span> <span class="opacity-60 text-[10px]" x-text="ctxSpectraCountEnv('claude')"></span>
                      </button>
                      <button type="button" @click="ctxSpectraEnv = 'gemini'" class="badge badge-sm cursor-pointer gap-1"
                              :class="ctxSpectraEnv === 'gemini' ? 'badge-info' : 'badge-ghost hover:badge-neutral'">
                        <span class="inline-flex items-center" x-html="ctxSpectraAssistantMark('gemini', 'w-3 h-3')"></span>
                        <span class="hidden sm:inline">Gemini</span> <span class="opacity-60 text-[10px]" x-text="ctxSpectraCountEnv('gemini')"></span>
                      </button>
                      <button type="button" @click="ctxSpectraEnv = 'chatgpt'" class="badge badge-sm cursor-pointer gap-1"
                              :class="ctxSpectraEnv === 'chatgpt' ? 'badge-success' : 'badge-ghost hover:badge-neutral'">
                        <span class="inline-flex items-center" x-html="ctxSpectraAssistantMark('chatgpt', 'w-3 h-3')"></span>
                        <span class="hidden sm:inline">ChatGPT</span> <span class="opacity-60 text-[10px]" x-text="ctxSpectraCountEnv('chatgpt')"></span>
                      </button>
                    </div>

                    <!-- Discretion Filter -->
                    <div class="flex items-center gap-1" data-slot="frame:filter-switch">
                      <button type="button" @click="ctxSpectraFilterDiscretion = ''" class="badge badge-sm cursor-pointer"
                              :class="!ctxSpectraFilterDiscretion ? 'badge-primary' : 'badge-ghost hover:badge-neutral'">
                        All Tiers
                      </button>
                      <template x-for="d in ctxSpectraDiscretions" :key="d.id">
                        <button type="button" @click="ctxSpectraFilterDiscretion = (ctxSpectraFilterDiscretion === d.id ? '' : d.id)"
                                class="badge badge-sm cursor-pointer"
                                :class="ctxSpectraFilterDiscretion === d.id ? 'badge-primary' : 'badge-ghost hover:badge-neutral'">
                          <span x-text="d.short"></span>
                        </button>
                      </template>
                    </div>

                    <!-- Overlap Topic Highlighting Pill (if active) -->
                    <div x-show="ctxTopic" class="flex items-center gap-1.5 px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-xs text-primary font-medium">
                      <i class="ph ph-intersect"></i>
                      <span>Topic:</span>
                      <strong x-text="ctxTopicLabel(ctxTopic)"></strong>
                      <button type="button" @click="ctxTopic = ''" class="hover:text-primary-focus ml-1 cursor-pointer" title="Clear topic filter"><i class="ph ph-x"></i></button>
                    </div>

                    <div class="grow"></div>
                    <span class="text-sm text-base-content/40 tabular-nums"
                          x-text="ctxSpectraMechanisms.length + ' mechanisms · 4 scopes · 4 discretion tiers'">
                    </span>
                  </div>

                  <!-- Unified Grid + Inspector Layout. Declared a Figure
                       (data/ui-units/codebook.md, "Slots"): the matrix is the
                       body, and a pick redraws the inspector under it. -->
                  <div class="flex flex-col gap-4" data-pattern="figure">

                    <!-- 1. Top Section: Ultra-Compact Scope x Discretion Matrix -->
                    <div class="border border-base-300 rounded-md bg-base-100 overflow-x-auto shadow-xs">
                      <div class="min-w-[540px] sm:min-w-[680px] grid grid-cols-[5.25rem_repeat(4,minmax(115px,1fr))] sm:grid-cols-[7.5rem_repeat(4,minmax(0,1fr))] divide-x divide-y divide-[var(--color-base-300)]">
                        
                        <!-- Header: Top Left -->
                        <div class="px-2 py-1.5 bg-base-200/50 flex items-center justify-between" title="Discretion vs Scope Matrix">
                          <span class="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-base-content/60 truncate">Discr. \\ Scope</span>
                        </div>

                        <!-- Scope Headers (Columns) -->
                        <template x-for="s in ctxSpectraScopes" :key="s.id">
                          <div class="px-2 py-1.5 bg-base-200/50 flex items-center justify-between min-w-0" :title="s.label + ': ' + s.gloss">
                            <span class="text-xs font-bold uppercase tracking-wider text-base-content truncate" x-text="s.label"></span>
                          </div>
                        </template>

                        <!-- Discretion Rows (Ultra-Compact) -->
                        <template x-for="d in ctxSpectraFilteredDiscretions" :key="d.id">
                          <div class="contents">
                            <!-- Row Header -->
                            <div class="px-2 py-1.5 bg-base-200/30 flex items-center justify-between gap-1 min-w-0" :title="d.label + ': ' + d.gloss + ' (' + d.cost + ')'">
                              <span class="text-xs font-bold text-base-content truncate" x-text="d.short"></span>
                              <span class="w-1.5 h-1.5 rounded-full shrink-0" :class="d.dotClass"></span>
                            </div>

                            <!-- 4 Scope Cells (Compact single-line chips) -->
                            <template x-for="s in ctxSpectraScopes" :key="s.id">
                              <div class="p-1 flex flex-col gap-1 min-h-[30px]"
                                   :class="ctxSpectraCellItems(s.id, d.id).length ? 'bg-base-100' : 'bg-base-200/10'">
                                
                                <template x-for="m in ctxSpectraCellItems(s.id, d.id)" :key="m.id">
                                  <button type="button" @click="ctxSpectraSelected = m.id"
                                          class="w-full text-left flex items-center justify-between gap-1 px-1.5 py-0.5 rounded border text-xs transition-all cursor-pointer min-w-0"
                                          :class="ctxSpectraSelected === m.id ? 'border-primary bg-primary/10 text-primary font-semibold shadow-xs ring-1 ring-[var(--color-primary)]' : (ctxTopic && m.topics && m.topics.includes(ctxTopic) ? 'border-primary/70 bg-primary/10 text-primary font-semibold ring-1 ring-[var(--color-primary)]' : 'border-base-300 bg-base-100 hover:border-primary/50 text-base-content/85')"
                                          :title="m.title + ' (' + ctxSpectraAssistantLabel(m.env) + ') — ' + m.gloss">
                                    <div class="flex items-center gap-1 min-w-0 truncate">
                                      <i class="ph text-xs shrink-0 text-base-content/60" :class="m.icon"></i>
                                      <span class="truncate text-[11px]" x-text="m.title"></span>
                                    </div>
                                    <div class="flex items-center gap-1 shrink-0">
                                      <i class="ph text-base-content/40 text-[10px]" :class="ctxSpectraTriggerIcon(m.trigger)" :title="m.trigger"></i>
                                      <span class="shrink-0 flex items-center" :title="ctxSpectraAssistantLabel(m.env)" x-html="ctxSpectraAssistantMark(m.env, 'w-3 h-3')"></span>
                                    </div>
                                  </button>
                                </template>

                                <div x-show="!ctxSpectraCellItems(s.id, d.id).length" class="grow flex items-center justify-center">
                                  <span class="text-[10px] text-base-content/20 font-mono">—</span>
                                </div>

                              </div>
                            </template>
                          </div>
                        </template>

                      </div>
                    </div>

                    <!-- 2. Bottom Section: Spectra Barometer & Detailed Inspector -->
                    <template x-if="ctxSpectraActive">
                      <div class="border border-base-300 rounded-md p-3 sm:p-4 bg-base-100 flex flex-col gap-3 shadow-xs">
                        <!-- Selected Mechanism Header -->
                        <div class="flex items-baseline justify-between flex-wrap gap-2 border-b border-base-300 pb-2.5">
                          <div class="flex items-center gap-2.5 min-w-0">
                            <div class="p-1.5 rounded-md bg-base-200 border border-base-300 flex items-center justify-center shrink-0 w-8 h-8">
                              <i class="ph text-lg text-primary" :class="ctxSpectraActive.icon"></i>
                            </div>
                            <div class="min-w-0">
                              <div class="flex items-baseline gap-1.5 flex-wrap">
                                <h3 class="font-bold text-sm sm:text-base leading-tight" x-text="ctxSpectraActive.title"></h3>
                                <div class="flex items-center gap-1 px-1.5 py-0.5 rounded bg-base-200 border border-base-300 text-[10px] font-mono">
                                  <span class="inline-flex items-center" x-html="ctxSpectraAssistantMark(ctxSpectraActive.env, 'w-3 h-3')"></span>
                                  <span x-text="ctxSpectraAssistantLabel(ctxSpectraActive.env)"></span>
                                </div>
                              </div>
                              <code class="text-[11px] text-base-content/50 font-mono break-all" x-text="ctxSpectraActive.file"></code>
                            </div>
                          </div>
                          <div class="flex flex-wrap items-center gap-2 min-w-0">
                            <span class="badge badge-sm font-mono text-[10px]" :class="ctxSpectraActiveDiscretionBadge()" x-text="ctxSpectraActive.discretionLabel"></span>
                            <span class="badge badge-sm badge-ghost font-mono text-[10px] h-auto max-w-full whitespace-normal" x-text="'Footprint: ' + ctxSpectraActive.tokenCost"></span>
                          </div>
                        </div>

                        <!-- Gloss Description -->
                        <p class="text-xs text-base-content/75 leading-relaxed" x-text="ctxSpectraActive.gloss"></p>

                        <!-- Spectra Barometer: Interactive 3-Axis Gauges -->
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                          <!-- 1. Scope Gauge -->
                          <div class="bg-base-200/50 p-2.5 rounded-md border border-base-300 flex flex-col gap-1.5">
                            <div class="flex items-baseline justify-between text-[11px]">
                              <span class="font-semibold uppercase tracking-wider text-base-content/60">1. Scope</span>
                              <span class="font-mono text-primary font-bold text-xs" x-text="ctxSpectraActive.scopeLabel"></span>
                            </div>
                            <div class="relative py-1">
                              <div class="h-1.5 rounded-full bg-base-300 w-full relative">
                                <div class="absolute -top-1 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-primary ring-2 ring-[var(--color-primary)]/20 shadow-xs transition-all duration-200"
                                     :style="'left:' + ctxSpectraScalePos('scope', ctxSpectraActive) + '%;'"></div>
                              </div>
                            </div>
                            <div class="flex justify-between text-[9px] font-mono text-base-content/40 pt-0.5">
                              <span>Universal</span>
                              <span>Plugin</span>
                              <span>Repo</span>
                              <span>Turn</span>
                            </div>
                            <p class="text-[10px] text-base-content/65 leading-tight mt-0.5" x-text="ctxSpectraActive.scopeGloss"></p>
                          </div>

                          <!-- 2. Discretion Gauge -->
                          <div class="bg-base-200/50 p-2.5 rounded-md border border-base-300 flex flex-col gap-1.5">
                            <div class="flex items-baseline justify-between text-[11px]">
                              <span class="font-semibold uppercase tracking-wider text-base-content/60">2. Discretion</span>
                              <span class="font-mono text-primary font-bold text-xs" x-text="ctxSpectraActive.discretionLabel"></span>
                            </div>
                            <div class="relative py-1">
                              <div class="h-1.5 rounded-full bg-base-300 w-full relative">
                                <div class="absolute -top-1 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-primary ring-2 ring-[var(--color-primary)]/20 shadow-xs transition-all duration-200"
                                     :style="'left:' + ctxSpectraScalePos('discretion', ctxSpectraActive) + '%;'"></div>
                              </div>
                            </div>
                            <div class="flex justify-between text-[9px] font-mono text-base-content/40 pt-0.5">
                              <span>Injected</span>
                              <span>Prodded</span>
                              <span>Reactive</span>
                              <span>Pulled</span>
                            </div>
                            <p class="text-[10px] text-base-content/65 leading-tight mt-0.5" x-text="ctxSpectraActive.discretionGloss"></p>
                          </div>

                          <!-- 3. Lifecycle Trigger Gauge -->
                          <div class="bg-base-200/50 p-2.5 rounded-md border border-base-300 flex flex-col gap-1.5">
                            <div class="flex items-baseline justify-between text-[11px]">
                              <span class="font-semibold uppercase tracking-wider text-base-content/60">3. Trigger</span>
                              <span class="font-mono text-primary font-bold text-xs" x-text="ctxSpectraActive.trigger"></span>
                            </div>
                            <div class="relative py-1">
                              <div class="h-1.5 rounded-full bg-base-300 w-full relative">
                                <div class="absolute -top-1 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-primary ring-2 ring-[var(--color-primary)]/20 shadow-xs transition-all duration-200"
                                     :style="'left:' + ctxSpectraScalePos('trigger', ctxSpectraActive) + '%;'"></div>
                              </div>
                            </div>
                            <div class="flex justify-between text-[9px] font-mono text-base-content/40 pt-0.5">
                              <span>Build</span>
                              <span>Start</span>
                              <span>Event</span>
                              <span>Turn</span>
                              <span>Demand</span>
                            </div>
                            <p class="text-[10px] text-base-content/65 leading-tight mt-0.5" x-text="ctxSpectraActive.triggerGloss"></p>
                          </div>
                        </div>

                        <!-- Bottom Details: Architectural Rationale & Token Economics -->
                        <div class="grid grid-cols-1 md:grid-cols-[1fr_16rem] gap-3 pt-2 border-t border-base-200 text-xs">
                          <div class="flex flex-col gap-0.5">
                            <span class="text-[10px] font-bold uppercase tracking-wider text-base-content/50">Architectural Rationale</span>
                            <p class="text-base-content/80 leading-relaxed text-pretty text-[11px]" x-text="ctxSpectraActive.rationale"></p>
                          </div>
                          <div class="flex flex-col gap-0.5">
                            <span class="text-[10px] font-bold uppercase tracking-wider text-base-content/50">Token Footprint & Idle Cost</span>
                            <p class="text-base-content/80 font-mono text-[11px]" x-text="ctxSpectraActive.tokenCost"></p>
                          </div>
                        </div>

                        <!-- Collision Topics Linkage -->
                        <template x-if="ctxSpectraActive.topics && ctxSpectraActive.topics.length">
                          <div class="flex items-center gap-1.5 flex-wrap pt-2 border-t border-base-200 text-xs">
                            <span class="text-[10px] font-bold uppercase tracking-wider text-base-content/50">Collision Topics:</span>
                            <template x-for="t in ctxSpectraActive.topics" :key="t">
                              <button type="button" @click="openCtxTopic(t)"
                                      class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-base-200 hover:bg-primary/20 border border-base-300 hover:border-primary/40 text-[10px] text-base-content transition-colors cursor-pointer"
                                      :title="'View ' + ctxTopicLabel(t) + ' in Overlaps'">
                                <i class="ph ph-intersect text-primary"></i>
                                <span x-text="ctxTopicLabel(t)"></span>
                              </button>
                            </template>
                          </div>
                        </template>
                      </div>
                    </template>

                  </div>
                </div>

                <!-- Overlaps -->
                <div x-show="ctxLens === 'overlaps'">
                  <div x-show="ctxTopic" class="flex items-center gap-2 mb-4 text-sm">
                    <span class="text-base-content/50">One topic:</span>
                    <span class="font-semibold" x-text="ctxTopicLabel(ctxTopic)"></span>
                    <button @click="ctxTopic = ''" class="text-primary hover:underline">show all</button>
                  </div>
                  <div class="flex flex-col gap-4">
                    <template x-for="o in ctxOverlaps" :key="o.topic">
                      <div class="border border-base-300 rounded-lg p-4 bg-base-100">
                        <div class="flex items-baseline gap-2 flex-wrap">
                          <span class="font-semibold text-lg" x-text="o.label"></span>
                          <span class="badge badge-sm" :class="ctxVerdict(o.verdict).tone"
                                :title="ctxVerdict(o.verdict).gloss" x-text="o.verdict"></span>
                          <span class="grow"></span>
                          <span class="text-sm text-base-content/40"
                                x-text="o.rows.length + ' sources in ' + o.circles + (o.circles === 1 ? ' circle' : ' circles')"></span>
                          <button @click="ctxTopic = o.topic; ctxLens = 'delivery'" class="text-sm text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"><i class="ph ph-tray"></i><span>Delivery</span></button>
                          <button @click="ctxTopic = o.topic; ctxLens = 'when'" class="text-sm text-base-content/40 hover:text-primary hover:underline cursor-pointer">When</button>
                        </div>
                        <p class="text-base text-base-content/60 mt-1" x-text="o.gloss"></p>
                        <div class="flex flex-col mt-3 divide-y divide-[var(--color-base-200)]">
                          <template x-for="r in o.rows" :key="r.id">
                            <div class="flex items-baseline gap-2 py-1.5 flex-wrap"
                                 :class="r.status === 'retiring' ? 'opacity-60' : ''">
                              <span class="badge badge-sm badge-ghost w-32 justify-start" x-text="ctxCircleLabel(r.circle)"></span>
                              <button x-show="ctxFile(r)" @click="openCtxDeck(r)" class="text-left hover:text-primary" x-text="r.item"></button>
                              <span x-show="!ctxFile(r)" x-text="r.item"></span>
                              <span x-show="r.status === 'retiring'" class="badge badge-sm badge-soft badge-warning">retiring</span>
                            </div>
                          </template>
                        </div>
                      </div>
                    </template>
                  </div>
                </div>

                <!-- Measured -->
                <div x-show="ctxLens === 'measured'">
                  <p x-show="!hasToken()" class="text-sm text-base-content/40">Needs a token.</p>
                  <template x-if="hasToken() && docStartup">
                    <div class="flex flex-col gap-4">
                      <div>
                        <div class="flex items-baseline gap-2 flex-wrap mb-2">
                          <span class="text-sm font-semibold uppercase tracking-wide text-base-content/60">Instruction files at session start</span>
                          <span class="text-sm text-base-content/40 grow"
                                x-text="docReadsSessions + ' recorded sessions'"></span>
                        </div>
                        <div class="flex flex-col divide-y divide-[var(--color-base-200)] border border-base-300 rounded-lg bg-base-100">
                          <template x-for="m in ctxMeasuredStartup" :key="m.path">
                            <div class="flex gap-3 px-3 py-2" :class="m.stale ? 'opacity-50' : ''">
                              <span class="font-mono text-sm tabular-nums w-10 text-right shrink-0" x-text="m.sessions"></span>
                              <div class="min-w-0">
                                <div class="flex items-baseline gap-2 flex-wrap">
                                  <span class="font-mono text-sm break-all" x-text="m.path"></span>
                                  <span x-show="!m.row && !m.stale" class="badge badge-sm badge-soft badge-warning"
                                        title="No registry row claims this file">not in the registry</span>
                                </div>
                                <div class="text-sm text-base-content/45"
                                     x-text="(m.row ? m.row.item + ' · ' : '') + (m.receipt ? m.receipt + ' receipt · ' : '') + (m.reconstructed ? m.reconstructed + ' reconstructed · ' : '') + (m.stale ? 'not seen since ' : 'last ') + ctxDate(m.last)"></div>
                              </div>
                            </div>
                          </template>
                        </div>
                      </div>
                      <div x-show="ctxMeasuredSkills.length">
                        <div class="flex items-baseline gap-2 flex-wrap mb-2">
                          <span class="text-sm font-semibold uppercase tracking-wide text-base-content/60">Skills invoked</span>
                          
                        </div>
                        <div class="flex flex-col divide-y divide-[var(--color-base-200)] border border-base-300 rounded-lg bg-base-100">
                          <template x-for="s in ctxMeasuredSkills" :key="s.path">
                            <div class="flex items-baseline gap-3 px-3 py-2">
                              <span class="font-mono text-sm tabular-nums w-10 text-right shrink-0" x-text="s.sessions"></span>
                              <span class="font-mono text-sm" x-text="s.path"></span>
                              <span x-show="!s.plugin" class="badge badge-sm badge-ghost"
                                    title="An account upload, a repo's own skill, or one since retired">not in the plugin</span>
                              <span class="grow"></span>
                              <span class="text-sm text-base-content/40 shrink-0" x-text="ctxDate(s.last)"></span>
                            </div>
                          </template>
                        </div>
                      </div>
                    </div>
                  </template>
                  <p x-show="hasToken() && !docStartup" class="text-sm text-base-content/40">
                    The session cache has no startup tally yet.</p>
                </div>
              </div>
            </template>
          </section>

          <!-- ── Harness ────────────────────────────────────────────────────
               The harness registry. Same shape as Tests one tab over: role is
               the authored judgment, the counts are derived, and a blank role
               renders in the warning tone rather than being hidden, because
               the ledger of unaccounted files is the number this tab exists
               to show. No backticks anywhere in this template. -->
          <section x-show="mapTab==='harness'">
            <div class="flex items-center gap-2 mb-1 flex-wrap">
              ${regChip('TOOLS_MANIFEST')}
              <a x-blob="peek(TOOLS_BUILDER)"
                 class="text-base-content/30 hover:text-primary"
                 title="node/build/tools-index.mjs stamps every field but role from the tree">
                <i class="ph ph-function"></i></a>
            </div>
            <p class="text-sm text-base-content/50 mb-3">
              The role line is authored in the registry; every badge and count is
              measured from the tree.
            </p>
            <div x-show="toolsLoading" class="flex justify-center py-10">
              <span class="loading loading-dots loading-md opacity-30"></span>
            </div>
            <div x-show="toolsErr" class="text-base text-error font-mono" x-text="toolsErr"></div>
            <template x-if="toolsReg">
              <div class="flex flex-col gap-4">

                <!-- The invocation pills are a FILTER layer, not the structure:
                     the structure is the folder rail below, which is the tree
                     as it exists on disk. Same split as the Docs tab, where
                     reach filters and folders orient. Picking a pill
                     re-weights the rail counts, so "where do the drivers
                     live" is one tap. -->
                <div class="flex items-center gap-2 flex-wrap" data-slot="frame:count-chips">
                  <template x-for="r in harnessInvokeCounts" :key="r.key">
                    <button type="button" @click="toggleHarnessInvoke(r.key)" :title="r.gloss"
                            class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-colors"
                            :class="harnessInvoke === r.key ? 'border-primary bg-primary/10' : 'border-base-300 hover:bg-base-200'">
                      <span class="badge badge-sm" :class="r.tone" x-text="r.n"></span>
                      <span class="text-base" x-text="r.key"></span>
                    </button>
                  </template>
                  <button type="button" x-show="harnessInvoke" @click="harnessInvoke = ''"
                          class="text-sm text-base-content/50 hover:text-primary px-2 py-1">show all</button>
                  <div class="grow"></div>
                  <span class="text-sm text-base-content/40 tabular-nums"
                        x-text="toolTotals.files + ' files · ' + toolTotals.named + ' named · ' + toolTotals.tested + ' tested' + (toolTotals.blank ? ' · ' + toolTotals.blank + ' roles unstated' : '')"></span>
                </div>

                <div class="flex flex-col lg:flex-row gap-4">
                  <!-- The folder rail: the tree as it exists on disk, python/
                       and node/ as the two roots, counts rolled up to
                       ancestors. The amber number is the folder's unstated
                       roles, the registry's one warning figure. -->
                  <nav class="lg:w-80 shrink-0" aria-label="harness folders" data-slot="frame:rail-filter">
                    <div class="flex flex-col gap-0.5">
                      <template x-for="f in harnessFolders" :key="f.dir">
                        <div class="flex items-center gap-1" :style="'margin-left:' + f.depth + 'rem'">
                          <button type="button" @click="harnessDir = f.dir"
                                  class="flex items-center gap-2 px-2 py-1.5 rounded-lg flex-1 min-w-0 text-left transition-colors"
                                  :class="harnessDir === f.dir ? 'bg-primary/10 text-primary' : (f.n ? 'hover:bg-base-200' : 'opacity-40 hover:bg-base-200')">
                            <i class="ph shrink-0" :class="harnessDir === f.dir ? 'ph-folder-open' : 'ph-folder'"></i>
                            <span class="text-base font-medium truncate" x-text="f.name"></span>
                            <span class="ml-auto text-sm tabular-nums shrink-0"
                                  :class="harnessDir === f.dir ? 'text-primary/70' : 'text-base-content/40'"
                                  x-text="f.n"></span>
                            <span class="text-sm text-warning/70 tabular-nums shrink-0 w-6 text-right"
                                  :title="f.blank + ' file(s) at or below this folder with no authored role'"
                                  x-text="f.blank || ''"></span>
                          </button>
                          <a :href="folderGh(f.dir)" target="_blank" rel="noopener"
                             :title="'Open ' + f.dir + ' on GitHub'"
                             class="text-base-content/30 hover:text-primary shrink-0 px-1">
                            <i class="ph ph-github-logo"></i></a>
                        </div>
                      </template>
                    </div>
                  </nav>

                  <!-- The selected folder: its own direct files; subfolders
                       are one tap away in the rail. -->
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 flex-wrap mb-1">
                      <h3 class="text-sm font-semibold uppercase tracking-wide text-base-content/40" x-text="harnessDir + '/'"></h3>
                      <a :href="folderGh(harnessDir)" target="_blank" rel="noopener"
                         :title="'Open ' + harnessDir + ' on GitHub'"
                         class="text-base-content/30 hover:text-primary"><i class="ph ph-github-logo"></i></a>
                      <!-- Same door as the Docs tab's, over the same shape: a
                           folder rail, a selected folder, its direct files. -->
                      <button type="button" x-show="harnessDirFiles.length"
                              @click="openHarnessDeck(harnessDirFiles[0])"
                              class="btn btn-square btn-sm max-sm:h-11 max-sm:w-11 btn-ghost hover:text-primary"
                              :title="'Read ' + plural(harnessDirFiles.length, 'file') + ' one at a time'">
                        <i class="ph ph-cards-three text-lg max-sm:text-xl"></i></button>
                    </div>
                    <!-- Declared a List with named parts (data/ui-units/codebook.md,
                         "Declaring a pattern in markup"); nothing at runtime
                         reads the attributes. The invocation chips and the
                         folder rail are the frame's filters, not part of the
                         list. -->
                    <div class="grid grid-cols-1 xl:grid-cols-2 gap-x-8 gap-y-1"
                         data-pattern="list" data-part="list">
                      <template x-for="t in harnessDirFiles" :key="t.path">
                        <div class="flex items-start gap-2.5 px-2 py-1.5 rounded-lg hover:bg-base-200/60 group" data-part="item">
                          <i class="ph ph-terminal mt-1 text-base-content/40 shrink-0" data-part="meta"
                             data-title-tip-bare :data-title-tip="t.emits ? (t.layer === '.github/workflows' ? 'emits: its run pushes a commit' : 'emits: writes a file') : 'reads only'"></i>
                          <div class="min-w-0 flex-1">
                            <div class="flex items-center gap-2 flex-wrap">
                              <button type="button" class="text-base font-medium hover:text-primary text-left"
                                      :title="'Read ' + t.path + ' here'" data-part="title"
                                      @click="openHarnessDeck(t)" x-text="toolTitle(t)"></button>
                              <!-- Wraps rather than clips: a workflow with four
                                   triggers (activity-cache.yml) ran its badge
                                   off a phone's edge at a fixed badge height. -->
                              <span class="badge badge-sm badge-outline h-auto max-w-full whitespace-normal break-words"
                                    data-part="meta" :class="invokeTone(t.invocation)"
                                    x-text="t.invocation.replaceAll('+', '+\u200b')"></span>
                              <span x-show="!t.named && t.invocation !== 'driver'" data-part="meta"
                                    class="text-sm text-warning/70" data-title-tip="no prose names this file">unnamed</span>
                              <span x-show="t.tested" class="text-sm text-base-content/40" data-part="meta"
                                    data-title-tip="a file under node/test/ exercises it">tested</span>
                              <!-- A workflow whose run lands a commit, which is
                                   the fact the ci badge beside it cannot say:
                                   it names when the file runs, not what the run
                                   leaves behind. -->
                              <span x-show="t.emits && t.layer === '.github/workflows'" data-part="meta"
                                    class="text-sm text-base-content/60"
                                    data-title-tip="its run pushes a commit to this repository">commits</span>
                            </div>
                            <p class="text-base" data-part="summary" :class="t.role ? 'text-base-content/60' : 'text-warning/70'"
                               x-text="t.role || 'role unstated'"></p>
                            <!-- The hook is one file and nineteen steps, and
                                 which step keeps which file true is the
                                 question this row is opened for. Folded by
                                 default so the folder still reads as a list of
                                 files. The repair count says how much of the
                                 hook refresh-derived.yml runs on main. -->
                            <template x-if="t.path === HOOK_PATH && hookLegs">
                              <div class="mt-1" data-part="detail" data-hook-legs>
                                <button type="button" @click="hookOpen = !hookOpen"
                                        class="inline-flex items-center gap-1 text-sm text-base-content/60 hover:text-primary text-left"
                                        :aria-expanded="hookOpen">
                                  <i class="ph" :class="hookOpen ? 'ph-caret-down' : 'ph-caret-right'"></i>
                                  <span x-text="hookLegs.length + ' steps, in the order they run'"></span>
                                  <span class="text-base-content/40"
                                        x-text="'· ' + hookLegs.filter(l => l.in_repair === 'yes').length + ' run in the repair on main'"></span>
                                </button>
                                <ol x-show="hookOpen" class="mt-1.5 flex flex-col gap-2">
                                  <template x-for="l in hookLegs" :key="l.leg">
                                    <li class="text-sm">
                                      <div class="flex items-center gap-1.5 flex-wrap">
                                        <span class="w-5 shrink-0 text-right tabular-nums text-base-content/40" x-text="l.order"></span>
                                        <span class="font-medium"
                                              :data-title-tip="(l.watches.length ? 'runs when ' + l.watches.join(', ') + ' changes' : 'runs on every commit') + '; runs ' + l.runs.join(', ')"
                                              x-text="l.leg"></span>
                                        <span x-show="l.mode === 'warns'" class="badge badge-xs badge-ghost"
                                              data-title-tip="prints a warning and writes nothing">warns</span>
                                        <span x-show="l.in_repair === 'no'" class="badge badge-xs badge-warning badge-outline"
                                              data-title-tip="npm run artifacts:refresh skips this step, so the repair on main does not run it">not in repair</span>
                                      </div>
                                      <p class="pl-7 text-base-content/60" x-text="l.gloss"></p>
                                      <p x-show="l.stages.length" class="pl-7 font-mono text-xs text-base-content/50 break-words"
                                         x-text="'writes ' + l.stages.join(', ')"></p>
                                    </li>
                                  </template>
                                </ol>
                              </div>
                            </template>
                          </div>
                          <a x-blob="peek(t.path)" title="Open on GitHub" data-part="actions"
                             class="opacity-0 group-hover:opacity-100 focus:opacity-100 text-base-content/30 hover:text-primary transition-opacity shrink-0 mt-1">
                            <i class="ph ph-github-logo"></i></a>
                        </div>
                      </template>
                    </div>
                    <p x-show="!harnessDirFiles.length" class="text-sm text-base-content/40">
                      No direct files here under the current filter; the counts on the rail include subfolders.
                    </p>
                  </div>
                </div>

              </div>
            </template>
          </section>

          <!-- ── Kits ───────────────────────────────────────────────────────
               The kit shelf. Every column is derived, so the strip carries
               the warning states as counts rather than leaving them to the
               row tone alone. A demo opens in-app, as an app view. -->
          <section x-show="mapTab==='kits'">
            <div class="flex items-center gap-2 mb-1 flex-wrap">
              ${regChip('KITS_MANIFEST')}
              <a x-blob="peek(KITS_BUILDER)"
                 class="text-base-content/30 hover:text-primary"
                 title="node/build/kits-index.mjs stamps every field from the tree; nothing here is authored">
                <i class="ph ph-function"></i></a>
              <a x-blob="peek(KITS_README)"
                 class="text-base-content/30 hover:text-primary"
                 title="lib/kits/README.md: the shelf's admission rule and the shape a kit has to take">
                <i class="ph ph-book-open"></i></a>
            </div>
            <p class="text-sm text-base-content/50 mb-3">
              Each row is read off the kit's own file: its header sentence (the gloss), its
              namespace, and who loads it. A blank is a fact about the file.
            </p>
            <div x-show="kitsLoading" class="flex justify-center py-10">
              <span class="loading loading-dots loading-md opacity-30"></span>
            </div>
            <div x-show="kitsErr" class="text-base text-error font-mono" x-text="kitsErr"></div>
            <template x-if="kitsReg">
              <div class="flex flex-col gap-5">
                <div class="flex items-center gap-2 flex-wrap" data-slot="frame:count-chips">
                  <template x-for="r in kitFilterCounts" :key="r.key">
                    <button type="button" @click="toggleKitFilter(r.key)" :title="r.gloss"
                            class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-colors"
                            :class="kitFilter === r.key ? 'border-primary bg-primary/10' : 'border-base-300 hover:bg-base-200'">
                      <span class="badge badge-sm" :class="r.tone" x-text="r.n"></span>
                      <span class="text-base" x-text="r.label"></span>
                    </button>
                  </template>
                  <button type="button" x-show="kitFilter" @click="kitFilter = ''"
                          class="text-sm text-base-content/50 hover:text-primary px-2 py-1">show all</button>
                  <div class="grow"></div>
                  <span class="text-sm text-base-content/40 tabular-nums"
                        x-text="kitTotals.kits + ' kits · ' + kitTotals.demos + ' demos · ' + kitTotals.boot + ' boot · ' + kitTotals.lines.toLocaleString() + ' lines'"></span>
                  <button type="button" x-show="kitRows.length"
                          @click="openKitDeck(kitRows[0])"
                          class="btn btn-square btn-sm max-sm:h-11 max-sm:w-11 btn-ghost hover:text-primary"
                          :title="'Read ' + plural(kitRows.length, 'kit') + ' one at a time'">
                    <i class="ph ph-cards-three text-lg max-sm:text-xl"></i></button>
                </div>

                <!-- Declared a List with named parts (data/ui-units/codebook.md,
                     "Declaring a pattern in markup"); nothing at runtime reads the
                     attributes. The chip strip above is the frame's filter,
                     not part of the list. -->
                <div class="grid grid-cols-1 xl:grid-cols-2 gap-x-8 gap-y-1"
                     data-pattern="list" data-part="list">
                  <template x-for="k in kitRows" :key="k.path">
                    <div class="flex items-start gap-2.5 px-2 py-1.5 rounded-lg hover:bg-base-200/60 group" data-part="item">
                      <i class="ph mt-1 shrink-0" data-part="meta"
                         :class="k.boot ? 'ph-lightning text-info' : 'ph-toolbox text-base-content/40'"
                         data-title-tip-bare :data-title-tip="k.boot ? 'loaded on every chain-boot page' : 'loaded by the pages that ask for it'"></i>
                      <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2 flex-wrap">
                          <button type="button" class="text-base font-medium hover:text-primary text-left"
                                  :title="'Read ' + k.path + ' here'" data-part="title"
                                  @click="openKitDeck(k)" x-text="k.name"></button>
                          <code class="font-mono text-sm" data-part="meta" :class="k.namespace ? 'text-base-content/50' : 'text-warning/70'"
                                :data-title-tip="k.namespace ? 'window.' + k.namespace : 'no window.<name> assignment found: nothing can reach it by name'"
                                x-text="k.namespace ? 'window.' + k.namespace : 'no namespace'"></code>
                          <a x-show="k.demo" :href="kitDemoHref(k)" data-part="links"
                             class="badge badge-sm badge-success badge-outline gap-1 hover:badge-success"
                             :title="'Open ' + kitDemoPath(k) + ' as an app view'">
                            <i class="ph ph-play"></i>demo</a>
                          <span class="text-sm tabular-nums" data-part="meta" :class="k.users ? 'text-base-content/40' : 'text-warning/70'"
                                :data-title-tip="k.users ? k.users + ' file(s) under lib/, pages/ or app/ load it' : 'nothing under lib/, pages/ or app/ loads it'"
                                x-text="k.users ? k.users + (k.users === 1 ? ' load' : ' loads') : 'nothing loads it'"></span>
                          <span x-show="!k.tested" class="text-sm text-warning/70" data-part="meta" data-title-tip="no file under node/test/ names it">untested</span>
                          <span class="text-sm text-base-content/30 tabular-nums" data-part="meta" x-text="k.lines + ' lines'"></span>
                        </div>
                        <p class="text-base" data-part="summary" :class="k.gloss ? 'text-base-content/60' : 'text-warning/70'"
                           x-text="k.gloss || 'gloss unstated: the header comment does not open with a sentence'"></p>
                      </div>
                      <a x-blob="peek(k.path)" title="Open on GitHub" data-part="actions"
                         class="opacity-0 group-hover:opacity-100 focus:opacity-100 text-base-content/30 hover:text-primary transition-opacity shrink-0 mt-1">
                        <i class="ph ph-github-logo"></i></a>
                    </div>
                  </template>
                </div>
                <p x-show="!kitRows.length" class="text-sm text-base-content/40">No kit matches the current filter.</p>
              </div>
            </template>
          </section>

          <!-- ── UI / Dimensions: what the units are coded on ─────────────────
               The layer above the Gallery. Each dimension is a row of
               data/ui-units/dimensions.csv and its codes are codes.csv's rows
               whose axis names it, so a code renamed there is renamed here.
               By dimension, a block per dimension: what it holds, whether a
               unit takes one code or any number, and one row per code with
               its share of the units in scope, opening to its gloss and its
               units. As a table, the same values one row per unit; a sort by a
               dimension orders the rows as that dimension's codes run, and a
               rule marks where each code's units start. -->
          <section x-show="mapTab==='dimensions'">
            <div class="flex items-center gap-2 mb-4 flex-wrap">
              ${chip('UI_DIMS', 'measured')}${chip('UI_CODES', 'measured')}${chip('UI_CODED', 'measured')}
              <a x-blob="peek(UI_CODEBOOK)" class="text-base-content/30 hover:text-primary"
                 data-title-tip="data/ui-units/codebook.md: the fields a reader fills, and the calls behind the codes">
                <i class="ph ph-book-open"></i></a>
            </div>
            <div x-show="patLoading" class="flex justify-center py-10">
              <span class="loading loading-dots loading-md opacity-30"></span>
            </div>
            <div x-show="patErr" class="text-base text-error font-mono" x-text="patErr"></div>
            <template x-if="patReg">
              <div class="flex flex-col gap-6">
                <div class="flex items-center gap-2 flex-wrap">
                  <div class="flex items-center gap-2 flex-wrap" data-slot="frame:count-chips">
                    <template x-for="r in patScopes" :key="'dim-' + r.key">
                      <button type="button" @click="patScope = patScope === r.key ? '' : r.key"
                              :data-title-tip="r.gloss"
                              class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-colors"
                              :class="patScope === r.key ? 'border-primary bg-primary/10' : 'border-base-300 hover:bg-base-200'">
                        <span class="badge badge-sm" :class="r.tone" x-text="r.n"></span>
                        <span class="text-base" x-text="r.label"></span>
                      </button>
                    </template>
                  </div>
                  <div class="join">
                    <template x-for="v in [{ k: 'dims', n: 'By dimension', i: 'ph-rows' }, { k: 'table', n: 'Table', i: 'ph-table' }]" :key="v.k">
                      <button type="button" class="btn btn-sm join-item gap-1.5"
                              :class="dimView === v.k ? 'btn-neutral' : 'btn-ghost'"
                              :aria-pressed="dimView === v.k" @click="dimView = v.k">
                        <i class="ph text-base" :class="v.i"></i><span x-text="v.n"></span></button>
                    </template>
                  </div>
                  <div class="grow"></div>
                  <span class="text-sm text-base-content/40 tabular-nums" x-text="patLine"></span>
                </div>
                <p x-show="patNote" class="text-sm text-warning/80" x-text="patNote"></p>

                <!-- Declared a List (data/ui-units/codebook.md, "Declaring a
                     pattern in markup"): each dimension's header is an item
                     group and each code row an item, opening in place. -->
                <div x-show="dimView === 'dims'" class="grid gap-x-12 gap-y-10 @5xl:grid-cols-2 items-start"
                     data-pattern="list" data-part="list">
                  <template x-for="d in dimBlocks" :key="d.dimension">
                    <section class="flex flex-col gap-2 min-w-0">
                      <!-- Held at the top of the pane while the block's code
                           rows pass under it, in the Gallery header's row: the
                           name, a badge of its codes in use, and a caption
                           after a rule saying how many a unit takes. -->
                      <div class="sticky top-0 z-10 bg-base-100 py-1.5 border-b border-base-200 flex items-center gap-2.5 min-w-0 whitespace-nowrap"
                           data-part="group">
                        <span class="text-lg font-semibold shrink-0" x-text="d.name"></span>
                        <span class="badge badge-sm badge-ghost tabular-nums shrink-0" data-part="meta"
                              x-text="(d.used < d.defined ? d.used + ' of ' + d.defined : d.used) + ' codes'"></span>
                        <span class="min-w-0 flex-1 truncate border-l border-base-300 pl-2.5 text-sm text-base-content/60" data-part="meta"
                              x-text="d.per_unit === 'one' ? 'One code per unit' : 'Any number of codes per unit'"></span>
                        <button type="button" @click="dimToGallery(d.dimension)" data-part="links"
                                class="btn btn-sm btn-ghost gap-1.5 max-sm:h-11 -my-1 max-sm:-my-2.5 shrink-0 hover:text-primary"
                                :title="'Shots of the units, grouped by ' + d.name">
                          <i class="ph ph-squares-four text-base"></i>Gallery</button>
                      </div>
                      <p class="text-base text-base-content/70 text-pretty" data-part="summary">
                        <span x-text="d.holds.charAt(0).toUpperCase() + d.holds.slice(1) + '.'"></span>
                        <span class="text-base-content/50" x-text="'Test: ' + d.test + '.'"></span></p>
                      <ul class="flex flex-col mt-1">
                        <template x-for="g in d.groups" :key="d.dimension + '|' + g.code">
                          <li class="border-b border-base-200 last:border-b-0" data-part="item">
                            <button type="button" @click="dimToggle(d.dimension + '|' + g.code)"
                                    :aria-expanded="!!dimOpen[d.dimension + '|' + g.code]"
                                    class="w-full grid grid-cols-[minmax(0,1fr)_5rem_2rem] sm:grid-cols-[minmax(0,1fr)_9rem_2.5rem] items-center gap-3 py-1.5 max-sm:py-2.5 text-left rounded hover:bg-base-200/60"
                                    :class="!g.units.length && 'text-base-content/40'">
                              <span class="flex items-baseline gap-2 min-w-0">
                                <i class="ph ph-caret-right text-sm text-base-content/40 transition-transform self-center"
                                   :class="dimOpen[d.dimension + '|' + g.code] && 'rotate-90'"></i>
                                <span class="text-base truncate" :class="g.empty && 'italic text-base-content/50'" x-text="g.name" data-part="title"></span>
                              </span>
                              <!-- A progress at 0 draws as indeterminate, so an unused
                                   code gets an empty track of the same size. -->
                              <progress x-show="g.units.length" class="progress h-2" :class="g.empty ? 'progress-neutral opacity-40' : 'progress-primary'"
                                        :value="g.units.length" :max="patRows.length" data-part="meta"></progress>
                              <span x-show="!g.units.length" class="h-2 rounded-full bg-base-200"></span>
                              <span class="text-base tabular-nums text-right" x-text="g.units.length" data-part="meta"></span>
                            </button>
                            <div x-show="dimOpen[d.dimension + '|' + g.code]" class="pl-6 pb-3 pt-1 flex flex-col gap-2" data-part="body">
                              <p x-show="g.gloss" class="text-base text-base-content/70 text-pretty" x-text="g.gloss"></p>
                              <dl x-show="g.codeLabel || g.test || g.not_to_confuse || g.kits" class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-sm">
                                <template x-if="g.codeLabel"><dt class="text-base-content/40">Code</dt></template>
                                <template x-if="g.codeLabel"><dd class="font-mono text-base-content/60" x-text="g.codeLabel"></dd></template>
                                <template x-if="g.test"><dt class="text-base-content/40">Test</dt></template>
                                <template x-if="g.test"><dd class="text-base-content/60" x-text="g.test"></dd></template>
                                <template x-if="g.not_to_confuse"><dt class="text-base-content/40">Not</dt></template>
                                <template x-if="g.not_to_confuse"><dd class="text-base-content/60" x-text="g.not_to_confuse"></dd></template>
                                <template x-if="g.kits"><dt class="text-base-content/40">Kit</dt></template>
                                <template x-if="g.kits"><dd class="text-base-content/60"
                                    x-text="g.kits + (g.units.length ? ', called by ' + g.drawn + ' of these ' + g.units.length : '')"></dd></template>
                              </dl>
                              <div x-show="g.units.length" class="flex flex-wrap gap-1.5" data-part="links">
                                <template x-for="(u, i) in g.units" :key="d.dimension + '|' + g.code + '|' + u.unit">
                                  <button type="button" @click="openPatternDeck(g.units, i, d.name + ': ' + g.name)"
                                          class="inline-flex items-baseline gap-1.5 px-2 py-0.5 max-sm:py-1.5 rounded-md bg-base-200 hover:bg-primary/10 hover:text-primary text-sm text-left">
                                    <span class="font-mono text-xs text-base-content/40" x-text="u.app_ring"></span>
                                    <span x-text="u.label"></span></button>
                                </template>
                              </div>
                              <button type="button" x-show="g.units.length && !g.empty" @click="dimToGallery(d.dimension, g.code)" data-part="links"
                                      class="self-start inline-flex items-center gap-1.5 text-sm text-base-content/60 hover:text-primary">
                                <i class="ph ph-squares-four"></i><span x-text="'Their shots, in the Gallery'"></span></button>
                            </div>
                          </li>
                        </template>
                      </ul>
                    </section>
                  </template>
                </div>

                <div x-show="dimView === 'table'" class="overflow-x-auto rounded-lg border border-base-300">
                  <table class="table table-sm">
                    <thead>
                      <tr>
                        <th class="sticky left-0 z-10 bg-base-100">
                          <button type="button" @click="dimSort = 'unit'" class="inline-flex items-center gap-1 hover:text-primary"
                                  :class="dimSort === 'unit' && 'text-primary'">Unit
                            <i x-show="dimSort === 'unit'" class="ph ph-sort-ascending"></i></button></th>
                        <template x-for="d in patDims" :key="'th-' + d.dimension">
                          <th :class="dimSort === d.dimension && 'bg-base-200/60'">
                            <button type="button" @click="dimSort = d.dimension" class="inline-flex items-center gap-1 hover:text-primary"
                                    :class="dimSort === d.dimension && 'text-primary'"
                                    :title="'Order the units as the ' + d.name + ' codes run'">
                              <span x-text="d.name"></span>
                              <i x-show="dimSort === d.dimension" class="ph ph-sort-ascending"></i></button></th>
                        </template>
                      </tr>
                    </thead>
                    <template x-for="g in dimTable" :key="'tg-' + g.code">
                      <tbody>
                        <tr x-show="g.name" class="bg-base-200/70">
                          <td :colspan="patDims.length + 1" class="py-1.5">
                            <span class="sticky left-3 inline-flex items-baseline gap-2">
                              <span class="text-base font-semibold" :class="g.empty && 'italic font-normal'" x-text="g.name"></span>
                              <span class="text-sm tabular-nums text-base-content/50" x-text="g.units.length"></span></span></td>
                        </tr>
                        <template x-for="(r, i) in g.rows" :key="g.code + '|' + r.u.unit">
                          <tr class="cursor-pointer hover:bg-base-200/40"
                              @click="openPatternDeck(g.units, i, g.name || 'All units')">
                            <td class="sticky left-0 z-10 bg-base-100 align-top min-w-40 max-w-56">
                              <div class="text-base truncate" x-text="r.u.label"></div>
                              <div class="text-sm text-base-content/40 truncate" x-text="r.u.host || r.u.repo"></div></td>
                            <template x-for="(cell, j) in r.cells" :key="g.code + '|' + r.u.unit + '|' + j">
                              <td class="align-top text-sm min-w-28 max-w-56" :class="patDims[j]?.dimension === dimSort && 'bg-base-200/60'"
                                  x-text="cell"></td>
                            </template>
                          </tr>
                        </template>
                      </tbody>
                    </template>
                  </table>
                </div>
              </div>
            </template>
          </section>

          <!-- ── UI / Gallery: every coded unit's shots, grouped ────────────────
               A gallery, not a list: the UI units (data/ui-units/) coded
               against its codebook, one section per code of the dimension it
               is grouped by, each unit a card with its shot. Grouping is the
               only thing the dimension changes, so it is a control in the
               toolbar rather than a strip of tabs. A grid
               is for scanning and a deck for reading (kits/record-deck.js), so
               the page scrolls and a card opens that section's units as a deck,
               one unit a slide. The warning edge means one thing: the unit's
               own code does a job a shared kit already does (hand_evidence).
               budget-drs units and their shots live in home and
               web-tools-private, read under a token. -->
          <section x-show="mapTab==='patterns'" x-init="patTrack($el.closest('[data-pane]'))">
            <div class="flex items-center gap-2 mb-4 flex-wrap">
              ${chip('UI_CODES', 'measured')}${chip('UI_CODED', 'measured')}
              <a x-blob="peek(UI_CODEBOOK)" class="text-base-content/30 hover:text-primary"
                 data-title-tip="data/ui-units/codebook.md: the fields a reader fills, and the calls behind the codes">
                <i class="ph ph-book-open"></i></a>
              <a x-blob="peek(UI_UNITS_TOOL)" class="text-base-content/30 hover:text-primary"
                 data-title-tip="node/ui-units.mjs: lists the units from the apps' declarations and counts their kit calls">
                <i class="ph ph-function"></i></a>
            </div>
            <div x-show="patLoading" class="flex justify-center py-10">
              <span class="loading loading-dots loading-md opacity-30"></span>
            </div>
            <div x-show="patErr" class="text-base text-error font-mono" x-text="patErr"></div>
            <template x-if="patReg">
              <div class="flex flex-col gap-4">
                <div class="flex items-center gap-2 flex-wrap">
                  <label class="flex items-center gap-2">
                    <span class="text-sm text-base-content/50">Group by</span>
                    <select class="select select-sm w-auto" x-model="patAxis">
                      <template x-for="d in patDims" :key="'by-' + d.dimension">
                        <option :value="d.dimension" :selected="patAxis === d.dimension" x-text="d.name"></option>
                      </template>
                    </select>
                  </label>
                  <div class="flex items-center gap-2 flex-wrap" data-slot="frame:count-chips">
                    <template x-for="r in patScopes" :key="r.key">
                      <button type="button" @click="patScope = patScope === r.key ? '' : r.key"
                              :data-title-tip="r.gloss"
                              class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-colors"
                              :class="patScope === r.key ? 'border-primary bg-primary/10' : 'border-base-300 hover:bg-base-200'">
                        <span class="badge badge-sm" :class="r.tone" x-text="r.n"></span>
                        <span class="text-base" x-text="r.label"></span>
                      </button>
                    </template>
                  </div>
                  <div class="join">
                    <template x-for="k in [{ k: 'desk', n: 'Desktop 1280', i: 'ph-desktop' }, { k: 'phone', n: 'Phone 390', i: 'ph-device-mobile' }]" :key="k.k">
                      <button type="button" class="btn btn-sm join-item gap-1.5"
                              :class="patShot === k.k ? 'btn-neutral' : 'btn-ghost'"
                              :aria-pressed="patShot === k.k" @click="patShot = k.k">
                        <i class="ph text-base" :class="k.i"></i><span x-text="k.n"></span></button>
                    </template>
                  </div>
                  <div class="grow"></div>
                  <span class="text-sm text-base-content/40 tabular-nums" x-text="patLine"></span>
                </div>
                <p x-show="patNote" class="text-sm text-warning/80" x-text="patNote"></p>

                <!-- The contents: one jump per section that has units, the
                     codebook's contents-rail drawn as a wrapping row. -->
                <!-- What the shots outline: each frame slot solid and the body
                     dashed, in their dimension's colour (dimensions.csv), each
                     labelled on the shot with its code's name. -->
                <div class="flex items-center gap-4 text-sm text-base-content/60">
                  <template x-for="d in (patReg?.dims || []).filter(d => d.color)" :key="'key-' + d.dimension">
                    <span class="inline-flex items-center gap-1.5" :data-title-tip="d.holds">
                      <span class="w-5 h-3 rounded-sm" :style="{ border: '2px ' + (d.dimension === 'body' ? 'dashed ' : 'solid ') + d.color }"></span>
                      <span x-text="d.name"></span></span>
                  </template>
                </div>
                <nav class="flex flex-wrap gap-x-3 gap-y-1" data-slot="frame:contents-rail">
                  <template x-for="g in patSections" :key="'jump-' + g.code">
                    <button type="button" @click="patJump(g.code)"
                            class="text-base text-base-content/60 hover:text-primary">
                      <span x-text="g.name"></span>
                      <span class="text-sm tabular-nums text-base-content/40" x-text="g.units.length"></span></button>
                  </template>
                </nav>

                <!-- The current card, under the held section header: the card
                     the header's "n / m" counts, named with its kind, its app,
                     its address and, where the width allows, its codes on the
                     other dimensions, with its check seal and the hand-built
                     mark at the end. The anchor is sticky and zero-height, so
                     the strip overlays the cards rather than taking a row of
                     its own, and nothing below it moves when it appears; the
                     negative margin returns the gap the column puts after it.
                     It shows only while a section is held, and only where the
                     pane is narrower than @2xl, a phone or a pane beside a
                     docked deck: there the cards run one to a row, so one card
                     is the current one, where a wider grid has a row of them and each
                     card's footer says the same things. Section headers sit
                     above it (z-20), so an arriving header passes over it. -->
                <div data-pat-strip class="sticky z-10 h-0 -mb-4 @2xl:hidden" :style="{ top: patHeadH + 'px' }">
                  <template x-if="patCur">
                    <div data-pat-cardbar
                         class="absolute inset-x-0 top-0 flex items-center gap-2 min-w-0 whitespace-nowrap px-2.5 py-1 rounded-b-lg border border-t-0 border-base-300 bg-base-200/95 shadow-sm text-sm">
                      <i class="ph text-base text-base-content/50 shrink-0" :class="patKindIcon(patCur.u)"
                         :data-title-tip="patCur.u.kind + (patCur.u.app_ring !== '' ? ', ring ' + patCur.u.app_ring : '')"></i>
                      <button type="button" class="font-medium truncate max-w-[50%] shrink-0 hover:text-primary"
                              @click="openPatternDeck(patCur.g.units, patCur.i, patCur.g.name)"
                              x-text="patCur.u.label"></button>
                      <span class="badge badge-xs badge-ghost shrink-0 max-sm:hidden" x-text="patApp(patCur.u)"></span>
                      <code class="font-mono text-xs text-base-content/50 truncate min-w-0" x-text="patAddr(patCur.u)"></code>
                      <span class="text-xs text-base-content/40 truncate min-w-0 flex-1 max-md:hidden"
                            x-text="patOthers(patCur.u, patAxis)"></span>
                      <span class="ml-auto flex items-center gap-1.5 shrink-0">
                        <template x-if="patDeclared(patCur.u)">
                          <i class="ph text-base"
                             :class="{ holds: 'ph-seal-check text-success', fails: 'ph-seal-warning text-warning',
                                       unchecked: 'ph-seal-question text-base-content/40', declared: 'ph-seal text-info',
                                       contains: 'ph-seal text-base-content/40' }[patDeclared(patCur.u).state]"
                             :data-title-tip="patDeclared(patCur.u).tip"></i>
                        </template>
                        <i x-show="patCur.u.hand_evidence" class="ph ph-hand text-base text-warning"
                           data-title-tip="its own code does a job a shared kit already does"></i>
                        <a x-show="/^[?]/.test(patAddr(patCur.u))" :href="patAddr(patCur.u)"
                           class="text-base text-base-content/40 hover:text-primary" data-title-tip="Open this view">
                          <i class="ph ph-arrow-square-out"></i></a>
                      </span>
                    </div>
                  </template>
                </div>

                <!-- Declared a Card grid (data/ui-units/codebook.md, "Declaring
                     a pattern in markup"): each section's held header is an
                     item group, each card an item, its shot the item's body. -->
                <div class="flex flex-col gap-4" data-pattern="card-grid" data-part="list">
                <template x-for="g in patSections" :key="g.code">
                  <section :id="'pat-' + g.code" class="pt-4 flex flex-col gap-2">
                    <!-- The section's header row, one line at every width and
                         no taller than its name: the deck button's phone-sized
                         hit area overhangs the row (negative margin) rather
                         than setting its height. Held at the top of the Map
                         pane (the pane is the scroller) while the section's
                         cards pass under it, and the next section's header
                         takes its place as it arrives.

                         The badge is the section's size in flow and the
                         reader's place while held, "n / m", n being the first
                         card not under the header (patTrack); it darkens only
                         while held, the one state its colour marks. The gloss
                         is a caption after a rule, in sentence case, cut short
                         where the line runs out. The code, its test and the
                         whole gloss are the name's tip; Dimensions has the
                         rest. -->
                    <div data-pat-head data-part="group" class="sticky top-0 z-20 bg-base-100 py-1.5 border-b border-base-200 flex items-center gap-2.5 min-w-0 whitespace-nowrap">
                      <span class="text-lg font-semibold truncate max-w-[55%] shrink-0"
                            :data-title-tip="patTip(g)" x-text="g.name"></span>
                      <span class="badge badge-sm tabular-nums shrink-0" data-part="meta"
                            :class="patAt.code === g.code ? 'badge-neutral' : 'badge-ghost'"
                            x-text="patAt.code === g.code ? patAt.n + ' / ' + g.units.length : plural(g.units.length, 'unit')"></span>
                      <span x-show="g.gloss" class="min-w-0 flex-1 truncate border-l border-base-300 pl-2.5 text-sm text-base-content/60" data-part="summary"
                            x-text="String(g.gloss || '').charAt(0).toUpperCase() + String(g.gloss || '').slice(1)"></span>
                      <!-- The deck door wears exactly swipeDeck.entry.cls()
                           (deck-entry-parity.test.mjs holds it), so its place
                           in the strip rides on this wrapper. -->
                      <span class="ml-auto shrink-0 flex -my-1 max-sm:-my-2.5" data-part="actions">
                        <button type="button" x-show="g.units.length > 1"
                                @click="openPatternDeck(g.units, 0, g.name)"
                                class="btn btn-square btn-sm max-sm:h-11 max-sm:w-11 btn-ghost hover:text-primary"
                                :title="'Read ' + plural(g.units.length, 'unit') + ' one at a time'">
                          <i class="ph ph-cards-three text-lg max-sm:text-xl"></i></button></span>
                    </div>
                    <!-- What draws a Body or Reach code, the two dimensions whose
                         codes name kits, and what its declarations showed. The
                         kit is defined, in codes.csv's kits cell; the counts are
                         observed, from each unit's built_on and instances.csv. -->
                    <div x-show="patAxis === 'body' || patAxis === 'reach'"
                         class="flex items-center gap-x-5 gap-y-1 flex-wrap text-sm text-base-content/60">
                      <span class="inline-flex items-center gap-1.5"
                            :data-title-tip="g.kits ? 'codes.csv names the kits that draw this code; a unit counts when its built_on calls one of them' : 'codes.csv names no kit for this code, so each unit coded with it draws its own'">
                        <i class="ph ph-toolbox text-base"></i>
                        <span x-text="g.kits ? 'Drawn by ' + g.kits + ' in ' + g.drawn + ' of ' + g.units.length : 'No shared kit draws it'"></span></span>
                      <span x-show="g.declared" class="inline-flex items-center gap-1.5"
                            data-title-tip="units whose markup carries data-pattern with this code (instances.csv), and how many kept the code's promise when the page was driven headless">
                        <i class="ph ph-seal-check text-base"></i>
                        <span x-text="g.declared + ' declare it in markup, ' + g.holds + ' hold'"></span></span>
                    </div>
                    <!-- The Pages gallery's card, at the Pages gallery's size: a
                         frame holding the shot and, inside it, a tinted footer,
                         so the card's name reads as part of the card rather
                         than as text under it. The footer says what the
                         current-card strip says on a phone: the unit's kind,
                         name, check seal and hand-built mark, then its address
                         and app. The shot is cut from the top, a phone one to a
                         square and a desktop one to 16:10, each already
                         starting where the unit's own content does
                         (node/build/ui-shots.mjs, THE FOCUS); it keeps its
                         full width, so a short unit ends early rather than
                         being trimmed at both edges. -->
                    <!-- Columns follow the PANE, not the window (container
                         queries on the app's <main>): a deck docked beside the
                         Gallery pads <main>, and a pane narrowed to a phone's
                         width gets a phone's single column and its strip. -->
                    <div class="grid gap-4 mt-1"
                         :class="patShot === 'phone' ? 'grid-cols-1 @2xl:grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-4' : 'grid-cols-1 @2xl:grid-cols-2 @5xl:grid-cols-3'">
                      <template x-for="(u, i) in g.units" :key="g.code + '|' + u.unit">
                        <button type="button" data-pat-card data-part="item" :data-unit="u.unit" @click="openPatternDeck(g.units, i, g.name)"
                                class="group card bg-base-100 border shadow-sm overflow-hidden text-left min-w-0 transition-colors"
                                :class="[u.hand_evidence ? 'border-warning/70 hover:border-warning' : 'border-base-300 hover:border-primary/60',
                                         patDeckUnit === u.unit ? 'ring-2 ring-[var(--color-primary)] ring-offset-2 ring-offset-base-100' : '']">
                          <div class="relative w-full overflow-hidden bg-base-200/40 border-b border-base-300" data-part="body"
                               :class="patShot === 'phone' ? 'aspect-square' : 'aspect-[16/10]'">
                            <img x-show="patThumb(u, patShot)" :src="patThumb(u, patShot)" alt="" loading="lazy"
                                 class="block w-full h-auto">
                            <div x-show="!patThumb(u, patShot)" class="w-full h-full grid place-items-center text-base-content/25">
                              <i class="ph ph-image-broken text-3xl"></i></div>
                          </div>
                          <div class="px-3 py-2 bg-base-200/60 flex flex-col gap-0.5 min-w-0">
                            <div class="flex items-center gap-1.5 min-w-0">
                              <i class="ph text-base text-base-content/50 shrink-0" :class="patKindIcon(u)" data-part="meta"
                                 :data-title-tip="u.kind + (u.app_ring !== '' ? ', ring ' + u.app_ring : '')"></i>
                              <span class="font-semibold truncate group-hover:text-primary" data-part="title"
                                    :class="patAt.code === g.code && patAt.n === i + 1 && '@max-2xl:text-primary'" x-text="u.label"></span>
                              <span class="grow"></span>
                              <i x-show="u.hand_evidence" class="ph ph-hand text-base text-warning shrink-0"
                                 data-title-tip="its own code does a job a shared kit already does"></i>
                              <template x-if="patDeclared(u)">
                                <i class="ph text-base shrink-0"
                                   :class="{ holds: 'ph-seal-check text-success', fails: 'ph-seal-warning text-warning',
                                             unchecked: 'ph-seal-question text-base-content/40', declared: 'ph-seal text-info',
                                             contains: 'ph-seal text-base-content/40' }[patDeclared(u).state]"
                                   :data-title-tip="patDeclared(u).tip"></i>
                              </template>
                            </div>
                            <div class="flex items-center gap-2 min-w-0" data-part="meta">
                              <code class="font-mono text-xs text-base-content/50 truncate min-w-0" x-text="patAddr(u)"></code>
                              <span class="grow"></span>
                              <span class="badge badge-xs badge-ghost shrink-0" x-text="patApp(u)"></span>
                            </div>
                          </div>
                        </button>
                      </template>
                    </div>
                  </section>
                </template>
                </div>
                <p x-show="patEmptyCodes.length" class="text-sm text-base-content/40 pt-4 border-t border-base-200"
                   x-text="'No unit is coded ' + patEmptyCodes.join(', ') + '.'"></p>
                <p x-show="!patRows.length" class="text-sm text-base-content/40">No coded unit matches the current filter.</p>
              </div>
            </template>
          </section>

          <!-- ── Outposts: estate material held where no commit reaches ─────
               One card per row of docs/outposts.csv, its parts as a definition
               list. The account card adds the last observation a session wrote
               (web-tools-private environment/account-skills.csv), grouped so
               what needs a step in the app comes first. The live check is the
               session-start hook; this is only as current as its date. -->
          <section x-show="mapTab==='outposts'">
            <div class="flex items-center gap-2 mb-4 flex-wrap">
              ${regChip('OUTPOSTS_MANIFEST')}${regChip('ACCOUNT_SKILLS_MANIFEST')}
              <a x-blob="peek(OUTPOSTS_DOC)" class="text-base-content/30 hover:text-primary"
                 data-title-tip="docs/outposts.md: what an outpost is, and the four parts each is held by">
                <i class="ph ph-book-open"></i></a>
            </div>
            <div x-show="outpostsLoading" class="flex justify-center py-10">
              <span class="loading loading-dots loading-md opacity-30"></span>
            </div>
            <div x-show="outpostsErr" class="text-base text-error font-mono" x-text="outpostsErr"></div>
            <template x-if="outpostsReg">
              <!-- Declared a Card grid with named parts (data/ui-units/codebook.md,
                   "Declaring a pattern in markup"); nothing at runtime reads the
                   attributes. The account-skills observation is that card's
                   body, not a list of its own. -->
              <div class="grid grid-cols-1 xl:grid-cols-2 gap-4"
                   data-pattern="card-grid" data-part="list">
                <template x-for="o in outpostsReg.outposts" :key="o.id">
                  <div class="border border-base-300 rounded-lg p-4 bg-base-100 min-w-0" data-part="item"
                       :class="o.id === 'account-skills' ? 'xl:col-span-2' : ''">
                    <div class="flex items-baseline gap-2 flex-wrap">
                      <i class="ph text-lg self-center" data-part="meta"
                         :class="o.reports === 'outpost' ? 'ph-broadcast text-success' : 'ph-hand text-warning'"
                         data-title-tip-bare
                         :data-title-tip="o.reports === 'outpost' ? 'the outpost reports itself; nobody has to act' : 'the owner supplies each observation'"></i>
                      <span class="text-lg font-semibold" data-part="title" x-text="o.title"></span>
                      <span class="text-sm text-base-content/50" data-part="meta"
                            x-text="(o.reports === 'outpost' ? 'reports itself' : 'owner reports') + ' · ' + o.cadence"></span>
                      <span class="grow"></span>
                      <a x-blob="outpostPart(o.doc).addr" class="text-base-content/30 hover:text-primary" data-part="links"
                         :data-title-tip="'The document that owns this outpost: ' + outpostPart(o.doc).text">
                        <i class="ph ph-book-open"></i></a>
                    </div>
                    <p class="text-base text-base-content/60 mt-1 text-pretty" data-part="summary" x-text="o.gloss"></p>
                    <dl class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 mt-3 items-baseline" data-part="body">
                      <template x-for="p in outpostParts(o)" :key="p.k">
                        <div class="contents">
                          <dt class="text-sm text-base-content/50" x-text="p.label"></dt>
                          <dd class="text-base min-w-0 break-words">
                            <a x-show="p.addr" x-blob="p.addr" class="font-mono text-sm hover:text-primary" x-text="p.text"></a>
                            <a x-show="p.href" :href="p.href" target="_blank" rel="noopener"
                               class="font-mono text-sm hover:text-primary" x-text="p.text"></a>
                            <code x-show="!p.addr && !p.href && p.code" class="font-mono text-sm text-base-content/70" x-text="p.text"></code>
                            <span x-show="!p.addr && !p.href && !p.code" x-text="p.text"></span>
                          </dd>
                        </div>
                      </template>
                    </dl>
                    <template x-if="o.id === 'account-skills'">
                      <div class="mt-4 pt-3 border-t border-base-300" data-part="body">
                        <p x-show="!hasToken()" class="text-sm text-base-content/40">
                          Sign in to read the last recorded observation, which lives in the private registry.</p>
                        <p x-show="hasToken() && accountObsErr" class="text-sm text-base-content/40" x-text="accountObsErr"></p>
                        <template x-if="accountObs && accountObs.length">
                          <div class="flex flex-col gap-3">
                            <div class="text-sm text-base-content/50"
                                 x-text="'Observed ' + accountObservedOn + ' · ' + accountObs.length + ' skills on the account or declared'"></div>
                            <template x-for="g in accountGroups" :key="g.key">
                              <div>
                                <div class="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-base-content/50 mb-1">
                                  <i class="ph text-base" :class="g.key === 'attention' ? 'ph-warning-circle text-warning' : 'ph-check-circle text-success'"></i>
                                  <span x-text="g.label + ' · ' + g.rows.length"></span></div>
                                <div class="flex flex-col">
                                  <template x-for="r in g.rows" :key="r.name">
                                    <div class="flex items-baseline gap-x-3 gap-y-0.5 flex-wrap px-2 py-1 rounded-lg hover:bg-base-200/60">
                                      <span class="font-mono text-base sm:w-64 shrink-0" x-text="r.name"></span>
                                      <span class="text-base text-base-content/80" x-text="r.label"></span>
                                      <span class="text-sm text-base-content/40" x-text="[r.detail, r.source, r.note].filter(Boolean).join(' · ')"></span>
                                    </div>
                                  </template>
                                </div>
                              </div>
                            </template>
                          </div>
                        </template>
                      </div>
                    </template>
                  </div>
                </template>
              </div>
            </template>
          </section>

          <!-- ── Views: the app's own destinations, dated ────────────────
               Every address the app can be sent to, ranked by when the code
               behind it last moved, with whatever is open against it now.

               WHAT THIS TAB IS FOR. Every other tab in this strip reads a
               committed registry about the hub and renders it; this one reads
               docs/app-routes.csv, which is that same kind of file, and joins
               it to the hub's own history. It was Activity's fifth pill until
               2026-09-08, beside four cross-repo crawl caches keyed to who was
               working, and it answered a different question from all four: not
               who, but WHICH PART OF THE APP.

               THE JOIN IS FILES, AND FILES ARE COARSER THAN ROUTES. Nine
               routes render out of the estate component, so a commit there
               could date all nine; the shell holds the router and every pane's
               outer markup, so a commit there would date everything. The kit
               (lib/kits/route-activity.js) handles both by refusing the
               attribution rather than making it: the shell is excluded and gets
               its own row at the foot, and a file carrying three or more routes
               cannot be a row's REASON, only its fallback, in which case the
               row says "shared" beside the date. The exclusions are not a
               limitation the tab hides; they are what it has to show, because a
               route with no narrow file is a route with no code of its own,
               and that count is the header's second figure. -->
          <section x-show="mapTab==='views'" x-effect="mapTab === 'views' && authedHub && loadAppViews()">
            <p x-show="!authedHub" class="text-base text-base-content/60">
              Routes are read from the hub's own history. Add a token on Repos to see them.
            </p>

            <div x-show="authedHub && viewsBusy && !viewRows.length"
                 class="text-base text-base-content/50 italic py-6">Dating the routes…</div>

            <!-- Same shape as the Chats failure state, and for the same
                 reason: the loader will not retry itself, so the retry has to
                 be a gesture. -->
            <div x-show="authedHub && viewsError"
                 class="rounded-xl border border-warning/40 bg-warning/10 p-4 mb-4">
              <div class="flex items-start gap-2">
                <i class="ph ph-warning-circle text-lg text-warning shrink-0 mt-0.5"></i>
                <div class="min-w-0">
                  <p class="text-base">Could not read the routes.</p>
                  <p class="text-sm text-base-content/60 font-mono mt-1 break-words" x-text="viewsError"></p>
                </div>
              </div>
              <button @click="loadAppViews(true)" :disabled="viewsBusy"
                      class="btn btn-ghost btn-sm gap-1.5 text-base mt-2">
                <i class="ph" :class="viewsBusy ? 'ph-circle-notch animate-spin' : 'ph-arrow-clockwise'"></i>
                <span x-text="viewsBusy ? 'Reading…' : 'Retry'"></span>
              </button>
            </div>

            <!-- The census, in one line. Three figures, and the second is the
                 one worth the pane: how many destinations have no code that is
                 theirs alone. It is a reading of the app's shape, not a to-do,
                 which is why it states the number and stops. -->
            <div x-show="authedHub && viewRows.length"
                 class="flex items-center flex-wrap gap-x-3 gap-y-1 mb-3 text-base">
              <i class="ph ph-signpost text-lg text-base-content/50"></i>
              <span><span class="font-mono font-semibold" x-text="viewRows.length"></span> routes</span>
              <span class="text-base-content/50"
                    x-text="'· ' + viewsWithoutCode + ' with no file of their own'"></span>
              <span x-show="viewsInFlight" class="text-primary"
                    x-text="'· ' + viewsInFlight + ' with work open'"></span>
              <span x-show="viewsFlattened" class="text-base-content/50"
                    data-title-tip="A sub-tab addressed as its own ?view= key. Each was a nav stop once and kept its key so saved links resolve, which is why it sits under another destination here."
                    x-text="'· ' + viewsFlattened + ' sub-tabs with a view key'"></span>
              <!-- The ref, whenever it is not the default. Every figure and
                   date on this pane is read from one tree, so a preview that
                   did not say which tree would be reporting the branch's
                   routes against nothing in particular. -->
              <span x-show="viewsRef !== 'main'"
                    class="badge badge-sm badge-ghost font-mono gap-1"
                    :data-title-tip="'read at ' + viewsRef">
                <i class="ph ph-git-branch"></i><span x-text="viewsRef"></span></span>
              <span class="ml-auto font-mono text-sm text-base-content/40"
                    x-show="viewsLoadedAt" x-text="agoShort(viewsLoadedAt)"></span>
            </div>

            <!-- RANKED, THEN FOLDED INTO NAV STOPS. Two earlier shapes were
                 both wrong and in opposite directions. A section per manifest
                 group cost the pane its headline: an hour-old route sat below
                 a six-day-old one because they were in different sections. A
                 flat list fixed that and introduced its own confusion, listing
                 six FOSSIL keys at the same rank as live destinations, since
                 the router addresses Sessions, Chats, Routes, Jot and Saved
                 as their own ?view= key even though each is a sub-tab of
                 something else. (They were all nav stops once; each kept its
                 key when its pane moved under another, so saved links resolve.)
                 Grouping by the declared stop puts that level back, and taking the order
                 from the ranking rather than recomputing it is what keeps
                 freshest-first true at both levels: see the kit. A stop that
                 owns one route is not a grouping and renders as a plain row. -->
            <!-- A PER-ROW BORDER KEYED ON THE LOOP INDEX, not divide-y plus a
                 divide colour. daisyUI ships no divide-* family, so
                 divide-base-300 compiles to nothing and is dropped silently,
                 and Tailwind v4 then defaults border-color to currentColor:
                 divide-y alone paints the hairlines in the TEXT colour. The
                 html-style skill states it at Key Conventions 7, and 8 says
                 to take the position from the loop rather than from an
                 adjacency selector inside an x-for. Held by
                 node/test/dead-family.test.mjs. -->
            <!-- Declared a List with named parts (data/ui-units/codebook.md,
                 "Declaring a pattern in markup"); nothing at runtime reads the
                 attributes. A nav stop's line is a group; the caret's
                 expansion is the item's body. -->
            <div x-show="authedHub && viewRows.length"
                 class="flex flex-col border-y border-base-300/50 mb-4"
                 data-pattern="list" data-part="list">
              <template x-for="(s, i) in viewStops" :key="s.stop">
                <div class="py-2" :class="i ? 'border-t border-base-300/50' : ''">
                  <!-- The stop's own line, only where it owns more than one
                       route. It carries no date of its own: the freshest row is
                       directly below it and would be saying the same thing
                       twice, which is the noise a heading is supposed to save. -->
                  <div x-show="!s.solo" class="flex items-baseline gap-2 mb-1.5" data-part="group">
                    <span class="text-base font-semibold" x-text="s.stop"></span>
                    <span class="font-mono text-sm text-base-content/30" data-part="meta"
                          :data-title-tip="s.rows.length + ' views under one nav stop'"
                          x-text="s.rows.length"></span>
                    <!-- nowrap: inside a badge a two-word label breaks across
                         two lines and the pill's own border reads as a strike
                         through the text. Measured at 390 px. -->
                    <span x-show="s.open" data-part="meta"
                          class="badge badge-sm badge-primary badge-outline font-mono shrink-0 whitespace-nowrap"
                          x-text="s.open + ' open'"></span>
                  </div>
                  <div :class="s.solo ? '' : 'pl-3 border-l-2 border-base-300/60 flex flex-col gap-2.5'">
                  <template x-for="r in s.rows" :key="r.key">
                    <div :class="s.solo ? '' : 'min-w-0'" data-part="item">
                      <!-- The row proper. The label opens the route where the
                           address can be honoured, and is plain text where it
                           cannot: an address carrying a placeholder has no
                           single destination, so offering a tap would be
                           offering a guess. -->
                      <div class="flex items-baseline gap-2 flex-wrap">
                        <button x-show="viewIsOpenable(r)" @click="openAppView(r)"
                                class="text-base font-medium hover:underline shrink-0" data-part="title"
                                :class="viewIsShell(r) ? 'text-base-content/60' : 'text-primary'"
                                x-text="r.label"></button>
                        <span x-show="!viewIsOpenable(r)" class="text-base font-medium shrink-0" data-part="title"
                              :class="viewIsShell(r) ? 'text-base-content/50' : ''"
                              x-text="r.label"></span>
                        <!-- The placeholders are trimmed off; the ellipsis says
                             so and the tooltip carries the full shape. -->
                        <code class="text-sm text-base-content/40 font-mono" data-part="meta" data-title-tip-bare :data-title-tip="r.address">
                          <span x-text="viewShortAddress(r)"></span><span
                            x-show="viewAddressTruncated(r)" class="opacity-50">…</span></code>
                        <!-- The stop line already names the group for a folded
                             stop, so the row only says it when it stands alone. -->
                        <span x-show="s.solo" class="text-sm text-base-content/30" data-part="meta"
                              x-text="viewGroupLabel(r.group)"></span>
                        <span x-show="r.branches.length" data-part="meta"
                              class="badge badge-sm badge-primary badge-outline font-mono shrink-0 whitespace-nowrap"
                              x-text="r.branches.length + ' open'"></span>
                        <!-- A PR whose only hit is a file several routes share
                             is NEAR this route, not on it. Shown, because it
                             may well be the work; ghosted and uncounted,
                             because nothing here can tell. -->
                        <span x-show="r.nearBranches.length" data-part="meta"
                              class="badge badge-sm badge-ghost font-mono shrink-0 whitespace-nowrap"
                              data-title-tip-bare :data-title-tip="'touches a file this route shares, so it may or may not be this route'"
                              x-text="r.nearBranches.length + ' near'"></span>
                        <div class="grow"></div>
                        <!-- The date, and the caveat attached to it rather
                             than filed somewhere else. "shared" means the row
                             is standing on a file several routes carry, so the
                             date is the truest available and not a claim about
                             this route in particular. -->
                        <template x-if="r.lastTouch">
                          <a :href="r.lastTouch.url" target="_blank" rel="noopener" data-part="meta"
                             class="font-mono text-sm tabular-nums shrink-0 hover:text-primary"
                             :class="r.borrowed ? 'text-base-content/30' : 'text-base-content/60'"
                             :title="r.lastTouch.subject + ' · ' + r.lastTouch.shortSha">
                            <span x-text="agoShort(r.lastTouch.date)"></span>
                            <span x-show="r.borrowed" class="italic ml-1">shared</span>
                          </a>
                        </template>
                        <span x-show="!r.lastTouch" class="font-mono text-sm text-base-content/30 shrink-0" data-part="meta"
                              x-text="r.hasOwnCode ? 'unread' : 'no code'"></span>
                      </div>
                      <div class="flex items-baseline gap-2 mt-0.5">
                        <p class="text-sm text-base-content/50 min-w-0" data-part="summary" x-text="r.what"></p>
                        <button @click="toggleViewRow(r.key)" data-part="actions"
                                class="ml-auto shrink-0 text-sm text-base-content/40 hover:text-primary">
                          <i class="ph" :class="viewOpenRow === r.key ? 'ph-caret-up' : 'ph-caret-down'"></i>
                        </button>
                      </div>

                      <!-- Expanded: what the row is standing on. Every declared
                           file with its own date and how many routes it
                           carries, then the open PRs that touch it and which
                           file each one hit. This is where the coarseness
                           becomes legible instead of merely disclosed. -->
                      <template x-if="viewOpenRow === r.key">
                        <div class="mt-2 pl-3 border-l-2 border-base-300 flex flex-col gap-1.5" data-part="body">
                          <!-- The full address, where the row trimmed it. Here
                               rather than on the row because it is a shape to
                               read once, not a label to scan. -->
                          <code x-show="viewAddressTruncated(r)"
                                class="text-sm font-mono text-base-content/50 break-all"
                                x-text="r.address"></code>
                          <p x-show="r.note" class="text-sm text-base-content/50 italic" x-text="r.note"></p>
                          <p x-show="!r.files.length && !r.note" class="text-sm text-base-content/50 italic">
                            No file of its own.
                          </p>
                          <template x-for="f in r.files" :key="f.path">
                            <div class="flex items-baseline gap-2 text-sm">
                              <code class="font-mono text-base-content/70 truncate min-w-0" x-text="f.path"></code>
                              <span x-show="f.shared"
                                    class="shrink-0 text-base-content/30 font-mono"
                                    :data-title-tip="'carries ' + f.routes + ' routes'"
                                    x-text="'×' + f.routes"></span>
                              <div class="grow"></div>
                              <span class="font-mono tabular-nums text-base-content/40 shrink-0"
                                    x-text="f.touch ? agoShort(f.touch.date) : '—'"></span>
                            </div>
                          </template>
                          <template x-if="r.tabs">
                            <div class="flex items-center gap-1 flex-wrap pt-1">
                              <span class="text-sm text-base-content/40">tabs:</span>
                              <template x-for="t in r.tabs" :key="t">
                                <code class="text-sm font-mono text-base-content/50 bg-base-200/60 rounded px-1.5"
                                      x-text="t"></code>
                              </template>
                            </div>
                          </template>
                          <template x-for="b in r.branches.concat(r.nearBranches)" :key="b.pr">
                            <div class="flex items-baseline gap-2 text-sm pt-1">
                              <i class="ph ph-git-pull-request text-base shrink-0"
                                 :class="r.branches.includes(b) ? 'text-primary' : 'text-base-content/30'"></i>
                              <a :href="b.url" target="_blank" rel="noopener"
                                 class="hover:underline truncate min-w-0"
                                 :class="r.branches.includes(b) ? 'text-primary' : 'text-base-content/40'"
                                 x-text="'#' + b.pr + ' ' + b.title"></a>
                              <span x-show="!r.branches.includes(b)"
                                    class="shrink-0 italic text-base-content/30">near</span>
                              <span class="shrink-0 font-mono text-base-content/30"
                                    :data-title-tip="b.hits.join(', ')"
                                    x-text="b.hits.length + (b.hits.length === 1 ? ' file' : ' files')"></span>
                            </div>
                          </template>
                        </div>
                      </template>
                    </div>
                  </template>
                  </div>
                </div>
              </template>
            </div>

            <!-- The shell, on its own row, because it is every route's file
                 and therefore no route's signal. Excluding it silently would
                 leave a reader wondering why the busiest file in the app never
                 dates anything. -->
            <template x-if="authedHub && viewShellRow">
              <div class="rounded-xl border border-base-300 bg-base-200/30 p-3 text-sm">
                <div class="flex items-baseline gap-2 flex-wrap">
                  <i class="ph ph-browsers text-base text-base-content/50"></i>
                  <span class="font-medium text-base">Shell</span>
                  <code class="font-mono text-base-content/60" x-text="viewShellRow.path"></code>
                  <span class="text-base-content/40 font-mono"
                        x-text="'×' + viewShellRow.routes"></span>
                  <div class="grow"></div>
                  <template x-if="viewShellRow.touch">
                    <a :href="viewShellRow.touch.url" target="_blank" rel="noopener"
                       class="font-mono tabular-nums text-base-content/50 hover:text-primary"
                       :title="viewShellRow.touch.subject"
                       x-text="agoShort(viewShellRow.touch.date)"></a>
                  </template>
                </div>
                <p class="text-base-content/50 mt-1" x-text="viewShellRow.note"></p>
              </div>
            </template>
          </section>

        </div>
      `,

      AIMS_MANIFEST,
      THEMES_GRAPH,
      OVERLAP_DOCS,
      OVERLAP_MATCHES,
      SET_MANIFEST,
      ROUTES_MANIFEST,
      ROUTES_MODES,
      ROUTES_ROUTES,
      SHOWING_MECHANISMS,
      ROUTES_PASTE,
      DOCS_MANIFEST,
      POLICIES_MANIFEST,
      POLICY_TOPICS_MANIFEST,
      GROWTH_PAYLOAD,
      OWNERS_MANIFEST,
      OWNERS_REPS,
      PROPS_MANIFEST,
      PROPS_DECLS,
      TAB_LEDES,
      PROPS_VOCAB,
      TEXT_FIELDS,
      SKILLS_MANIFEST,
      PROPS_DOC,
      SPAN_DOC,
      SHOWING_FRAME,
      SURF_MANIFEST,
      SURF_DOC,
      SURF_SIBLINGS,
      REACH_BUILDER,
      TESTS_MANIFEST,
      TESTS_BUILDER,
      AGENTS_MANIFEST,
      PEEVES_LIST,
      TOOLS_MANIFEST,
      TOOLS_BUILDER,
      HOOK_LEGS,
      HOOK_PATH,
      KITS_MANIFEST,
      OUTPOSTS_MANIFEST, ACCOUNT_SKILLS_MANIFEST, OUTPOSTS_DOC, UPSTREAM_SKILLS,
      CTX_MANIFEST, CTX_TOPICS,
      KITS_BUILDER,
      KITS_README,
      KITS_DEMOS,
      UI_CODES, UI_CODED, UI_CODEBOOK, UI_UNITS_TOOL, UI_DIMS,
      authed: false,
      // The open tab, rendered from here and OWNED by the shell (its `mapTab`,
      // stamped as ?tab=). This copy is seeded from the shell at mount so a deep
      // link opens on the tab it names, and re-seeded by the watch in init() so
      // back and forward walk the tabs.
      mapTab: (window.__shell?.mapTab || 'reach'),
      manifest: null,
      harnessRoles: {},
      agentRoles: {},
      setLoading: false,
      setErr: '',
      setQ: '',
      // The route a Reach edge opened Distribution on; '' shows every route.
      setUse: '',
      reachRepos: null, reachLoading: false, reachErr: '',
      reachPaths: [], reachHot: '',
      reachTip: null, reachTipClose: '', _reachTipT: null, _reachTipWired: false,
      routes: null,
      routesLoading: false,
      routesErr: '',
      propsReg: null,
      propsLoading: false,
      propsErr: '',
      docsReg: null,
      docsLoading: false,
      docPending: null,     // docs path -> { calls, staged }: edits waiting on it (loadDocPending)
      docPendingOnly: false,
      docQ: '',
      docSearchDir: '',
      docGrowth: null,   // path -> {w, delta, from}; null while absent or unread
      growthSeen: false,  // the Growth subview has been opened at least once
      ctxReg: null,        // { rows, topics } from the public half
      ctxPrivate: null,    // private rows, or [] when the token read failed
      ctxPrivateErr: '',
      ctxLoading: false,
      ctxErr: '',
      ctxLens: (new URLSearchParams(location.search).get('ctxlens') === 'spectra' ? 'delivery' : (new URLSearchParams(location.search).get('ctxlens') || 'delivery')),  // delivery | circles | when | overlaps | measured
      ctxCircle: '',
      ctxSpectraEnv: 'all',
      ctxSpectraFilterDiscretion: '',
      ctxSpectraSelected: 'invoke-default',
      ctxTopic: '',
      docsErr: '',
      ownersReg: null,
      ownersLoading: false,
      // The Themes half: a derived graph beside the curated registry, on one
      // tab because they answer the same question from opposite ends. The
      // registry knows why a repetition exists; the graph knows every
      // repetition. Neither is complete without the other and only one of
      // them can be.
      themeGraph: null,
      themesLoading: false,
      themesErr: '',
      lens: 'clusters',
      // The top-level tabs as data, and the strip is generated from them.
      // A tab's key is its first subview's, so a tab lands on that reading.
      // Each address opens with ONE SENTENCE saying what its rows ARE, never
      // what the reader can do. The sentences live in docs/map-tabs.csv, one
      // row per address, fetched once at mount; map-tabs.test.mjs holds the
      // row set to these keys in both directions and the sentences to the
      // lede's shape, so a tab still cannot ship without one.
      TABS: [
        { k: 'harness', n: 'Harness', i: 'ph-wrench' },
        { k: 'dimensions', n: 'Browser', i: 'ph-browser' },
        { k: 'docs', n: 'Docs', i: 'ph-books' },
        { k: 'reach', n: 'Reach', i: 'ph-globe-hemisphere-west' },
      ],
      SUBVIEWS: {
        // Harness: the scaffolding around the model, as
        // docs/environment/harness-comparison.md defines it.
        harness: [
          { k: 'harness', n: 'Automation', i: 'ph-wrench' },
          { k: 'tests', n: 'Tests', i: 'ph-flask' },
          { k: 'skills', n: 'Skills', i: 'ph-sparkle' },
          { k: 'agents', n: 'Agents', i: 'ph-robot' },
          { k: 'peeves', n: 'Peeves', i: 'ph-cat' },
          { k: 'context', n: 'Context', i: 'ph-circles-three' },
          { k: 'surfacing', n: 'Surfacing', i: 'ph-megaphone' },
        ],
        // Browser: what the apps put on screen and the code that draws it.
        dimensions: [
          { k: 'dimensions', n: 'Dimensions', i: 'ph-sliders-horizontal' },
          { k: 'patterns', n: 'Gallery', i: 'ph-squares-four' },
          { k: 'views', n: 'Views', i: 'ph-signpost' },
          { k: 'kits', n: 'Kits', i: 'ph-toolbox' },
          { k: 'showing', n: 'Showing', i: 'ph-paper-plane-tilt' },
        ],
        docs: [
          { k: 'docs', n: 'Inventory', i: 'ph-list-bullets' },
          { k: 'aims', n: 'Purpose', i: 'ph-target' },
          { k: 'growth', n: 'Growth', i: 'ph-chart-scatter' },
          { k: 'policy', n: 'Policy', i: 'ph-tree-structure' },
          { k: 'claims', n: 'Themes', i: 'ph-graph' },
          { k: 'registries', n: 'Registries', i: 'ph-stack' },
        ],
        // Reach: what the hub carries beyond itself. It lands on the routes
        // diagram; Distribution keeps ?tab=set, the long-lived address.
        reach: [
          { k: 'reach', n: 'Routes', i: 'ph-graph' },
          { k: 'set', n: 'Distribution', i: 'ph-package' },
          { k: 'outposts', n: 'Outposts', i: 'ph-flag-pennant' },
          { k: 'data', n: 'Data', i: 'ph-table' },
        ],
      },
      SUBVIEW_PARENT: {
        tests: 'harness', skills: 'harness', agents: 'harness', peeves: 'harness', context: 'harness', surfacing: 'harness',
        patterns: 'dimensions', views: 'dimensions', kits: 'dimensions', showing: 'dimensions',
        aims: 'docs', growth: 'docs', policy: 'docs', claims: 'docs', registries: 'docs',
        set: 'reach', outposts: 'reach', data: 'reach',
      },
      get displayTab(){ return this.SUBVIEW_PARENT[this.mapTab] || this.mapTab; },
      get subviews(){ return this.SUBVIEWS[this.displayTab] || []; },
      // One row per address, so no fallback: the Automation subview IS the
      // harness address and its row carries the Harness sentence.
      tabLedes: null,
      refInfo: {},
      get tabGloss(){ return this.tabLedes?.[this.mapTab]?.gloss || ''; },
      // The lede as runs of text, each phrase its row's `refs` names carrying the
      // path it points at. The sentence stays plain prose in the CSV; the links
      // are data beside it, so the lede's own tests read an unmarked sentence.
      get ledeParts(){
        const row = this.tabLedes?.[this.mapTab];
        if (!row) return [];
        const g = row.gloss || '';
        const refs = window.Csv.list(row.refs || '')
          .map(p => { const i = p.indexOf('='); return { ph: p.slice(0, i), to: p.slice(i + 1) }; })
          .map(r => ({ ...r, at: g.indexOf(r.ph) })).filter(r => r.at >= 0)
          .sort((a, b) => a.at - b.at);
        const parts = [];
        let pos = 0;
        for (const r of refs) {
          if (r.at < pos) continue;
          if (r.at > pos) parts.push({ t: g.slice(pos, r.at) });
          parts.push({ t: r.ph, to: r.to });
          pos = r.at + r.ph.length;
        }
        if (pos < g.length) parts.push({ t: g.slice(pos) });
        return parts;
      },
      // What a linked phrase points at, said by the file's own owner rather than
      // by the lede: a registry's gloss from docs/registries.csv, else a doc's
      // subject from docs/docs.csv. A folder or an unlisted file shows its path.
      refTip(to){ return this.refInfo[to] || ''; },
      async openRef(to){
        const shell = window.__shell;
        if (!shell) return;
        await shell.ensureBrowser(this.hub(), useRef());
        if (to.endsWith('/')) shell.openFolder(to.slice(0, -1)); else shell.openFile(to);
      },
      async loadTabLedes(){
        const gh = new window.GH({ token: window.TOKEN, repo: this.hub(), ref: useRef() });
        try {
          const rows = window.Csv.rows((await gh.get(TAB_LEDES)).text);
          this.tabLedes = Object.fromEntries(rows.map(r => [r.tab, r]));
        } catch (e) { this.tabLedes = {}; }
        // The tips are a nicety over working links, so a failed read leaves the
        // links with their paths as tips rather than holding the lede back.
        try {
          const [reg, docs] = await Promise.all([PROPS_MANIFEST, DOCS_MANIFEST]
            .map(f => gh.get(f).then(r => window.Csv.rows(r.text))));
          const info = {};
          for (const d of docs) if (d.subject) info[d.path] = d.subject;
          for (const r of reg) if (r.gloss) info[r.path] = r.gloss;
          this.refInfo = info;
        } catch (e) { /* paths stand in */ }
      },
      // The lede's source, opened at its own row: the Files view with the whole
      // table drawn and this address's row scrolled into view and marked, so the
      // sentence is read among the others.
      async openLedeRow(){
        const shell = window.__shell;
        if (!shell) return;
        await shell.ensureBrowser(this.hub(), useRef());
        shell.openFile(TAB_LEDES, { col: 'tab', row: this.mapTab });
      },
      THEME_LENSES: [
        { k: 'clusters', n: 'Clusters', i: 'ph-graph' },
        { k: 'arcs',     n: 'Arcs',     i: 'ph-flow-arrow' },
        { k: 'atoms',    n: 'Atoms',    i: 'ph-quotes' },
        { k: 'matrix',   n: 'Matrix',   i: 'ph-grid-nine' },
        { k: 'owners',   n: 'Owners',   i: 'ph-key' },
        { k: 'related', n: 'Related', i: 'ph-swap' },
      ],
      // The threshold is state, not a constant, because which clusters exist
      // is a function of it: at 3 the graph is one blob of 32 files, at 30 it
      // is isolated pairs. Twelve is where it reads.
      themeTh: 12,
      // The concern the accent marks. One accent, one meaning at a time, and
      // which meaning is the segment the reader picked: the alternative was a
      // second colour, which would have made the encoding unreadable the moment
      // a pair carried both. 'review' is the default because it is the one a
      // reader can act on.
      themeConcern: 'review',
      themePick: null,
      ownersErr: '',
      surf: null,
      surfLoading: false,
      surfErr: '',
      aims: null,
      aimsLoading: false,
      aimsErr: '',
      policies: null,
      policyTopics: null,
      policiesLoading: false,
      policiesErr: '',
      policyTopic: 'all',
      policyIntent: 'all',
      policyLevel: 'all',
      policyQ: '',
      policyTopicsOpen: false,

      init(){
        this.$el.innerHTML = this.template;
        this.$nextTick(() => { if (this.$el.isConnected) Alpine.initTree(this.$el); });
        // The title-tip kit. Every legend in these eleven tabs and their subviews is a title-tip now, and
        // there are 39 of them: what a status word means, what a reach code
        // covers, what a count counted. Each was a title, which is to say each
        // was visible to a mouse and to nothing else, on tabs whose whole job is
        // to make the coordination layer inspectable. Fire and forget: the kit
        // is delegated and watches for elements written later, so arriving after
        // a tab has drawn costs nothing.
        if (!window.TitleTip && window.gh?.load) window.gh.load('kits/title-tip.js');
        this.load();
        this.loadTabLedes();
        // A deep-linked tab has to fetch its own manifest: load() covers the
        // set, and non-default sections were fetched by the click handler that
        // no longer runs when the URL picked the tab instead.
        this.loadTab(this.mapTab);
        this.$watch(() => window.__shell && window.__shell._authState, (s) => {
          if (s === 'auth') this.load();
          this.refreshDataCensus();
        });
        this._dataRefresh = () => this.refreshDataCensus();
        document.addEventListener('web-tools:configs-refreshed', this._dataRefresh);
        // Back and forward: the shell rewrites its mapTab from the URL, and the
        // render follows. One-way, since setTab already pushed the other way.
        this.$watch(() => window.__shell?.mapTab, (t) => {
          if (t && t !== this.mapTab) { this.mapTab = t; this.loadTab(t); }
        });
      },

      destroy(){
        document.removeEventListener('web-tools:configs-refreshed', this._dataRefresh);
        this._dataRun++;
      },

      // The tab strip scrolls sideways, so a tab opened from an address can
      // sit past its edge. Scroll the strip alone; the page stays put.
      revealTab(el){
        const strip = el.parentElement, a = el.getBoundingClientRect(), b = strip.getBoundingClientRect();
        if (a.left < b.left) strip.scrollLeft += a.left - b.left - 8;
        else if (a.right > b.right) strip.scrollLeft += a.right - b.right + 8;
      },
      // A tab tap: render it, fetch what it needs, and stamp the URL.
      setTab(tab){
        if (tab === this.mapTab) return;
        this.mapTab = tab;
        this.loadTab(tab);
        window.__shell?.goMapTab?.(tab);
      },
      // Each tab's manifest, fetched on first open. The loaders are idempotent
      // (each returns early once its manifest is in hand), so this is safe to
      // call on every arrival at a tab, whatever route brought the reader.
      loadTab(tab){
        if (tab === 'aims') this.loadAims();
        else if (tab === 'policy') this.loadPolicies();
        else if (tab === 'surfacing') this.loadSurf();
        else if (tab === 'showing') this.loadRoutes();
        else if (tab === 'docs') { this.loadDocsReg(); this.loadEstateDocs(); }
        else if (tab === 'growth') { this.growthSeen = true; this.loadEstateGrowth(); }
        else if (tab === 'claims') {
          this.loadOwnersReg(); this.loadThemes();
          // portable.csv answers which files leave the repo, which is half of
          // what makes a duplication worth reviewing.
          if (!this.manifest) this.loadManifest();
        }
        else if (tab === 'tests') this.loadTestsReg();
        else if (tab === 'agents') { this.loadAgentsReg(); this.loadEstateAgents(); }
        else if (tab === 'peeves') { this.loadPeeves(); this.loadPropsReg(); }
        else if (tab === 'harness') this.loadToolsReg();
        else if (tab === 'context') this.loadContextReg();
        else if (tab === 'kits') this.loadKitsReg();
        else if (tab === 'patterns' || tab === 'dimensions') this.loadPatterns();
        else if (tab === 'outposts') this.loadOutposts();
        else if (tab === 'reach') this.loadReach();
        else if (tab === 'registries') this.loadPropsReg();
        else if (tab === 'data') this.loadDataCensus();
        // Views dates one repo's own files, so it reads the hub's history
        // rather than a registry file: the loader is its own, and the x-effect
        // on the section covers the deep-link arrival this switch does not.
        else if (tab === 'views') this.loadAppViews();
        // The plugin set reads Distribution's manifest. load() fetches it on
        // mount, so this is the cold-deep-link case, and loadManifest has no guard
        // of its own.
        else if (tab === 'skills') {
          this.loadSkillsReg(); this.loadEstateSkills(); this.loadUpstreams();
          if (!this.manifest) this.loadManifest();
          // Invocation counts ride the same cache as the Docs tab's readership,
          // so the Skills tab pulls it too rather than keeping a second fetch.
          this.loadDocReads();
        }
      },

      hub(){ return window.PortableAlign?.HUB || 'mehrlander/web-tools'; },
      // Registry reads pin ref 'main': it is live shared state written on main.
      registry(){ return window.__shell?.REGISTRY_REPO || 'mehrlander/web-tools-private'; },
      hasToken(){ return !!window.__shell?.hasToken?.(); },
      // A hub link follows the ref the manifests were READ at, for the same
      // reason loadManifest does: under ?use= a jump-over pinned to main opens a
      // different file than the one on screen.
      hubUrl(path){ return 'https://github.com/' + this.hub() + '/blob/' + useRef() + '/' + path; },
      // The peek address for a hub file, and for a route's renderer in whatever
      // repo it lives (lib/kits/source-peek.js reads it off data-peek). Exact files
      // only: a `dir` item and every repo-level link stay peekless, which is
      // what keeps the glyph's two meanings apart.
      peek(path){ return path ? (window.SourcePeek?.addr(this.hub(), useRef(), path) || null) : null; },
      routePeek(r){ return window.SourcePeek?.addr(r.repo, r.ref || selRef(r.repo, r.path), r.path) || null; },
      // The card gear opens the shell's repo dialog on that repo's Config tab, in
      // place (no navigation), the same call the estate Repos card makes with
      // { tab: 'settings' }. openDialog loads any repo's config, not just the
      // open one, so editing a repo's .web-tools.json is one tap from the Map.
      openConfig(repo){
        const el = document.getElementById('repo');
        el?.__repo?.openDialog(repo, { tab: 'config' });
      },

      load(){
        this.authed = this.hasToken();
        if (!this.manifest) this.loadManifest();
        // Auth resolves after boot, so a Docs or Skills tab opened tokenless
        // renders its registry and picks the usage column up here when the
        // token lands. One cache serves both.
        if (this.docsReg || this.skillsReg) this.loadDocReads();
        if (this.docsReg) this.loadDocPending();
        // The account outpost's observation is private, so it waits for the token too.
        if (this.outpostsReg) this.loadAccountObserved();
      },

      // ── The set ──────────────────────────────────────────────────────────
      async loadManifest(){
        this.setLoading = true;
        this.setErr = '';
        try {
          const gh = new window.GH({ token: window.TOKEN, repo: this.hub(), ref: useRef() });
          // The set inherits: it curates WHICH files travel and how a
          // consumer takes each one, and leaves the description of a file to
          // whichever registry owns it. Nine scripts are described by the harness
          // registry, so their rows here are blank and the role is joined below.
          // Skills keep an authored role, because the skills catalog carries a
          // model-facing trigger description rather than a reader's one-liner.
          const [set, harness, agents] = await Promise.all([
            gh.get(SET_MANIFEST),
            gh.get(TOOLS_MANIFEST).catch(() => null),   // the harness registry, for the joined role
            gh.get(AGENTS_MANIFEST).catch(() => null),  // the agent roster, likewise
          ]);
          // The header's own peek reads these bytes rather than fetching them
          // again: the view has them, and a peek at the file a view is a
          // projection of should not be a second round trip.
          window.SourcePeek?.seed(this.peek(SET_MANIFEST), set.text);
          this.manifest = { items: window.Csv.rows(set.text) };
          this.harnessRoles = harness ? Object.fromEntries(
            window.Csv.rows(harness.text).map(t => [t.path, t.role])) : {};
          this.agentRoles = agents ? Object.fromEntries(
            window.Csv.rows(agents.text).filter(a => a.kind === 'definition').map(a => [a.path, a.role])) : {};
        } catch (e) {
          this.setErr = 'Manifest load failed: ' + (e?.message || e);
        } finally { this.setLoading = false; }
      },
      // A row's own role where it has one, the owning registry's where it does
      // not. Blank on both is the honest empty, not a hidden failure.
      setRole(it){ return it.role || this.harnessRoles?.[it.path] || this.agentRoles?.[it.path] || ''; },
      setHit(it){
        if (this.setUse && it.use !== this.setUse) return false;
        const q = this.setQ.trim().toLowerCase();
        if (!q) return true;
        return [it.title, it.path, it.command, this.setRole(it)]
          .some(v => String(v || '').toLowerCase().includes(q));
      },
      get setRows(){ return (this.manifest?.items || []).filter(it => this.setHit(it)); },
      get setSections(){
        const items = this.manifest?.items || [];
        const visible = this.setRows;
        return this.setRouteDefs
          .map(d => ({ ...d,
            total: items.filter(i => i.use === d.key).length,
            items: visible.filter(i => i.use === d.key),
          }))
          .filter(s => s.total && (!(this.setQ.trim() || this.setUse) || s.items.length));
      },
      // One label and gloss per use value, read by Distribution's groups and
      // by the Routes panel for a route.
      get setRouteDefs(){
        return [
          { key: 'plugin', label: 'Plugin package',
            gloss: 'Copied with the installed plugin.' },
          { key: 'live', label: 'Fetched live',
            gloss: 'Read from the hub when the convention is needed.' },
          { key: 'adopt', label: 'Adopt once',
            gloss: 'Fetched into the receiving repository, which then owns its copy.' },
          { key: 'reference', label: 'Reference',
            gloss: 'Consulted as shared background rather than copied.' },
          { key: 'on-demand', label: 'On demand',
            gloss: 'Fetched only when a task calls for it.' },
        ];
      },
      get setTally(){
        return { shown: this.setRows.length, total: (this.manifest?.items || []).length };
      },

      // ── Reach: the routes diagram ────────────────────────────────────────
      // Edges are portable.csv rows counted by use, largest first; the counts
      // are the data, so nothing here names a route or orders them by hand.
      get reachRoutes(){
        const n = {};
        for (const it of this.manifest?.items || []) if (it.use) n[it.use] = (n[it.use] || 0) + 1;
        return Object.entries(n).map(([use, c]) => ({ use, n: c })).sort((a, b) => b.n - a.n || a.use.localeCompare(b.use));
      },
      // An outpost is joined to the repository its `declared` locator names.
      get reachOutposts(){
        return (this.outpostsReg?.outposts || []).map(o => ({
          id: o.id, title: o.title, from: String(o.declared || '').split(':')[0] }));
      },
      reachVisClass(r){
        return r.vis === 'public' ? 'border-base-content/40'
          : r.vis === 'private' ? 'border-dashed border-base-content/40'
          : 'border-dotted border-base-content/25';
      },
      openRoute(use){
        this.setUse = use;
        this.setQ = '';
        this.setTab('set');
      },
      // Nodes: the hub's own manifest; with a token, every estate repository
      // in the crawled config cache (the source the Data tab reads); and any
      // repository an outpost names that neither supplies, drawn as named but
      // not read. Visibility is GitHub's: the account list with a token, else
      // one anonymous /repos read, which answers only for a public repository.
      async loadReach(){
        if (!this.manifest) this.loadManifest();
        if (this.reachRepos || this.reachLoading) return;
        this.reachLoading = true;
        this.reachErr = '';
        const token = window.TOKEN, hubRepo = this.hub();
        const configs = new Map(), aligns = new Map();
        try {
          try {
            const hub = new window.GH({ token, repo: hubRepo, ref: useRef() });
            configs.set(hubRepo, JSON.parse((await hub.get('.web-tools.json')).text));
          } catch (e) { configs.set(hubRepo, null); this.reachErr = 'Hub declaration unavailable: ' + (e?.message || e); }
          if (this.hasToken()) {
            try {
              const path = window.RepoConfigCache?.CACHE_PATH || 'state/configs.json';
              const reg = new window.GH({ token, repo: this.registry(), ref: 'main' });
              const cache = JSON.parse((await reg.get(path)).text);
              for (const [repo, entry] of Object.entries(cache?.repos || {}))
                if (repo !== hubRepo && entry?.config?.estate === true) {
                  configs.set(repo, entry.config);
                  if (entry.align) aligns.set(repo, entry.align);
                }
            } catch (e) { this.reachErr = 'Estate declarations unavailable: ' + (e?.message || e); }
          }
          const repos = [...configs].map(([repo, c]) => ({
            repo, name: repo.split('/')[1], hub: repo === hubRepo, read: !!c,
            icon: /^ph-/.test(c?.icon || '') ? c.icon : '', order: c?.order ?? 999, vis: 'unknown',
            conf: c || null, align: aligns.get(repo) || null, pushed: '' }));
          // loadOutposts returns at once while another call is in flight, so
          // wait for the registry itself rather than for this call.
          await this.loadOutposts();
          for (let i = 0; this.outpostsLoading && i < 100; i++) await new Promise(r => setTimeout(r, 50));
          for (const o of this.reachOutposts)
            if (o.from && !repos.some(r => r.repo === o.from))
              repos.push({ repo: o.from, name: o.from.split('/')[1], hub: false, read: false,
                           icon: '', order: 1000, vis: 'unknown', conf: null, align: null, pushed: '' });
          this.reachRepos = repos.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
          // Drawn first, styled second: a visibility read never holds the diagram.
          this.reachVisibility().catch(() => {});
        } catch (e) {
          this.reachErr = 'Reach load failed: ' + (e?.message || e);
        } finally { this.reachLoading = false; }
        this.$nextTick(() => this.reachMeasure());
      },
      // ── The node panel-tip ───────────────────────────────────────────────
      // Same contract as session-brief's branch panel-tip: hover opens it
      // where the pointer is fine, a click or tap pins it, and
      // kits/panel-tip.js closes it on ✕, Escape and a press outside.
      reachTipIs(kind, key){ return !!(this.reachTip && this.reachTip.kind === kind && this.reachTip.key === key); },
      async wireReachTip(){
        if (this._reachTipWired) return;
        this._reachTipWired = true;
        await window.gh?.load?.('kits/panel-tip.js').catch(() => {});
        if (!window.PanelTip || !this.$refs.reachTip) return;
        window.PanelTip.wire(this.$refs.reachTip, { onClose: () => this.closeReachTip(), except: ['[data-reach-tip]', 'svg path[data-route]', '.sd-overlay'], stale: false });
        const gone = () => { if (this.reachTip && !this.reachTip.pinned) this.closeReachTip(); };
        window.addEventListener('scroll', gone, { passive: true });
        window.addEventListener('resize', () => this.reachTip && this.closeReachTip());
      },
      showReachTip(kind, key, el, pinned){
        const r = el.getBoundingClientRect();
        const w = Math.min(innerWidth >= 768 ? 440 : 360, innerWidth - 16);
        this.reachTipClose = window.PanelTip ? window.PanelTip.closeHTML(pinned) : '';
        this.reachTip = { kind, key, pinned, w, x: Math.max(8, Math.min(r.left, innerWidth - w - 8)), y: r.bottom + 6 };
        this.$nextTick(() => {
          const t = this.$refs.reachTip;
          if (!t || !this.reachTip) return;
          const h = t.offsetHeight;
          if (r.bottom + 6 + h > innerHeight - 8) this.reachTip.y = Math.max(8, r.top - 6 - h >= 8 ? r.top - 6 - h : innerHeight - 8 - h);
        });
      },
      async toggleReachTip(kind, key, el){
        clearTimeout(this._reachTipT);
        await this.wireReachTip();
        if (this.reachTipIs(kind, key) && this.reachTip.pinned) return this.closeReachTip();
        this.showReachTip(kind, key, el, true);
      },
      hoverReachTip(kind, key, el){
        if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
        if (this.reachTip?.pinned) return;
        clearTimeout(this._reachTipT);
        this._reachTipT = setTimeout(async () => { await this.wireReachTip(); this.showReachTip(kind, key, el, false); }, 160);
      },
      leaveReachTip(){
        clearTimeout(this._reachTipT);
        if (!this.reachTip || this.reachTip.pinned) return;
        this._reachTipT = setTimeout(() => this.closeReachTip(), 240);
      },
      closeReachTip(){ clearTimeout(this._reachTipT); this.reachTip = null; },
      reachEdgeClick(use){
        const el = this.$refs.reach?.querySelector('[data-reach-route="' + String(use).replace(/[^\w-]/g, '') + '"]');
        if (el) this.toggleReachTip('route', use, el);
      },
      // What a node's panel shows, from what the diagram already loaded:
      // a route's rows by kind, a repository's manifest and alignment record,
      // an outpost's row of docs/outposts.csv.
      get reachTipBody(){
        const t = this.reachTip;
        if (!t) return null;
        const items = this.manifest?.items || [];
        const n = (k, x) => x + ' ' + k + (x === 1 ? '' : 's');
        // owner/repo:path, shown as repo · path, breaking only after a slash.
        const loc = (v) => { const m = String(v || '').match(/^[\w.-]+\/([\w.-]+):(.+)$/);
          return m ? { loc: true, text: m[1] + ' · ' + m[2].replace(/\//g, '/\u200b') } : { loc: false, text: v || '' }; };
        if (t.kind === 'route') {
          const rows = items.filter(it => it.use === t.key);
          const def = this.setRouteDefs.find(d => d.key === t.key);
          const groups = Object.values(rows.reduce((a, it) => {
            const k = this.kindLabel(it);
            (a[k] ||= { kind: k.toLowerCase(), icon: this.kindIcon(it), rows: [] }).rows.push(it);
            return a;
          }, {})).sort((a, b) => b.rows.length - a.rows.length);
          return { kind: 'route', icon: 'ph-arrow-right', title: def?.label || t.key, badge: t.key, groups,
                   links: [{ label: 'Open in Distribution', icon: 'ph-package', text: 'Distribution', go: () => this.openRoute(t.key) }] };
        }
        if (t.kind === 'outpost') {
          const o = (this.outpostsReg?.outposts || []).find(x => x.id === t.key) || {};
          return { kind: 'outpost', icon: 'ph-flag-pennant', title: o.title || t.key, badge: '',
                   where: o.gloss || '', declared: loc(o.declared), observed: loc(o.observed),
                   check: loc(o.check).text, cadence: o.cadence || '', record: loc(o.record).text,
                   links: [{ label: 'Open in Outposts', icon: 'ph-flag-pennant', text: 'Outposts', go: () => this.setTab('outposts') }] };
        }
        const r = (this.reachRepos || []).find(x => x.repo === t.key) || {};
        const c = r.conf || {}, a = r.align;
        const projects = (c.projects || []).length;
        const views = (c.pages || []).filter(p => p?.appView).length;
        const outposts = this.reachOutposts.filter(o => o.from === r.repo).length;
        // The Repos card's checks, from the same alignment record. The hub
        // is the source, so it shows its role rather than grading itself.
        const checks = r.hub ? [] : !a ? [] : [
          { label: 'marketplace', on: !!a.marketplace },
          { label: (a.plugins || []).length ? a.plugins.join(', ') : 'plugin', on: !!(a.plugins || []).length },
          { label: 'conventions', on: !!a.conventionsWired },
        ];
        const facts = [
          r.pushed && { icon: 'ph-clock', text: this.agoOf(r.pushed) },
          views && { icon: 'ph-app-window', text: n('view', views) },
          projects && { icon: 'ph-kanban', text: n('project', projects) },
          outposts && { icon: 'ph-flag-pennant', text: n('outpost', outposts) },
          r.hub && items.length && { icon: 'ph-package', text: items.length + ' shipped' },
        ].filter(Boolean);
        return { kind: 'repo', icon: r.icon || 'ph-git-branch', title: r.name || t.key,
                 badge: r.read ? '' : 'not read', note: c.note || '',
                 verdict: r.hub ? 'source' : (a?.verdict || ''), checks,
                 install: r.hub ? '/plugin install portable@web-tools' : '', facts,
                 links: [{ label: 'Open on GitHub', icon: r.vis === 'private' ? 'ph-lock-simple' : 'ph-github-logo', href: 'https://github.com/' + t.key }] };
      },
      // A row opens the swipe deck the Distribution tab uses, over the route's
      // files, at the one tapped; the panel stays pinned under it.
      openReachRow(it){
        if (it.kind === 'dir') return this.openItem(it);
        const files = (this.manifest?.items || []).filter(x => x.use === it.use && x.kind !== 'dir');
        return this.openFileDeck(files, files.findIndex(f => f.path === it.path), {
          icon: 'ph-graph', key: 'reach:' + it.use, context: 'Routes',
          label: (it2) => ({ title: it2.title || this.docTitle(it2), subtitle: this.setRole(it2), icon: this.kindIcon(it2) }),
        });
      },
      async reachVisibility(){
        const gh = new window.GH({ token: this.hasToken() ? window.TOKEN : '' });
        const acct = this.hasToken() ? await Promise.resolve().then(() => gh.repos()).catch(() => []) : [];
        const listed = new Map((Array.isArray(acct) ? acct : []).map(r => [r.full_name, r]));
        await Promise.all((this.reachRepos || []).map(async (n) => {
          const r = listed.get(n.repo) || await Promise.resolve().then(() => gh.req('/repos/' + n.repo)).catch(() => null);
          if (r) { n.vis = r.private ? 'private' : 'public'; n.pushed = r.pushed_at || ''; }
        }));
      },
      // Lines between boxes the grid already placed. A route runs hub to its
      // label to the set; an outpost line runs from its declaring repository.
      // Side by side the curves run left to right; stacked (a phone, a narrow
      // dock) route lines run top to bottom and outpost lines are left out,
      // since the outpost names its repository in its own box there.
      reachMeasure(){
        const root = this.$refs?.reach;
        if (!root || this.mapTab !== 'reach' || !root.offsetWidth) return;
        const b = root.getBoundingClientRect();
        const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect();
          return { l: r.left - b.left, r: r.right - b.left, t: r.top - b.top, bt: r.bottom - b.top,
                   cx: (r.left + r.right) / 2 - b.left, cy: (r.top + r.bottom) / 2 - b.top }; };
        const hub = box(root.querySelector('[data-reach-hub]'));
        const set = box(root.querySelector('[data-reach-set]'));
        if (!hub || !set) { this.reachPaths = []; return; }
        const side = set.l > hub.r + 8;
        const curve = (x1, y1, x2, y2) => side
          ? 'M' + x1 + ' ' + y1 + ' C' + (x1 + x2) / 2 + ' ' + y1 + ' ' + (x1 + x2) / 2 + ' ' + y2 + ' ' + x2 + ' ' + y2
          : 'M' + x1 + ' ' + y1 + ' C' + x1 + ' ' + (y1 + y2) / 2 + ' ' + x2 + ' ' + (y1 + y2) / 2 + ' ' + x2 + ' ' + y2;
        const paths = [];
        for (const rt of this.reachRoutes) {
          const lab = box(root.querySelector('[data-reach-route="' + rt.use + '"]'));
          if (!lab) continue;
          const w = 1.5 + Math.sqrt(rt.n) * 0.6;
          const ty = Math.min(Math.max(lab.cy, set.t + 16), set.bt - 16);
          paths.push(side
            ? { key: 'a:' + rt.use, kind: 'route', route: rt.use, w, d: curve(hub.r, hub.cy, lab.l, lab.cy) }
            : { key: 'a:' + rt.use, kind: 'route', route: rt.use, w, d: curve(hub.cx, hub.bt, lab.cx, lab.t) });
          // The plugin route alone can be drawn to the repositories it
          // actually reaches: the config cache's alignment record says which
          // ones enable a hub plugin. With no record (no token, or a repo the
          // crawl has not graded) the line ends at the set as before.
          const takers = side && rt.use === 'plugin'
            ? (this.reachRepos || []).filter(r => !r.hub && r.align && (r.align.plugins || []).length) : [];
          const graded = side && rt.use === 'plugin' && (this.reachRepos || []).some(r => !r.hub && r.align);
          if (graded) {
            for (const r of takers) {
              const to = box(root.querySelector('[data-reach-repo="' + r.repo + '"]'));
              if (to) paths.push({ key: 'b:plugin:' + r.repo, kind: 'route', route: rt.use, w: Math.max(2, w * 0.6),
                                   d: curve(lab.r, lab.cy, to.l, to.cy) });
            }
          } else paths.push(side
            ? { key: 'b:' + rt.use, kind: 'route', route: rt.use, w, d: curve(lab.r, lab.cy, set.l, ty) }
            : { key: 'b:' + rt.use, kind: 'route', route: rt.use, w, d: curve(lab.cx, lab.bt, lab.cx, set.t) });
        }
        if (side) for (const o of this.reachOutposts) {
          const from = box(root.querySelector('[data-reach-repo="' + o.from + '"]'))
                    || (o.from === this.hub() ? hub : null);
          const to = box(root.querySelector('[data-reach-outpost="' + o.id + '"]'));
          if (!from || !to) continue;
          // The hub's own outposts pass beneath the set rather than through it,
          // where they would read as a set member's.
          const low = Math.max(set.bt, to.cy) + 28;
          paths.push({ key: 'o:' + o.id, kind: 'outpost', w: 1.5, d: o.from === this.hub()
            ? 'M' + hub.cx + ' ' + hub.bt + ' C' + hub.cx + ' ' + low + ' ' + (to.l - 90) + ' ' + low + ' ' + to.l + ' ' + to.cy
            : curve(from.r, from.cy, to.l, to.cy) });
        }
        this.reachPaths = paths;
      },
      get reachSvg(){
        return this.reachPaths.map(p => '<path d="' + p.d + '" fill="none" stroke-linecap="round" stroke-width="' + p.w + '"'
          + (p.kind === 'route'
            ? ' data-route="' + String(p.route).replace(/[^\w-]/g, '') + '" class="cursor-pointer [pointer-events:visibleStroke] '
              + (this.reachHot === p.route ? 'stroke-current text-primary' : 'stroke-current text-base-content/20') + '"'
            : ' stroke-dasharray="2 5" class="stroke-current text-base-content/25"') + '></path>').join('');
      },
      kindIcon(it){ return (KIND[it.kind] || KIND.doc).icon; },
      kindLabel(it){ return (KIND[it.kind] || KIND.doc).label; },
      setOwner(it){
        // A script shipped inside a plugin skill belongs to that skill, not to
        // the repository Automation inventory. Keep the parent slug on the
        // owner result so the cross-reference can land on the exact plugin
        // skill rather than merely opening the Skills tab.
        if (it.kind === 'agent') return { tab: 'agents', label: 'Agents' };
        const pluginSkill = String(it.path || '').match(/^skills\/([^/]+)\//)?.[1] || '';
        if (it.kind === 'skill' || pluginSkill)
          return { tab: 'skills', label: 'Skills', set: 'plugin', query: pluginSkill || it.title || '' };
        if (it.path === 'skills' || it.path.startsWith('skills/'))
          return { tab: 'skills', label: 'Skills', set: 'library', query: '' };
        if (it.kind === 'script') return { tab: 'harness', label: 'Automation' };
        return { tab: 'docs', label: 'Docs' };
      },
      async openSetOwner(it){
        const owner = this.setOwner(it);
        if (owner.tab === 'skills') {
          this.skillSet = owner.set;
          this.skillQ = owner.query;
          return this.setTab('skills');
        }
        if (owner.tab === 'agents') {
          this.agentSet = (this.agentsReg || []).find(a => a.path === it.path)?.team || 'critic';
          this.agentQ = String(it.path || '').split('/').pop().replace(/\.md$/, '');
          return this.setTab('agents');
        }
        if (owner.tab === 'docs') {
          const slash = it.path.lastIndexOf('/');
          this.docDir = it.kind === 'dir' ? it.path : (slash > 0 ? it.path.slice(0, slash) : 'docs');
          this.docSearchDir = '';
          this.docQ = it.kind === 'doc' ? it.path : '';
          return this.setTab('docs');
        }
        // Distributed tools under python/ are real repository automation and
        // land on their canonical Harness layer. Plugin-internal helpers were
        // returned above to the plugin skill that owns them.
        if (it.path.startsWith('python/')) this.harnessDir = 'python';
        this.harnessInvoke = '';
        return this.setTab('harness');
      },
      itemGh(it){
        return 'https://github.com/' + this.hub() + '/' + (it.kind === 'dir' ? 'tree' : 'blob') +
               '/' + useRef() + '/' + it.path;
      },
      // The distribution's readable rows, flattened in delivery order and
      // narrowed by the query, so the deck pages what is on screen rather than
      // the manifest's own row order. `dir` rows are not files and keep the
      // folder route: there is nothing for a slide to render.
      get setFiles(){
        return this.setSections.flatMap(s => s.items).filter(i => i.kind !== 'dir');
      },
      async openItem(it){
        if (it.kind === 'dir') {
          if (!window.__shell) return;
          await window.__shell.ensureBrowser(this.hub(), '');
          return window.__shell.openFolder(it.path);
        }
        const files = this.setFiles;
        return this.openFileDeck(files, files.findIndex(f => f.path === it.path), {
          icon: 'ph-package', key: 'set:' + this.setQ.trim().toLowerCase(), context: 'Distribution',
          // The manifest names each row and says what it is for, which is a
          // better handle than a filename: half this set is SKILL.md.
          label: (it2) => ({ title: it2.title || this.docTitle(it2), subtitle: this.setRole(it2),
                             icon: this.kindIcon(it2) }),
        });
      },
      async openHubFile(path){
        if (!window.__shell || !path) return;
        await window.__shell.ensureBrowser(this.hub(), '');
        await window.__shell.openFile(path);
      },
      async openDoctrine(){ await this.openHubFile(DOCTRINE_PATH); },
      async openRepo(repo){ await window.__shell?.openPinned(repo); },

      // ── Showing ───────────────────────────────────────────────────────────

      // ── Views: the app's own destinations, dated ──────────────────────────
      // Every address the app can be sent to, ranked by when the code behind
      // it last moved, with whatever pull request is open against it now.
      //
      // It was Activity's fifth pill until 2026-09-08 and belongs here instead.
      // The four panes it sat beside are cross-repo crawl caches keyed to who
      // was working; this reads ONE hand-authored registry
      // (docs/app-routes.csv) about ONE repo, joined to that repo's history,
      // which is what every tab in this view already is. The argument for
      // keeping it there was that Map is the coordination layer at rest and a
      // date is motion, but Docs already carries growth over time and Tests
      // carries staleness, so rest was never the line.
      //
      // NAMED FOR THE ?view= KEY, not "Routes", and the rename is the other
      // half of the move: this component already had a loadRoutes and a
      // ROUTES_MANIFEST, both about the SHOWING tab's address grammar and
      // neither about these. Two subjects under one word in one file is how a
      // reader ends up reading the wrong table.
      //
      // The manifest, the pull-request file lists and the pool are the shell's
      // (loadRouteJoin there): the estate's branch rows read the same join for
      // their own chips, so one read serves both panes.
      get routeManifest(){ return window.__shell?.routeManifest || null; },
      get routeBranchFiles(){ return window.__shell?.routeBranchFiles || []; },
      get routeJoinRef(){ return window.__shell?.routeJoinRef || ''; },
      get viewsRef(){ return window.__shell?.routesRef || 'main'; },
      get authedHub(){ return !!window.TOKEN; },
      // The relative clock the Views rows read dates with. Same two lines the
      // estate carries, because the pane arrived from there and GH.ago is the
      // one phrasing of "how long ago" the whole app uses; a second wording
      // would have this view disagreeing with every other one about the same
      // commit. The client is built once and never used for a request.
      agoOf(iso){ try { return iso ? (this.__ago ||= new window.GH({})).ago(iso) : ''; } catch { return ''; } },
      agoShort(iso){ return this.agoOf(iso).replace(' ago', '').replace('just now', 'now'); },
      __ago: null,
      viewTouches: {},        // path -> { date, sha, subject, url, author }
      viewsBusy: false,
      viewsLoadedAt: '',
      viewsTried: false,      // attempt-once guard; guards the attempt, not success
      viewsError: '',
      viewGroupOpen: {},      // group key -> collapsed, for the quiet groups
      viewOpenRow: '',        // the expanded row's key; one at a time

      // ── Routes: the app's own destinations, dated ────────────────────────
      // Read the reactive fields FIRST and unconditionally: the kit is loaded
      // lazily, so an expression that
      // short-circuits on `window.routeActivity?` registers no dependency on
      // the state the loader writes and the pane never re-renders.
      get viewRows(){
        const m = this.routeManifest, touches = this.viewTouches, branches = this.routeBranchFiles;
        if (!window.routeActivity || !m) return [];
        return window.routeActivity.rank(m, { touches, branches });
      },
      // The group survives as a per-row label rather than as a section, so the
      // one thing it must do is name itself. Kept off the row data because the
      // manifest already holds it and the kit should not copy it forward.
      viewGroupLabel(key){
        const m = this.routeManifest;
        return (m?.groups || []).find(g => g.key === key)?.label || key;
      },
      // The rows folded into their nav stops, the level the router flattens
      // away. Order is the ranking's, not a second sort: see the kit.
      get viewStops(){
        const rows = this.viewRows;
        return window.routeActivity ? window.routeActivity.stops(rows) : [];
      },
      // The address, minus the placeholders a row cannot fill. `?view=app` is
      // the useful half of ?view=app&appRepo=<owner/repo>&appPath=<path>: the
      // rest is a shape, not an address, and at phone width it wrapped to a
      // second line to say what the row's own tone now says. The full form is
      // in the expanded detail, where a reader who wants the shape can get it.
      viewShortAddress(r){
        const a = r.address || '';
        const m = /^(\?view=[a-z]+)&/.exec(a);
        return m ? m[1] : a;
      },
      viewAddressTruncated(r){ return this.viewShortAddress(r) !== (r.address || ''); },
      // The shell group is not a screen this app draws (a promoted page, a
      // tokenless read of someone else's repo), so it reads in the muted tone
      // rather than announcing itself in the same weight as a real destination.
      viewIsShell(r){ return r.group === 'shell'; },
      // How many routes are sub-tabs wearing a top-level key. Stated ONCE, as a
      // figure beside the pane's other aggregates, rather than as a sentence
      // repeated on each folded stop: the sentence was identical three times
      // and cost two lines apiece on a phone, while the indent already says a
      // stop owns its rows. What the indent cannot say is how much of the list
      // this accounts for, so that is the part worth a number.
      get viewsFlattened(){
        return this.viewStops.reduce((n, s) => n + s.rows.length - 1, 0);
      },
      get viewShellRow(){
        const m = this.routeManifest, touches = this.viewTouches;
        if (!window.routeActivity || !m) return null;
        return window.routeActivity.shellRow(m, { touches });
      },
      // How many routes have no file of their own. The pane's one aggregate,
      // and the reason it is here rather than in the kit: it is a reading of
      // the app, and it belongs where the reading is shown.
      get viewsWithoutCode(){ return this.viewRows.filter(r => !r.hasOwnCode).length; },
      // Counts the narrow join only. Counting `near` too is what made the first
      // render claim work open on eleven of twenty-four routes off three PRs.
      get viewsInFlight(){ return this.viewRows.filter(r => r.branches.length).length; },

      // What a BRANCH row is working on: the reciprocal of the Routes pane's
      // per-route branch list, off the same data and the same rule. Answers
      // only for the hub's own branches, because routes are one page in one
      // repo; every other repo's rows get nothing rather than a guess, which is
      // why this returns null instead of an empty result.
      async loadAppViews(force){
        if (!this.authedHub || this.viewsBusy) return;
        // Attempt-once, not success-once: guarding on viewsLoadedAt would make
        // one thrown error relaunch the load forever off the x-effect below.
        if (this.viewsTried && !force) return;
        this.viewsTried = true;
        if (!window.RouteJoin || !window.routeActivity) {
          try {
            await window.gh.load('kits/route-activity.js');
            await window.gh.load('kits/route-join.js');
          } catch { return; }
        }
        this.viewsBusy = true;
        this.viewsError = '';
        try {
          const ref = this.viewsRef;
          // The manifest and the pull-request file lists, shared with the
          // estate's Branches rows and held by the shell so one read serves
          // both. Re-run it only when no pane has it at this ref, or the caller
          // forced it: it is a manifest read, a pull list, and a file list per
          // open pull request.
          const gh = await window.__shell.loadRouteJoin(
                       force || !this.routeManifest || this.routeJoinRef !== ref)
                     || new window.GH({ token: window.TOKEN, repo: window.__shell.ROUTES_REPO, ref });
          const manifest = this.routeManifest;
          if (!manifest) throw new Error('no route manifest at ' + ref);

          // One last-commit read per declared file. The shell's own file
          // rides the same list, so its row is dated by the same mechanism even
          // though it is excluded from attribution.
          this.viewTouches = await window.RouteJoin.dates(
            gh, window.routeActivity.pathsToRead(manifest), ref);
          this.viewsLoadedAt = new Date().toISOString();
        } catch (e) {
          this.viewsError = e?.message || String(e);
        } finally { this.viewsBusy = false; }
      },

      // Open a route from its row, through the shell's own dispatcher, so it is
      // the same navigation a header tab performs: no reload, one history
      // entry, and the URL stamped by the view's own rule.
      //
      // Only a bare `?view=<key>` is offered. An address carrying a placeholder
      // (a repo, a file path, a promoted page) cannot be opened from a row that
      // does not know which one, and a link that lands nowhere is worse than no
      // link; those rows show the address as text instead. The repo-scoped
      // views open against whichever repo is current, which is what tapping
      // them in the sidebar does.
      viewIsOpenable(r){ return !!window.routeActivity?.openable(r); },
      openAppView(r){
        if (!this.viewIsOpenable(r)) return;
        window.__shell?.routeFromUrl?.({ view: r.key });
      },
      toggleViewRow(key){ this.viewOpenRow = this.viewOpenRow === key ? '' : key; },

      async loadRoutes(){
        if (this.routes || this.routesLoading) return;
        this.routesLoading = true;
        this.routesErr = '';
        try {
          const gh = new window.GH({ token: window.TOKEN, repo: this.hub(), ref: useRef() });
          const [raw, modes, routes, mechanisms, kinds, paste, subjects] = await Promise.all(
            [ROUTES_MANIFEST, ROUTES_MODES, ROUTES_ROUTES, SHOWING_MECHANISMS,
             ROUTES_KINDS, ROUTES_PASTE, SUBJECTS]
              .map(p => gh.get(p).then(r => r.text)));
          const parsed = JSON.parse(raw);
          if (!parsed || !parsed.grammar) throw new Error('no grammar block');
          window.SourcePeek?.seed(this.peek(ROUTES_MANIFEST), raw);
          parsed.modes = window.Csv.rows(modes);
          parsed.routes = window.Csv.rows(routes);
          // `trap` is carried by one mechanism of seven, so a blank cell is the
          // absence of a trap rather than an empty one; the template tests the
          // string, so nothing further is needed to keep the six quiet.
          parsed.showing.mechanisms = window.Csv.rows(mechanisms);
          // The subject axis names its registry rather than listing values, so
          // the axis card is drawn from the rows: each type with what it needs.
          parsed.subjects = window.Csv.rows(subjects);
          parsed.showing.axes = { ...parsed.showing.axes,
            subject: parsed.subjects.map(t => t.label + ' (' + t.needs + ')') };
          // Most cells here are blank on most rows, deliberately: aim is
          // carried by one kind of eleven and kit by three, so an empty cell
          // is "this kind has none" rather than a gap. Every x-show below tests
          // the string, so the blanks render as absence.
          parsed.kinds = window.Csv.rows(kinds);
          // `path` is blank on the form-field row, which names a browser
          // behavior rather than a file of ours; the template tests the string,
          // so the row renders without a link rather than with a broken one.
          parsed.paste = window.Csv.rows(paste);
          this.routes = parsed;
        } catch (e) {
          this.routesErr = 'Routes manifest load failed: ' + (e?.message || e);
        } finally { this.routesLoading = false; }
      },
      // The manifest names its own renderer; the fallback is what the header
      // shows before the fetch lands, and it is the same file either way.
      get rendererPath(){ return this.routes?.renderer || 'pages/toss-render.html'; },
      // A subject key's one-line meaning, for the badges that carry it.
      subjectGloss(key){
        const t = (this.routes?.subjects || []).find(s => s.key === key);
        return t ? t.label + ': ' + t.gloss : '';
      },
      // The icon carries the trust posture, the badge carries the delivery:
      // whether a mode can read this origin is the consequential fact.
      modeIcon(m){ return MODE_ICON[m.trust] || MODE_ICON['n/a']; },
      // A route names its own repo, so a renderer living outside the hub opens
      // in its own repo rather than 404ing against this one.
      async openRouteRenderer(r){
        if (!window.__shell) return;
        await window.__shell.ensureBrowser(r.repo, r.ref === 'main' ? '' : r.ref);
        await window.__shell.openFile(r.path);
      },
      routeGh(r){ return 'https://github.com/' + r.repo + '/blob/' + (r.ref || selRef(r.repo, r.path)) + '/' + r.path; },

      // ── Surfacing ─────────────────────────────────────────────────────────
      // Same lazy shape as loadRoutes: fetched on first open of the tab.
      // Markdown from the manifest, not from the DOM: the page is one rendering
      // of docs/aims.json and this is another, so both move when the file does.
      readingUrl(r){
        return r.repo ? 'https://github.com/' + r.repo + '/blob/main/' + r.path : this.hubUrl(r.path);
      },
      goRepos(){ window.__shell?.goRepos?.(); },
      aimsMd(){
        const d = this.aims;
        if (!d) return '';
        let lines = ['# Purpose', '', '## Mission', '', d.mission, '', '## Goals', '']
          .concat(d.goals.map((g, i) => (i + 1) + '. **' + g.name + '.** ' + g.gloss));
        if (d.initiatives?.length) {
          lines = lines.concat(['', '## Strategic Initiatives', ''])
            .concat(d.initiatives.map((init, i) => (i + 1) + '. **' + init.name + '.** ' + init.gloss));
        }
        return lines.concat(['', '## Reading', ''])
          .concat((d.reading || []).map(r => '- [' + (r.repo ? r.repo + ' ' : '') + r.path + '](' +
                  this.readingUrl(r) + ')' + (r.private ? ' (private)' : '') + ' ' + r.gloss))
          .concat(['']).join('\n');
      },
      copyAimsMd(){ return this.deckCopy(this.aimsMd(), 'Purpose copied as Markdown'); },

      async loadAims(){
        if (this.aims || this.aimsLoading) return;
        this.aimsLoading = true;
        this.aimsErr = '';
        try {
          const gh = new window.GH({ token: window.TOKEN, repo: this.hub(), ref: useRef() });
          const [raw, goals, initiatives, reading] = await Promise.all(
            [AIMS_MANIFEST, AIMS_GOALS, AIMS_INITIATIVES, AIMS_READING].map(p => gh.get(p).then(r => r.text)));
          const parsed = JSON.parse(raw);
          parsed.goals = window.Csv.rows(goals);
          parsed.initiatives = window.Csv.rows(initiatives);
          parsed.reading = window.Csv.rows(reading);
          if (!parsed.goals?.length) throw new Error('no goals in the registry');
          window.SourcePeek?.seed(this.peek(AIMS_MANIFEST), raw);
          window.SourcePeek?.seed(this.peek(AIMS_GOALS), goals);
          window.SourcePeek?.seed(this.peek(AIMS_INITIATIVES), initiatives);
          window.SourcePeek?.seed(this.peek(AIMS_READING), reading);
          this.aims = parsed;
        } catch (e) {
          this.aimsErr = 'Purpose sources failed to load: ' + (e?.message || e);
        } finally { this.aimsLoading = false; }
      },

      async loadPolicies(){
        if (this.policies || this.policiesLoading) return;
        this.policiesLoading = true;
        this.policiesErr = '';
        try {
          const gh = new window.GH({ token: window.TOKEN, repo: this.hub(), ref: useRef() });
          const [polText, topText] = await Promise.all([
            gh.get(POLICIES_MANIFEST).then(r => r.text),
            gh.get(POLICY_TOPICS_MANIFEST).then(r => r.text),
          ]);
          window.SourcePeek?.seed(this.peek(POLICIES_MANIFEST), polText);
          window.SourcePeek?.seed(this.peek(POLICY_TOPICS_MANIFEST), topText);
          this.policies = window.Csv.rows(polText);
          this.policyTopics = window.Csv.rows(topText);
        } catch (e) {
          this.policiesErr = 'Policies failed to load: ' + (e?.message || e);
        } finally { this.policiesLoading = false; }
      },

      get policyDomainGroups(){
        if (!this.policyTopics || !this.policies) return [];
        const count = this.policyCount('topic_id');
        const groups = new Map();
        for (const t of this.policyTopics) {
          if (!groups.has(t.domain)) groups.set(t.domain, []);
          groups.get(t.domain).push({ ...t, count: count[t.topic_id] || 0 });
        }
        return [...groups].map(([domain, topics]) => ({ domain, topics }));
      },

      get policyActiveTopicTitle(){
        if (this.policyTopic === 'all') return 'All topics';
        return (this.policyTopics || []).find(t => t.topic_id === this.policyTopic)?.title || this.policyTopic;
      },

      // Filter chips for one column: every value present, in the order the
      // properties registry declares, each with its count. A value with no row
      // gets no chip, so the strip never offers an empty answer.
      policyCount(col){
        const c = {};
        for (const p of this.policies || []) c[p[col]] = (c[p[col]] || 0) + 1;
        return c;
      },
      policyOpts(col, order, names){
        const c = this.policyCount(col);
        return [{ k: 'all', n: 'All', c: (this.policies || []).length },
          ...order.filter(v => c[v]).map(v => ({ k: v, n: names[v] || v, c: c[v] }))];
      },
      get policyLevelOpts(){
        return this.policyOpts('level', ['principle', 'policy', 'standard'],
          { principle: 'Principle', policy: 'Policy', standard: 'Standard' });
      },
      get policyIntentOpts(){
        return this.policyOpts('intent_class',
          ['user-mandate', 'dialogue-ratified', 'model-extrapolated', 'organic-precedent', 'unknown'],
          { 'user-mandate': 'User', 'dialogue-ratified': 'Ratified', 'model-extrapolated': 'Model',
            'organic-precedent': 'Precedent', unknown: 'Unknown' });
      },
      policyIntentBadge(v){
        return { 'user-mandate': 'badge-primary', 'dialogue-ratified': 'badge-success',
          'model-extrapolated': 'badge-warning', 'organic-precedent': 'badge-info' }[v] || 'badge-ghost';
      },
      policyStatusTip(v){
        return { lead: 'Not verified: its quote has not been checked against its source',
          sourced: 'Its quote is found verbatim in the document it cites',
          checked: 'Confirmed by a second reading' }[v] || '';
      },

      get filteredPolicies(){
        if (!this.policies) return [];
        const q = (this.policyQ || '').trim().toLowerCase();
        return this.policies.filter(p =>
          (this.policyTopic === 'all' || p.topic_id === this.policyTopic) &&
          (this.policyIntent === 'all' || p.intent_class === this.policyIntent) &&
          (this.policyLevel === 'all' || p.level === this.policyLevel) &&
          (!q || [p.statement, p.policy_id, p.topic_id, p.quoted, p.user_prompt_quote, p.canonical_doc]
            .some(v => (v || '').toLowerCase().includes(q))));
      },
      // Reading the primitives: the same deck the Docs and Distribution tabs open,
      // paging the two files this tab's header already names. Docked (the app
      // installs window.__deckPane), the prose sits BESIDE the cards, which is
      // the reading this tab wants and the one the Files view could not give:
      // navigating there is a route change, so the cards the doc explains were
      // gone by the time it arrived.
      //
      // BOTH FILES, because the pair IS this tab: SURFACING.md is authoritative
      // and surfacing.csv is its gated index, membership held both ways by
      // node/test/surfacing-manifest.test.mjs, and the cards below are that
      // index rendered. One swipe puts the two ends of that relation side by
      // side. It is also what makes the door honest: swipeDeck.entry's promise
      // is that a COLLECTION has a reader, and a counted title over one file
      // reads as a control that mis-describes itself.
      //
      // The manifest was left out on the first pass and the reason was the
      // rendition, not the relation: renderDoc had no CSV branch, so the index
      // arrived as wrapped raw text. It renders as a table now.
      get surfDeckFiles(){
        return [
          { path: SURF_DOC, title: 'SURFACING.md', subtitle: 'the primitives, injected into every session' },
          { path: SURF_MANIFEST, title: 'surfacing.csv', subtitle: 'the gated index behind these cards' },
          ...SURF_SIBLINGS.map(s => ({ path: s.path, title: s.path.split('/').pop(), subtitle: s.gloss })),
        ];
      },
      // ── A card, and the bullet it paraphrases ─────────────────────────────
      //
      // THE JOIN ALREADY EXISTED; nothing here invents it. docs/surfacing.csv's
      // `lead` IS the bold lead-in of the matching bullet in SURFACING.md, and
      // node/test/surfacing-manifest.test.mjs holds that both ways: every
      // bullet has a row, every row points at a real bullet. So the card and
      // the paragraph are already two renderings of one key, and this is the
      // key being followed rather than a correspondence being guessed at.
      //
      // NORMALIZED THE WAY THE GATE NORMALIZES, one trailing colon or full stop
      // off each side. The manifest carries "Reference is a link" and the doc
      // renders "Reference is a link.", and a match that failed on the stop
      // would fail on exactly the rows the gate was written to protect.
      leadKey(s){ return String(s || '').replace(/[:.]\s*$/, '').trim(); },

      // THE LIST IS LOOSE, and that single fact decides the selector. The
      // primitives are separated by blank lines, so marked emits
      // <li><p><strong>Lead.</strong> …</p></li> rather than <li><strong>….
      // Measured against the real rendered doc: `li > strong:first-child`
      // matched 0 of 22 and looked like a broken join; `li > p > strong` matches
      // 22 of 22. The tight form is kept as a second selector because a doc
      // whose bullets carry no blank line between them is the same document
      // written another way, and this should not break on that edit.
      findLead(box, lead){
        const want = this.leadKey(lead);
        for (const el of box.querySelectorAll('li > p > strong:first-child, li > strong:first-child'))
          if (this.leadKey(el.textContent) === want) return el.closest('li');
        return null;
      },
      findHeading(box, heading){
        for (const el of box.querySelectorAll('h2'))
          if (el.textContent.trim() === heading) return el;
        return null;
      },

      // The mark is kits/land.js's, not this tab's. It began as a tint and a
      // left rule of its own, which was a third answer to a question the estate
      // had already answered twice: mehrlander/home's submittal view lands a
      // reader on a block of an office document and on a rectangle of a PDF,
      // both in the same yellow, and this arrived at the same scroller walk
      // independently. The kit is that concept lifted out; what stays here is
      // WHICH element, which is the only part this tab knows.
      markLead(el){
        window.Land?.clear(el.closest('[data-deck-content]'));
        if (!window.Land) return el.scrollIntoView({ block: 'center' });
        window.Land.mark(el);
      },

      // WAIT FOR THE DOCK TO STOP MOVING THINGS. There is no event for it: the
      // host flips an attribute, CSS transitions the content pane's width, and
      // both the doc's line wrapping and the card grid reflow inside the new
      // one. Scrolling to a target mid-transition puts it where it was rather
      // than where it lands, which is how the tapped card ended up 500px below
      // the fold beside its own marked paragraph. Two identical readings of
      // position and width is the signal, since neither an event nor a fixed
      // delay is available and a delay long enough to be safe is a delay the
      // reader feels on every tap.
      async settled(el, ms = 800){
        const at = () => { const r = el.getBoundingClientRect();
                           return Math.round(r.top) + 'x' + Math.round(r.width); };
        let last = null;
        for (let waited = 0; waited <= ms; waited += 60) {
          const now = at();
          if (now === last) return;
          last = now;
          await new Promise(r => setTimeout(r, 60));
        }
      },

      // The slide's box, once its three async steps have finished. Polled
      // rather than awaited directly, because the deck decides when it calls
      // render() and the first call can land after open() returns.
      async slideBox(path, ms = 4000, token = this._deckToken){
        for (let waited = 0; waited <= ms; waited += 50) {
          const ready = this._slideReady?.get(path);
          if (ready?.token === token) return ready.promise;
          await new Promise(r => setTimeout(r, 50));
        }
        return null;
      },

      // DOCK IF THE HOST WILL, and open anyway if it will not. Docked, the card
      // and its paragraph sit side by side, which is the whole point. Below the
      // host's dock width there is no side by side to offer, and the honest
      // fallback is the deck over the cards, scrolled to the bullet: the reader
      // asked to be taken somewhere and is taken there.
      async openSurfAt(find, card){
        // Lazily, beside the deck: a tab whose cards are never tapped should
        // not pay for the landing.
        if (!window.Land && window.gh?.load) {
          try { await window.gh.load('kits/land.js'); } catch { /* fall through */ }
        }
        window.__deckPane?.('dock');
        await this.openSurfDeck();
        this._deck?.deck?.go?.(0);
        const box = await this.slideBox(SURF_DOC);
        if (!box) return;
        await this.settled(box);
        const el = find(box);
        if (el) this.markLead(el);
        else box.scrollTop = 0;   // the file is open and right; the anchor is not
        // AND BRING THE CARD BACK. Docking narrows the pane the cards are laid
        // out in, so they reflow under the reader and the one they just tapped
        // can end up below the fold, beside a paragraph it no longer faces.
        // `nearest` is the whole rule: it moves the page only when the card is
        // actually out of view, so a tap on a card already on screen scrolls
        // nothing.
        // The card gets the kit's scroll and NOT its tint: it is where the
        // reader already is, so lighting it would answer a question nobody
        // asked. `ifNeeded` keeps a card the reader can see from jumping under
        // the finger that tapped it.
        if (card) {
          await this.settled(card);
          window.Land?.mark(card, { ifNeeded: true, tint: false });
        }
      },
      // Two doors, one opener. A card's title lands on the bullet it
      // paraphrases; a region door lands on the h2 that opens that region.
      showPrimitive(p, card){ return this.openSurfAt(box => this.findLead(box, p.lead), card); },
      // A sibling is its own file, so the door opens the deck on it rather
      // than scrolling SURFACING.md to a heading that no longer exists there.
      showRegion(r){
        const files = this.surfDeckFiles;
        const i = files.findIndex(f => f.path === r.path);
        return i < 0 ? null : this.openFileDeck(files, i, {
          icon: 'ph-megaphone', key: 'surfacing', context: 'Surfacing',
          label: (f) => ({ title: f.title, subtitle: f.subtitle, icon: 'ph-file-text' }),
        });
      },

      openSurfDeck(){
        const files = this.surfDeckFiles;
        return this.openFileDeck(files, 0, {
          icon: 'ph-megaphone', key: 'surfacing', context: 'Surfacing',
          label: (f) => ({ title: f.title, subtitle: f.subtitle, icon: 'ph-file-text' }),
        });
      },
      async loadSurf(){
        if (this.surf || this.surfLoading) return;
        this.surfLoading = true;
        this.surfErr = '';
        try {
          const gh = new window.GH({ token: window.TOKEN, repo: this.hub(), ref: useRef() });
          const raw = (await gh.get(SURF_MANIFEST)).text;
          const parsed = { primitives: window.Csv.rows(raw), regions: SURF_SIBLINGS };
          if (!parsed.primitives.length) throw new Error('no primitives in the index');
          window.SourcePeek?.seed(this.peek(SURF_MANIFEST), raw);
          // The doors are declared, so they cost no second fetch and cannot be
          // lost to one failing. They were read off the doc until 2026-09-10.
          this.surf = parsed;
        } catch (e) {
          this.surfErr = 'Surfacing manifest load failed: ' + (e?.message || e);
        } finally { this.surfLoading = false; }
      },

      // ── Docs ──────────────────────────────────────────────────────────────
      // Same lazy shape as loadRoutes: fetched on first open of the tab.
      // ── Doc growth: the trend behind the `words` column ───────────────────
      // A sparkline is normalized to the FILE's own range, not the registry's,
      // so it reports shape (did this document grow, hold, or get cut) and
      // never size. Size is already the number beside it, and one mark cannot
      // carry both without lying about one of them.
      growthOf(path){ return this.docRepo ? null : (this.docGrowth?.get(path) || null); },
      spark(path){
        const g = this.growthOf(path);
        if (!g) return '';
        const lo = Math.min(...g.w), hi = Math.max(...g.w), span = hi - lo || 1;
        return g.w.map((v, i) =>
          (i / (g.w.length - 1) * 44).toFixed(1) + ',' +
          (11 - (v - lo) / span * 10).toFixed(1)).join(' ');
      },
      growthDelta(path){
        const g = this.growthOf(path);
        if (!g || !g.delta) return '';
        return (g.delta > 0 ? "+" : "\u2212") + kw(Math.abs(g.delta));
      },
      growthHint(path){
        const g = this.growthOf(path);
        if (!g) return '';
        const d = g.delta;
        return d === 0 ? 'unchanged since ' + g.from
          : (d > 0 ? 'grew ' : 'shrank ') + Math.abs(d).toLocaleString() +
            ' words since ' + g.from;
      },
      // Net movement across the docs the payload covers, which is the docs/
      // registry minus anything added since the payload was last regenerated.
      get docGrowthTotal(){
        if (!this.docGrowth || !this.docsReg || this.docRepo) return null;
        let delta = 0, n = 0, from = '';
        for (const d of this.docsReg.documents) {
          const g = this.growthOf(d.path);
          if (!g) continue;
          delta += g.delta; n++;
          if (!from || g.from < from) from = g.from;
        }
        return n ? { delta, n, from } : null;
      },
      folderGrowth(dir){
        if (!this.docGrowth || !this.docsReg || this.docRepo) return 0;
        let delta = 0;
        for (const d of this.docsReg.documents) {
          if (d.path !== dir && !d.path.startsWith(dir + '/')) continue;
          delta += this.growthOf(d.path)?.delta || 0;
        }
        return delta;
      },

      // ── Data, federated ───────────────────────────────────────────────────
      // One inventory per declaration. Refresh follows the config crawl; the
      // request number keeps an older read from restoring obsolete sources.
      dataCensus: null,
      dataLoading: false,
      dataErr: '',
      dataScope: '',
      dataQ: '',
      dataLimit: 200,
      _dataRun: 0,
      get dataNeedsRetry(){
        return !!this.dataErr || (this.dataCensus || []).some(s => s.state === 'unavailable');
      },
      refreshDataCensus(){
        this._dataRun++;
        this.dataCensus = null;
        this.dataLoading = false;
        this.dataErr = '';
        this.dataLimit = 200;
        if (this.mapTab === 'data') return this.loadDataCensus();
      },
      async loadDataCensus(force = false){
        if (!force && (this.dataLoading || (this.dataCensus && !this.dataNeedsRetry))) return;
        const run = ++this._dataRun;
        const token = window.TOKEN, hubRepo = this.hub(), ref = useRef();
        const authed = this.hasToken();
        // This loader already caches successful results. An actual read must
        // bypass both GH's memo and HTTP caching, especially after Refresh.
        const fresh = window.GH.FRESH;
        this.dataLoading = true;
        this.dataErr = '';
        const configs = new Map(), errors = [];
        try {
          try {
            const hub = new window.GH({ token, repo: hubRepo, ref });
            configs.set(hubRepo, { config: JSON.parse((await hub.get('.web-tools.json', fresh)).text), ref });
          } catch (e) { errors.push('Hub declaration unavailable: ' + (e?.message || e)); }
          if (authed) {
            try {
              const path = window.RepoConfigCache?.CACHE_PATH || 'state/configs.json';
              // The config cache is live registry state, written on main.
              const reg = new window.GH({ token, repo: this.registry(), ref: 'main' });
              const cache = JSON.parse((await reg.get(path, fresh)).text);
              // Each census file is only displayed, so it follows the selection.
              for (const [repo, entry] of Object.entries(cache?.repos || {})) {
                if (repo !== hubRepo && entry?.config?.estate === true)
                  configs.set(repo, { config: entry.config, ref: selRef(repo, entry.config?.data?.census) });
              }
            } catch (e) { errors.push('Estate declarations unavailable: ' + (e?.message || e)); }
          }
          if (run !== this._dataRun) return;
          const sources = [...configs].map(([repo, entry]) => {
            const path = entry.config?.data?.census;
            return { repo, ref: entry.ref, path,
                     state: path === undefined ? 'undeclared' : 'loading', files: [] };
          }).sort((a, b) => (a.repo === hubRepo ? -1 : b.repo === hubRepo ? 1 : 0)
                             || a.repo.localeCompare(b.repo));
          await Promise.all(sources.filter(s => s.state === 'loading').map(async s => {
            try {
              if (!this.validDataPath(s.path)) throw new Error('Invalid census path');
              const gh = new window.GH({ token, repo: s.repo, ref: s.ref });
              const raw = (await gh.get(s.path, fresh)).text;
              // Census fields are single-line: the generator JSON-encodes
              // headers, including embedded newlines. Csv.rows trims values,
              // which would change a valid filename beginning with a space.
              const lines = raw.split(/\r?\n/).filter(line => line !== '');
              const heading = window.Csv.parseLine(lines.shift() || '');
              if (heading.length !== 5 || heading.join(',') !== 'path,rows,columns,bytes,headers')
                throw new Error('Unexpected census columns');
              const seen = new Set();
              s.files = lines.map(line => {
                const cells = window.Csv.parseLine(line);
                const [path, rows, columns, bytes, json] = cells;
                if (cells.length !== 5 || !this.validDataPath(path) || seen.has(path))
                  throw new Error('Invalid or duplicate CSV path');
                seen.add(path);
                const headers = JSON.parse(json);
                const measurements = [rows, columns, bytes];
                const numbers = measurements.map(Number);
                if (!Array.isArray(headers) || !headers.every(h => typeof h === 'string') ||
                    measurements.some(n => !/^\d+$/.test(n)) ||
                    numbers.some(n => !Number.isSafeInteger(n)) || headers.length !== numbers[1])
                  throw new Error('Invalid CSV measurements');
                return { repo: s.repo, ref: s.ref, path, rows: numbers[0],
                         columns: numbers[1], bytes: numbers[2], headers };
              });
              if (!seen.has(s.path)) throw new Error('Census does not include itself');
              s.state = s.files.length === 1 ? 'empty' : 'declared';
            } catch (e) { s.state = 'unavailable'; s.error = e?.message || String(e); s.files = []; }
          }));
          if (run !== this._dataRun) return;
          this.dataCensus = sources;
          this.dataErr = errors.join(' · ');
          if (this.dataScope && !sources.some(s => s.repo === this.dataScope)) this.dataScope = '';
        } finally {
          if (run === this._dataRun) this.dataLoading = false;
        }
      },
      validDataPath(path){
        return typeof path === 'string' && /\.csv$/i.test(path) &&
          !/^[a-z]:/i.test(path) && !/[\\\r\n]/.test(path) &&
          path.split('/').every(part => part && part !== '.' && part !== '..');
      },
      get dataSources(){
        return (this.dataCensus || []).filter(s => !this.dataScope || s.repo === this.dataScope);
      },
      get dataMatches(){
        const q = this.dataQ.trim().toLowerCase();
        return this.dataSources.flatMap(s => s.files.filter(f => !q ||
          s.repo.toLowerCase().includes(q) || f.path.toLowerCase().includes(q) ||
          f.headers.some(h => h.toLowerCase().includes(q))));
      },
      get dataFolders(){
        const groups = new Map();
        for (const f of this.dataMatches.slice(0, this.dataLimit)) {
          const folder = f.path.includes('/') ? f.path.slice(0, f.path.lastIndexOf('/')) : '/';
          const key = f.repo + ':' + folder;
          if (!groups.has(key)) groups.set(key, { repo: f.repo, folder, files: [] });
          groups.get(key).files.push(f);
        }
        return [...groups.values()];
      },
      dataStateLabel(s){
        if (s.state === 'undeclared') return 'No declaration';
        if (s.state === 'unavailable') return 'Unavailable';
        if (s.state === 'empty') return 'Declared · no other CSVs';
        return 'Declared · ' + (s.files.length - 1) + ' other CSVs';
      },
      dataSize(n){
        return n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB'
          : (n / 1048576).toFixed(1) + ' MB';
      },
      async openDataFile(f){
        const shell = window.__shell;
        if (!shell) return;
        await shell.ensureBrowser(f.repo, f.ref);
        const browser = Alpine.store('browser');
        if (browser.repo !== f.repo || browser.ref !== f.ref) {
          window.Alpine?.store?.('toast')?.('warning',
            'Could not open ' + f.repo + '@' + f.ref + ' in Files', 'alert-warning', 4000);
          return;
        }
        await shell.openFile(f.path);
      },

      // ── Growth, federated ─────────────────────────────────────────────────
      // Every repo declaring a `growth` path in its own .web-tools.json, read
      // from the same crawled config cache the Skills tab's estate half uses.
      // The hub is INCLUDED, unlike there: skills excludes it because the hub's
      // committed set is the plugin and would double-count, while here the hub
      // is simply one more corpus with a payload.
      //
      // Federation is what retired the two app views. The page was promoted by
      // web-tools and by home, each carrying a different `?src=`, and the
      // sidebar renders a promoted page as label plus icon, so the estate's nav
      // said "Doc Growth" twice with nothing to choose between. Two corpora is
      // one instrument with a subject, which is a control on a tab.
      //
      // Token-gated and silent on failure, the same posture as the estate
      // skills: the hub's payload is a public fetch, so a reader with no token
      // still gets the chart, minus the selector.
      estateGrowth: null,
      growthRepo: '',
      async loadEstateGrowth(){
        if (this.estateGrowth || !this.hasToken()) return;
        try {
          const path = window.RepoConfigCache?.CACHE_PATH || 'state/configs.json';
          const reg = new window.GH({ token: window.TOKEN, repo: this.registry(), ref: 'main' });
          const cache = JSON.parse((await reg.get(path)).text);
          const rows = [];
          for (const [repo, e] of Object.entries(cache?.repos || {})) {
            const declared = e?.config?.growth;
            if (typeof declared !== 'string' || !declared.trim()) continue;
            rows.push({ repo, short: repo.split('/').pop(), path: declared.trim() });
          }
          // The hub first, then the rest by name: it is the corpus this view
          // opens on, so the control reads in the order it selects.
          rows.sort((a, b) => (a.repo === this.hub() ? -1 : b.repo === this.hub() ? 1 : 0)
                              || a.short.localeCompare(b.short));
          this.estateGrowth = rows;
        } catch { this.estateGrowth = null; }
      },
      // The selected corpus, or the hub when nothing is selected and whenever
      // the selection names a repo the cache no longer carries.
      get growthSubject(){
        const rows = this.estateGrowth || [];
        return rows.find(r => r.repo === this.growthRepo)
            || rows.find(r => r.repo === this.hub())
            || null;
      },
      // Under ?use= Pages still serves the page file from main, so a ref has to
      // go the long way round through the toss renderer. Without one the direct
      // path is cheaper. The hub's payload is the page's own built-in default,
      // so selecting it needs no ?src= and no token; every other corpus is
      // addressed, and the page reads it through the viewer's stored token.
      get growthUrl(){
        const ref = useRef();
        const sub = this.growthSubject;
        const q = sub && sub.repo !== this.hub() ? '?src=' + sub.repo + ':' + sub.path : '';
        return ref && ref !== 'main'
          ? '../pages/toss-render.html#gh=' + this.hub() + '@' + ref + ':pages/doc-growth.html' + q
          : '../pages/doc-growth.html' + q;
      },
      // ── Context ──────────────────────────────────────────────────────
      // The public half renders for anyone; the private half and the session
      // tally need a token. Both reads are separate and non-fatal, so a
      // missing private file or cache shows as a line saying so rather than
      // hiding the public circles.
      async loadContextReg(){
        if (this.ctxReg || this.ctxLoading) return;
        this.ctxLoading = true;
        this.ctxErr = '';
        try {
          const gh = new window.GH({ token: window.TOKEN, repo: this.hub(), ref: useRef() });
          const [src, top] = await Promise.all([gh.get(CTX_MANIFEST), gh.get(CTX_TOPICS)]);
          const rows = window.Csv.rows(src.text).map(r => this.ctxRow(r, this.hub()));
          const topics = window.Csv.rows(top.text);
          if (!rows.length) throw new Error('no context rows');
          window.SourcePeek?.seed(this.peek(CTX_MANIFEST), src.text);
          this.ctxReg = { rows, topics };
        } catch (e) {
          this.ctxErr = 'Context registry load failed: ' + (e?.message || e);
        } finally { this.ctxLoading = false; }
        this.loadContextPrivate();
        this.loadDocReads();
        this.loadSkillsReg();
      },
      async loadContextPrivate(){
        if (this.ctxPrivate || !this.hasToken()) return;
        try {
          const reg = new window.GH({ token: window.TOKEN, repo: this.registry(), ref: ctxPrivRef() });
          const raw = (await reg.get(CTX_PRIVATE)).text;
          this.ctxPrivate = window.Csv.rows(raw).map(r => this.ctxRow(r, this.registry(), true));
        } catch (e) {
          this.ctxPrivate = [];
          this.ctxPrivateErr = 'The private half did not load (' + CTX_PRIVATE + ' in ' + this.registry() + '): ' + (e?.message || e);
        }
      },
      // One shape for both halves. topics splits once here; the source link
      // resolves against the row's own repo, since a private row can name a
      // file in home or the registry and the peek has to fetch it there.
      ctxRow(r, fromRepo, priv = false){
        return { ...r, priv, topicList: String(r.topics || '').split(';').map(s => s.trim()).filter(Boolean) };
      },
      // The deck key for the file a row names, or '' for a folder or a source
      // that is no file. A path may carry #section, which the deck lands on.
      ctxFile(r){
        if (!r.repo || !r.path) return '';
        const file = r.path.split('#')[0];
        if (!/\.\w+$/.test(file.split('/').pop())) return '';
        return r.repo === this.hub() ? file : r.repo + '@main:' + file;
      },
      // One deck over every file the registry names, so a reader swipes from
      // one source to the next. A file several rows share (account.md, the
      // setup script) is one slide, titled by its name rather than one row's.
      openCtxDeck(r){
        const files = [], at = new Map();
        for (const x of this.ctxAll) {
          const k = this.ctxFile(x);
          if (!k) continue;
          if (at.has(k)) { at.get(k).shared = true; continue; }
          const f = { path: k, item: x.item, repo: x.repo, file: x.path.split('#')[0], shared: false };
          at.set(k, f); files.push(f);
        }
        return this.openFileDeck(files, files.findIndex(f => f.path === this.ctxFile(r)), {
          icon: 'ph-circles-three', key: 'context', context: 'Context',
          label: f => ({ title: f.shared ? f.file.split('/').pop() : f.item, subtitle: f.repo + ' · ' + f.file }),
          hash: r.path.split('#')[1] || '',
        });
      },
      openCtxRegistry(i){
        const files = [{ path: CTX_MANIFEST, t: 'Context sources' }, { path: CTX_TOPICS, t: 'Context topics' }];
        if (this.ctxPrivate?.length) files.push({ path: this.registry() + '@' + ctxPrivRef() + ':' + CTX_PRIVATE, t: 'Private sources' });
        return this.openFileDeck(files, i, { icon: 'ph-table', key: 'context:registry', context: 'Context registry',
          label: f => ({ title: f.t, subtitle: f.path }) });
      },
      get ctxAll(){ return [...(this.ctxReg?.rows || []), ...(this.ctxPrivate || [])]; },
      get ctxCircleDefs(){ return CTX_CIRCLES; },
      get ctxCircleCounts(){
        const all = this.ctxAll;
        return CTX_CIRCLES.map(c => ({ ...c, n: all.filter(r => r.circle === c.key).length }));
      },
      get ctxCircles(){
        const all = this.ctxAll;
        return CTX_CIRCLES
          .filter(c => !this.ctxCircle || this.ctxCircle === c.key)
          .map(c => ({ ...c, rows: all.filter(r => r.circle === c.key) }));
      },
      // Whether the private half is the reason a circle is empty: said on the
      // circle itself, since an empty account circle otherwise reads as an
      // account that supplies nothing.
      ctxGap(c){
        return !c.rows.length && c.priv && !this.hasToken() ? 'Needs a token.' : '';
      },
      // The row's delivery facts as one plain phrase: how, when, and which
      // sessions. The facts that make a source hard to see or fix get badges
      // of their own; these three only describe.
      ctxMeta(r){
        const how = { instructions: 'instructions', 'skill-listing': 'skill listing', skill: 'skill', hook: 'hook',
          settings: 'settings', install: 'install', tool: 'tool results', message: 'message', continuity: 'carried forward', none: 'configures only' }[r.arrives] || r.arrives;
        const when = { build: 'at environment build', start: 'at session start', invoke: 'when invoked', turn: 'every turn', event: 'on an event' }[r.when] || r.when;
        const reach = { every: 'every session', checkout: 'when checked out', root: 'only when the repo is the root', invoke: 'when invoked', pr: 'with a PR open' }[r.reach] || r.reach;
        return [how, when, reach].join(' · ');
      },
      // The When lens: one row per circle, one cell per moment.
      get ctxMomentDefs(){ return CTX_MOMENTS; },
      get ctxWhen(){
        const all = this.ctxAll;
        return CTX_CIRCLES.map(c => {
          const mine = all.filter(r => r.circle === c.key);
          return { ...c, n: mine.length, rows: mine,
            cells: CTX_MOMENTS.map(m => ({ ...m, rows: mine.filter(r => r.when === m.key) })) };
        });
      },
      ctxEvidence(r){ return CTX_EVIDENCE[r.evidence] || '?'; },
      ctxWhenTone(r){
        const lit = this.ctxTopic && r.topicList.includes(this.ctxTopic);
        const tone = lit ? 'border-primary bg-primary/10 text-primary'
          : this.ctxTopic ? 'border-base-300 text-base-content/40' : 'border-base-300 hover:border-primary/50 hover:text-primary';
        return tone + (r.status === 'retiring' ? ' border-dashed' : '');
      },
      get ctxWhenSummary(){
        const lit = this.ctxAll.filter(r => r.topicList.includes(this.ctxTopic));
        const at = CTX_MOMENTS.filter(m => lit.some(r => r.when === m.key)).map(m => m.label.toLowerCase());
        return lit.length + (lit.length === 1 ? ' source' : ' sources') + (at.length ? ', arriving at ' + at.join(', ') : '');
      },
      // Topics with two or more sources, ignoring the current pick.
      get ctxTopicsLive(){
        const all = this.ctxAll;
        return (this.ctxReg?.topics || []).filter(t => all.filter(r => r.topicList.includes(t.topic)).length >= 2);
      },
      ctxTopicOf(key){ return (this.ctxReg?.topics || []).find(t => t.topic === key) || null; },
      ctxTopicLabel(key){ return this.ctxTopicOf(key)?.label || key; },
      ctxVerdict(v){ return CTX_VERDICTS[v] || { tone: 'badge-ghost', order: 9, gloss: '' }; },
      // The overlap lens. A topic is listed when two or more sources speak to
      // it; the verdict is authored in the topics file, and the members are
      // derived from the rows, so a new row joins its topics without anyone
      // editing the topic.
      get ctxOverlaps(){
        const all = this.ctxAll;
        return (this.ctxReg?.topics || [])
          .map(t => {
            const rows = all.filter(r => r.topicList.includes(t.topic));
            const circles = new Set(rows.map(r => r.circle));
            return { ...t, rows, circles: circles.size, live: rows.filter(r => r.status !== 'retiring').length };
          })
          .filter(t => t.rows.length >= 2 && (!this.ctxTopic || this.ctxTopic === t.topic))
          .sort((a, b) => this.ctxVerdict(a.verdict).order - this.ctxVerdict(b.verdict).order || b.rows.length - a.rows.length);
      },
      get ctxOverlapsAll(){ const all = this.ctxAll; return (this.ctxReg?.topics || []).filter(tp => all.filter(r => r.topicList.includes(tp.topic)).length >= 2).length; },
      ctxCircleLabel(key){ return CTX_CIRCLES.find(c => c.key === key)?.label || key; },
      openCtxTopic(key){ this.ctxTopic = key; this.ctxLens = 'overlaps'; },
      // The tally tail on a row, from the session store: presence for an
      // instruction file, invocations for a skill. Blank when the row has no
      // tally key or the cache is absent, so "not measured" never reads as zero.
      ctxTally(r){
        const k = String(r.tally || '');
        if (k.startsWith('startup:')) {
          const a = this.docStartup?.[k.slice(8)];
          return a ? a.sessions + ' sessions' : (this.docStartup ? 'in no recorded session' : '');
        }
        if (k.startsWith('skill:')) {
          const u = this.skillUses?.[k.slice(6)];
          return u ? 'invoked in ' + u.sessions + ' sessions' : (this.skillUses ? 'never invoked' : '');
        }
        return '';
      },
      // The measured lens: what the session records say reached sessions,
      // joined back to the registry by tally key. A path in the tally that no
      // row claims is the finding: a source nobody has accounted for.
      // A file not seen in the week before the newest record is history, not
      // a gap: the retired injector's documents stay in the tally with their
      // old counts, and flagging them "not in the registry" would read as a
      // current hole. They dim and say when they were last seen instead.
      get ctxMeasuredStartup(){
        const by = this.docStartup || {};
        const claimed = new Map(this.ctxAll.filter(r => r.tally).map(r => [r.tally, r]));
        const newest = Math.max(0, ...Object.values(by).map(a => Date.parse(a.last) || 0));
        return Object.values(by)
          .map(a => ({ ...a, row: claimed.get('startup:' + a.path) || null,
                       stale: newest - (Date.parse(a.last) || 0) > 7 * 864e5 }))
          .sort((x, y) => (x.stale - y.stale) || (y.sessions - x.sessions));
      },
      // Plugin skills are marked against the skills manifest, which lists
      // exactly what the plugin carries; anything else fired from an account
      // upload or a repo's own .claude/skills/.
      get ctxMeasuredSkills(){
        const plugin = new Set((this.skillsReg || []).map(s => s.name));
        return Object.values(this.skillUses || {})
          .map(u => ({ ...u, plugin: plugin.has(u.path) }))
          .sort((x, y) => y.sessions - x.sessions)
          .slice(0, 24);
      },
      ctxDate(iso){ return String(iso || '').slice(0, 10).replace(/-/g, '\u2011'); },

      // Spectra lens: Scope x Discretion delivery matrix, parallel axes, and environment filters
      get ctxSpectraScopes(){
        return [
          { id: 'universal', label: 'Universal', gloss: 'Every session under account / machine' },
          { id: 'host-plugin', label: 'Host / Plugin', gloss: 'Shared tools and ecosystem' },
          { id: 'repo', label: 'Repo-Specific', gloss: 'Checked-out codebase / PR' },
          { id: 'task-turn', label: 'Task / Turn', gloss: 'Active conversation step / symbol' }
        ];
      },
      get ctxSpectraDiscretions(){
        return [
          { id: 'injected', label: 'Forced Injected', short: 'Injected', gloss: 'Platform mandatory, zero choice', cost: 'Highest token burden', badgeClass: 'badge-error', dotClass: 'bg-error' },
          { id: 'prodded', label: 'System-Prodded', short: 'Prodded', gloss: 'Hook advises, model accepts', cost: '1-line directive', badgeClass: 'badge-info', dotClass: 'bg-info' },
          { id: 'reactive', label: 'Event-Reactive', short: 'Reactive', gloss: 'Idles until condition met', cost: 'Zero idle cost', badgeClass: 'badge-warning', dotClass: 'bg-warning' },
          { id: 'pulled', label: 'User / Model Pulled', short: 'Pulled', gloss: 'Explicit on-demand invocation', cost: 'Targeted pay-on-use', badgeClass: 'badge-success', dotClass: 'bg-success' }
        ];
      },
      get ctxSpectraFilteredDiscretions(){
        if (!this.ctxSpectraFilterDiscretion) return this.ctxSpectraDiscretions;
        return this.ctxSpectraDiscretions.filter(d => d.id === this.ctxSpectraFilterDiscretion);
      },
      get ctxSpectraAxes(){
        return [
          {
            id: 'scope',
            title: 'Scope',
            question: 'What boundary does this context govern?',
            poleLeft: 'Universal (Global)',
            poleRight: 'Ephemeral (Turn)',
            stops: ['Universal', 'Host / Plugin', 'Repo-Bound', 'Task / Turn']
          },
          {
            id: 'discretion',
            title: 'Discretion',
            question: 'Who decides to load the material into context?',
            poleLeft: 'Platform Mandatory',
            poleRight: 'Autonomous Choice',
            stops: ['Forced Injected', 'Event-Reactive', 'System-Prodded', 'User / Model Pulled']
          },
          {
            id: 'trigger',
            title: 'Trigger',
            question: 'At what point in execution does the payload arrive?',
            poleLeft: 'Build / Boot',
            poleRight: 'On Demand',
            stops: ['Daemon / Build', 'Session Start', 'Event Juncture', 'Per Turn', 'On Demand']
          }
        ];
      },
      get ctxSpectraMechanisms(){
        return [
          {
            id: 'chatgpt-custom',
            title: 'Custom Instructions & Memory',
            short: 'Custom Inst.',
            env: 'chatgpt',
            icon: 'ph-chat-circle-dots',
            file: 'chatgpt.com/settings/custom-instructions',
            scopeId: 'universal',
            scopeLabel: 'Universal (Account)',
            scopeGloss: 'Pre-pended to system prompt across all ChatGPT chat sessions.',
            discretionId: 'injected',
            discretionLabel: 'Forced Injected',
            discretionGloss: 'Zero model discretion: automatically included in conversation preamble.',
            trigger: 'Session Start',
            triggerGloss: 'Injected at session initialization.',
            evidence: '●',
            tokenCost: '~100 tokens per message',
            gloss: 'Account-level custom instructions and biographical memory profile.',
            rationale: 'Ensures user persona, style preferences, and profile persist across sessions automatically.',
            topics: ['writing-rules']
          },
          {
            id: 'sys-prompt',
            title: 'Personal Preferences & Preamble',
            short: 'Prefs',
            env: 'claude',
            icon: 'ph-user',
            file: 'claude.ai/settings/preferences',
            scopeId: 'universal',
            scopeLabel: 'Universal (Account)',
            scopeGloss: 'Injected into every single prompt across all repositories.',
            discretionId: 'injected',
            discretionLabel: 'Forced Injected',
            discretionGloss: 'Zero model discretion: baked into system prompt preamble.',
            trigger: 'Session Start',
            triggerGloss: 'Present from turn 1 before any user interaction.',
            evidence: '●',
            tokenCost: '~150 tokens every turn',
            gloss: 'User-wide directives and core identity instructions.',
            rationale: 'Ensures base persona and formatting rules hold universally without needing per-repo configuration.',
            topics: ['writing-rules']
          },
          {
            id: 'skill-manifest',
            title: 'Plugin Skill Listing',
            short: 'Manifest',
            env: 'claude',
            icon: 'ph-list-checks',
            file: 'skills/manifest.csv',
            scopeId: 'host-plugin',
            scopeLabel: 'Host / Plugin',
            scopeGloss: 'Reaches every session where the portable plugin is installed.',
            discretionId: 'injected',
            discretionLabel: 'Forced Injected',
            discretionGloss: 'Short descriptions are mandatory so model knows tools exist.',
            trigger: 'Session Start',
            triggerGloss: 'Injected during plugin session initialization.',
            evidence: '●',
            tokenCost: '1 line per skill (~25 tokens)',
            gloss: 'Concise 1-line stubs defining available skills.',
            rationale: 'Provides awareness without payload. The agent knows a tool exists without paying for full instructions upfront.',
            topics: ['context-cost', 'house-style']
          },
          {
            id: 'antigravity-state',
            title: 'Antigravity Host State',
            short: 'AGYState',
            env: 'gemini',
            icon: 'ph-cpu',
            file: '~/.gemini/antigravity/antigravity_state.pbtxt',
            scopeId: 'universal',
            scopeLabel: 'Universal (Host Machine)',
            scopeGloss: 'Governs all Antigravity agent interactions on this workstation.',
            discretionId: 'injected',
            discretionLabel: 'Forced Injected',
            discretionGloss: 'Supplied automatically by the language_server daemon.',
            trigger: 'Daemon / Build',
            triggerGloss: 'Established when language_server_windows_x64.exe boots.',
            evidence: '●',
            tokenCost: 'Engine internal',
            gloss: 'Machine installation UUID, loopback RPC port, and host config.',
            rationale: 'Establishes device identity and isolates the desktop GUI from headless background workers.',
            topics: []
          },
          {
            id: 'hook-refresh',
            title: 'Plugin Refresher',
            short: 'Refresher',
            env: 'claude',
            icon: 'ph-arrows-clockwise',
            file: 'skills/hooks/refresh-plugin.sh',
            scopeId: 'host-plugin',
            scopeLabel: 'Host / Plugin',
            scopeGloss: 'Ecosystem maintenance hook.',
            discretionId: 'injected',
            discretionLabel: 'Forced Injected',
            discretionGloss: 'Runs automatically on session start via dispatcher.',
            trigger: 'Session Start',
            triggerGloss: 'Executes before first turn to pin main.',
            evidence: '●',
            tokenCost: '0 tokens (runs silently in background)',
            gloss: 'Moves the plugin pin to main tip.',
            rationale: 'Keeps checkout tools current without manual developer intervention.',
            topics: ['plugin-currency']
          },
          {
            id: 'invoke-default',
            title: 'Conventions Directive',
            short: 'invoke-default',
            env: 'claude',
            icon: 'ph-compass',
            file: 'skills/hooks/invoke-default.sh',
            scopeId: 'host-plugin',
            scopeLabel: 'Host / Plugin',
            scopeGloss: 'Universal delivery prod across the estate.',
            discretionId: 'prodded',
            discretionLabel: 'System-Prodded',
            discretionGloss: 'Hook prints a directive; model executes /portable:default.',
            trigger: 'Session Start',
            triggerGloss: 'Fires at session startup and again after compaction.',
            evidence: '●',
            tokenCost: '1 directive line until invoked',
            gloss: 'Dynamic prod to load SURFACING.md and QUALIFIED-WRITING.md.',
            rationale: 'Replaces static monolithic imports with a verified load directive, preventing stale cached doctrine.',
            topics: ['conventions-delivery', 'writing-rules']
          },
          {
            id: 'event-guards',
            title: 'Safety & Quality Guards',
            short: 'Guards',
            env: 'claude',
            icon: 'ph-shield',
            file: 'skills/hooks/*-guard.sh',
            scopeId: 'host-plugin',
            scopeLabel: 'Host / Plugin',
            scopeGloss: 'Enforced across all checkouts adopting the plugin.',
            discretionId: 'reactive',
            discretionLabel: 'Event-Reactive',
            discretionGloss: 'Fires only when an edit or commit touches guarded invariants.',
            trigger: 'Event Juncture',
            triggerGloss: 'Executes immediately on PreToolUse or commit-msg.',
            evidence: '●',
            tokenCost: '0 idle tokens; ~60 tokens only when triggered',
            gloss: 'reading-column-guard, send-later-guard, and governing-docs warner.',
            rationale: 'Zero idle context cost. Sits completely dormant until an edit or commit violates a known failure pattern.',
            topics: ['askuserquestion', 'house-style', 'doc-governance']
          },
          {
            id: 'project-settings',
            title: 'Project Settings',
            short: 'Settings',
            env: 'claude',
            icon: 'ph-gear',
            file: '.claude/settings.json',
            scopeId: 'repo',
            scopeLabel: 'Repo-Specific',
            scopeGloss: 'Read only when this repository is the session root.',
            discretionId: 'injected',
            discretionLabel: 'Forced Injected',
            discretionGloss: 'Platform injects settings into the root session harness.',
            trigger: 'Session Start',
            triggerGloss: 'Established during workspace initialization.',
            evidence: '●',
            tokenCost: 'Harness internal',
            gloss: 'Tool permissions, AskUserQuestion denials, and enabled extensions.',
            rationale: 'Deterministic environment controls applied at repository root.',
            topics: ['askuserquestion']
          },
          {
            id: 'repo-claude',
            title: 'Repository Contract',
            short: 'CLAUDE.md',
            env: 'claude',
            icon: 'ph-book-open',
            file: 'CLAUDE.md',
            scopeId: 'repo',
            scopeLabel: 'Repo-Specific',
            scopeGloss: 'Bounded strictly to this git checkout.',
            discretionId: 'injected',
            discretionLabel: 'Forced Injected',
            discretionGloss: 'Platform loads it automatically when checkout is root.',
            trigger: 'Session Start',
            triggerGloss: 'Loaded at session start or directory navigation.',
            evidence: '●',
            tokenCost: 'Varies by repo (~1,500 - 3,000 tokens)',
            gloss: 'Repository-specific build commands, test suites, and invariants.',
            rationale: 'Prototypical repo level: keeps repo-specific tooling isolated so commands never bleed into other projects.',
            topics: ['conventions-delivery', 'showing']
          },
          {
            id: 'pr-course',
            title: 'Surfacing Course',
            short: 'PRCourse',
            env: 'claude',
            icon: 'ph-git-pull-request',
            file: 'skills/default/surfacing-course.md',
            scopeId: 'host-plugin',
            scopeLabel: 'Host / Plugin',
            scopeGloss: 'Ships in the portable plugin; applies once a pull request is open.',
            discretionId: 'reactive',
            discretionLabel: 'Event-Reactive',
            discretionGloss: 'Idles until pr-subscribe-hint detects an open pull request.',
            trigger: 'Event Juncture',
            triggerGloss: 'Delivered at the exact moment a PR is opened.',
            evidence: '●',
            tokenCost: '0 tokens before PR; ~1,200 tokens once opened',
            gloss: 'Step-by-step guide for PR description and review upkeep.',
            rationale: 'Eliminates premature cognitive load by keeping review procedures dormant until work is actually published.',
            topics: ['pr-lifecycle']
          },
          {
            id: 'hook-session-record',
            title: 'Session Recorder',
            short: 'Recorder',
            env: 'claude',
            icon: 'ph-floppy-disk',
            file: 'skills/hooks/session-record.sh',
            scopeId: 'host-plugin',
            scopeLabel: 'Host / Plugin',
            scopeGloss: 'Ships in the portable plugin as a hook.',
            discretionId: 'reactive',
            discretionLabel: 'Event-Reactive',
            discretionGloss: 'Fires automatically at each session stop event.',
            trigger: 'Event Juncture',
            triggerGloss: 'Writes telemetry at each stop; source of Measured.',
            evidence: '●',
            tokenCost: '0 tokens in prompt',
            gloss: 'Writes session history at each stop; source of Measured.',
            rationale: 'Continuous session telemetry collection without context window bloat.',
            topics: ['session-store']
          },
          {
            id: 'conversation-continuity',
            title: 'Context Continuity & History',
            short: 'Continuity',
            env: 'all',
            icon: 'ph-arrows-clockwise',
            file: 'transcript.jsonl / summary',
            scopeId: 'task-turn',
            scopeLabel: 'Task / Turn',
            scopeGloss: 'Carried turn-to-turn in the active conversation.',
            discretionId: 'injected',
            discretionLabel: 'Forced Injected',
            discretionGloss: 'Platform maintains conversation history and compactions.',
            trigger: 'Per Turn',
            triggerGloss: 'Delivered on every conversation exchange.',
            evidence: '●',
            tokenCost: 'Rolling context window',
            gloss: 'Session memory, user turns, and tool results.',
            rationale: 'Preserves reasoning steps across multi-turn interactions.',
            topics: []
          },
          {
            id: 'slash-commands',
            title: 'Interactive Slash Utilities',
            short: 'SlashUtils',
            env: 'claude',
            icon: 'ph-terminal-window',
            file: 'python/showing.py, skills/tasks/',
            scopeId: 'task-turn',
            scopeLabel: 'Task / Session',
            scopeGloss: 'Scoped to the immediate task at hand.',
            discretionId: 'pulled',
            discretionLabel: 'User / Model Pulled',
            discretionGloss: 'User explicitly types /markers, /showing, or /plan.',
            trigger: 'On Demand',
            triggerGloss: 'Runs only upon human command entry.',
            evidence: '●',
            tokenCost: '0 idle; output only appears upon execution',
            gloss: 'Advisory tools for showing links, frozen zones, and goals.',
            rationale: 'High discretion: specialized utilities run only when the operator explicitly requests verification or planning.',
            topics: ['showing']
          },
          {
            id: 'antigravity-skills',
            title: 'Antigravity Domain Skills',
            short: 'AGYSkills',
            env: 'gemini',
            icon: 'ph-sparkle',
            file: '~/.gemini/antigravity/builtin/skills/*',
            scopeId: 'task-turn',
            scopeLabel: 'Task / Domain',
            scopeGloss: 'Specialized knowledge packs.',
            discretionId: 'pulled',
            discretionLabel: 'User / Model Pulled',
            discretionGloss: 'Model autonomously reads SKILL.md when domain is triggered.',
            trigger: 'On Demand',
            triggerGloss: 'Loaded via view_file upon task relevance.',
            evidence: '●',
            tokenCost: '0 idle; ~1,000 - 4,000 tokens when consulted',
            gloss: 'Deep skills (BigQuery, GCS basics, Chrome DevTools, Generative UI).',
            rationale: 'Heaviest documentation is kept in local disk folders, leaving 100% of context free until needed.',
            topics: ['context-cost']
          },
          {
            id: 'agent-tools',
            title: 'Autonomous File & Search Tools',
            short: 'FileTools',
            env: 'all',
            icon: 'ph-magnifying-glass',
            file: 'view_file, grep, run_command',
            scopeId: 'task-turn',
            scopeLabel: 'File / Symbol',
            scopeGloss: 'Targeted to specific files and lines.',
            discretionId: 'pulled',
            discretionLabel: 'User / Model Pulled',
            discretionGloss: 'Model exercises real-time autonomous agency.',
            trigger: 'Per Turn',
            triggerGloss: 'Dispatched dynamically during tool-calling steps.',
            evidence: '●',
            tokenCost: 'Exact byte cost of lines requested',
            gloss: 'Read tools, search commands, and trajectory records.',
            rationale: 'Maximum flexibility: agent pulls only the exact character ranges needed to solve the specific request.',
            topics: ['github-access']
          }
        ];
      },
      get ctxSpectraVisible(){
        let list = this.ctxSpectraMechanisms;
        if (this.ctxSpectraEnv !== 'all') list = list.filter(m => m.env === 'all' || m.env === this.ctxSpectraEnv);
        if (this.ctxSpectraFilterDiscretion) list = list.filter(m => m.discretionId === this.ctxSpectraFilterDiscretion);
        return list;
      },
      get ctxSpectraActive(){
        return this.ctxSpectraMechanisms.find(m => m.id === this.ctxSpectraSelected) || this.ctxSpectraVisible[0] || this.ctxSpectraMechanisms[0];
      },
      ctxSpectraCountEnv(env){
        return this.ctxSpectraMechanisms.filter(m => m.env === env || m.env === 'all').length;
      },
      ctxSpectraCellItems(scopeId, discretionId){
        return this.ctxSpectraVisible.filter(m => m.scopeId === scopeId && m.discretionId === discretionId);
      },
      ctxSpectraAssistantMark(env, cls){
        cls = cls || 'w-3.5 h-3.5 shrink-0';
        if (env === 'all') {
          return '<i class="ph ph-globe text-base-content/60 ' + cls + ' text-[12px] flex items-center justify-center" aria-hidden="true"></i>';
        }
        // The marks belong to kits/assistant-mark.js (Claude's to claude-mark.js,
        // which it delegates to); gh-boot carries both, so this only picks the key.
        const key = { claude: 'claude', gemini: 'gemini', chatgpt: 'codex', codex: 'codex' }[env];
        return key && window.assistantMark ? window.assistantMark.svg(key, { cls: cls }) : '';
      },
      ctxSpectraAssistantLabel(env){
        if (env === 'claude') return 'Claude Code';
        if (env === 'gemini') return 'Gemini';
        if (env === 'chatgpt' || env === 'codex') return 'ChatGPT';
        if (env === 'all') return 'Universal / All';
        return env;
      },
      ctxSpectraEnvBadge(env){
        if (env === 'gemini') return 'badge-info';
        if (env === 'claude') return 'badge-warning';
        if (env === 'chatgpt') return 'badge-success';
        return 'badge-primary';
      },
      ctxSpectraActiveDiscretionBadge(){
        const active = this.ctxSpectraActive;
        if (!active) return 'badge-ghost';
        const d = this.ctxSpectraDiscretions.find(x => x.id === active.discretionId);
        return d ? d.badgeClass : 'badge-ghost';
      },
      ctxSpectraTriggerIcon(trig){
        if (trig.includes('Daemon')) return 'ph-terminal';
        if (trig.includes('Start')) return 'ph-play';
        if (trig.includes('Event')) return 'ph-bell';
        if (trig.includes('Turn')) return 'ph-arrows-clockwise';
        return 'ph-hand-pointing';
      },
      ctxSpectraScalePos(axisId, m){
        if (axisId === 'scope') {
          const map = { universal: 8, 'host-plugin': 36, repo: 66, 'task-turn': 92 };
          return map[m.scopeId] || 50;
        }
        if (axisId === 'discretion') {
          const map = { injected: 8, prodded: 36, reactive: 66, pulled: 92 };
          return map[m.discretionId] || 50;
        }
        if (axisId === 'trigger') {
          if (m.trigger.includes('Daemon')) return 8;
          if (m.trigger.includes('Start')) return 28;
          if (m.trigger.includes('Event')) return 52;
          if (m.trigger.includes('Turn')) return 74;
          return 92;
        }
        return 50;
      },

      // The payload behind whatever is on screen, so the header's source link
      // moves with the selector instead of always naming the hub's.
      get growthPayloadUrl(){
        const sub = this.growthSubject;
        return sub
          ? 'https://github.com/' + sub.repo + '/blob/' +
            (sub.repo === this.hub() ? useRef() : selRef(sub.repo, sub.path)) + '/' + sub.path
          : this.hubUrl(GROWTH_PAYLOAD);
      },
      get growthPayloadLabel(){
        const sub = this.growthSubject;
        return sub && sub.repo !== this.hub() ? sub.short + ':' + sub.path
             : (sub ? sub.path : GROWTH_PAYLOAD);
      },
      selectGrowthRepo(repo){
        if (this.growthRepo === repo) return;
        this.growthRepo = repo;
        this.growthSeen = true;
      },

      async loadDocsReg(){
        if (this.docsReg || this.docsLoading) return;
        this.docsLoading = true;
        this.docsErr = '';
        try {
          const gh = new window.GH({ token: window.TOKEN, repo: this.hub(), ref: useRef() });
          const raw = (await gh.get(DOCS_MANIFEST)).text;
          const parsed = { documents: window.Csv.rows(raw).map(d => ({ ...d, words: +d.words || 0 })) };
          if (!parsed.documents.length) throw new Error('no documents table');
          window.SourcePeek?.seed(this.peek(DOCS_MANIFEST), raw);
          this.docsReg = parsed;
          // Non-fatal on its own: the registry is the tab, and the trend is a
          // column on it. A missing or stale payload costs the sparklines and
          // nothing else, so it must not take the tab down with it.
          try {
            const g = JSON.parse((await gh.get(GROWTH_PAYLOAD)).text);
            const byPath = new Map();
            for (const f of g.files) {
              const w = f.w.filter(v => v != null);
              if (w.length < 2) continue;
              byPath.set(f.p, { w, delta: w[w.length - 1] - w[0], from: g.frames[f.born] || g.frames[0] });
            }
            this.docGrowth = byPath;
          } catch { this.docGrowth = null; }
        } catch (e) {
          this.docsErr = 'Docs registry load failed: ' + (e?.message || e);
        } finally { this.docsLoading = false; }
        this.loadDocReads();
        this.loadDocPending();
      },

      // EDITS WAITING ON A DOCUMENT, on its row (owner, 2026-10-04: "see
      // current doc proposals directly in the view, so they are simply
      // there"). From lib/kits/user-calls.js: an open documentation user call
      // naming the file, and the Text collection's proposals Dictate would
      // stage on it as it stands. Read after the registry and never in its
      // way: no token, or a failed read, is no markers rather than an error.
      async loadDocPending(){
        if (this.docPending || this._docPendingRun) return;
        const t = window.TOKEN;
        if (!t || String(t).includes('🎟')) return;
        this._docPendingRun = true;
        try {
          if (!window.UserCalls) await window.gh?.load?.('kits/user-calls.js');
          const by = await window.UserCalls.pendingEdits();
          const hub = this.hub() + ':', mine = new Map();
          for (const [k, v] of by) if (k.startsWith(hub) && (v.staged || v.calls.length)) mine.set(k.slice(hub.length), v);
          this.docPending = mine;
          this.remarkDeck();
        } catch { this.docPending = new Map(); }
        finally { this._docPendingRun = false; }
      },
      pendingOf(d){ return this.docRepo ? null : (this.docPending?.get(d.path) || null); },
      get docPendingCount(){
        return this.docPending && !this.docRepo ? (this.docsReg?.documents || []).filter(d => this.docPending.has(d.path)).length : 0;
      },
      pendingTip(d){
        const p = this.pendingOf(d);
        return p ? p.staged + ' proposed ' + (p.staged === 1 ? 'edit' : 'edits') + ' Dictate would stage here' : '';
      },
      proposedHref(d){ return window.UserCalls?.dictateHref({ file: this.hub() + ':' + d.path, proposed: true }) || '#'; },

      // PROPOSALS ON THE PAGE (owner, 2026-10-07: "a little label on a given
      // paragraph, that says, hey, there's a proposal on this. Then the ability
      // to click it and turn the thing into a change container"). The row's
      // badge counts what waits on a document; this puts each item on the
      // paragraph it would change, in the reading deck. A label opens the
      // paragraph in place as a kits/md-diff.js container (old, marked, new on
      // one swipe), with the item's note and what can be done about it shown
      // while it is selected. Applying stays Dictate's: it is the one surface
      // that commits a proposal, one confirmed card at a time.
      //
      // Two queues, one shape: a Text collection proposal replaces a whole
      // block, and a documentation call's edit replaces a phrase inside one, so
      // a call's edit is widened to its block before it is drawn.
      deckEdits(path){
        const p = this.docPending?.get(path);
        if (!p) return [];
        const file = this.hub() + ':' + path;
        const out = (p.items || []).map(x => ({
          path, from: x.from, to: x.to, kind: x.kind || 'edit', purpose: x.purpose || '',
          author: x.author || '', basis: x.basis || '', why: x.why || '', question: '',
          fromId: x.fromId || '', toId: x.toId || '', notes: [...(x.notes || [])],
          href: window.UserCalls?.dictateHref({ file, proposed: x.kind || true }) || '' }));
        for (const c of p.calls || []) for (const e of c.edits || []) out.push({
          path, from: e.from, to: e.to, kind: 'call', purpose: '', author: '', basis: '',
          why: e.why || c.why || '', question: c.question || '', fromId: '', toId: '', notes: [],
          href: this.userCallHref(c) });
        return out.filter(e => e.from && typeof e.to === 'string');
      },
      async markDeckProposals(box, path, text){
        const edits = this.deckEdits(path);
        if (!edits.length || !window.marked) return 0;
        if (!window.mdDiff) { try { await window.gh?.load?.('kits/md-diff.js'); } catch { /* unlabelled */ } }
        const D = window.mdDiff;
        if (!D) return 0;
        const flat = s => String(s || '').replace(/\s+/g, ' ').trim();
        const shown = md => { const d = document.createElement('div'); d.innerHTML = window.marked.parse(md); return flat(d.textContent); };
        const blocks = [...D.blocks(text, { items: true }), ...D.blocks(text)];
        const els = [...box.querySelectorAll('p, li, blockquote')];
        const used = new Set();
        let n = 0;
        for (const e of edits) {
          const f = flat(e.from);
          const whole = blocks.find(b => flat(b.text) === f);
          const b = whole || blocks.find(x => x.text.includes(e.from));
          if (!b) continue;
          const want = shown(b.text);
          const el = els.find(x => !used.has(x) && flat(x.textContent) === want);
          if (!el) continue;
          used.add(el);
          this.labelDeckProposal(el, { ...e, oldMd: b.text, newMd: whole ? e.to : b.text.replace(e.from, e.to) });
          n++;
        }
        return n;
      },
      labelDeckProposal(el, e){
        const tone = e.kind === 'call' ? 'badge-secondary' : e.kind === 'tighten' ? 'badge-info' : 'badge-warning';
        el.classList.add('relative', 'rounded-sm', 'outline', 'outline-1', 'outline-dashed', 'outline-offset-4',
                         'outline-[color-mix(in_oklab,var(--color-warning)_40%,transparent)]');
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.dataset.deckProposal = e.kind;
        chip.className = 'badge badge-xs ' + tone + ' gap-0.5 absolute -top-3 right-0 z-10 cursor-pointer not-prose';
        chip.innerHTML = '<i class="ph ph-pencil-simple"></i>' + esc(e.kind);
        chip.title = (e.kind === 'call' ? 'An edit a user call proposes' : 'A proposed ' + e.kind) + ': tap to see the change';
        chip.addEventListener('click', (ev) => { ev.stopPropagation(); this.openDeckProposal(el, e); });
        el.append(chip);
      },
      // ACTED ON WHERE IT IS READ (owner, 2026-10-07, of the first cut's
      // "Review in Dictate": "this is perfectly capable of doing what I would
      // want to do, and there's no reason why I would want to go off into some
      // other place"). A proposal is applied, rejected or commented on in the
      // container itself. Apply commits the one block to main, guarded by the
      // blob sha it read, and offers Undo; refresh-derived.yml restamps what
      // the edit moves. Reject is a down vote, with an optional reason, in
      // home's projects/text/reviews.jsonl, the file Text Lab's votes already
      // write, and kits/user-calls.js and Dictate stop staging a rejected
      // proposal. A documentation call's edit still answers in Dictate, since a
      // call's answer covers all its edits and is recorded beside the call.
      async openDeckProposal(el, e){
        const D = window.mdDiff;
        if (!D || !el.isConnected) return;
        const holder = document.createElement('div');
        holder.dataset.deckProposalOpen = e.kind;
        holder.className = 'my-3 not-prose';
        el.replaceWith(holder);
        const note = this.deckProposalNote(e);
        const close = () => { this.closeDeckSignTip(); holder.replaceWith(el); };
        const call = e.kind === 'call';
        await D.render(holder, e.oldMd, e.newMd, {
          strip: false,
          size: 'drawer',   // the small guide body, the size of the deck's own prose
          note: () => note,
          sign: () => call ? null : this.deckProposalSign(e),
          actions: () => call ? [
            { label: 'Answer the call', title: 'A call is answered for all its edits at once, in Dictate',
              run: () => { if (e.href) window.open(e.href, '_blank', 'noopener'); } },
            { label: 'Close', icon: 'ph-x', title: 'Back to the paragraph; nothing is recorded', run: close },
          ] : [
            { label: 'Apply', title: 'Commit this change to ' + e.path + ' on main',
              run: (_c, _i, btn) => this.applyDeckProposal(e, holder, el, btn) },
            { label: 'Reject', title: 'Say no, with a reason if you like; it is not proposed here again',
              run: () => this.deckProposalForm(e, note, 'reject', holder, el) },
            { label: 'Comment', title: 'Leave a note on this proposal',
              run: () => this.deckProposalForm(e, note, 'comment', holder, el) },
            { label: 'Close', icon: 'ph-x', title: 'Back to the paragraph; nothing is recorded, and it stays proposed', run: close },
          ],
        });
        // Claimed on open, so its note and actions are there without a second tap.
        holder.querySelector('.md-diff-change')
          ?.dispatchEvent(new CustomEvent('md-diff:here', { bubbles: true, detail: { at: 0 } }));
      },
      // ONLY WHAT IS PARTICULAR TO THIS ITEM (owner: "we would only want
      // something there if it's an actual custom note explaining the edit").
      // A call's question and its reason for this edit, a proposal's reason
      // when its record carries one, and the comments left on it. No purpose
      // definition. Who proposed it and on what basis is the signature pill's.
      deckProposalNote(e){
        const box = document.createElement('div');
        box.className = 'flex flex-col gap-1';
        box.dataset.deckProposalNote = '';
        const line = (cls, ...kids) => { const d = document.createElement('div'); if (cls) d.className = cls; d.append(...kids); box.append(d); return d; };
        if (e.question) line('font-medium', e.question);
        if (e.why) line('', e.why);
        for (const n of e.notes || []) box.append(this.deckProposalComment(n));
        return box;
      },
      deckProposalComment(n){
        const d = document.createElement('div');
        d.className = 'flex items-start gap-1.5 text-[12px]';
        d.innerHTML = '<i class="ph ph-chat-circle mt-0.5 opacity-50"></i>';
        const t = document.createElement('span');
        t.textContent = n.note;
        if (n.by || n.at) t.setAttribute('data-title-tip', [n.by, String(n.at || '').slice(0, 10)].filter(Boolean).join(', '));
        d.append(t);
        return d;
      },
      // What a basis URL names, as fields: a batch run's folder in home, a
      // pull request, or a commit. `short` is what the signature pill shows.
      basisOf(url){
        const s = String(url || '');
        if (!s) return null;
        const r = window.TextCollection?.basisRun?.(s);
        if (r) {
          const name = r.run.slice(11).replace(/-/g, ' ');
          const day = new Date(r.date + 'T00:00:00Z');
          return { kind: 'run', run: r.run, date: r.date, name: name.charAt(0).toUpperCase() + name.slice(1) + ' run',
                   short: isNaN(day) ? r.date : day.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) };
        }
        let m = /github\.com\/([\w.-]+\/[\w.-]+)\/pull\/(\d+)/.exec(s);
        if (m) return { kind: 'pr', repo: m[1], name: 'PR #' + m[2], short: '#' + m[2] };
        m = /github\.com\/([\w.-]+\/[\w.-]+)\/commit\/([0-9a-f]{7})/.exec(s);
        if (m) return { kind: 'commit', repo: m[1], name: 'Commit ' + m[2], short: m[2] };
        return { kind: 'other', name: 'Basis', short: 'basis' };
      },
      // THE SIGNATURE (owner, 2026-10-07: "another little pill on the bottom
      // right ... the quad icon and a date", where a tap opens "structured
      // data ... the date of the run and some specific parameters of it rather
      // than just unstructured text"). The proposer's mark and the run's date;
      // the tip's fields are counted from the collection, never captioned.
      deckProposalSign(e){
        const b = this.basisOf(e.basis);
        const who = (e.author || '').toLowerCase();
        const M = window.AssistantMark;
        if (!b && !who) return null;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.deckProposalSign = '';
        btn.className = 'flex items-center gap-1 cursor-pointer rounded-full px-2 py-1 hover:bg-base-200 tabular-nums';
        btn.title = 'Who proposed this, and on what basis';
        if (who && M?.COLOR?.[who]) btn.append(M.el(who, { cls: 'w-3.5 h-3.5 shrink-0' }));
        else if (e.author) btn.append(Object.assign(document.createElement('span'), { textContent: e.author }));
        if (b) btn.append(Object.assign(document.createElement('span'), { textContent: b.short }));
        btn.addEventListener('click', (ev) => { ev.stopPropagation(); this.toggleDeckSignTip(e, btn); });
        return btn;
      },
      // Text Lab at the version this view runs at, as growthUrl reaches its page.
      textLabHref(query){
        const ref = useRef();
        return ref && ref !== 'main'
          ? '../pages/toss-render.html#gh=' + this.hub() + '@' + ref + ':pages/text-lab.html' + query
          : '../pages/text-lab.html' + query;
      },
      // A panel-tip built on the body, since the deck's overlay sits above
      // anything in the view's template; kits/panel-tip.js owns the ways out.
      async toggleDeckSignTip(e, anchor){
        if (this._signTip?.anchor === anchor) return this.closeDeckSignTip();
        this.closeDeckSignTip();
        await window.gh?.load?.('kits/panel-tip.js').catch(() => {});
        const tip = document.createElement('div');
        tip.dataset.deckSignTip = '';
        tip.setAttribute('role', 'dialog');
        tip.setAttribute('aria-label', 'Who proposed this, and on what basis');
        tip.className = 'fixed z-[90] rounded-xl border border-base-300 bg-base-100 shadow-lg px-4 py-3 text-sm leading-6 '
                      + 'max-h-[60vh] overflow-y-auto not-prose';
        tip.innerHTML = window.PanelTip ? window.PanelTip.closeHTML(true) : '';
        let body = this.deckSignBody(e, undefined);
        tip.append(body);
        document.body.append(tip);
        const place = () => {
          const r = anchor.getBoundingClientRect();
          const w = Math.min(360, innerWidth - 16);
          tip.style.width = w + 'px';
          tip.style.left = Math.max(8, Math.min(r.right - w, innerWidth - w - 8)) + 'px';
          const h = tip.offsetHeight;
          tip.style.top = (r.bottom + 6 + h <= innerHeight - 8 ? r.bottom + 6 : Math.max(8, r.top - 6 - h)) + 'px';
        };
        place();
        const wired = window.PanelTip?.wire(tip, { onClose: () => this.closeDeckSignTip(), stale: 'geometry',
          except: ['[data-deck-proposal-sign]'], label: 'proposal signature' });
        this._signTip = { el: tip, anchor, wired };
        let stats = null;
        try {
          const index = await window.mdVariants?.index?.();
          stats = index && window.TextCollection?.bases ? window.TextCollection.bases(index).get(e.basis) || null : null;
        } catch { stats = null; }
        if (this._signTip?.el !== tip) return;
        const next = this.deckSignBody(e, stats);
        body.replaceWith(next);
        body = next;
        place();
      },
      closeDeckSignTip(){
        const t = this._signTip;
        this._signTip = null;
        if (!t) return;
        t.wired?.detach?.();
        t.el.remove();
      },
      // The tip's fields. `stats` is undefined while the collection is read,
      // null when it could not be, and otherwise TextCollection.bases' entry.
      deckSignBody(e, stats){
        const b = this.basisOf(e.basis);
        const who = (e.author || '').toLowerCase();
        const M = window.AssistantMark;
        const box = document.createElement('div');
        box.className = 'flex flex-col gap-2 pr-6';
        box.dataset.deckSignBody = '';
        const head = document.createElement('div');
        head.className = 'flex items-center gap-2 font-medium';
        if (who && M?.COLOR?.[who]) head.append(M.el(who, { cls: 'w-4 h-4 shrink-0' }));
        head.append(b ? b.name : 'Proposal');
        box.append(head);
        const grid = document.createElement('dl');
        grid.className = 'grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 tabular-nums';
        const row = (k, v) => {
          if (v === '' || v === null || v === undefined) return;
          const dt = document.createElement('dt'); dt.className = 'opacity-60'; dt.textContent = k;
          const dd = document.createElement('dd'); dd.textContent = v;
          grid.append(dt, dd);
        };
        const tally = (o) => Object.entries(o || {}).sort((x, y) => y[1] - x[1]).map(([k, n]) => k + ' ' + n).join(' · ');
        const plural = (n, one, many) => n.toLocaleString() + ' ' + (n === 1 ? one : many);
        row('Proposed by', e.author);
        row('Purpose', e.purpose || e.kind);
        if (b?.kind === 'run') row('Run date', b.date);
        if (b?.kind === 'pr' || b?.kind === 'commit') row('Repository', b.repo);
        if (stats) {
          row('Filed', [plural(stats.proposals, 'proposal', 'proposals'), plural(stats.files.length, 'document', 'documents'),
                        plural(stats.repos.length, 'repo', 'repos')].join(' · '));
          row('Purposes', tally(stats.by_purpose));
          if (Object.keys(stats.by_author).length > 1) row('Proposers', tally(stats.by_author));
          const here = stats.files.find(f => f.repo === this.hub() && f.path === e.path)?.proposals || 0;
          const pending = (this.docPending?.get(e.path)?.items || []).filter(x => x.basis === e.basis).length;
          row('This document', here + ' filed · ' + pending + ' pending');
          row('Reviews', stats.rejected + ' rejected · ' + plural(stats.notes, 'comment', 'comments'));
        }
        box.append(grid);
        if (stats === undefined) {
          const wait = document.createElement('div');
          wait.className = 'loading loading-dots loading-xs opacity-40';
          box.append(wait);
        } else if (stats === null) {
          const miss = document.createElement('div');
          miss.className = 'text-[12px] opacity-60';
          miss.textContent = 'The Text collection could not be read, so the run is not counted here.';
          box.append(miss);
        }
        if (b?.kind === 'run') {
          const a = document.createElement('a');
          a.className = 'link link-hover text-[13px] inline-flex items-center gap-1';
          a.href = this.textLabHref('?pane=runs&run=' + encodeURIComponent(b.run));
          a.target = '_blank';
          a.rel = 'noopener';
          a.innerHTML = '<i class="ph ph-flask"></i>';
          a.append('This run in Text Lab');
          box.append(a);
        }
        return box;
      },
      deckProposalForm(e, note, mode, holder, el){
        note.querySelector('[data-deck-proposal-form]')?.remove();
        const toast = window.Alpine?.store?.('toast');
        const form = document.createElement('div');
        form.dataset.deckProposalForm = mode;
        form.className = 'flex flex-col gap-1.5 mt-1';
        const ta = document.createElement('textarea');
        ta.className = 'textarea textarea-sm w-full text-[13px] leading-snug';
        ta.rows = 2;
        ta.placeholder = mode === 'reject' ? 'Why not (optional)' : 'Your comment';
        const row = document.createElement('div');
        row.className = 'flex justify-end gap-1.5';
        const btn = (label, cls) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-xs ' + cls; b.textContent = label; return b; };
        const cancel = btn('Cancel', 'btn-ghost');
        const go = btn(mode === 'reject' ? 'Reject' : 'Save', mode === 'reject' ? 'btn-error btn-outline' : 'btn-primary');
        cancel.onclick = () => form.remove();
        go.onclick = async () => {
          const text = ta.value.trim();
          if (mode === 'comment' && !text) { ta.focus(); return; }
          go.disabled = true;
          try {
            const row = await this.writeProposalReview(e, mode === 'reject' ? { vote: 'down', note: text } : { note: text });
            if (mode === 'reject') {
              this.retireDeckProposal(e, el);
              holder.replaceWith(el);
              toast?.('check', 'Rejected' + (text ? ', with your reason' : ''), 'alert-success', 2500);
            } else {
              e.notes.push({ by: row.by, at: row.at, note: text });
              form.replaceWith(this.deckProposalComment(e.notes[e.notes.length - 1]));
              toast?.('check', 'Comment saved', 'alert-success', 2000);
            }
          } catch (err) {
            go.disabled = false;
            toast?.('warning', 'Not saved: ' + (err?.message || err), 'alert-error', 6000);
          }
        };
        row.append(cancel, go);
        form.append(ta, row);
        note.append(form);
        ta.focus();
      },
      tokenOk(){ const t = window.TOKEN; return !!t && !String(t).includes('🎟'); },
      b64(text){
        const bytes = new TextEncoder().encode(text);
        let bin = '';
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        return btoa(bin);
      },
      // One appended line per act, the row shape Text Lab writes. A write that
      // races another re-reads and appends again rather than overwriting.
      async writeProposalReview(e, patch){
        const T = window.TextCollection;
        if (!T?.reviewLine || !e.fromId || !e.toId) throw new Error('this proposal carries no passage ids');
        if (!this.tokenOk()) throw new Error('a review needs a token that can write to mehrlander/home');
        const home = new window.GH({ token: window.TOKEN, repo: 'mehrlander/home', ref: 'main' });
        this._ghLogin ||= (await home.req('/user'))?.login || '';
        const row = { from: e.fromId, to: e.toId, by: this._ghLogin, at: new Date().toISOString(),
                      ...(patch.vote !== undefined ? { vote: patch.vote } : {}), ...(patch.note ? { note: patch.note } : {}) };
        const path = T.PATHS.reviews;
        for (let tries = 0; ; tries++) {
          let text = '', sha;
          try { const cur = await home.get(path, window.GH.FRESH); text = cur.text; sha = cur.sha; }
          catch (err) { if (err?.status !== 404) throw err; }
          if (text && !text.endsWith('\n')) text += '\n';
          const body = { message: 'Text review: ' + (patch.vote === 'down' ? 'reject' : 'comment') + ' on a proposal for '
                           + e.path + ' via Web Tools',
                         content: this.b64(text + T.reviewLine(row) + '\n'), branch: 'main', ...(sha ? { sha } : {}) };
          try { await home.req('contents/' + path, { method: 'PUT', body: JSON.stringify(body) }); return row; }
          catch (err) { if ((err?.status === 409 || err?.status === 422) && tries < 2) continue; throw err; }
        }
      },
      // A paragraph docs/policies.csv quotes cannot change from here: the quote
      // would no longer be found in its document, and only a person can choose
      // the new one. Returns the policy id that blocks, or ''.
      async policyQuoteIn(e){
        if (!this._policyRows) {
          try {
            const gh = new window.GH({ token: window.TOKEN, repo: this.hub(), ref: 'main' });
            this._policyRows = window.Csv.rows((await gh.get('docs/policies.csv')).text);
          } catch { this._policyRows = []; }
        }
        const flat = s => String(s || '').replace(/\s+/g, ' ').trim();
        const was = flat(e.oldMd), now = flat(e.newMd);
        const hit = this._policyRows.find(r => r.canonical_doc === e.path && r.quoted
          && was.includes(flat(r.quoted)) && !now.includes(flat(r.quoted)));
        return hit ? hit.policy_id : '';
      },
      // The one block, swapped in the file as main holds it, committed with
      // the sha that was read: a file that moved since is refused, never
      // overwritten.
      async commitBlockSwap(path, from, to, message){
        const gh = new window.GH({ token: window.TOKEN, repo: this.hub(), ref: 'main' });
        const cur = await gh.get(path, window.GH.FRESH);
        const n = cur.text.split(from).length - 1;
        if (n !== 1) throw new Error(n ? 'the paragraph appears more than once in the file'
                                       : 'the paragraph has changed on main since this was proposed');
        const res = await gh.req('contents/' + path, { method: 'PUT', body: JSON.stringify({
          message, content: this.b64(cur.text.replace(from, () => to)), sha: cur.sha, branch: 'main' }) });
        for (const k of [...docCache.keys()]) if (k.endsWith(':' + path)) docCache.delete(k);
        return res?.commit?.sha || '';
      },
      async applyDeckProposal(e, holder, el, btn){
        const toast = window.Alpine?.store?.('toast');
        if (!this.tokenOk()) return toast?.('warning', 'Applying needs a token that can write to ' + this.hub(), 'alert-error', 5000);
        if (btn) btn.disabled = true;
        try {
          const blocked = await this.policyQuoteIn(e);
          if (blocked) throw new Error('docs/policies.csv quotes this paragraph (' + blocked
            + '), so a session has to apply it and move the quote with it');
          const sha = await this.commitBlockSwap(e.path, e.oldMd, e.newMd,
            'Apply a proposed ' + (e.purpose || e.kind) + ' to ' + e.path + ' via Web Tools'
            + (e.basis ? '\n\nBasis: ' + e.basis : ''));
          this.retireDeckProposal(e, el);
          this.showDeckApplied(e, holder, el, sha);
        } catch (err) {
          if (btn) btn.disabled = false;
          const moved = err?.status === 409 || err?.status === 422;
          toast?.('warning', 'Not applied: ' + (moved ? 'the file changed on main; reopen it and try again' : (err?.message || err)),
                  'alert-error', 8000);
        }
      },
      showDeckApplied(e, holder, el, sha){
        const body = document.createElement('div');
        body.className = 'prose prose-sm !max-w-none';
        body.innerHTML = window.marked ? window.marked.parse(e.newMd) : '';
        const bar = document.createElement('div');
        bar.className = 'flex items-center gap-2 text-[12px] opacity-70 mt-1';
        bar.dataset.deckProposalApplied = '';
        bar.innerHTML = '<i class="ph ph-check-circle text-success"></i>';
        bar.append('Applied to main' + (sha ? ' in ' + sha.slice(0, 7) : ''));
        const undo = document.createElement('button');
        undo.type = 'button';
        undo.className = 'btn btn-xs btn-ghost';
        undo.textContent = 'Undo';
        undo.onclick = async () => {
          undo.disabled = true;
          try {
            await this.commitBlockSwap(e.path, e.newMd, e.oldMd, 'Undo a proposed ' + (e.purpose || e.kind) + ' to ' + e.path + ' via Web Tools');
            this.retireDeckProposal(e, el, true);
            this.labelDeckProposal(el, e);
            holder.replaceWith(el);
          } catch (err) {
            undo.disabled = false;
            window.Alpine?.store?.('toast')?.('warning', 'Not undone: ' + (err?.message || err), 'alert-error', 6000);
          }
        };
        bar.append(undo);
        holder.replaceChildren(body, bar);
      },
      // Off the row badge, the deck's count and the paragraph's label once it
      // is applied or rejected; back on after an Undo.
      retireDeckProposal(e, el, restore = false){
        const p = this.docPending?.get(e.path);
        if (p && e.kind !== 'call') {
          const same = x => x.from === e.from && x.to === e.to;
          if (restore) { if (!p.items.some(same)) p.items.push(e._item || e); }
          else { e._item = p.items.find(same); p.items = p.items.filter(x => !same(x)); }
          p.staged = p.items.length;
          this.docPending = new Map(this.docPending);
        }
        if (!restore) {
          el.querySelector('[data-deck-proposal]')?.remove();
          el.classList.remove('outline', 'outline-1', 'outline-dashed', 'outline-offset-4',
                              'outline-[color-mix(in_oklab,var(--color-warning)_40%,transparent)]');
        }
        this._deck?.setActions?.(this.deckActions(e.path));
      },
      nextDeckProposal(){
        const box = this.deckBox();
        const chips = box ? [...box.querySelectorAll('[data-deck-proposal]')] : [];
        if (!chips.length) return;
        this._deckProposalAt = ((this._deckProposalAt ?? -1) + 1) % chips.length;
        const el = chips[this._deckProposalAt].parentElement;
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        this.markLead(el);
      },
      // The pending edits load after the registry and may land after the deck
      // has drawn the open slide; label it then rather than on the next swipe.
      remarkDeck(){
        const path = this.deckPath(), box = this.deckBox();
        if (!path || !box || this.deckSource(path).foreign) return;
        this._deck?.setActions?.(this.deckActions(path));
        if (this.deckReading(path) !== 'rendered' || box.querySelector('[data-deck-proposal]')) return;
        this.docDeckText(path).then(t => this.markDeckProposals(box, path, t)).catch(() => {});
      },
      userCallHref(c){ return window.UserCalls?.href(c) || '#'; },


      // ── Registries ────────────────────────────────────────────────────────
      // The declaration table. Same lazy shape as every other tab.
      async loadPropsReg(){
        if (this.propsReg || this.propsLoading) return;
        this.propsLoading = true;
        this.propsErr = '';
        try {
          const gh = new window.GH({ token: window.TOKEN, repo: this.hub(), ref: useRef() });
          const [rawReg, rawProp, rawVocab, rawText] = await Promise.all([
            gh.get(PROPS_MANIFEST).then(r => r.text),
            gh.get(PROPS_DECLS).then(r => r.text),
            gh.get(PROPS_VOCAB).then(r => r.text),
            gh.get(TEXT_FIELDS).then(r => r.text),
          ]);
          const registries = window.Csv.rows(rawReg).map(r => ({
            ...r,
            // Every registry is now one CSV, so the registry's path is the whole
            // of `path`; `file` stays as its name for a consumer asking which
            // file to open.
            file: r.path,
            renders_in: window.Csv.list(r.renders_in),
          }));
          const properties = window.Csv.rows(rawProp).map(p => ({
            ...p, values: p.values ? window.Csv.list(p.values) : null,
          }));
          const vocab = window.Csv.rows(rawVocab);
          // name -> the prose kind it is, whether it IS the sanctioned name or
          // an alias the vocabulary accounts for. Both conform; the tab shows
          // the kind and never the distinction, since the distinction is a
          // naming history rather than a fact about the column.
          const kinds = new Map();
          for (const t of window.Csv.rows(rawText)) {
            kinds.set(t.field, { kind: t.field, gloss: t.gloss });
            for (const a of (t.instead_of || '').split(','))
              if (a.trim() && !kinds.has(a.trim()))
                kinds.set(a.trim(), { kind: t.field, gloss: t.gloss });
          }
          if (!registries.length) throw new Error('no registries table');
          window.SourcePeek?.seed(this.peek(PROPS_MANIFEST), rawReg);
          window.SourcePeek?.seed(this.peek(PROPS_DECLS), rawProp);
          window.SourcePeek?.seed(this.peek(PROPS_VOCAB), rawVocab);
          window.SourcePeek?.seed(this.peek(TEXT_FIELDS), rawText);
          this.propsReg = { registries, properties, vocab, kinds };
        } catch (e) {
          this.propsErr = 'Registries load failed: ' + (e?.message || e);
        } finally { this.propsLoading = false; }
      },

      // Property definitions grouped under the registry they govern, so the page reads
      // the way the model does: a registry, then what it asserts. The counts
      // beside each grade are the enforcement story, which is the thing worth
      // seeing at a glance and the thing that was wrong twice this month.
      get registryRows(){
        const r = this.propsReg;
        if (!r) return [];
        const byReg = new Map();
        for (const d of r.properties) {
          if (!byReg.has(d.registry)) byReg.set(d.registry, []);
          byReg.get(d.registry).push(d);
        }
        return r.registries.map(reg => {
          const decls = byReg.get(reg.id) || [];
          const kinds = this.propsReg?.kinds;
          return {
            ...reg,
            decls: decls.map(d => ({ ...d, textKind: kinds?.get(d.property)?.kind || '' })),
            nClosed: decls.filter(d => Array.isArray(d.values)).length,
            nValue: decls.filter(d => d.required === 'value').length,
            nCounted: decls.filter(d => d.required === 'counted').length,
            nComputed: decls.filter(d => d.mode === 'computed').length,
          };
        });
      },
      // The tab's own columns, defined from the registry pair rather than from
      // a paragraph. Two legends, because the cards show two grains: a registry
      // row (what registries.csv records about a registry) and a property chip
      // (what properties.csv records about one of its columns).
      //
      // This getter is the argument of the 2026-08-19 pass in one place.
      // registries.md carried a fifteen-row Vocabulary table, and eight of its
      // rows glossed a column whose gloss was already committed in
      // properties.csv; the prose copy is the one that goes stale, and it did.
      // A definition that is data should be rendered, not restated. What could
      // not be derived, the model and the reasons, stayed in the document.
      legendFor(registryId){
        const r = this.propsReg;
        if (!r) return [];
        const vocab = r.vocab || [];
        return r.properties.filter(p => p.registry === registryId).map(p => ({
          ...p,
          // A domain's values carry their own glosses where one is worth
          // writing; where none is, the bare value is the whole definition and
          // rendering it alone is honest rather than thin.
          domain: (p.values || []).map(v => {
            const row = vocab.find(x => x.registry === registryId && x.property === p.property && x.value === v);
            return { value: v, label: row?.label || v, gloss: row?.gloss || '' };
          }),
        }));
      },
      get registryLegend(){ return this.legendFor('registries'); },
      get propertyLegend(){ return this.legendFor('properties'); },

      // Two areas, split by one question. The rule is the point: without one,
      // every added registry re-litigates the grouping. `area` is a declared
      // field on the registry row and gated, so this reads the data rather than
      // holding a list of its own.
      get registryAreas(){
        const AREAS = [
          ['files', 'Files', 'Does the target have a path in this tree?'],
          ['names', 'Names', 'Everything else: a name something declared, and the registry is what declares it.'],
        ];
        const rows = this.registryRows;
        return AREAS.map(([key, label, rule]) => ({
          key, label, rule,
          rows: rows.filter(r => r.area === key),
        })).filter(a => a.rows.length);
      },
      // One reading of the gate column, so the badge and the ledger figure
      // cannot disagree about what its none token means.
      hasGate(r){ return !!r.gate && r.gate !== 'none'; },
      get registryTotals(){
        const rows = this.registryRows;
        return {
          registries: rows.length,
          // Two independent facts, and they used to be one `kind` column whose
          // three values answered two questions: `crosswalk` had to be unioned
          // back into `catalog` here to count correctly, and then counted again
          // on its own. Split 2026-08-18 into `membership`, which says whether
          // the row set can be recomputed, and `inherits`, which names the
          // registry whose descriptions this one borrows.
          computed: rows.filter(r => r.membership === 'computed').length,
          curated: rows.filter(r => r.membership === 'curated').length,
          inheriting: rows.filter(r => r.inherits).length,
          decls: rows.reduce((n, r) => n + r.decls.length, 0),
          closed: rows.reduce((n, r) => n + r.nClosed, 0),
          // `none` is the token for "nothing holds this"; a blank cell in CSV
          // could only mean not asserted, so the two readings need two spellings.
          gated: rows.filter(r => this.hasGate(r)).length,
          // `span` is the typed sibling of `scope`, added 2026-08-20. The
          // distinction lived inside twenty-two prose sentences, so nothing
          // could group or count it, and the question "what does the hub know
          // about the rest of the estate" had no answer a surface could show.
          estate: rows.filter(r => r.span === 'estate').length,
          // The headline the tab was missing: registries nothing in the app
          // reads. Same role as the Docs tab's orphan count.
          unrendered: rows.filter(r => !(r.renders_in || []).length).length,
        };
      },

      // ── Owners ────────────────────────────────────────────────────────────
      // Its own fetch since the table moved out of docs.json. Same lazy shape;
      // the two tabs no longer share a load, which is the point of the split.
      async loadOwnersReg(){
        if (this.ownersReg || this.ownersLoading) return;
        this.ownersLoading = true;
        this.ownersErr = '';
        try {
          const gh = new window.GH({ token: window.TOKEN, repo: this.hub(), ref: useRef() });
          // Its own two files and nothing else. The tab used to pull the
          // registry pair as a third fetch, for this registry's scope alone;
          // that line came off the header on 2026-08-26 and the scope is read
          // on the Registries tab, where every registry's is.
          const [rawOwn, rawRep] = await Promise.all([
            gh.get(OWNERS_MANIFEST).then(r => r.text),
            gh.get(OWNERS_REPS).then(r => r.text),
          ]);
          const reps = window.Csv.rows(rawRep);
          const owners = window.Csv.rows(rawOwn).map(r => ({
            ...r, repetitions: reps.filter(p => p.subject === r.subject),
          }));
          if (!owners.length) throw new Error('no owners table');
          window.SourcePeek?.seed(this.peek(OWNERS_MANIFEST), rawOwn);
          window.SourcePeek?.seed(this.peek(OWNERS_REPS), rawRep);
          this.ownersReg = { owners };
        } catch (e) {
          this.ownersErr = 'Owners registry load failed: ' + (e?.message || e);
        } finally { this.ownersLoading = false; }
      },

      // ── Themes ────────────────────────────────────────────────────────────
      // docs/themes.json is a measurement, not a registry: no rule decides
      // membership, the shingle pass does. So it carries no registry chip, the
      async loadThemes(){
        if (this.themeGraph || this.themesLoading) return;
        this.themesLoading = true;
        this.themesErr = '';
        try {
          const gh = new window.GH({ token: window.TOKEN, repo: this.hub(), ref: useRef() });
          const raw = await gh.get(THEMES_GRAPH).then(r => r.text);
          window.SourcePeek?.seed(this.peek(THEMES_GRAPH), raw);
          const rows = window.Csv.rows(raw);
          if (!rows.length) throw new Error('no edges');
          const g = {
            shingle: +rows[0].shingle, scanned: +rows[0].scanned,
            edges: rows.map(r => ({ a: r.a, b: r.b, w: +r.w,
                                    rule: r.rule === 'true',
                                    quoted: window.Csv.list(r.quoted) })),
          };
          g.nodes = [...new Set(g.edges.flatMap(e => [e.a, e.b]))].sort();
          this.themeGraph = g;
        } catch (e) {
          this.themesErr = 'Theme graph load failed: ' + (e?.message || e);
        } finally { this.themesLoading = false; }
      },

      // Every file the owners registry names anywhere, pulled out of prose
      // locators the same way owners-registry.test.mjs does. Membership stays
      // owners.csv's to say: the graph carries no copy of it, so this join is
      // the only place the two meet.
      get themeListed(){
        const out = new Set();
        const paths = /[\w./-]+\.(?:md|csv|json|js|mjs|html|sh|py)/g;
        for (const o of (this.ownersReg?.owners || [])) {
          for (const m of (o.authoritative || '').matchAll(paths)) out.add(m[0]);
          for (const r of (o.repetitions || []))
            for (const m of (r.where || '').matchAll(paths)) out.add(m[0]);
        }
        return out;
      },
      // An edge is listed when the registry names BOTH of its files, meaning
      // somebody has at least looked at what each one repeats. Naming one and
      // not the other is not an account of the pair.
      themeListedEdge(e){ const L = this.themeListed; return L.has(e.a) && L.has(e.b); },

      // ── Related ──────────────────────────────────────────────────────────
      overlap: null,
      overlapErr: '',
      // Set from the 2026-09-29 gold set and scored on held-out pairs whose
      // passages are both 20+ words (gold-set/2026-09-29-held-out-scorecard.md): from
      // 0.78 about 86% of pairs are worth reading or could be consolidated and
      // 9% are unrelated, and from 0.85 about nine in ten restate. The first
      // sample had promised 1% unrelated; tuning and scoring on one set
      // flattered it. Passages under 20 words were the larger error (44% of
      // such pairs unrelated), so they are hidden until asked for rather than
      // dropped from the data.
      overlapCut: 0.78,
      overlapRestates: 0.85,
      overlapShortWords: 20,
      overlapShort: false,
      overlapPick: null,
      overlapFiles: {},
      async loadOverlap(){
        if (this.overlap || this._overlapLoading) return;
        this._overlapLoading = true;
        try {
          const gh = new window.GH({ token: window.TOKEN, repo: this.hub(), ref: useRef() });
          const [docs, rows] = await Promise.all([OVERLAP_DOCS, OVERLAP_MATCHES]
            .map(f => gh.get(f).then(r => window.Csv.rows(r.text))));
          this.overlap = {
            docs: Object.fromEntries(docs.map(d => [d.path, { sha: d.sha, words: +d.prose_words, shingles: +d.shingles }])),
            rows: rows.map(r => ({ ...r, start: +r.start, end: +r.end, line: +r.line, words: +r.words,
                                   target_start: +r.target_start, target_end: +r.target_end,
                                   target_line: +r.target_line, target_words: +r.target_words, cosine: +r.cosine })),
          };
          if (!this.themeGraph) this.loadThemes();
        } catch (e) {
          this.overlapErr = 'Overlap load failed: ' + (e?.message || e);
        } finally { this._overlapLoading = false; }
      },
      // A share above zero never reads as 0%: five shared shingles are not none.
      pct(x){ return x > 0 && x < 0.005 ? '<1%' : Math.round(100 * x) + '%'; },
      // Every pair with a match at the cutoff, both directions at once: a
      // source passage counts once however many target passages resemble it.
      get overlapPairsAll(){
        return new Set((this.overlap?.rows || []).map(r => [r.source, r.target].sort().join('\n'))).size;
      },
      get overlapPairs(){
        if (!this.overlap) return [];
        const D = this.overlap.docs, cut = this.overlapCut, by = {};
        for (const r of this.overlap.rows) {
          if (r.cosine < cut) continue;
          if (!this.overlapShort && Math.min(r.words, r.target_words) < this.overlapShortWords) continue;
          const [a, b] = [r.source, r.target].sort();
          const q = (by[a + '\n' + b] ||= { key: a + '\n' + b, a, b, seen: new Set(), wordsA: 0, wordsB: 0, matches: [] });
          const k = r.source + ':' + r.start;
          if (!q.seen.has(k)) { q.seen.add(k); if (r.source === a) q.wordsA += r.words; else q.wordsB += r.words; }
          q.matches.push(r);
        }
        const w = {};
        for (const e of (this.themeGraph?.edges || [])) w[e.a + '\n' + e.b] = e.w;
        return Object.values(by).map(q => {
          const shared = w[q.key] || 0;
          // Two passages that are each other's best match are one piece of
          // evidence, not two: keep the a-side row and drop its mirror.
          const fwd = new Set(q.matches.filter(m => m.source === q.a).map(m => m.start + ':' + m.target_start));
          q.matches = q.matches.filter(m => m.source === q.a || !fwd.has(m.target_start + ':' + m.start));
          q.matches.sort((x, y) => (x.source === q.a ? 0 : 1) - (y.source === q.a ? 0 : 1) || y.cosine - x.cosine);
          return { ...q, w: shared, restates: q.matches.some(m => m.cosine >= this.overlapRestates),
            semA: q.wordsA / (D[q.a]?.words || 1), semB: q.wordsB / (D[q.b]?.words || 1),
            litA: shared / (D[q.a]?.shingles || 1), litB: shared / (D[q.b]?.shingles || 1) };
        }).sort((x, y) => Math.max(y.semA, y.semB) - Math.max(x.semA, x.semB));
      },
      // The passage, cut from the file as it is now. A file whose hash no
      // longer matches the scan's gets no cut at all: offsets into changed
      // text would show the wrong words with the right line number.
      overlapSlice(path, start, end){
        const f = this.overlapFiles[path];
        if (!f) { this.overlapFetch(path); return '…'; }
        if (f.loading) return '…';
        if (f.err) return '(could not read ' + path + ')';
        if (!f.fresh) return '(changed since the scan; rerun python/doc-overlap.py)';
        return f.text.slice(start, end);
      },
      async overlapFetch(path){
        if (this.overlapFiles[path]) return;
        this.overlapFiles = { ...this.overlapFiles, [path]: { loading: true } };
        try {
          const gh = new window.GH({ token: window.TOKEN, repo: this.hub(), ref: useRef() });
          const text = (await gh.get(path)).text;
          const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
          const sha = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 12);
          this.overlapFiles = { ...this.overlapFiles, [path]: { text, fresh: sha === this.overlap.docs[path]?.sha } };
        } catch (e) {
          this.overlapFiles = { ...this.overlapFiles, [path]: { err: true } };
        }
      },

      // Whether a file leaves this repository. docs/portable.csv curates the
      // to-go set and the plugin ships skills/ wholesale, so those two are the
      // whole answer. Read here rather than baked into the payload for the same
      // reason membership is: what travels is portable.csv's to say.
      get themeTravelling(){
        return new Set((this.manifest?.items || []).map(r => r.path).filter(Boolean));
      },
      themeTravels(p){
        return p.startsWith('skills/') || p.startsWith('.claude/skills/') || this.themeTravelling.has(p);
      },
      // The pair worth reviewing first: the shared text states a rule AND both
      // copies leave the repo, so no single reader ever sees them disagree.
      // Either half alone is weaker. A rule repeated in two files a reader has
      // side by side is visible; a description repeated anywhere only goes
      // stale.
      themeReview(e){ return !!e.rule && this.themeTravels(e.a) && this.themeTravels(e.b); },
      // What the accent means right now, which is whatever concern is selected.
      themeMarked(e){
        return this.themeConcern === 'review' ? this.themeReview(e) : !this.themeListedEdge(e);
      },

      get themeEdges(){
        return (this.themeGraph?.edges || [])
          .filter(e => e.w >= this.themeTh)
          .slice().sort((x, y) => y.w - x.w);
      },
      // Every count, so each segment carries its own definition and no legend
      // has to say what one of them selects.
      get themeTally(){
        const all = this.themeEdges;
        return {
          all: all.length,
          unlisted: all.filter(e => !this.themeListedEdge(e)).length,
          review: all.filter(e => this.themeReview(e)).length,
        };
      },

      // Union-find over whatever survives the threshold. A cluster is what the
      // dial makes, which is why the dial is the first control on the tab.
      get themeClusters(){
        const p = {};
        const find = (x) => { if (p[x] == null) p[x] = x; while (p[x] !== x) { p[x] = p[p[x]]; x = p[x]; } return x; };
        const edges = this.themeEdges;
        for (const e of edges) { const a = find(e.a), b = find(e.b); if (a !== b) p[a] = b; }
        const by = {};
        for (const e of edges) {
          const g = (by[find(e.a)] ||= { files: new Set(), edges: [] });
          g.files.add(e.a); g.files.add(e.b); g.edges.push(e);
        }
        return Object.values(by)
          .map(g => ({ files: [...g.files].sort(), edges: g.edges }))
          .sort((x, y) => y.files.length - x.files.length || y.edges[0].w - x.edges[0].w);
      },
      // Cluster order, so arcs bundle and the matrix shows blocks on the
      // diagonal rather than scatter.
      get themeOrdered(){ return this.themeClusters.flatMap(c => c.files); },

      get themeCells(){
        const o = this.themeOrdered, ix = {};
        o.forEach((f, i) => { ix[f] = i; });
        const m = {};
        for (const e of this.themeEdges) { m[ix[e.a] + ':' + ix[e.b]] = e; m[ix[e.b] + ':' + ix[e.a]] = e; }
        const out = [];
        for (let r = 0; r < o.length; r++)
          for (let c = 0; c < o.length; c++)
            out.push({ e: m[r + ':' + c] || null, diag: r === c, row: o[r], col: o[c] });
        return out;
      },

      // Built as a string, not an x-for: Alpine clones a <template> into the
      // HTML namespace, so a <path> inside <svg> parses as an unknown HTML
      // element and never draws. x-html lets the parser switch namespace.
      themeArcs(){
        const o = this.themeOrdered, R = 30, G = 108, H = Math.max(o.length * R, 1);
        const y = {};
        o.forEach((f, i) => { y[f] = i * R + R / 2; });
        const paths = this.themeEdges.map(e => {
          const bx = Math.min(G - 4, 16 + Math.abs(y[e.b] - y[e.a]) * 0.42);
          const hot = this.themeMarked(e);
          return `<path d="M ${G},${y[e.a]} C ${G - bx},${y[e.a]} ${G - bx},${y[e.b]} ${G},${y[e.b]}"`
               + ` fill="none" stroke-linecap="round" stroke="${hot ? 'var(--color-primary)' : 'currentColor'}"`
               + ` stroke-opacity="${hot ? 0.75 : 0.2}"`
               + ` stroke-width="${(1 + 4 * (e.w / this.themeMaxW)).toFixed(2)}"/>`;
        }).join('');
        return `<svg width="${G}" height="${H}" viewBox="0 0 ${G} ${H}">${paths}</svg>`;
      },
      get themeMaxW(){ return Math.max(1, ...(this.themeGraph?.edges || []).map(e => e.w)); },
      themeDir(p){ const i = p.lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i + 1); },
      themeBase(p){ return p.slice(p.lastIndexOf('/') + 1); },
      themeExcerpt(text){
        if (!text || text.length <= 180) return text || '';
        return text.slice(0, 180).replace(/\s+\S*$/, '') + '…';
      },
      // Never empty: the heaviest visible pair stands in until one is picked,
      // so the matrix always has a worked example of what a cell is.
      get themeShown(){ return this.themePick || this.themeEdges[0] || null; },

      // ── Readership ────────────────────────────────────────────────────────
      // Which documents sessions actually open, from the private registry's
      // sessions cache (state/sessions.json, docAttention). The registry says
      // what a doc is and reach says who CAN get to it; this says who did.
      //
      // A separate, token-gated fetch after the registry lands, never blocking
      // it: docs.csv is public and this tab must render for a reader with no
      // token, minus this column. It is a plain read of a committed aggregate,
      // so the crawl that refreshes it stays where it belongs, on the Sessions
      // pane; opening a docs tab should not go walking a private store.
      docReads: null,
      async loadDocReads(){
        if (this.docReads || !this.hasToken()) return;
        try {
          const S = window.RepoSessionsCache;
          const path = S?.CACHE_PATH || 'state/sessions.json';
          const reg = new window.GH({ token: window.TOKEN, repo: this.registry(), ref: 'main' });
          const cache = JSON.parse((await reg.get(path)).text);
          const by = {};
          for (const a of (cache.docAttention || [])) by[a.path] = a;
          this.docReads = by;
          // Presence, folded separately from access and never summed with it.
          // Absent until the crawl re-summarizes under record schema 6, which
          // is why every reader below falls back rather than showing a zero.
          const pres = {};
          for (const a of (cache.startupAttention || [])) pres[a.path] = a;
          this.docStartup = Object.keys(pres).length ? pres : null;
          // Invocation, for the Skills tab. Keyed by skill NAME, not by path:
          // a skill's body never passes through a file tool, so the readership
          // fold above cannot see one fire. Absent until the crawl re-summarizes
          // under row version 15, and null rather than empty so a skill reads
          // "not measured" instead of "never used" in the meantime.
          const uses = {};
          for (const a of (cache.skillAttention || [])) uses[a.path] = a;
          this.skillUses = Object.keys(uses).length ? uses : null;
          this.docReadsSessions = cache.count || 0;
        } catch {
          // A missing or unreadable cache leaves the column absent rather than
          // showing an error: the registry is not this tab's subject.
          this.docReads = null;
        }
      },
      docReadsSessions: 0,
      docPhantomsOpen: false,
      // path -> {sessions, receipt, reconstructed, last}; null while the cache
      // predates the field.
      docStartup: null,
      // skill name -> {count, sessions, last}; null while the cache predates it.
      skillUses: null,
      skillUse(name){ return this.skillUses?.[String(name || '').split(':').pop()] || null; },
      // The tail on a skill row. Silent when the fold is absent, and explicit
      // when it is present and the skill is not in it: those are "not measured"
      // and "never fired", and a blank for both would collapse the one number
      // this tab exists to show. A skill nobody invokes is the finding.
      skillUseLabel(name){
        if (!this.skillUses) return '';
        const u = this.skillUse(name);
        return u ? u.sessions + (u.sessions === 1 ? ' session' : ' sessions') : 'never fired';
      },
      skillUseHint(name){
        if (!this.skillUses) return '';
        const u = this.skillUse(name);
        if (!u) return 'Never invoked in any of the ' + this.docReadsSessions
          + ' recorded sessions. Counts the Skill tool call, so a skill whose file was '
          + 'merely opened does not appear here and one that fired does.';
        return 'Invoked in ' + u.sessions + ' of ' + this.docReadsSessions
          + ' recorded sessions (' + u.count + (u.count === 1 ? ' call' : ' calls')
          + '), last ' + (u.last || '').slice(0, 10)
          + '. Counts the Skill tool call, not a read of the file: a skill is loaded by the '
          + 'harness on invocation and never passes through a file tool. A plugin skill and '
          + 'its local twin (portable:tasks, tasks) count as one.';
      },
      docPresent(d){ return this.docStartup?.[this.docReadKey(d.path)] || null; },
      // The cache keys a file by repo-qualified path (`web-tools/docs/x.md`),
      // since a session spans repositories and `docs/README.md` alone would
      // collide across them. The registry rows are hub-relative, so qualify
      // before looking up rather than storing the same string twice.
      docReadKey(path){ return (this.docRepo || this.hub()).split('/').pop() + '/' + path; },
      // A row's `formerly` names the paths the same document carried before a
      // rename (docs.json became docs.csv, and so on), so a read of an old path
      // is a read of this row: folded here, and excluded from the phantoms.
      docReadKeys(d){
        return [d.path, ...(d.formerly || '').split(';').filter(Boolean)].map(p => this.docReadKey(p));
      },
      docRead(d){
        if (!this.docReads) return null;
        const hits = this.docReadKeys(d).map(k => this.docReads[k]).filter(Boolean);
        if (!hits.length) return null;
        return hits.reduce((a, b) => ({ path: a.path, count: a.count + b.count,
          sessions: a.sessions + b.sessions, last: a.last > b.last ? a.last : b.last }));
      },
      // What the italic tail says, and the honest empty. A never-opened doc
      // shows nothing rather than a dash, since an absence needs no ornament,
      // and the caveats the column used to state in a standing paragraph live
      // in the per-row title.
      //
      // TWO FACTS, SIDE BY SIDE, NEVER ADDED. Presence in context and being
      // opened by a tool are different things, and a document present in forty
      // sessions and opened in three has not been read forty-three times.
      // Until 2026-08-27 this rendered that difference as the literal word
      // "injected" on the two rows tagged that way, because a count would have
      // ranked the estate's two most-read files last. The record now carries
      // startup context as data, so the word is the fallback for a cache older
      // than the field rather than the only answer available.
      //
      // The "injected" label used to close with "not measurable here, and not
      // zero", which was two claims: the first true, the second an assumption
      // about a delivery path nothing was checking. It was wrong on 2026-08-26,
      // when the hook carrying both documents turned out to have been truncated
      // to a 2 KB preview since 2026-08-07. That is the strongest argument for
      // the receipts behind this column: a receipt states the BYTE COUNT the
      // hook actually supplied, so the same nineteen-day silence would now show
      // as a number that moved rather than as a label nobody could check.
      docReadLabel(d){
        const p = this.docPresent(d), a = this.docRead(d);
        if (!p && !a) return d.reach === 'injected' ? 'injected' : '';
        const parts = [];
        if (p) parts.push(p.sessions + ' in context');
        if (a) parts.push(a.sessions + (a.sessions === 1 ? ' read' : ' reads'));
        return parts.join(' \u00b7 ');
      },
      docReadHint(d){
        const p = this.docPresent(d), a = this.docRead(d);
        if (!p && !a) {
          // The pre-receipt answer, kept for a cache older than the field.
          return d.reach === 'injected' ? 'Arrives in every session\'s context through CLAUDE.md imports, which no file tool records, so this column cannot measure it.' : '';
        }
        const out = [];
        if (p) {
          // Where the number came from is part of the number. A receipt is the
          // injecting hook naming what it supplied; a reconstruction is a
          // static walk standing in for a loader with no hook to observe it,
          // since Claude Code has no InstructionsLoaded event and its memory
          // loader logs a file count rather than the paths.
          const how = p.receipt && p.reconstructed ? 'by receipt and reconstruction'
            : p.receipt ? 'by receipt from the injecting hook, which states the bytes it supplied'
            : 'by reconstruction from the filesystem, not observed';
          out.push('In context at the start of ' + p.sessions + ' of '
            + this.docReadsSessions + ' recorded sessions, ' + how + '.');
        }
        if (a) {
          out.push('Opened in ' + a.sessions + ' of ' + this.docReadsSessions + ' recorded sessions ('
            + a.count + ' accesses), last ' + (a.last || '').slice(0, 10)
            + '. Counts the file tools and shell reads (cat, sed, grep) in recorded '
            + 'sessions; a bare path in a session spanning several checkouts is not '
            + 'attributed.');
        }
        if (p && a) out.push('The two are separate facts and are not added together.');
        return out.join(' ');
      },
      // ── The constellation's documents ─────────────────────────────────────
      // The hub's rows are its curated registry. Every other repo's are the
      // index the hourly crawl keeps in the private registry
      // (lib/kits/doc-index.js, state/docs.json): Markdown paths and word
      // counts, with no subject, status or reach, which only a repo's own
      // registry could state. The strip picks the repo; every getter below
      // reads docDocs, so the rail, rows, search, readership and deck serve
      // both.
      docRepo: '',
      estateDocs: null,
      _estateRows: null,
      async loadEstateDocs(){
        if (this.estateDocs || !this.hasToken()) return;
        try {
          const reg = new window.GH({ token: window.TOKEN, repo: this.registry(), ref: 'main' });
          const doc = JSON.parse((await reg.get(window.DocIndex?.CACHE_PATH || 'state/docs.json')).text);
          this._estateRows = new Map();
          this.estateDocs = doc;
        } catch { this.estateDocs = null; }
      },
      get docRepos(){
        const hub = this.hub();
        const others = Object.entries(this.estateDocs?.repos || {})
          .filter(([repo, e]) => repo !== hub && e.docs)
          .map(([repo, e]) => ({ repo, short: repo.split('/').pop(), docs: e.docs }))
          .sort((a, b) => a.short.localeCompare(b.short));
        return [{ repo: hub, short: hub.split('/').pop(), docs: (this.docsReg?.documents || []).length }, ...others];
      },
      get docDocs(){
        if (!this.docRepo) return this.docsReg?.documents || [];
        const e = this.estateDocs?.repos?.[this.docRepo];
        if (!e || !window.DocIndex) return [];
        if (!this._estateRows.has(this.docRepo))
          this._estateRows.set(this.docRepo, window.DocIndex.rows(e)
            .map(r => ({ path: r.path, words: r.words || 0, subject: '', status: '', reach: '' })));
        return this._estateRows.get(this.docRepo);
      },
      selectDocRepo(repo){
        const next = repo === this.hub() ? '' : repo;
        if (next === this.docRepo) return;
        this.docRepo = next;
        this.docQ = ''; this.docSearchDir = ''; this.docReach = ''; this.docPendingOnly = false; this.docShowAll = false;
        this.docDir = next ? '' : 'docs';
      },
      // A data repo's folder can hold 1,800 generated files; the list shows
      // the first DOC_ROWS and says how many more there are.
      docShowAll: false,
      get docDirShown(){ return this.docShowAll ? this.docDirFiles : this.docDirFiles.slice(0, DOC_ROWS); },
      // The rail's selection.
      docDir: 'docs',
      docTextHit(d){
        const q = this.docQ.trim().toLowerCase();
        return !q || (d.path || '').toLowerCase().includes(q)
          || (d.subject || '').toLowerCase().includes(q);
      },
      // Search starts across the corpus and composes with reach. A folder
      // chosen during a search is an explicit scope; the folder that happened
      // to be open before the query is deliberately irrelevant.
      get docQueryRows(){
        return this.docDocs.filter(d => this.docHit(d));
      },
      // One test for a row being in view, which the rail's counts share.
      docHit(d){
        return this.docTextHit(d) && (!this.docReach || d.reach === this.docReach)
          && (!this.docPendingOnly || !!this.pendingOf(d));
      },
      get docTally(){
        return { shown: this.docQueryRows.length, total: this.docDocs.length };
      },
      selectDocFolder(dir){
        this.docShowAll = false;
        if (this.docQ.trim() || this.docPendingOnly) this.docSearchDir = dir;
        else this.docDir = dir;
      },
      docFolderSelected(dir){
        return (this.docQ.trim() || this.docPendingOnly) ? this.docSearchDir === dir : this.docDir === dir;
      },
      toggleDocPending(){ this.docPendingOnly = !this.docPendingOnly; this.docSearchDir = ''; },
      // The rail: every directory in the registry plus its ancestors, in DFS
      // order (lexicographic gives it, since every path shares the docs/
      // root), rolled up so a folder's count and words include everything
      // below it. Structure comes from the full registry, so the tree never
      // changes shape under a reach filter; only the counts move, and a
      // folder filtered to nothing dims rather than vanishing.
      //
      // Another repo's tree is not seven folders (home has 471), so there the
      // rail is the root, the open folder's ancestors and their siblings, and
      // the open folder's children; a search shows every folder it hits.
      get docFolders(){
        const agg = new Map();
        const est = !!this.docRepo;
        if (est) agg.set('', { n: 0, words: 0 });
        for (const d of this.docDocs) {
          const hit = this.docHit(d);
          let dir = docDirOf(d.path);
          while (dir) {
            if (!agg.has(dir)) agg.set(dir, { n: 0, words: 0 });
            if (hit) { const a = agg.get(dir); a.n++; a.words += d.words || 0; }
            dir = docDirOf(dir);
          }
          if (est && hit) { const a = agg.get(''); a.n++; a.words += d.words || 0; }
        }
        const open = this.docQ.trim() || this.docPendingOnly ? null : this.docDir;
        const within = (a, b) => a === '' || b === a || b.startsWith(a + '/');
        const shown = (dir) => !est || dir === ''
          || (open === null ? agg.get(dir).n > 0 : within(docDirOf(dir), open));
        return [...agg.entries()].filter(([dir]) => shown(dir)).sort(([a], [b]) => a.localeCompare(b))
          .map(([dir, a]) => ({
            dir, ...a,
            name: dir ? dir.slice(dir.lastIndexOf('/') + 1) : this.docRepo.split('/').pop(),
            depth: dir ? dir.split('/').length - (est ? 0 : 1) : 0,
          }));
      },
      // The selected folder's DIRECT files, filter applied; subfolder contents
      // stay behind their own rail rows.
      //
      // Registry order is the default and stays the default: it is the order
      // the folder actually has, and a reader looking for a known file finds it
      // there. The sort is the other question, "what is nobody opening", which
      // registry order answers only by making someone read every row.
      //
      // An injected doc sorts by its own channel, not by a zero. Nothing reads
      // it with a file tool by construction, so ranking it on reads would put
      // the estate's two most-delivered documents at the cold end, which is the
      // failure the readership column already refuses to make on a single row.
      get docDirFiles(){
        let rows = this.docQueryRows;
        if (this.docQ.trim() || this.docPendingOnly) {
          if (this.docSearchDir) rows = rows.filter(d => d.path.startsWith(this.docSearchDir + '/'));
        } else {
          rows = rows.filter(d => docDirOf(d.path) === this.docDir);
        }
        if (!this.docSort || !this.docReads) return rows;
        const rank = (d) => {
          const a = this.docRead(d), p = this.docPresent(d);
          return Math.max(a ? a.sessions : 0, p ? p.sessions : 0);
        };
        const dir = this.docSort === 'cold' ? -1 : 1;
        return [...rows].sort((x, y) =>
          dir * (rank(y) - rank(x)) || x.path.localeCompare(y.path));
      },
      // '' registry order, 'hot' most-opened first, 'cold' least. Cold is the
      // one worth having; hot is its inverse and costs one more state.
      docSort: '',
      cycleDocSort(){
        this.docSort = this.docSort === '' ? 'cold' : this.docSort === 'cold' ? 'hot' : '';
      },
      docSortLabel(){
        return this.docSort === 'cold' ? 'Coldest first'
          : this.docSort === 'hot' ? 'Most opened first' : 'Registry order';
      },

      // Reads that resolved to nothing: a path some session opened under this
      // hub's docs/ that the registry does not carry. Two causes and the
      // registry cannot tell them apart, so neither can this: a doc that has
      // since been deleted or renamed, and a path that never existed because a
      // session guessed it. The second is the one worth surfacing, and it is
      // the only direct evidence the estate holds that a document could not be
      // found by the name someone reached for. Measured 2026-08-30: five such
      // rows, among them docs/html-style.md, lowercase, for a file that is
      // HTML-STYLE.md, and three paths cut short of their .md.
      get docPhantoms(){
        if (!this.docReads || !this.docsReg || this.docRepo) return [];
        const have = new Set((this.docsReg.documents || []).flatMap(d => this.docReadKeys(d)));
        const prefix = this.hub().split('/').pop() + '/docs/';
        return Object.values(this.docReads)
          .filter(a => a.path.startsWith(prefix) && !have.has(a.path))
          .sort((a, b) => (b.sessions - a.sessions) || a.path.localeCompare(b.path));
      },
      // The folder's README subject doubles as the folder's description; a
      // folder without one shows nothing, which is itself information.
      get docDirGloss(){
        if (this.docQ.trim() || this.docPendingOnly) return '';
        const row = this.docDocs.find(d => d.path === this.docDir + '/README.md');
        return row ? row.subject : '';
      },
      get docResultHeading(){
        if (!this.docQ.trim() && !this.docPendingOnly) return (this.docDir || this.docRepo.split('/').pop()) + '/';
        return this.docSearchDir ? this.docSearchDir + '/' : this.docQ.trim() ? 'Search results' : 'With proposed edits';
      },
      docResultTitle(d){ return (this.docQ.trim() || this.docPendingOnly) ? d.path : this.docTitle(d); },
      folderGh(dir){
        return 'https://github.com/' + (this.docRepo || this.hub()) + '/tree/' + (this.docRepo ? 'HEAD' : useRef()) + (dir ? '/' + dir : '');
      },
      docPeek(d){ return this.docRepo ? (window.SourcePeek?.addr(this.docRepo, 'HEAD', d.path) || null) : this.peek(d.path); },
      fmtWords(n){ return kw(n); },
      // The counted half of swipeDeck.entry's title, spelled the way every
      // other template-driven door spells it (branch-brief owns the original).
      plural(n, noun){ return n + ' ' + noun + (n === 1 ? '' : 's'); },
      docTitle(d){ return d.path.slice(d.path.lastIndexOf('/') + 1); },

      // Reading a doc: the house swipe deck, opened on the tapped row and
      // paging the selected folder's files as they are currently filtered.
      // Fetched full rather than excerpted (the peek is the glance, this is
      // the read), cached per ref:path so swiping back costs nothing. The
      // whole surface is imperative DOM: swipe-deck is framework-free, which
      // is also what keeps Alpine's moved-node hazards out of it.
      docDetails: false,
      _deck: null,
      _deckKey: '',
      _deckFiles: null,
      _deckToken: 0,
      _deckSerial: 0,
      _deckReading: null,
      // docDeckRead, not docRead: the readership column's per-row accessor
      // (main's parallel work, merged 2026-08-07) already owns that name, and
      // a duplicate object key would shadow it silently.
      // A deck slide's path is a hub path, or owner/repo@ref:path for a file
      // in another repo (the Context tab's sources live in four). One parse,
      // so the fetch, the copied address and the link pass agree on which.
      deckSource(p){
        const m = /^([\w.-]+\/[\w.-]+)@([^:]+):(.+)$/.exec(p || '');
        return m ? { repo: m[1], ref: m[2], path: m[3], foreign: true }
                 : { repo: this.hub(), ref: useRef(), path: p, foreign: false };
      },
      async docDeckText(path){
        const src = this.deckSource(path);
        const key = src.repo + '@' + src.ref + ':' + src.path;
        if (!docCache.has(key)) {
          const gh = new window.GH({ token: window.TOKEN, repo: src.repo, ref: src.ref });
          docCache.set(key, (await gh.get(src.path)).text);
        }
        return docCache.get(key);
      },
      // The address a copied SECTION carries, assembled here because this is
      // the only place that knows all four parts: which repo the deck reads,
      // which ref it is pinned at, which file the slide is, and the blob URL a
      // person rather than a tool would open. mdDoc adds the line span.
      docDeckAddr(path){
        const src = this.deckSource(path);
        if (!src.foreign) return { repo: this.hub(), ref: useRef(), path, url: this.hubUrl(path) };
        return { repo: src.repo, ref: src.ref, path: src.path,
                 url: 'https://github.com/' + src.repo + '/blob/' + src.ref + '/' + src.path };
      },
      // The registries are a useful immediate seed, but not the authority for
      // whether a repository path exists: a skill can cite an unregistered
      // sibling. The recursive tree fills that gap once per ref. Failure is
      // non-fatal; authored links keep their ordinary GitHub href and inline
      // code remains inert unless the paths already in hand prove the match.
      deckKnownPaths(path){
        const out = new Set([
          path, SET_MANIFEST, ROUTES_MANIFEST, ROUTES_MODES, ROUTES_ROUTES,
          ROUTES_KINDS, ROUTES_PASTE, SUBJECTS, SHOWING_MECHANISMS, DOCS_MANIFEST,
          OWNERS_MANIFEST, OWNERS_REPS, THEMES_GRAPH, SURF_MANIFEST, SURF_DOC,
          TESTS_MANIFEST, AGENTS_MANIFEST, TOOLS_MANIFEST, KITS_MANIFEST, SKILLS_MANIFEST, CTX_MANIFEST, CTX_TOPICS,
          OUTPOSTS_MANIFEST, ACCOUNT_SKILLS_MANIFEST, OUTPOSTS_DOC,
          ...SURF_SIBLINGS.map(s => s.path),
        ].filter(Boolean));
        const add = rows => { for (const r of rows || []) if (r?.path) out.add(r.path); };
        add(this.manifest?.items);
        add(this.docsReg?.documents);
        add(this.testsReg?.tests);
        add(this.toolsReg?.tools);
        add(this.kitsReg?.kits);
        add(this.skillsReg);
        add(this.agentsReg);
        add(this._deckFiles);
        return out;
      },
      async deckRepoPaths(path){
        const key = this.hub() + '@' + useRef();
        if (!repoPathCache.has(key)) {
          const seed = this.deckKnownPaths(path);
          repoPathCache.set(key, (async () => {
            try {
              const gh = new window.GH({ token: window.TOKEN, repo: this.hub(), ref: useRef() });
              const tree = await gh.req('git/trees/' + encodeURIComponent(gh.ref || useRef()) + '?recursive=1');
              for (const e of tree?.tree || []) if (e.type === 'blob' && e.path) seed.add(e.path);
            } catch { /* a registry-seeded reader is still useful offline */ }
            return seed;
          })());
        }
        const paths = await repoPathCache.get(key);
        for (const p of this.deckKnownPaths(path)) paths.add(p);
        return paths;
      },
      deckReading(path){ return this._deckReading?.[path] || 'rendered'; },
      deckCanRender(path){ return /\.(?:md|markdown|csv)$/i.test(path || ''); },
      async docDeckRead(host, path){
        const generation = (host.__deckRenderGeneration || 0) + 1;
        host.__deckRenderGeneration = generation;
        const reading = this.deckReading(path);
        const text = await this.docDeckText(path);
        const foreign = this.deckSource(path).foreign;
        const paths = reading === 'rendered' && !foreign ? await this.deckRepoPaths(path) : new Set();
        const scratch = host.ownerDocument.createElement('div');
        const actual = await renderDoc(scratch, path, text, this.docDeckAddr(path), reading);
        // A lazy rendered pass may finish after the reader has asked for raw.
        // Build off-DOM and commit only the newest request whose mode still
        // agrees with the file's state.
        if (host.__deckRenderGeneration !== generation || this.deckReading(path) !== reading) return host;
        host.replaceChildren(...scratch.childNodes);
        if (actual !== reading && this.deckCanRender(path)) {
          this._deckReading = { ...(this._deckReading || {}), [path]: actual };
          if (this.deckPath() === path) this._deck?.setActions?.(this.deckActions(path));
        }
        if (actual === 'rendered' && !foreign) window.mdDoc?.linkRepoFiles?.(host, {
          path,
          paths,
          href: (target, hash) => this.hubUrl(target) + (hash || ''),
          open: target => this.openDeckLink(target),
        });
        if (actual === 'rendered' && !foreign) this.markDeckProposals(host, path, text).catch(() => {});
        return host;
      },
      // THE SLIDE IS THE DOCUMENT, and nothing above it. It used to lead with a
      // strip carrying the path, a GitHub mark and a "files view" button, which
      // named the file a THIRD time (the header's title and subtitle are the
      // other two, each elided a different way) and put two doors inside the
      // reading surface. kits/file-deck.js had already made this call for the
      // changeset deck and written down why; this half of the estate had not
      // followed. Both doors moved into the header, where the kit owns a `link`
      // slot and an actions row and the reader finds them in the same place on
      // every deck.
      // On the component only so the gate can reach it: the conversion is a
      // module-level pure function and renderDoc calls it directly, but a rule
      // about what a cell may not be reinterpreted as is worth holding, and
      // map-view.test.mjs mounts the component rather than the module.
      csvToMarkdown,
      //
      // IT RECORDS WHEN IT IS DONE, because a caller that wants to point INSIDE
      // a slide has to wait for three async steps it cannot see: the fetch,
      // marked, and md-doc. showPrimitive below is that caller, and without
      // this it scrolled an empty box. Keyed by path plus the deck generation
      // rather than by index, since the index is the deck's, the path is the
      // file's, and a reopened child must not inherit a detached prior box.
      _slideReady: null,
      renderDocSlide(d, slide, token = this._deckToken){
        slide.innerHTML =
          '<div data-deck-content><div class="flex justify-center py-10">' +
          '<span class="loading loading-dots loading-md opacity-30"></span></div></div>';
        const box = slide.querySelector('[data-deck-content]');
        const done = this.docDeckRead(box, d.path)
          .catch(e => {
            box.innerHTML = '<div class="text-base text-error font-mono py-4">Load failed: '
              + esc(e?.message || e) + '</div>';
          })
          .then(() => box);
        (this._slideReady ||= new Map()).set(d.path, { token, promise: done });
        return done;
      },
      deckBox(){
        const h = this._deck;
        const i = h?.deck?.active?.() ?? 0;
        return h?.deck?.track?.children?.[i]?.querySelector?.('[data-deck-content]') || null;
      },
      async toggleDeckReading(){
        const path = this.deckPath();
        if (!this.deckCanRender(path)) return;
        const next = this.deckReading(path) === 'source' ? 'rendered' : 'source';
        this._deckReading = { ...(this._deckReading || {}), [path]: next };
        this._deck?.setActions?.(this.deckActions(path));
        const box = this.deckBox();
        if (!box) return;
        box.innerHTML = '<div class="flex justify-center py-10">'
          + '<span class="loading loading-dots loading-md opacity-30"></span></div>';
        const done = this.docDeckRead(box, path).catch(e => {
          box.innerHTML = '<div class="text-base text-error font-mono py-4">Load failed: '
            + esc(e?.message || e) + '</div>';
        }).then(() => box);
        (this._slideReady ||= new Map()).set(path, { token: this._deckToken, promise: done });
        return done;
      },
      async landDeckHash(path, hash){
        if (!hash) return;
        const box = await this.slideBox(path);
        if (!box) return;
        let id = String(hash).replace(/^#/, '');
        try { id = decodeURIComponent(id); } catch { /* keep the authored id */ }
        const target = [...box.querySelectorAll('[id]')].find(el => el.id === id);
        if (target) this.markLead(target);
      },
      async openDeckLink(target){
        if (!target?.path) return;
        const files = this._deckFiles || [];
        const at = files.findIndex(f => f.path === target.path);
        if (at >= 0) {
          this._deck?.deck?.build?.(at);
          this._deck?.deck?.go?.(at);
          return this.landDeckHash(target.path, target.hash);
        }
        const parent = this._deck;
        return this.openFileDeck([{ path: target.path }], 0, {
          icon: 'ph-file-text', key: 'linked:' + target.path,
          context: 'Linked file', parent,
          label: f => ({ title: this.docTitle(f), subtitle: f.path }),
          hash: target.hash || '',
        });
      },
      deckActions(path = this.deckPath()){
        const actions = [];
        if (this.deckCanRender(path)) {
          const source = this.deckReading(path) === 'source';
          const markdown = /\.(?:md|markdown)$/i.test(path || '');
          actions.push({
            icon: source ? 'ph-eye' : 'ph-code',
            title: source ? 'View rendered ' + (markdown ? 'Markdown' : 'table')
                          : 'View raw ' + (markdown ? 'Markdown' : 'CSV'),
            onClick: () => this.toggleDeckReading(),
          });
        }
        const proposed = this.deckReading(path) === 'rendered' ? this.deckEdits(path).length : 0;
        if (proposed) actions.push({ icon: 'ph-pencil-simple',
          title: this.plural(proposed, 'proposed edit') + ' on this document: go to the next',
          onClick: () => this.nextDeckProposal() });
        actions.push({ icon: 'ph-dots-three-vertical', title: 'Reference and actions',
          onClick: (_deck, btn) => this.openDeckMenu(btn) });
        return actions;
      },
      // ONE DECK FOR BOTH LISTS, and that is the point of the shape rather
      // than a saving. The Docs tab read a row here; Distribution reached
      // its file by NAVIGATING to the Files view, which is a route change and
      // not an overlay, so the list the reader was working through was gone and
      // the way back was the browser's. Two tabs in one view answered the same
      // tap two different ways. The deck is the better answer, because it keeps
      // the set, the reader's place in it, and the return path.
      //
      // A slide needs only `.path` (renderDoc decides the rendition by
      // extension and drops to a <pre> for source), so one renderer serves a
      // doc, a SKILL.md and a .py script alike. Kept as ONE function rather
      // than one per tab, since two would be two reading experiences a month
      // from now and nothing would report the drift.
      //
      // `start` is clamped here rather than at each call site: a findIndex miss
      // returns -1, and a deck opened at -1 is a blank first slide with the
      // pager already wrong.
      //
      // ONE LABELER, TWO READERS, which is what keeps the header and the
      // contents list from describing the same row two ways. `label(row)`
      // answers {title, subtitle, icon}; the HEADER takes the title and pairs
      // it with the locating half (the caller's context plus this file's
      // folder), and the CONTENTS list takes the title and the subtitle, which
      // is the gloss. The split is deliberate: a header answers "where am I"
      // and has one line to do it in, while a list is being scanned for "which
      // one did I want" and the subject is what answers that.
      // RE-AIM RATHER THAN STACK. Docked, the list stays on screen and stays
      // clickable, so a second tap is the ordinary case rather than the odd one,
      // and opening a second deck over the first would bury the reader one Back
      // press deeper for every row they looked at. Same list and a deck already
      // open: go to that slide. `key` is what "same list" means, since the two
      // tabs hand in different sets and the Docs tab a different one per folder.
      // A different key closes and reopens, which is the honest answer: the
      // pager, the title and the swipe range all belong to the old set.
      async openFileDeck(files, start, o){
        if (!files?.length) return;
        const { icon, key, context = '', label, parent = null, hash = '' } = o || {};
        start = Math.max(0, Math.min(start, files.length - 1));
        if (!parent && this._deck && this._deckKey === key) {
          this._deck.deck.go(start);
          return hash ? this.landDeckHash(files[start].path, hash) : this._deck;
        }
        const previous = parent
          ? { deck: this._deck, key: this._deckKey, files: this._deckFiles, token: this._deckToken }
          : null;
        if (!parent) this._deck?.close();
        if (!window.swipeDeck && window.gh?.load) {
          try { await window.gh.load('kits/swipe-deck.js'); } catch { /* fall through */ }
        }
        if (!window.swipeDeck) return this.openHubFile(files[start].path);
        const at = (i) => files[i] || {};
        const lab = (i) => (label ? label(at(i), i) : null) || {};
        const dirOf = (i) => {
          const path = at(i).path || '';
          const j = path.lastIndexOf('/');
          return j < 0 ? '' : path.slice(0, j);
        };
        const crumb = (i) => [context, dirOf(i)].filter(Boolean).join(' · ');
        // Named rather than "Open": where a link goes is worth saying, which is
        // the same reason the kit lets a link carry its own mark.
        const ghAt = (i) => ({ href: this.hubUrl(at(i).path || ''), icon: 'ph-github-logo',
                               title: 'Open ' + (at(i).path || '') + ' on GitHub' });
        this._deckKey = key;
        this._deckFiles = files;
        const token = ++this._deckSerial;
        this._deckToken = token;
        let handle = null;
        const opts = {
          count: files.length,
          start,
          title: lab(start).title || this.docTitle(at(start)),
          subtitle: crumb(start),
          icon,
          link: ghAt(start),
          index: (i) => ({ title: lab(i).title || this.docTitle(at(i)),
                           subtitle: lab(i).subtitle || '', icon: lab(i).icon || '' }),
          actions: this.deckActions(at(start).path),
          render: (i, slide) => this.renderDocSlide(files[i], slide, token),
          onSlide: (i) => {
            this.closeDeckMenu();
            const h = handle;
            if (!h) return;
            h.setTitle(lab(i).title || this.docTitle(at(i)));
            h.setSubtitle(crumb(i));
            h.setLink(ghAt(i));
            h.setActions?.(this.deckActions(at(i).path));
          },
          onClose: () => {
            this.closeDeckMenu();
            // Alpine proxies an assigned plain handle, so object identity is
            // not stable across `this._deck = handle`. A scalar generation is.
            if (this._deckToken !== token) return;
            this._deck = previous?.deck || null;
            this._deckKey = previous?.key || '';
            this._deckFiles = previous?.files || null;
            this._deckToken = previous?.token || 0;
          },
        };
        handle = parent && window.swipeDeck.drill
          ? window.swipeDeck.drill(parent, opts)
          : window.swipeDeck.open({ ...opts, back: !!parent });
        this._deck = handle;
        handle?.setActions?.(this.deckActions(at(start).path));
        if (hash) queueMicrotask(() => this.landDeckHash(at(start).path, hash));
        return handle;
      },

      // ── The reference menu ────────────────────────────────────────────────
      //
      // What the slide's old strip did, in the one place a phone has room for
      // it. Four of the five rows answer the same question the strip never
      // asked: how does a reader take this file WITH them. The estate has one
      // spelling for that, `owner/repo[@ref]:path`, which a toss, a stage and a
      // data view all read, so "copy address" hands over the qualified form
      // rather than a path that means nothing outside this repo. Copying the
      // contents costs no fetch: the slide already read the file into docCache,
      // keyed by the same ref this menu quotes.
      //
      // The fifth row is the strip's "files view" door, and it keeps its words.
      // As a bare icon in the header it would promise a direction and name no
      // destination, which on a surface with no tooltips is a worse trade than
      // one extra row in a menu the reader opened on purpose.
      _deckMenu: null,
      deckPath(){
        const i = this._deck?.deck?.active?.() ?? 0;
        return this._deckFiles?.[i]?.path || '';
      },
      deckAddress(path){ return this.hub() + '@' + useRef() + ':' + path; },
      // The address as a HINT, which is a different job from the address. The
      // row still copies all forty characters of the SHA, the one place the
      // conventions call being approximately right being wrong; this line only
      // has to let a reader recognize what they are about to copy.
      //
      // So it is budgeted from the RIGHT, which is the lesson kits/file-deck.js
      // learned about a deep path: CSS truncates from the right,
      // so the untouched address spent its whole width on `owner/repo@` plus
      // thirty-three characters of hex and dropped `:docs/APP.md`, the only
      // part that says WHICH FILE. Shortening the SHA was not enough on a
      // phone; the owner and repo had to go too, and they are the third a
      // reader of this menu already knows, since every row in the deck is this
      // hub's. The leading ellipsis says the copied value is longer.
      deckAddressHint(path){
        const ref = useRef();
        return '…@' + (/^[0-9a-f]{40}$/.test(ref) ? ref.slice(0, 7) : ref) + ':' + path;
      },
      async deckCopy(text, said){
        const toast = window.Alpine?.store?.('toast');
        try {
          await navigator.clipboard.writeText(text);
          toast?.('check', said, 'alert-success', 2000);
        } catch (e) {
          toast?.('warning', 'Could not copy: ' + (e?.message || e), 'alert-error', 4000);
        }
      },
      closeDeckMenu(){
        if (!this._deckMenu) return;
        this._deckMenu.destroy();
        this._deckMenu = null;
      },
      openDeckMenu(btn){
        if (this._deckMenu) return this.closeDeckMenu();   // the button toggles
        const host = this._deck?.el;
        const path = this.deckPath();
        if (!host || !path) return;
        const rows = [
          { icon: 'ph-at', label: 'Copy address', hint: this.deckAddressHint(path),
            full: this.deckAddress(path),
            run: () => this.deckCopy(this.deckAddress(path), 'Address copied') },
          { icon: 'ph-file-text', label: 'Copy path', hint: path,
            run: () => this.deckCopy(path, 'Path copied') },
          { icon: 'ph-link-simple', label: 'Copy GitHub link',
            hint: 'the blob at ' + (/^[0-9a-f]{40}$/.test(useRef()) ? useRef().slice(0, 7) : useRef()),
            run: () => this.deckCopy(this.hubUrl(path), 'Link copied') },
          { icon: 'ph-clipboard-text', label: 'Copy contents', hint: 'the file as it reads here',
            run: async () => {
              await this.deckCopy(await this.docDeckText(path) || '', 'Contents copied');
            } },
          { icon: 'ph-arrow-square-out', label: 'Open in the files view',
            hint: 'for history and editing', sep: true,
            run: () => { this._deck?.close(); this.openHubFile(path); } },
        ];
        const menu = document.createElement('div');
        menu.className = 'absolute z-30 w-64 max-w-[calc(100%-1rem)] overflow-hidden rounded-xl '
          + 'border border-base-300 bg-base-100 shadow-xl';
        // IT HANGS OFF ITS OWN BUTTON. Pinned to the panel's right edge it
        // dropped from under the counter pill, two controls away from the thing
        // that opened it, which reads as a panel that arrived on its own. The
        // kit hands an action its button for exactly this. Falling back to the
        // header's measured height keeps it sane if a caller ever fires the
        // action from somewhere other than the header.
        const box = host.getBoundingClientRect();
        const r = btn?.getBoundingClientRect?.();
        menu.style.top = ((r ? r.bottom - box.top : (host.querySelector('.sd-header')?.offsetHeight || 56)) + 4) + 'px';
        menu.style.right = Math.max(8, r ? box.right - r.right : 8) + 'px';
        for (const r of rows) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-base-200/70 '
            + (r.sep ? 'border-t border-base-300' : '');
          // The elided hint in full, for a reader with a pointer. A phone gets
          // nothing from this and loses nothing by it.
          if (r.full) b.title = r.full;
          b.innerHTML = '<i class="ph ' + r.icon + ' mt-0.5 shrink-0 text-base text-base-content/50"></i>'
            + '<span class="min-w-0 flex-1"><span class="block text-sm">' + esc(r.label) + '</span>'
            + '<span class="block truncate text-xs text-base-content/50">' + esc(r.hint || '') + '</span></span>';
          b.addEventListener('click', () => { this.closeDeckMenu(); r.run(); });
          menu.append(b);
        }
        // Dismissal, and the Escape half is not decoration: the deck listens for
        // Escape on the window to close itself, so without a capture-phase
        // listener here the key would take the whole takeover down while a menu
        // was the only thing the reader meant to shut.
        const away = (e) => { if (!menu.contains(e.target)) this.closeDeckMenu(); };
        const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); this.closeDeckMenu(); } };
        this._deckMenu = {
          el: menu,
          destroy(){
            document.removeEventListener('pointerdown', away, true);
            document.removeEventListener('keydown', key, true);
            menu.remove();
          },
        };
        host.append(menu);
        // Next frame, so the click that opened this does not immediately close it.
        requestAnimationFrame(() => {
          document.addEventListener('pointerdown', away, true);
          document.addEventListener('keydown', key, true);
        });
      },
      openDocDeck(d){
        const files = this.docRepo
          ? this.docDirFiles.map(f => ({ ...f, path: this.docRepo + '@HEAD:' + f.path, local: f.path }))
          : this.docDirFiles;
        if (this.docRepo) d = files.find(f => f.local === d.path) || d;
        const searchKey = this.docQ.trim().toLowerCase();
        return this.openFileDeck(files, files.findIndex(f => f.path === d.path), {
          icon: 'ph-books',
          key: searchKey
            ? 'docs:search:' + searchKey + ':' + this.docSearchDir + ':' + this.docReach + ':' + this.docSort
            : 'docs:' + this.docRepo + ':' + this.docDir + ':' + this.docReach + ':' + this.docSort,
          // A normal folder needs no extra context; a corpus-wide query does,
          // because its slides can come from several directories.
          context: searchKey ? 'Search results' : '',
          label: (d2) => ({ title: searchKey ? (d2.local || d2.path) : this.docTitle(d2), subtitle: d2.subject || '' }),
        });
      },

      // Reach: the derived channel by which a reader gets to a doc. The counts
      // are the tab's headline because they are the one number here that moves
      // when the estate improves: point a skill or a page at an orphan and it
      // leaves the orphan column. Tapping a count filters the registry to it, so
      // "which 18 are orphans" is one tap rather than a scan.
      docReach: '',
      get docReachCounts(){
        const out = REACH_ORDER.map(key => ({ key, ...REACH[key], n: 0, words: 0 }));
        const rows = this.docDocs.filter(d => this.docTextHit(d));
        for (const d of rows) {
          const row = out.find(r => r.key === d.reach);
          if (row) { row.n++; row.words += (d.words || 0); }
        }
        const total = rows.reduce((n, d) => n + (d.words || 0), 0) || 1;
        for (const r of out) r.share = Math.round(r.words / total * 100);
        return out;
      },
      // Mass, alongside the counts. A channel's file count says how many docs
      // sit there; its share says how much of the folder they are. The two
      // point in different directions here, which is the reason both render.
      get docWordTotal(){
        return this.docDocs.reduce((s, d) => s + (d.words || 0), 0);
      },
      docSize(d){ return kw(d.words || 0); },
      docShare(d){
        const total = this.docWordTotal || 1;
        return Math.round((d.words || 0) / total * 100);
      },
      reachMeta(key){ return REACH[key] || { label: key, tone: 'badge-ghost' }; },

      // ── Skills ────────────────────────────────────────────────────────────
      // Two authored columns and nothing else, so the tab earns its place on
      // one affordance rather than on richness: the description IS the trigger
      // text a session matches against, so searching it answers "is there a
      // skill for this?", which 35 SKILL.md files and no index could not.
      skillsReg: null,
      skillsLoading: false,
      skillsErr: '',
      skillQ: '',
      async loadSkillsReg(){
        if (this.skillsReg || this.skillsLoading) return;
        this.skillsLoading = true;
        this.skillsErr = '';
        try {
          const gh = new window.GH({ token: window.TOKEN, repo: this.hub(), ref: useRef() });
          const [raw] = await Promise.all([
            gh.get(SKILLS_MANIFEST).then(r => r.text),
            this.loadPropsReg(),   // idempotent; carries the group vocabulary
          ]);
          const rows = window.Csv.rows(raw);
          if (!rows.length) throw new Error('no skills manifest');
          window.SourcePeek?.seed(this.peek(SKILLS_MANIFEST), raw);
          this.skillsReg = rows;
        } catch (e) {
          this.skillsErr = 'Skills load failed: ' + (e?.message || e);
        } finally { this.skillsLoading = false; }
      },
      // Name and description both, because a reader searching for a capability
      // has the words of the task, not the slug. Matching the description is
      // the whole point of holding it here.
      // ── Outside skills ────────────────────────────────────────────────────
      // Public, so it renders without a token. Matching runs on the id and the
      // rationale, the words a reader would search with.
      upstreams: null,
      async loadUpstreams(){
        if (this.upstreams) return;
        try {
          const gh = new window.GH({ token: window.TOKEN, repo: this.hub(), ref: useRef() });
          const raw = (await gh.get(UPSTREAM_SKILLS)).text;
          window.SourcePeek?.seed(this.peek(UPSTREAM_SKILLS), raw);
          this.upstreams = window.Csv.rows(raw);
        } catch (e) { this.upstreams = []; }
      },
      get upstreamRows(){
        const q = this.skillQ.trim().toLowerCase();
        const rows = this.upstreams || [];
        return q ? rows.filter(r => (r.id + ' ' + r.rationale).toLowerCase().includes(q)) : rows;
      },
      upstreamVocab(value, field){
        const row = (this.propsReg?.vocab || []).find(
          x => x.registry === 'upstream-skills' && x.property === 'status' && x.value === value);
        return row?.[field] || (field === 'label' ? value : '');
      },
      // An upstream's address: a GitHub folder at its pinned commit, or the
      // page it was found on when it lives elsewhere.
      upstreamHref(r){
        const m = String(r?.upstream || '').match(/^([\w.-]+\/[\w.-]+):(.+)$/);
        return m ? 'https://github.com/' + m[1] + '/tree/' + (r.pinned || 'HEAD') + '/' + m[2] : (r?.upstream || '');
      },
      // The row a copied skill came from, joined on the registry's `ours`, so
      // the origin is stated once and a Plugin or Library row only points at it.
      upstreamOf(name){
        return (this.upstreams || []).find(r => r.ours === 'skills/' + name) || null;
      },

      // ── The agent roster ──────────────────────────────────────────────────
      // Four sets on one tab row: the critics and the review panel's seats the
      // plugin ships, the readers hub skills spawn, and every other repo's own
      // agents from the crawl. A reader is grouped under the skill that spawns
      // it, since that skill's text is its prompt.
      agentsReg: null,
      agentsLoading: false,
      agentsErr: '',
      agentQ: '',
      agentSet: 'critic',
      agentIcons: {},
      estateAgents: null,
      AGENT_SETS: [
        { key: 'critic', label: 'Critics', icon: 'ph-scales' },
        { key: 'panel', label: 'Panel', icon: 'ph-users-three' },
        { key: 'inline', label: 'In skills', icon: 'ph-sparkle' },
        { key: 'estate', label: 'Estate', icon: 'ph-globe-hemisphere-west' },
      ],
      async loadAgentsReg(){
        if (this.agentsReg || this.agentsLoading) return;
        this.agentsLoading = true;
        this.agentsErr = '';
        try {
          const gh = new window.GH({ token: window.TOKEN, repo: this.hub(), ref: useRef() });
          const raw = (await gh.get(AGENTS_MANIFEST)).text;
          const rows = window.Csv.rows(raw);
          if (!rows.length) throw new Error('no agent roster');
          window.SourcePeek?.seed(this.peek(AGENTS_MANIFEST), raw);
          this.agentsReg = rows;
          // Icons arrive after the cards, the way the shell's project icons
          // do: a glyph stands in until each SVG is read, and a failed read
          // leaves the glyph rather than holding the roster back.
          rows.filter(a => a.icon).forEach(a => gh.get(a.icon)
            .then(j => { this.agentIcons = { ...this.agentIcons,
              [a.id]: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(j.text) }; })
            .catch(() => {}));
        } catch (e) {
          this.agentsErr = 'Agents load failed: ' + (e?.message || e);
        } finally { this.agentsLoading = false; }
      },
      // Token-gated and silent on failure, as the estate skills are: the
      // roster is public and renders without a token, minus this set.
      async loadEstateAgents(){
        if (this.estateAgents || !this.hasToken()) return;
        try {
          const path = window.RepoConfigCache?.CACHE_PATH || 'state/configs.json';
          const reg = new window.GH({ token: window.TOKEN, repo: this.registry(), ref: 'main' });
          const cache = JSON.parse((await reg.get(path)).text);
          const groups = [];
          for (const [repo, e] of Object.entries(cache?.repos || {})) {
            if (repo === this.hub()) continue;   // the hub's own are the roster
            const raw = e?.config?.agents || [];
            if (!Array.isArray(raw) || !raw.length) continue;
            const agents = raw
              .map(a => (typeof a === 'string' ? { name: a } : a))
              .filter(a => a && a.name)
              .map(a => ({ name: String(a.name), repo }))
              .sort((a, b) => a.name.localeCompare(b.name));
            if (agents.length) groups.push({ repo, short: repo.split('/').pop(), agents });
          }
          groups.sort((a, b) => a.short.localeCompare(b.short));
          this.estateAgents = groups;
        } catch { this.estateAgents = null; }
      },
      agentHit(...vals){
        const q = this.agentQ.trim().toLowerCase();
        return !q || vals.some(v => String(v || '').toLowerCase().includes(q));
      },
      agentDefsOf(team){
        return (this.agentsReg || []).filter(a => a.kind === 'definition' && a.team === team
          && this.agentHit(a.id, a.role, a.model, a.preloads));
      },
      get agentDefs(){ return this.agentDefsOf(this.agentSet); },
      get agentInlineGroups(){
        const by = new Map();
        for (const a of (this.agentsReg || []).filter(a => a.kind === 'inline')) {
          if (!this.agentHit(a.id, a.role, a.model)) continue;
          const [skill, name] = a.id.split(':');
          if (!by.has(skill)) by.set(skill, []);
          by.get(skill).push({ ...a, name });
        }
        return [...by].map(([skill, rows]) => ({ skill, rows }))
          .sort((a, b) => a.skill.localeCompare(b.skill));
      },
      get estateAgentGroups(){
        return (this.estateAgents || [])
          .map(g => ({ ...g, agents: g.agents.filter(a => this.agentHit(a.name, g.short)) }))
          .filter(g => g.agents.length);
      },
      agentCount(key){
        if (key === 'inline') return this.agentInlineGroups.reduce((t, g) => t + g.rows.length, 0);
        if (key === 'estate') return this.estateAgentGroups.reduce((t, g) => t + g.agents.length, 0);
        return this.agentDefsOf(key).length;
      },
      get agentSetCounts(){ return this.AGENT_SETS.map(c => ({ ...c, n: this.agentCount(c.key) })); },
      get agentShownN(){ return this.agentCount(this.agentSet); },

      // ── The owner's pet peeves ────────────────────────────────────────────
      // One row per peeve, each a bar sized by how many recorded sessions show
      // the correction, grouped two ways. By area is what the work was; by
      // where written is how far the peeve has travelled from the owner's
      // complaint toward a rule a session loads or a check that refuses it,
      // the path a snag takes once it recurs. Groups are ordered by summed
      // sessions and a bar is scaled to the heaviest peeve in the whole list,
      // so lengths compare across groups and stay put under the search.
      peevesReg: null,
      peevesLoading: false,
      peevesErr: '',
      peeveQ: '',
      peeveAxis: 'area',
      peeveOpen: '',
      peeveQuotes: null,
      PEEVE_AXES: [
        { key: 'area', label: 'Area', icon: 'ph-squares-four' },
        { key: 'written', label: 'Where written', icon: 'ph-file-text' },
      ],
      PEEVE_WRITTEN: [
        { key: 'nowhere', label: 'Only in this list', icon: 'ph-chat-circle' },
        { key: 'doc', label: 'Stated in a document', icon: 'ph-file-text' },
        { key: 'check', label: 'Checked by a script', icon: 'ph-gear-six' },
      ],
      async loadPeeves(){
        if (this.peevesReg || this.peevesLoading) return;
        this.peevesLoading = true;
        this.peevesErr = '';
        try {
          const gh = new window.GH({ token: window.TOKEN, repo: this.hub(), ref: useRef() });
          const raw = (await gh.get(PEEVES_LIST)).text;
          const rows = window.Csv.rows(raw).map(r => ({ ...r, n: +r.sessions || 0 }));
          if (!rows.length) throw new Error('no peeves');
          window.SourcePeek?.seed(this.peek(PEEVES_LIST), raw);
          this.peevesReg = rows;
        } catch (e) {
          this.peevesErr = 'Peeves load failed: ' + (e?.message || e);
        } finally { this.peevesLoading = false; }
        this.loadPeeveQuotes();
      },
      async loadPeeveQuotes(){
        if (this.peeveQuotes || !this.hasToken()) return;
        try {
          const reg = new window.GH({ token: window.TOKEN, repo: this.registry(), ref: 'main' });
          const by = {};
          for (const q of window.Csv.rows((await reg.get(PEEVES_EVIDENCE)).text))
            (by[q.peeve] ||= []).push({ ...q, short: q.session.split('-').pop() });
          this.peeveQuotes = by;
        } catch { this.peeveQuotes = null; }
      },
      peeveWritten(p){ return p.detector && p.detector !== 'reader' ? 'check' : (p.owner ? 'doc' : 'nowhere'); },
      peeveVocab(property, value, field){
        const row = (this.propsReg?.vocab || []).find(
          x => x.registry === 'peeves' && x.property === property && x.value === value);
        return row?.[field] || (field === 'label' ? value : '');
      },
      get peeveMax(){ return Math.max(1, ...(this.peevesReg || []).map(p => p.n)); },
      get peeveGroups(){
        const q = this.peeveQ.trim().toLowerCase();
        const rows = (this.peevesReg || []).filter(p => !q
          || [p.id, p.name, p.peeve, p.look_for, p.owner].some(v => String(v || '').toLowerCase().includes(q)));
        const key = this.peeveAxis === 'written' ? (p => this.peeveWritten(p)) : (p => p.area);
        const by = new Map();
        for (const p of rows) { const k = key(p); if (!by.has(k)) by.set(k, []); by.get(k).push(p); }
        return [...by].map(([k, list]) => {
          const w = this.PEEVE_WRITTEN.find(x => x.key === k);
          return {
            key: k,
            label: w ? w.label : this.peeveVocab('area', k, 'label'),
            gloss: w ? '' : this.peeveVocab('area', k, 'gloss'),
            icon: w?.icon || '',
            total: list.reduce((t, p) => t + p.n, 0),
            rows: list.sort((a, b) => b.n - a.n || a.id.localeCompare(b.id)),
          };
        }).sort((a, b) => b.total - a.total);
      },
      // An owner names files in the hub as repo paths, and those open in the
      // peek; anything else (another repo's file, a hook by name) stays text.
      peeveOwnerParts(s){
        return String(s || '').split(/((?:docs|skills|node|lib|python)\/[\w./-]+\.(?:md|csv|py|sh|mjs|js))/)
          .filter(Boolean).map(t => ({ t, path: /^(docs|skills|node|lib|python)\//.test(t) ? t : '' }));
      },
      peeveQuoteHref(q){
        // The find lands the deck on the exchange, so it takes the opening
        // words only as far as they are plain: a curly quote or a dash in the
        // record would not match a straightened copy.
        const words = [];
        for (const w of q.quote.split(/\s+/)) {
          const c = w.replace(/[.,;:!?)]+$/, '');
          if (!/^[\w'-]+$/.test(c)) break;
          words.push(c);
          if (c !== w || words.length >= 6) break;
        }
        return '?view=sessions&session=' + encodeURIComponent(q.short)
          + (words.length >= 2 ? '&find=' + encodeURIComponent(words.join(' ')) : '');
      },

      // ── The estate's own skills ───────────────────────────────────────────
      // The library above is the hub's. This is every OTHER repo's committed
      // .claude/skills/, read from the same crawled config cache the Repos
      // cards use, so the tab answers "is there a skill for this?" across the
      // estate rather than across one folder. Fifteen of them existed with no
      // surface anywhere until 2026-08-20, home's ten among them.
      //
      // Token-gated and silent on failure, like the Docs tab's readership: the
      // library is public and must render for a reader with no token, minus
      // this section. A repo that declares nothing contributes no group, which
      // is the ordinary case rather than a gap.
      estateSkills: null,
      async loadEstateSkills(){
        if (this.estateSkills || !this.hasToken()) return;
        try {
          const path = window.RepoConfigCache?.CACHE_PATH || 'state/configs.json';
          const reg = new window.GH({ token: window.TOKEN, repo: this.registry(), ref: 'main' });
          const cache = JSON.parse((await reg.get(path)).text);
          const groups = [];
          for (const [repo, e] of Object.entries(cache?.repos || {})) {
            if (repo === this.hub()) continue;   // the hub's own set IS the plugin
            const raw = e?.align?.skills || e?.config?.skills || [];
            if (!Array.isArray(raw) || !raw.length) continue;
            const skills = raw
              .map(s => (typeof s === 'string' ? { name: s } : s))
              .filter(s => s && s.name)
              .map(s => ({ name: String(s.name),
                           origin: s.origin === 'forked' ? 'forked' : 'local', repo }))
              .sort((a, b) => a.name.localeCompare(b.name));
            if (skills.length) groups.push({ repo, short: repo.split('/').pop(), skills });
          }
          groups.sort((a, b) => a.short.localeCompare(b.short));
          this.estateSkills = groups;
        } catch { this.estateSkills = null; }
      },
      // One query filters both halves, since a reader asking "is there a skill
      // for X" does not care which repo answers.
      get estateSkillGroups(){
        const q = this.skillQ.trim().toLowerCase();
        const groups = this.estateSkills || [];
        if (!q) return groups;
        return groups
          .map(g => ({ ...g, skills: g.skills.filter(s => s.name.toLowerCase().includes(q)) }))
          .filter(g => g.skills.length);
      },
      get estateSkillTotals(){
        const groups = this.estateSkills || [];
        return {
          repos: groups.length,
          skills: groups.reduce((n, g) => n + g.skills.length, 0),
          forked: groups.reduce((n, g) => n + g.skills.filter(s => s.origin === 'forked').length, 0),
        };
      },

      get skillRows(){
        const q = this.skillQ.trim().toLowerCase();
        let rows = this.skillsReg || [];
        if (this.skillGroup) rows = rows.filter(r => r.group === this.skillGroup);
        if (!q) return rows;
        return rows.filter(r =>
          r.name.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q));
      },
      // ── Grouping ──────────────────────────────────────────────────────────
      // Thirty-five rows alphabetical is a list you scroll, not one you browse:
      // docx sits next to doc-coauthoring and neither is near pdf. `group` is
      // the authored subject axis on skills/manifest.csv, and it is authored
      // because nothing on disk carries one. The strip cuts and the headers
      // orient, the same two-layer pattern the Harness view runs on invocation.
      skillGroup: '',
      // Order is a reading order, not a count order: what the skill acts ON,
      // widening from the text to the file to the page, then the two platform
      // constraints, then the session itself.
      get skillGroupOrder(){ return ['prose','documents','web','device','windows','session']; },
      // docs/vocabularies.csv owns every label and gloss below. Reading it here
      // rather than inlining the six keeps the tab from carrying a second copy
      // of a table the Registries tab already renders; loadSkillsReg pulls the
      // pair in, idempotently, the same way loadOwnersReg does for scope.
      skillGroupVocab(value, field){
        const row = (this.propsReg?.vocab || []).find(
          x => x.registry === 'skills' && x.property === 'group' && x.value === value);
        return row?.[field] || (field === 'label' ? value : '');
      },
      get skillGroupCounts(){
        const all = this.skillsReg || [];
        const q = this.skillQ.trim().toLowerCase();
        const matching = q
          ? all.filter(r => r.name.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q))
          : all;
        const by = {};
        for (const r of matching) by[r.group] = (by[r.group] || 0) + 1;
        return this.skillGroupOrder
          .map(g => ({ key: g, label: this.skillGroupVocab(g, 'label'),
                       gloss: this.skillGroupVocab(g, 'gloss'), n: by[g] || 0 }));
      },
      // ── The three sets, as one axis ───────────────────────────────────────
      // A skill reaches a session three ways, and the tab used to render them
      // as two stacked lists plus a paragraph explaining that a third existed
      // on another tab. The distinction is real and load-bearing (it decides
      // whether a skill fires by itself, waits to be asked for, or is one
      // repo's own), so it is a control now, and each set states its own rule
      // where it is selected. The paragraph is gone: it was describing the
      // structure instead of being it.
      //
      // Plugin rows come from Distribution's manifest, already in hand
      // (load() fetches it on mount), so the third set costs no fetch.
      skillSet: '',
      get skillSetOrder(){ return ['plugin', 'library', 'estate', 'outside']; },
      showSkillSet(key){ return !this.skillSet || this.skillSet === key; },
      // The registry chip follows the selection, since Plugin is the one set
      // this tab renders from a file other than the skills manifest.
      get skillManifestPath(){
        return this.skillSet === 'plugin' ? SET_MANIFEST : this.skillSet === 'outside' ? UPSTREAM_SKILLS : SKILLS_MANIFEST;
      },
      skillSetLabel(key){
        return { plugin: 'Plugin', library: 'Library', estate: 'Estate', outside: 'Outside' }[key] || key;
      },
      // One line per set, carrying the rule rather than the history: what
      // installs it, and what that costs.
      skillSetGloss(key){
        return {
          plugin: 'Installed in every session by the portable plugin, and auto-firing: every skill under skills/ that the marketplace roster names, which since 2026-09-27 is all of them.',
          library: 'The same skills as served to other repos: one row per directory under skills/, carrying the model-facing trigger description its own SKILL.md owns, for /load-skill and a raw fetch.',
          estate: 'What a repo committed under its own .claude/skills/, declared in its own manifest and collected by the crawl. The hub aggregates; it does not go reading trees.',
          outside: 'Skills written elsewhere: watched, studied, held under outside/, or copied into skills/, each with the version pinned. Only a copy reaches a session.',
        }[key] || 'Four sets, one search: the plugin installs in every session and fires unasked, so each skill costs context everywhere; the library waits for /load-skill and costs nothing until then; the estate rides only the repo that committed it; outside skills reach no session until copied.';
      },
      // The plugin's own skills, matched on the same two fields the library is:
      // the name a reader would type and the sentence saying what it does.
      get pluginSkillRows(){
        const q = this.skillQ.trim().toLowerCase();
        const rows = (this.manifest?.items || []).filter(i => i.kind === 'skill');
        if (!q) return rows;
        return rows.filter(r => (r.title || '').toLowerCase().includes(q) ||
                                (r.command || '').toLowerCase().includes(q) ||
                                (this.setRole(r) || '').toLowerCase().includes(q));
      },
      // Counts re-weight under the query, the same as the group strip's, so a
      // search says WHERE its matches live before the reader opens one. A set
      // at nought dims rather than disappearing: a strip that reflows is a
      // moving target to tap at.
      get skillSetCounts(){
        const q = this.skillQ.trim().toLowerCase();
        const lib = q
          ? (this.skillsReg || []).filter(r => r.name.toLowerCase().includes(q) ||
                                               (r.description || '').toLowerCase().includes(q))
          : (this.skillsReg || []);
        return [
          { key: 'plugin',  n: this.pluginSkillRows.length },
          { key: 'library', n: lib.length },
          { key: 'estate',  n: this.estateSkillGroups.reduce((t, g) => t + g.skills.length, 0) },
          { key: 'outside', n: this.upstreamRows.length },
        ].map(x => ({ ...x, label: this.skillSetLabel(x.key), gloss: this.skillSetGloss(x.key) }));
      },
      // The headline: what the query found across the sets in view, over what
      // is there to find. Both move with the set control, so the two numbers
      // are always about the same corpus.
      get skillTally(){
        const counts = Object.fromEntries(this.skillSetCounts.map(c => [c.key, c.n]));
        const all = { plugin: (this.manifest?.items || []).filter(i => i.kind === 'skill').length,
                      library: (this.skillsReg || []).length,
                      estate: (this.estateSkills || []).reduce((t, g) => t + g.skills.length, 0),
                      outside: (this.upstreams || []).length };
        const keys = this.skillSetOrder.filter(k => this.showSkillSet(k));
        return { shown: keys.reduce((t, k) => t + counts[k], 0),
                 total: keys.reduce((t, k) => t + all[k], 0) };
      },

      // Sections, in the reading order, carrying only what survived the query.
      get skillSections(){
        const rows = this.skillRows;
        return this.skillGroupOrder
          .map(g => ({ key: g, label: this.skillGroupVocab(g, 'label'),
                       gloss: this.skillGroupVocab(g, 'gloss'),
                       rows: rows.filter(r => r.group === g) }))
          .filter(s => s.rows.length);
      },

      // ── Tests ─────────────────────────────────────────────────────────────
      testsReg: null,
      testsLoading: false,
      toolsReg: null,
      toolsLoading: false,
      toolsErr: '',
      hookLegs: null,       // docs/hook-legs.csv rows, read beside the harness registry
      hookOpen: false,      // the hook row's step list, shown or folded
      harnessDir: 'node',
      harnessInvoke: '',
      outpostsReg: null,
      outpostsLoading: false,
      outpostsErr: '',
      accountObs: null,
      accountObsErr: '',
      kitsReg: null,
      kitsLoading: false,
      kitsErr: '',
      kitFilter: '',
      patReg: null,
      patLoading: false,
      patErr: '',
      patNote: '',
      // The dimension the Gallery groups by: a dimensions.csv key.
      patAxis: 'body',
      patScope: '',
      // Dimensions: drawn one block per dimension ('dims') or as one table of
      // units by dimensions ('table'); which category rows are open, by
      // 'dimension|code'; and the column the table is sorted by.
      dimView: 'dims',
      dimOpen: {},
      dimSort: 'body',
      // The Gallery section whose header is held at the top of the pane, and
      // the 1-based index of its first card not under that header.
      patAt: { code: '', n: 0 },
      // The held header's height, where the current-card strip pins under it.
      patHeadH: 41,
      // The unit the open deck shows, ringed among the Gallery's cards.
      patDeckUnit: '',
      patThumbs: {},   // unit -> { desk, phone, store }
      // Which shot the cards show. Blank until the tab loads, then the one this
      // screen is closest to: a phone shows phone shots, everything else the
      // desktop ones. The labels are the FAB's width bar's, whose Phone 390 and
      // Desktop 1280 are the widths the shots were taken at.
      patShot: '',
      patBlobs: {},    // 'unit|kind' -> object URL, for the shots fetched under a token
      _patDeck: null,
      async loadPatterns(){
        if (this.patReg || this.patLoading) return;
        this.patLoading = true;
        this.patErr = '';
        this.patNote = '';
        try {
          const rowsOf = (gh, p) => gh.get(p).then(r => window.Csv.rows(r.text));
          const hub = new window.GH({ token: window.TOKEN, repo: this.hub(), ref: useRef() });
          // The parts and the checks are additions to the coding, so either
          // missing leaves the gallery as it was rather than failing the tab.
          const quiet = (gh, p) => rowsOf(gh, p).catch(() => []);
          const [dims, codes, units, coded, parts, inst] = await Promise.all([
            rowsOf(hub, UI_DIMS), rowsOf(hub, UI_CODES), rowsOf(hub, UI_UNITS), rowsOf(hub, UI_CODED),
            quiet(hub, UI_PARTS), quiet(hub, UI_INSTANCES)]);
          if (!codes.length) throw new Error('no codes');
          let pUnits = [], pCoded = [], pInst = [];
          if (this.hasToken()) {
            try {
              const home = new window.GH({ token: window.TOKEN, repo: UI_PRIVATE });
              [pUnits, pCoded, pInst] = await Promise.all([rowsOf(home, UI_UNITS), rowsOf(home, UI_CODED), quiet(home, UI_INSTANCES)]);
            } catch (e) { this.patNote = 'budget-drs units unread: ' + UI_PRIVATE + ' ' + UI_CODED + ' (' + (e?.message || e) + ')'; }
          } else this.patNote = 'budget-drs units live in the private home repository and need a token';
          const byUnit = new Map([...units, ...pUnits].map(u => [u.unit, u]));
          const byInst = new Map([...inst, ...pInst].map(r => [r.unit, r]));
          const split = (v) => String(v || '').split(';').map(x => x.trim()).filter(Boolean);
          const rows = [...coded, ...pCoded].map(c => {
            const u = byUnit.get(c.unit) || {};
            return {
              ...u, ...c,
              // The commit the reader read the unit at, which is where its
              // file:line citations resolve; a census rerun restamps units.csv.
              at: c.at || u.at,
              label: u.label || c.unit,
              repo: u.repo || c.unit.split(':')[0],
              app_ring: u.app_ring ?? '',
              frameList: split(c.frame), reachList: split(c.reach),
              phoneCode: String(c.phone || '').split(':')[0],
              inst: byInst.get(c.unit) || null,
            };
          });
          this.patReg = { dims, codes, rows, parts };
          if (!this.patShot) this.patShot = window.matchMedia?.('(max-width: 639px)').matches ? 'phone' : 'desk';
          this.loadPatternThumbs(hub);
        } catch (e) {
          this.patErr = 'UI units load failed: ' + (e?.message || e);
        } finally { this.patLoading = false; }
      },
      // The shots are a nicety over the coding, so a missing manifest leaves a
      // card with its placeholder rather than failing the tab.
      async loadPatternThumbs(hub){
        const thumbs = {};
        const take = (rows, store) => {
          for (const r of rows) thumbs[r.unit] = { desk: r.desk, phone: r.phone, store };
        };
        try { take(window.Csv.rows((await hub.get(UI_THUMBS + 'thumbs.csv')).text), 'public'); } catch {}
        let reg = null;
        if (this.hasToken()) {
          try {
            reg = new window.GH({ token: window.TOKEN, repo: this.registry() });
            take(window.Csv.rows((await reg.get(UI_THUMBS_PRIVATE + 'thumbs.csv')).text), 'private');
          } catch { reg = null; }
        }
        this.patThumbs = thumbs;
        if (!reg) return;
        // Six at a time: 82 small reads, none of them blocking the page.
        const jobs = Object.entries(thumbs).filter(([, t]) => t.store === 'private')
          .flatMap(([unit, t]) => ['desk', 'phone'].filter(k => t[k]).map(k => [unit, k, t[k]]));
        const run = async () => {
          for (let job = jobs.shift(); job; job = jobs.shift()) {
            const [unit, kind, file] = job;
            try {
              const b = await reg.bytes(UI_THUMBS_PRIVATE + file);
              this.patBlobs[unit + '|' + kind] = URL.createObjectURL(new Blob([b.bytes], { type: 'image/jpeg' }));
            } catch { /* the card keeps its placeholder */ }
          }
        };
        await Promise.all(Array.from({ length: 6 }, run));
      },
      patThumb(u, kind){
        const t = this.patThumbs[u.unit];
        if (!t || !t[kind]) return '';
        if (t.store === 'public')
          return 'https://raw.githubusercontent.com/' + this.hub() + '/' + useRef() + '/' + UI_THUMBS + t[kind];
        return this.patBlobs[u.unit + '|' + kind] || '';
      },
      // The sections the Gallery draws: the chosen dimension's codes that have
      // units. Codes with none are named in one line.
      get patSections(){ return this.patGroups.filter(g => g.units.length); },
      get patEmptyCodes(){ return this.patGroups.filter(g => !g.units.length).map(g => g.name); },
      // The card the held header counts, with its section and index; null while
      // no section is held.
      get patCur(){
        const g = this.patSections.find(s => s.code === this.patAt.code);
        const u = g?.units[this.patAt.n - 1];
        return u ? { g, u, i: this.patAt.n - 1 } : null;
      },
      patKindIcon(u){
        return { tab: 'ph-tabs', view: 'ph-app-window', page: 'ph-file-html',
                 'framed page': 'ph-frame-corners', shell: 'ph-browser' }[u.kind] || 'ph-square';
      },
      patApp(u){ return u.host ? u.host.replace(/ app$/, '') : u.repo; },
      // Where a unit is: its address as units.csv records it, the first where
      // several are listed, else its first file.
      patAddr(u){
        return String(u.address || '').split(' | ')[0].trim() || String(u.files || '').split(';')[0];
      },
      // A unit's codes on the coded dimensions other than the one the Gallery
      // groups by, as "Frame Tabs, Lede · Reach Peek".
      patOthers(u, axis){
        return this.patDims.filter(d => d.dimension !== axis && d.dimension !== 'ring').map(d => {
          const names = this.patCodesOf(u, d.dimension).map(c => this.patCodeName(d.dimension, c));
          return names.length ? d.name + ' ' + names.join(', ') : '';
        }).filter(Boolean).join(' · ');
      },
      // A section header's tip: its code, its test and its whole gloss, which
      // the one-line header cuts short.
      patTip(g){
        return [g.codeLabel, g.gloss, g.test ? 'Test: ' + g.test : ''].filter(Boolean).join(' · ');
      },
      // Keeps patAt current as the Map pane scrolls, once per frame: the
      // section whose top has passed the pane's top is the held one, and n is
      // its first card whose bottom clears the held header. A regrouping
      // starts it over.
      patTrack(pane){
        if (!pane || this._patTrack) return;
        let frame = 0;
        const read = () => {
          frame = 0;
          if (this.mapTab !== 'patterns') return;
          const top = pane.getBoundingClientRect().top;
          const bar = pane.querySelector('[data-pat-cardbar]');
          const barH = bar ? bar.getBoundingClientRect().height : 0;
          let at = { code: '', n: 0 };
          for (const sec of pane.querySelectorAll('section[id^="pat-"]')) {
            const r = sec.getBoundingClientRect();
            if (r.top > top + 1 || r.bottom <= top) continue;
            const head = sec.querySelector('[data-pat-head]')?.getBoundingClientRect();
            const cards = [...sec.querySelectorAll('[data-pat-card]')];
            if (head && Math.round(head.height) !== this.patHeadH) this.patHeadH = Math.round(head.height);
            const line = (head ? head.bottom : top) + barH;
            const i = cards.findIndex(c => c.getBoundingClientRect().bottom > line + 8);
            at = { code: sec.id.slice(4), n: i < 0 ? cards.length : i + 1 };
            break;
          }
          if (at.code !== this.patAt.code || at.n !== this.patAt.n) this.patAt = at;
        };
        pane.addEventListener('scroll', () => { frame ||= requestAnimationFrame(read); }, { passive: true });
        this.$watch('patAxis', () => { this.patAt = { code: '', n: 0 }; this.$nextTick(read); });
        this._patTrack = read;
      },
      patJump(code){ document.getElementById('pat-' + code)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
      // Three scopes: the two apps, and the one fact the units tables exist to
      // surface, a unit whose own code does a job a shared kit already does.
      get patScopes(){
        const rows = this.patReg?.rows || [];
        const defs = [
          { key: 'wt', label: 'web-tools', tone: 'badge-ghost', hit: u => u.repo === 'web-tools',
            gloss: 'the Web Tools app: its own views, and the pages promoted into it' },
          { key: 'bd', label: 'budget-drs', tone: 'badge-ghost', hit: u => u.repo !== 'web-tools',
            gloss: "home's units: the budget-drs app's views and tabs, the pages it frames, and home's own app" },
          { key: 'hand', label: 'hand-built', tone: 'badge-warning', hit: u => !!u.hand_evidence,
            gloss: 'units whose own code does a job a shared kit already does' },
        ];
        return defs.map(d => ({ ...d, n: rows.filter(d.hit).length })).filter(d => d.n);
      },
      get patRows(){
        const d = this.patScopes.find(x => x.key === this.patScope);
        return (this.patReg?.rows || []).filter(u => !d || d.hit(u));
      },
      patCodeName(axis, code){
        const k = String(code || '').split(':')[0];
        const c = (this.patReg?.codes || []).find(x => x.axis === axis && x.code === k);
        return c ? c.name : String(code || '');
      },
      patCodesOf(u, axis){
        if (axis === 'frame') return u.frameList;
        if (axis === 'reach') return u.reachList;
        if (axis === 'phone') return u.phoneCode ? [u.phoneCode] : [];
        if (axis === 'ring') return u.app_ring !== '' ? [String(u.app_ring)] : [];
        return u[axis] ? [u[axis]] : [];
      },
      get patDims(){ return this.patReg?.dims || []; },
      // One row per code of a dimension, with the units in scope that take it:
      // the Gallery's sections and the Dimensions subview's category rows are
      // the same rows. A reader's new:<code> proposal joins as a row of its own,
      // unnamed, until synthesis settles it. Ring is ordinal, so its rows keep
      // their order; every other dimension's run most used first.
      //
      // Where a code names the kits that draw it, `drawn` counts the units
      // whose built_on calls one of them. The two spell a kit differently
      // (swipe-deck (core) in codes.csv, swipeDeck.core in a reader's
      // built_on), so both are compared as bare lowercase letters, and a call
      // counts when it starts with the kit's name.
      patGroupsOf(axis){
        const rows = this.patRows;
        const order = (a, b) => (+a.app_ring - +b.app_ring) || a.label.localeCompare(b.label);
        const bare = (x) => String(x).toLowerCase().replace(/[^a-z]/g, '');
        const defs = (this.patReg?.codes || []).filter(c => c.axis === axis);
        const known = new Set(defs.map(c => c.code));
        const extra = [...new Set(rows.flatMap(u => this.patCodesOf(u, axis)))]
          .filter(c => !known.has(c))
          .map(c => ({ axis, code: c, name: c, gloss: 'proposed by a reader, not yet a row of codes.csv', kits: '', proposed: true }));
        const groups = [...defs, ...extra].map(c => {
          const units = rows.filter(u => this.patCodesOf(u, axis).includes(c.code)).sort(order);
          const kits = String(c.kits || '').split(';').filter(Boolean);
          const drawn = units.filter(u => String(u.built_on || '').split(';')
            .some(b => kits.some(k => bare(b).startsWith(bare(k))))).length;
          const declared = units.filter(u => u.inst?.declared === c.code);
          return { ...c, units, kits: kits.join(', '), drawn,
                   codeLabel: axis === 'ring' ? 'ring ' + c.code : c.code,
                   declared: declared.length,
                   holds: declared.filter(u => this.patDeclared(u)?.state === 'holds').length };
        });
        return axis === 'ring' ? groups : groups.sort((a, b) => b.units.length - a.units.length);
      },
      get patGroups(){ return this.patGroupsOf(this.patAxis); },
      // Dimensions, by dimension: each with its code rows, how many of its
      // codes are defined and in use, and a last row for the units in scope
      // that take none of its codes. On a dimension of any number that row is
      // a finding (a unit with no reach code opens nothing); on a dimension of
      // one it is a gap in the coding.
      get dimBlocks(){
        return this.patDims.map(d => {
          const groups = this.patGroupsOf(d.dimension);
          const none = this.patRows.filter(u => !this.patCodesOf(u, d.dimension).length);
          const any = d.per_unit !== 'one';
          const empty = { code: '(none)', name: any ? 'None' : 'Not coded', codeLabel: '', units: none, empty: true,
                          gloss: any ? 'Units that take none of the ' + d.name + ' codes.'
                                     : 'Units a reader left without a ' + d.name + ' code.' };
          return { ...d, groups: none.length ? [...groups, empty] : groups,
                   defined: groups.filter(g => !g.proposed).length,
                   used: groups.filter(g => g.units.length).length };
        });
      },
      dimToggle(key){ this.dimOpen = { ...this.dimOpen, [key]: !this.dimOpen[key] }; },
      // A dimension's codes in the Gallery, landing on one of them when named.
      dimToGallery(axis, code){
        this.patAxis = axis;
        this.setTab('patterns');
        if (code) this.$nextTick(() => requestAnimationFrame(() => this.patJump(code)));
      },
      // Dimensions as a table: one row per unit, one column per dimension,
      // grouped by the dimension it is sorted by into the same groups, in the
      // same order, as that dimension's code rows and the Gallery's sections.
      // A unit with two codes of a dimension of any number is under both, as
      // in the Gallery. Sorted by unit, it is one group with no heading.
      get dimTable(){
        const k = this.dimSort;
        const cells = (u) => this.patDims.map(d =>
          this.patCodesOf(u, d.dimension).map(c => this.patCodeName(d.dimension, c)).join(', '));
        const groups = k === 'unit'
          ? [{ code: '', name: '', units: [...this.patRows].sort((a, b) => a.label.localeCompare(b.label)) }]
          : (this.dimBlocks.find(d => d.dimension === k)?.groups || []).filter(g => g.units.length);
        return groups.map(g => ({ code: g.code, name: g.name, empty: !!g.empty, units: g.units,
                                  rows: g.units.map(u => ({ u, cells: cells(u) })) }));
      },
      // A code's parts in codes.csv's order, each with its name, gloss and color
      // from parts.csv; empty for a code no markup can declare yet.
      patPartsOf(code){
        const def = (this.patReg?.codes || []).find(c => c.axis === 'body' && c.code === code);
        const by = new Map((this.patReg?.parts || []).map(p => [p.part, p]));
        return String(def?.parts || '').split(';').filter(Boolean).map(s => {
          const part = s.replace(/\?$/, ''), p = by.get(part) || {};
          return { part, name: p.name || part, gloss: p.gloss || '', optional: s.endsWith('?') };
        });
      },
      // What a unit's markup declares and how the check came out, for a card's
      // mark: holds, fails (a broken promise, a missing part, or a code the
      // reader did not give), unchecked (hidden or empty at its address), or
      // contains (a declared pattern that is not the unit's body); null where
      // the unit declares nothing.
      patDeclared(u){
        const i = u.inst;
        if (!i?.declared) return null;
        const c = i.contract || '';
        // A pattern other than the coded body is a mismatch only where the body
        // could itself be declared; otherwise the unit contains it (Stage, a
        // tool, shows a list of errands).
        const contains = i.declared !== u.body && !this.patPartsOf(u.body).length;
        // A code with no parts promises no behaviour (a Figure, a Tool), so its
        // declaration states the body and nothing is checked against it.
        const state = contains ? 'contains'
          : /fails|not read/.test(c) || i.missing || i.stray || i.declared !== u.body ? 'fails'
          : /^unchecked|; unchecked/.test(c) ? 'unchecked'
          : /^no promise/.test(c) ? 'declared' : 'holds';
        return { state, tip: (contains ? 'Contains a declared ' + i.declared + '; its body is coded ' + u.body
            : 'Declares data-pattern="' + i.declared + '"' + (i.declared !== u.body ? ', where a reader coded ' + (u.body || 'nothing') : ''))
          + '. ' + c };
      },
      get patLine(){
        const rows = this.patRows;
        const used = new Set(rows.flatMap(u => [u.body, ...u.reachList, ...u.frameList]).filter(Boolean));
        return this.plural(rows.length, 'unit') + ' coded · ' + used.size + ' codes in use · '
          + rows.filter(u => u.hand_evidence).length + ' hand-built';
      },
      // A codes.csv row by axis and code, the code read up to a colon
      // (hide:<region>); a code no row holds reads as itself.
      patCode(axis, code){
        const k = String(code || '').split(':')[0];
        return (this.patReg?.codes || []).find(c => c.axis === axis && c.code === k)
          || { axis, code: k, name: k, gloss: '', icon: '' };
      },
      // The units around this one in its app: the other tabs of its view, or
      // for a view or a page the other units of its kind and ring in its app.
      patSiblings(u){
        const rows = this.patReg?.rows || [];
        const same = u.kind === 'tab'
          ? (r) => r.kind === 'tab' && r.host === u.host && r.view === u.view
          : (r) => r.kind === u.kind && r.host === u.host && String(r.app_ring) === String(u.app_ring);
        return rows.filter(same).sort((a, b) => a.label.localeCompare(b.label));
      },
      patSiblingsTitle(u){
        if (u.kind === 'tab') return 'The tabs of ' + String(u.label).split(': ')[0];
        const of = { view: 'The views of ', page: 'The pages of ', 'framed page': 'The pages framed in ' }[u.kind];
        return of ? of + (u.host ? 'the ' + u.host : u.repo) : 'Beside it';
      },
      // The units a slide's counts open: those coded the same body, calling the
      // same function or kit, or listing the same file. Each is a connection no
      // column states, read across every coded row, the private ones included.
      patRelated(by, key){
        const rows = this.patReg?.rows || [];
        const list = (s) => String(s || '').split(';').map(x => x.trim()).filter(Boolean);
        const test = { body: (r) => r.body === key, call: (r) => list(r.built_on).includes(key),
                       file: (r) => list(r.files).includes(key) }[by];
        if (!test) return { list: [], title: '' };
        return { list: rows.filter(test).sort((a, b) => a.label.localeCompare(b.label)),
                 title: by === 'body' ? this.patCode('body', key).name
                   : by === 'call' ? 'Calls ' + key : String(key).split('/').pop() };
      },
      // One unit as a deck slide, drawn from what a unit is: a screen whose
      // frame chooses what its body shows, whose body a tap reaches out of,
      // tied by a binding, and changed by a phone. The slide draws that
      // composition rather than listing its fields:
      //
      //   where it lives   a path from its app down to it, its ring as a place
      //                    on the five-ring scale, and its address
      //   the shots        desktop and phone, the evidence
      //   its anatomy      a schematic: the frame's controls as a band over the
      //                    body, the body as a sketch beside its name, what a
      //                    tap opens in a column beside it, the binding as the
      //                    caption that ties them, and the phone as a sketch of
      //                    what the narrow width does; under the body, the type
      //                    one region is written for, and what its markup
      //                    declares and how the check came out
      //   the reader       the coder's note, citations linked at the commit read
      //   what draws it    its calls and files, each with the number of coded
      //                    units sharing it, the kit its body code names, and
      //                    any file:line where its own code does a kit's job
      //   around it        the units beside it, each marked with its body's
      //                    icon, so a view's mix of arrangements reads at a
      //                    glance
      //
      // Every count opens the units it counts as a deck (data-pat-rel, read
      // by patRelated), and every unit named opens at itself (data-pat-open).
      // Every code shows its name and icon, its gloss as the tip. blob() links
      // a file or file:line at the commit the unit was read at.
      patSlide(u, blob){
        const tip = (t) => t ? ' data-title-tip="' + esc(t) + '"' : '';
        const label = (t) => '<span class="shrink-0 whitespace-nowrap text-xs uppercase tracking-wide text-base-content/50">' + esc(t) + '</span>';
        const head = (t) => '<h3 class="text-sm uppercase tracking-wide text-base-content/50">' + esc(t) + '</h3>';
        const icon = (c, cls = 'text-base-content/60') => '<i class="ph ' + esc(c.icon || 'ph-dot-outline') + ' ' + cls + '"></i>';
        const list = (s) => String(s || '').split(';').map(x => x.trim()).filter(Boolean);
        // A frame code is a slot: drawn in the frame's colour, with whether
        // the page declares it (instances.csv): found, hidden at this
        // address, or not found, the last drawn dashed.
        const color = Object.fromEntries((this.patReg?.dims || []).map(d => [d.dimension, d.color || '']));
        const slotList = (v) => String(v || '').split(';').map(x => x.trim()).filter(Boolean);
        const shownSlots = slotList(u.inst?.slots).filter(x => !x.endsWith('(hidden)'));
        const hiddenSlots = slotList(u.inst?.slots).filter(x => x.endsWith('(hidden)')).map(x => x.replace(/ \(hidden\)$/, ''));
        const slotState = (code) => !u.inst || !('slots' in u.inst) ? '' : shownSlots.includes(code) ? 'found'
          : hiddenSlots.includes(code) ? 'hidden' : 'missing';
        const SLOT_TIP = { found: 'declared in the markup and shown here', hidden: 'declared in the markup, hidden at this address',
                           missing: 'not found in the markup at this address' };
        const chip = (axis, code) => { const c = this.patCode(axis, code), st = axis === 'frame' ? slotState(code) : '';
          return '<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-base-100 border-2 text-sm"'
            + ' style="border-color:' + esc(color.frame || '') + (st === 'missing' ? ';border-style:dashed' : '') + '"'
            + tip(c.gloss + (st ? '. Slot ' + SLOT_TIP[st] : '')) + '>'
            + icon(c) + esc(c.name)
            + (st === 'found' ? '<i class="ph ph-check text-xs text-base-content/50"></i>'
              : st === 'hidden' ? '<i class="ph ph-eye-slash text-xs text-base-content/40"></i>' : '') + '</span>'; };
        // A count that opens the units it counts; one alone is no connection.
        const shared = (by, key, n, cls = '') => n > 1
          ? '<button type="button" data-pat-rel="' + by + '" data-pat-key="' + esc(key) + '"'
            + tip(n + ' coded units share this; open them as a deck')
            + ' class="badge badge-sm badge-ghost tabular-nums hover:badge-primary ' + cls + '">' + n + '</button>' : '';
        const files = list(u.files);
        const addr = this.patAddr(u);

        // Where it lives: app, then the view a tab belongs to, then the unit.
        const [parent, ...rest] = String(u.label).split(': ');
        // A Map subview's label names its tab too ("Browser › Gallery"), each a crumb.
        const crumbs = [u.host || u.repo, ...(u.kind === 'tab' && rest.length ? [parent, ...rest.join(': ').split(' › ')] : [u.label])];
        const kind = { tab: 'a tab', view: 'a view', page: 'a page', 'framed page': 'a page the app frames', shell: 'the shell' }[u.kind] || u.kind;
        const ring = this.patCode('ring', u.app_ring);
        const rings = (this.patReg?.codes || []).filter(c => c.axis === 'ring');
        const scale = '<span class="inline-flex items-center gap-2"' + tip('Ring ' + u.app_ring + ', ' + ring.name + ': ' + ring.gloss) + '>'
          + '<span class="flex gap-0.5">' + rings.map(c => '<span class="block w-3 h-1.5 rounded-full '
            + (c.code === String(u.app_ring) ? 'bg-primary' : 'bg-base-300') + '"></span>').join('') + '</span>'
          + '<span class="text-sm text-base-content/70">' + esc(ring.name) + '</span></span>';
        const place = '<div class="flex flex-wrap items-center gap-x-4 gap-y-2">'
          + '<nav class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 min-w-0 text-base">'
          + '<i class="ph ' + this.patKindIcon(u) + ' text-lg text-base-content/50"' + tip(u.label + ' is ' + kind) + '></i>'
          + crumbs.map((c, i) => i === crumbs.length - 1
              ? '<span class="font-semibold">' + esc(c) + '</span>'
              : '<span class="text-base-content/60">' + esc(c) + '</span><i class="ph ph-caret-right text-xs text-base-content/30"></i>').join('')
          + '</nav>' + scale
          + '<span class="grow"></span>'
          + (addr ? '<span class="inline-flex items-center gap-1 min-w-0"><code class="font-mono text-sm text-base-content/60 truncate min-w-0">' + esc(addr) + '</code>'
            + (/^[?]/.test(addr) ? '<a class="btn btn-xs btn-ghost gap-1" href="' + esc(addr) + '"><i class="ph ph-arrow-square-out"></i>Open</a>' : '')
            + '</span>' : '')
          + '</div>';

        // The body: its sketch, name and gloss, how many share it, the type a
        // region is written for, and what the markup declares of it.
        const body = this.patCode('body', u.body);
        const same = this.patRelated('body', u.body).list;
        const wt = same.filter(r => r.repo === 'web-tools').length;
        const decl = this.patDeclared(u);
        const SEAL = { holds: 'ph-seal-check text-success', fails: 'ph-seal-warning text-warning',
                       unchecked: 'ph-seal-question text-base-content/40', contains: 'ph-seal text-base-content/40',
                       declared: 'ph-seal text-info' };
        const VERDICT = { holds: '<span class="text-success">holds</span>', fails: '<span class="text-warning">fails</span>',
                          declared: 'has no behaviour to check',
                          unchecked: 'is unchecked' };
        const partsBy = new Map((this.patReg?.parts || []).map(p => [p.part, p]));
        // The checker's evidence, its verdict word dropped since the seal and
        // the sentence carry it.
        const evidence = [decl?.state === 'declared' ? '' : String(u.inst?.contract || '').replace(/^(holds|fails|unchecked):\s*/, ''),
          u.inst?.missing ? 'missing ' + u.inst.missing : '', u.inst?.stray ? 'stray ' + u.inst.stray : ''].filter(Boolean).join('; ');
        const declared = decl ? '<div class="flex flex-col gap-1 mt-1.5">'
            + '<div class="flex items-start gap-1.5 text-sm"' + tip(decl.tip) + '><i class="ph ' + SEAL[decl.state] + ' text-base mt-0.5 shrink-0"></i>'
            + '<span class="text-pretty">' + (decl.state === 'contains'
                ? 'Contains a declared ' + esc(this.patCode('body', u.inst.declared).name)
                : 'Declared in its markup, and ' + VERDICT[decl.state])
            + (evidence ? '<span class="text-base-content/50">: ' + esc(evidence) + '</span>' : '') + '</span></div>'
            + '<div class="flex flex-wrap gap-x-3 gap-y-0.5 pl-6 text-xs text-base-content/70">'
            + String(u.inst.parts || '').split(';').map(x => x.trim().split(/\s+/)).filter(x => x[0])
                .map(([part, n]) => { const p = partsBy.get(part) || {};
                  return '<span' + tip(p.gloss) + '>' + esc(p.name || part) + ' <span class="tabular-nums text-base-content/40">' + esc(n || '') + '</span></span>'; }).join('')
            + '</div></div>'
          : (this.patPartsOf(u.body).length ? '<div class="text-sm text-base-content/40 mt-1.5">Not declared in its markup</div>' : '');
        const form = String(u.form || '').trim();
        const formLine = form ? '<span class="inline-flex items-center gap-1.5 text-sm mt-1"' + tip(form.endsWith('?') ? 'A candidate type, not yet a subject' : 'A subject in docs/subjects.csv') + '>'
          + '<i class="ph ph-cube text-base-content/50"></i>A region is written for one <span class="font-medium">' + esc(form.replace(/\?$/, '')) + '</span>'
          + (form.endsWith('?') ? '<span class="text-base-content/40">(a candidate type)</span>' : '') + '</span>' : '';
        const bodyCell = '<div class="p-3 flex gap-3 min-w-0">' + bodySketch(body.code, body.icon)
          + '<div class="min-w-0 flex flex-col gap-0.5">' + label('Body')
          + '<span class="text-lg font-semibold leading-tight"' + tip(body.test ? 'Test: ' + body.test : '') + '>' + esc(body.name) + '</span>'
          + '<span class="text-sm text-base-content/60 text-pretty">' + esc(body.gloss) + '</span>'
          + (same.length > 1 ? '<span class="text-xs leading-5 text-base-content/50">' + shared('body', u.body, same.length, 'mr-1.5 align-middle')
              + 'coded ' + esc(body.name) + ', ' + (wt && wt < same.length ? wt + ' in Web Tools and ' + (same.length - wt) + ' in budget-drs'
                : 'all in ' + (wt ? 'Web Tools' : 'budget-drs')) + '</span>' : '')
          + formLine + declared + '</div></div>';

        const reach = u.reachList.length
          ? u.reachList.map(r => { const c = this.patCode('reach', r);
              return '<span class="inline-flex items-center gap-1.5 text-sm"' + tip(c.gloss) + '>' + icon(c, 'text-primary/70') + esc(c.name) + '</span>'; }).join('')
          : '<span class="text-sm text-base-content/40">nothing opens over it</span>';
        const reachCell = '<div class="p-3 flex flex-col gap-1 border-t @lg:border-t-0 @lg:border-l border-dashed border-base-300 bg-base-200/30">'
          + label('A tap opens') + reach + '</div>';

        const frame = u.frameList.length ? u.frameList.map(f => chip('frame', f)).join('')
          : '<span class="text-sm text-base-content/40">nothing chooses what it shows</span>';
        const bind = this.patCode('binding', u.binding);
        const screen = '<figure class="rounded-xl border-2 border-base-300 overflow-hidden bg-base-100 min-w-0">'
          + '<div class="flex flex-wrap items-center gap-1.5 px-3 py-2 bg-base-200/70 border-b border-base-300">' + label('Frame') + frame + '</div>'
          + '<div class="grid @lg:grid-cols-[minmax(0,1fr)_minmax(10rem,auto)]">'
          + '<div class="m-1.5 rounded-lg border-2 border-dashed min-w-0" style="border-color:' + esc(color.body || '') + '">' + bodyCell + '</div>'
          + reachCell + '</div>'
          + '<figcaption class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-3 py-1.5 border-t border-base-300 bg-base-200/40 text-sm min-w-0">'
          + label('Tied by') + '<span class="inline-flex items-center gap-1.5 font-medium">' + icon(bind) + esc(bind.name || 'not coded') + '</span>'
          + '<span class="text-base-content/60 text-pretty">' + esc(bind.gloss) + '</span></figcaption></figure>';

        // The phone beside the screen where there is room, a row under it where not.
        const ph = this.patCode('phone', u.phone);
        const hidden = String(u.phone || '').split(':')[1];
        const phone = '<figure class="flex @xl:flex-col items-center gap-3 @xl:gap-1.5 @xl:text-center">' + phoneSketch(ph.code, ph.icon)
          + '<figcaption class="flex flex-col @xl:items-center">' + label('On a phone')
          + '<span class="inline-flex items-center gap-1 text-sm font-medium"' + tip(ph.gloss) + '>' + icon(ph) + esc(ph.name || 'not coded') + '</span>'
          + (hidden ? '<span class="text-xs text-base-content/60">drops the ' + esc(hidden) + '</span>'
            : '<span class="text-xs text-base-content/50 @xl:max-w-[8rem] text-pretty">' + esc(ph.gloss) + '</span>')
          + '</figcaption></figure>';

        const anatomy = '<section class="flex flex-col gap-2">' + head('How it is put together')
          + '<div class="grid gap-4 items-start @xl:grid-cols-[minmax(0,1fr)_auto]">' + screen + phone + '</div></section>';

        // The reader's note, its file:line citations linked and shown by file
        // name, since a note citing one long path ten times reads as the path.
        // A bare file name resolves against the unit's own files.
        const linked = esc(u.notes || '').replace(/([\w./-]+\.(?:js|mjs|html|css|py|md|csv|json))(?::(\d+))?/g, (m, f, line) => {
          const path = f.includes('/') ? f : files.find(x => x.endsWith('/' + f) || x === f);
          return path ? blob(u, path + (line ? ':' + line : ''), esc(f.split('/').pop() + (line ? ':' + line : '')), 'break-words') : m;
        });
        const note = u.notes ? '<section class="flex flex-col gap-2">' + head("The reader's note")
          + '<p class="text-base leading-7 text-pretty">' + linked + '</p>'
          + '<div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-base-content/50">'
          + '<span>coded by ' + esc(u.coder || 'a reader') + (u.confidence ? ', ' + esc(u.confidence) + ' confidence' : '') + '</span>'
          + (u.style === 'own' ? '<span>· its own CSS, not the house look</span>' : '')
          + '</div></section>' : '';

        // What draws it: the calls, the kit question, the hand-built evidence,
        // then the files. A call or file shared with other units carries the
        // count of them, and the count opens them.
        const rel = (by, key) => this.patRelated(by, key).list.length;
        const calls = list(u.built_on);
        const kits = String(body.kits || '').split(';').filter(Boolean);
        const bare = (x) => String(x).toLowerCase().replace(/[^a-z]/g, '');
        const usesKit = kits.length && calls.some(b => kits.some(k => bare(b).startsWith(bare(k))));
        const kitLine = kits.length
          ? 'A ' + esc(body.name) + ' has a shared kit, ' + esc(kits.join(', ')) + (usesKit ? ', and this unit calls it.' : ', and this unit does not call it.')
          : 'No shared kit draws a ' + esc(body.name) + ', so each unit draws its own.';
        const ev = String(u.hand_evidence || '').split(/[;,]\s*/).filter(Boolean);
        // The call that is the body's kit is marked, tying the chip to the
        // sentence under it.
        const isKit = (c) => kits.some(k => bare(c).startsWith(bare(k)));
        const drawn = '<section class="flex flex-col gap-2.5">' + head('What draws it')
          + (calls.length ? '<div class="flex flex-wrap gap-1.5">' + calls.map(c => c === 'hand'
              ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-warning/10 text-sm"><i class="ph ph-hand text-warning"></i>its own code</span>'
              : '<span class="inline-flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded-md ' + (isKit(c) ? 'bg-primary/10' : 'bg-base-200') + '"'
                + tip(isKit(c) ? 'The shared kit for a ' + body.name : '') + '>'
                + (isKit(c) ? '<i class="ph ph-package text-primary"></i>' : '') + '<code class="font-mono text-sm">' + esc(c) + '</code>'
                + (shared('call', c, rel('call', c)) || '<span class="w-1"></span>') + '</span>').join('') + '</div>' : '')
          + '<p class="text-base text-base-content/70">' + kitLine + '</p>'
          + (ev.length ? '<div class="rounded-lg border border-warning/40 bg-warning/5 p-3 flex flex-col gap-1">'
              + '<span class="inline-flex items-center gap-1.5 text-sm font-medium"><i class="ph ph-hand text-warning"></i>Where its own code does a job a shared kit does</span>'
              + ev.map(p => blob(u, p)).join('') + '</div>' : '')
          + (files.length ? '<div class="flex flex-col gap-1 pt-1">' + label('Its files')
              + files.map(f => '<span class="flex items-center gap-2 min-w-0">' + blob(u, f) + shared('file', f, rel('file', f), 'shrink-0') + '</span>').join('')
              + '</div>' : '')
          + '</section>';

        const sibs = this.patSiblings(u);
        const around = sibs.length > 1 ? '<section class="flex flex-col gap-2">' + head(this.patSiblingsTitle(u))
          + '<div class="flex flex-wrap gap-1.5">' + sibs.map(r => {
              const c = this.patCode('body', r.body), me = r.unit === u.unit;
              const name = r.kind === 'tab' ? String(r.label).split(': ').slice(1).join(': ') || r.label : r.label;
              return '<button type="button" data-pat-open="' + esc(r.unit) + '"' + tip(c.name)
                + ' class="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-sm border '
                + (me ? 'border-primary bg-primary/10 text-primary' : 'border-base-300 hover:border-primary/60 hover:text-primary') + '">'
                + icon(c, me ? 'text-primary' : 'text-base-content/50') + esc(name) + '</button>'; }).join('')
          + '</div></section>' : '';

        return '<div class="@container flex flex-col gap-7 pb-8">' + place + '%SHOTS%' + anatomy + note + drawn + around + '</div>';
      },
      // A deck of units, one per slide, each drawn by patSlide. Evidence and
      // files link to GitHub at the commit the unit was read at.
      async openPatternDeck(units, start, context){
        if (!units?.length) return;
        if (!window.swipeDeck && window.gh?.load) {
          try { await window.gh.load('kits/swipe-deck.js'); } catch { /* fall through */ }
        }
        if (!window.swipeDeck) return;
        this._patDeck?.close?.();
        const at = (i) => units[Math.max(0, Math.min(i, units.length - 1))];
        const repoOf = (u) => u.repo === 'web-tools' ? this.hub() : 'mehrlander/' + u.repo;
        const blob = (u, path, text, wrap = '') => {
          const [file, line] = String(path).split(/:(?=\d+$)/);
          // The commit the unit was read at (coded.csv's at), so a reader's
          // file:line lands where it was cited; the ref in view where a row has none.
          const ref = u.at || (u.repo === 'web-tools' ? useRef() : selRef(repoOf(u), file));
          // Without a text, the directory is dimmed so the file name leads,
          // and a narrow column breaks the directory rather than the name.
          const cut = file.lastIndexOf('/') + 1;
          const shown = text || '<span class="text-base-content/45 break-all">' + esc(file.slice(0, cut)) + '</span>'
            + '<span class="whitespace-nowrap">' + esc(file.slice(cut)) + (line ? ':' + esc(line) : '') + '</span>';
          return '<a class="link link-hover font-mono text-sm ' + wrap + '" target="_blank" rel="noopener" href="https://github.com/'
            + esc(repoOf(u)) + '/blob/' + esc(ref) + '/' + esc(file) + (line ? '#L' + esc(line) : '') + '">' + shown + '</a>';
        };
        // Both shots on a slide, side by side where the deck is wide and one
        // over the other where it is not, the one the gallery is showing first.
        const shots = (u) => {
          const d = this.patThumb(u, 'desk'), ph = this.patThumb(u, 'phone');
          if (!d && !ph) return '';
          const desk = d ? '<img alt="" class="min-w-0 w-full @lg:w-auto @lg:flex-[4] rounded-lg border border-base-300" src="' + esc(d) + '">' : '';
          const phone = ph ? '<img alt="" class="min-w-0 w-full max-w-[390px] @lg:w-auto @lg:flex-1 rounded-lg border border-base-300" src="' + esc(ph) + '">' : '';
          return '<div class="flex flex-col @lg:flex-row items-start gap-3">'
            + (this.patShot === 'phone' ? phone + desk : desk + phone) + '</div>';
        };
        const render = (i, slide) => {
          const u = at(i);
          slide.innerHTML = this.patSlide(u, blob).replace('%SHOTS%', shots(u));
          // A unit beside this one opens its group as a deck, at that unit; a
          // count opens the units it counts, at this one where it is among them.
          slide.onclick = (e) => {
            const b = e.target.closest('[data-pat-open], [data-pat-rel]');
            if (!b) return;
            const { list, title } = b.dataset.patRel ? this.patRelated(b.dataset.patRel, b.dataset.patKey)
              : { list: this.patSiblings(u), title: this.patSiblingsTitle(u) };
            const k = list.findIndex(r => r.unit === (b.dataset.patOpen || u.unit));
            if (list.length) this.openPatternDeck(list, Math.max(0, k), title);
          };
        };
        const sub = (u) => [context, 'ring ' + u.app_ring, u.repo].filter(Boolean).join(' · ');
        let handle = null;
        handle = window.swipeDeck.open({
          count: units.length,
          start: Math.max(0, Math.min(start, units.length - 1)),
          title: at(start).label,
          subtitle: sub(at(start)),
          icon: 'ph-squares-four',
          // The kit's default inner is a reading column; a slide that leads
          // with a desktop shot takes the deck's width instead.
          innerClass: 'w-full',
          index: (i) => ({ title: at(i).label, subtitle: this.patCodeName('body', at(i).body) }),
          render,
          onSlide: (i) => {
            handle?.setTitle(at(i).label); handle?.setSubtitle(sub(at(i)));
            this.patDeckUnit = at(i).unit;
            // Docked, the cards stay beside the deck, so the one it shows is
            // brought to the top, under the held header and the strip, which
            // is where patTrack counts from: the header's n / m and the deck's
            // own count then name the same card.
            const pane = document.querySelector('[data-pane="map"]');
            const card = pane?.querySelector('[data-pat-card][data-unit="' + CSS.escape(at(i).unit) + '"]');
            if (card && document.documentElement.dataset.deckPane === 'dock') {
              const strip = pane.querySelector('[data-pat-strip]');
              const stripH = strip && getComputedStyle(strip).display !== 'none'
                ? (strip.querySelector('[data-pat-cardbar]')?.offsetHeight || 30) : 0;
              pane.scrollBy({ top: card.getBoundingClientRect().top - pane.getBoundingClientRect().top - this.patHeadH - stripH - 6,
                              behavior: 'smooth' });
            }
          },
          onClose: () => { if (this._patDeck === handle) { this._patDeck = null; this.patDeckUnit = ''; } },
        });
        this._patDeck = handle;
      },
      testsErr: '',
      testNames: false,
      testExplained: false,
      testExplain: null,   // test path -> [comparison rows]; null while absent or unread
      async loadTestsReg(){
        if (this.testsReg || this.testsLoading) return;
        this.testsLoading = true;
        this.testsErr = '';
        try {
          const gh = new window.GH({ token: window.TOKEN, repo: this.hub(), ref: useRef() });
          const raw = (await gh.get(TESTS_MANIFEST)).text;
          // Blank is not-asserted: a browser check reports no assertion count
          // because test() is not its unit, which is a different claim from a
          // suite that ran zero. boot_smoke follows it, being dependent.
          const parsed = { tests: window.Csv.rows(raw).map(t => ({
            ...t,
            assertions: t.assertions === '' ? null : +t.assertions,
            boot_smoke: t.assertions === '' ? null : window.Csv.list(t.boot_smoke).map(Number),
            assertion_names: t.assertions === '' ? null : window.Csv.list(t.assertion_names),
          })) };
          if (!parsed.tests.length) throw new Error('no tests block');
          window.SourcePeek?.seed(this.peek(TESTS_MANIFEST), raw);
          this.testsReg = parsed;
          // Non-fatal on its own, the same posture as the growth payload on
          // the Docs tab: the registry is the tab and the comparisons are a
          // detail under a row. A row's `check` names the test file first,
          // then a function, section or line; the file is the join key.
          try {
            this.testExplain = this.foldComparisons(window.Csv.rows((await gh.get(TESTS_EXPLAIN)).text));
          } catch { this.testExplain = null; }
          // The reading is dated, and the date travels on the manifest key
          // rather than in the CSV itself, so the declaration and the rows say
          // the same thing. Then the drift: each row carries the blob hash of
          // its script as read, and one tree fetch says which scripts have
          // moved since. Both non-fatal; the rows render without them.
          try {
            const man = JSON.parse((await gh.get('.web-tools.json')).text);
            this.testExplainAsOf = man?.[CHECKING_KEY]?.as_of || '';
          } catch { this.testExplainAsOf = ''; }
          try { this.testExplainChanged = await this.changedSinceRead(gh, this.testExplain); }
          catch { this.testExplainChanged = null; }
        } catch (e) {
          this.testsErr = 'Test registry load failed: ' + (e?.message || e);
        } finally { this.testsLoading = false; }
        this.loadEstateChecking();
      },
      // The join key is the `script` column and nothing else: a row's `where`
      // (function, section, line) is descriptive and never parsed. The first
      // cut joined on the text before the first space or punctuation mark in
      // one combined column, and a trailing comma was enough to make a row
      // count and not attach; the count said every row was attached because
      // it counted rows, not attachments.
      foldComparisons(rows){
        const byPath = new Map();
        for (const r of rows) {
          if (!r.script || !r.kind) continue;
          if (!byPath.has(r.script)) byPath.set(r.script, []);
          byPath.get(r.script).push(r);
        }
        return byPath.size ? byPath : null;
      },
      explainOf(t){ return this.testExplain?.get(t.path) || []; },
      testExplainAsOf: '',
      testExplainChanged: null,   // Set of scripts whose blob hash moved; null while unknown
      // One tree fetch per repo, then a hash comparison per explained script.
      // The tree is the cheap route: a contents fetch per script would carry
      // every test file's bytes to answer a one-hash question.
      async changedSinceRead(gh, byPath){
        if (!byPath || !byPath.size) return new Set();
        const tree = await gh.req('git/trees/' + encodeURIComponent(gh.ref || 'main') + '?recursive=1');
        const now = new Map((tree?.tree || []).map(e => [e.path, e.sha]));
        return this.changedSet(byPath, now);
      },
      changedSet(byPath, now){
        const out = new Set();
        for (const [script, rows] of byPath) {
          const read = rows.find(r => r.script_sha)?.script_sha;
          if (!read) continue;                 // an unstamped row makes no claim
          const cur = now.get(script);
          if (cur && cur !== read) out.add(script);
        }
        return out;
      },
      changedSince(script){ return !!this.testExplainChanged?.has(script); },
      // Grouped for display by kind, one heading per kind, every comparison
      // kept: sharing a kind and a file does not make two subjects one.
      groupsOf(rows){
        const by = new Map();
        for (const r of rows) { if (!by.has(r.kind)) by.set(r.kind, { kind: r.kind, term: r.term, rows: [] }); by.get(r.kind).rows.push(r); }
        return [...by.values()];
      },
      // Counts the tab claims: attached means the row's script is a registry
      // path, which is the only sense in which a row is "under a file".
      get testExplainTotals(){
        const reg = new Set((this.testsReg?.tests || []).map(t => t.path));
        let rows = 0, attached = 0; const files = new Set();
        for (const [script, rs] of (this.testExplain || new Map())) {
          rows += rs.length;
          if (reg.has(script)) { attached += rs.length; files.add(script); }
        }
        return { rows, attached, files: files.size, unexplained: reg.size - files.size };
      },
      get testExplainCount(){ return this.testExplainTotals.rows; },
      // ── In the estate ─────────────────────────────────────────────────
      // Token-gated and silent per repo on failure, like the estate skills; a
      // repo that declares nothing contributes no group. The query override is
      // read even without a token, since the reader may hold one the shell
      // does not know about, and the failure then shows as the group's error.
      estateChecking: null,
      checkingSources(cache, query){
        const out = [];
        for (const [repo, e] of Object.entries(cache?.repos || {})) {
          if (repo === this.hub()) continue;
          const c = e?.config?.[CHECKING_KEY];
          if (!c || typeof c.comparisons !== 'string') continue;
          out.push({ repo, ref: selRef(repo), files: c.files || '', comparisons: c.comparisons, asOf: c.as_of || '', from: 'crawl' });
        }
        for (const part of String(query || '').split(';').map(x => x.trim()).filter(Boolean)) {
          const m = part.match(/^([^@:]+)(?:@([^:]+))?:([^,]*),(.+)$/);
          if (!m) continue;
          const repo = m[1];
          const i = out.findIndex(x => x.repo === repo);
          const src = { repo, ref: m[2] || selRef(repo), files: m[3], comparisons: m[4], from: 'query' };
          if (i >= 0) out[i] = src; else out.push(src);
        }
        return out;
      },
      async loadEstateChecking(){
        if (this.estateChecking) return;
        let query = CHECKING_AT_LOAD;
        try { query = new URLSearchParams(location.search).get(CHECKING_KEY) || query; } catch {}
        if (!this.hasToken() && !query) return;
        let cache = null;
        if (this.hasToken()) {
          try {
            const path = window.RepoConfigCache?.CACHE_PATH || 'state/configs.json';
            const reg = new window.GH({ token: window.TOKEN, repo: this.registry(), ref: 'main' });
            cache = JSON.parse((await reg.get(path)).text);
          } catch { cache = null; }
        }
        const groups = [];
        for (const src of this.checkingSources(cache, query)) {
          const g = { repo: src.repo, short: src.repo.split('/').pop(), ref: src.ref, from: src.from, asOf: src.asOf || '',
                      filesPath: src.files, comparisonsPath: src.comparisons, files: [], byPath: null, changed: null, err: '' };
          try {
            const gh = new window.GH({ token: window.TOKEN, repo: src.repo, ref: src.ref });
            g.byPath = this.foldComparisons(window.Csv.rows((await gh.get(src.comparisons)).text)) || new Map();
            if (src.files) {
              try { g.files = window.Csv.rows((await gh.get(src.files)).text).filter(f => f.path); }
              catch { g.files = []; }
            }
            if (!g.asOf) {
              try { g.asOf = JSON.parse((await gh.get('.web-tools.json')).text)?.[CHECKING_KEY]?.as_of || ''; } catch {}
            }
            try { g.changed = await this.changedSinceRead(gh, g.byPath); } catch { g.changed = null; }
          } catch (e) { g.err = e?.message || String(e); }
          groups.push(g);
        }
        this.estateChecking = groups;
      },
      // What a repo's group shows, with the two absences told apart: a file
      // in the repo's reading with no comparison rows is NOT YET EXPLAINED; a
      // file whose reading says it stops nowhere is NOT A CHECK. Rows whose
      // script is in no reading still render, under their own script.
      checkingView(g){
        const explained = [], rest = [];
        const seen = new Set();
        for (const f of g.files) {
          const rows = g.byPath.get(f.path) || [];
          const noStop = String(f.stop_sites || '') === '0';
          (rows.length ? explained : rest).push({ path: f.path, reading: f, rows, noStop });
          seen.add(f.path);
        }
        for (const [script, rows] of g.byPath) if (!seen.has(script)) explained.push({ path: script, reading: null, rows, noStop: false });
        const units = new Set(); let comparisons = 0;
        for (const rows of g.byPath.values()) { comparisons += rows.length; for (const r of rows) if (r.unit) units.add(r.unit); }
        return { explained, unexplained: rest.filter(x => !x.noStop), noCheck: rest.filter(x => x.noStop),
                 comparisons, units: [...units], filesRead: g.files.length };
      },
      // Browser checks are counted as files and excluded from the assertion
      // total rather than folded in as zero, so the headline never implies
      // they contribute nothing.
      get testTotals(){
        const rows = this.testsReg?.tests || [];
        return {
          files: rows.length,
          assertions: rows.reduce((s, t) => s + (t.assertions || 0), 0),
          smoke: rows.reduce((s, t) => s + (t.boot_smoke?.length || 0), 0),
          browser: rows.filter(t => t.assertions === null).length,
        };
      },
      // A qualification a row carries, filtered as a SECOND axis rather than
      // folded into the kind strip: a boot check and a browser check are not
      // genres of test, they are things true about a row of any genre. Same
      // shape as the harness registry's invocation pills over its layer rail.
      // These two used to be a sentence under the totals, which stated in prose
      // what the rows already render (the smoke badge, the browser icon) and
      // gave a 1.3% figure the same weight as the headline. A chip says the
      // number and shows you which files it means.
      // One labeled row per dimension, each row's chips carrying files and, where
      // the unit applies, assertions. A browser check reports no assertion count,
      // so its chip shows files alone rather than folding a null into a total.
      get testDimensions(){
        const rows = this.testsReg?.tests || [];
        return DIMENSIONS.map(d => ({
          ...d,
          chips: d.values
            .map(v => {
              const hit = rows.filter(t => d.of(t) === v);
              return {
                value: v,
                files: hit.length,
                assertions: hit.reduce((s, t) => s + (t.assertions || 0), 0),
                counted: hit.some(t => t.assertions !== null),
                hint: d.hint(v, this.testsReg),
                dot: d.dot ? (KIND_TONE[v] || 'badge-ghost').replace('badge-', 'bg-') : '',
              };
            })
            .filter(c => c.files),
        }));
      },
      // One selection per dimension, so the three compose as an AND.
      testPick: {},
      toggleDim(dim, value){
        this.testPick = { ...this.testPick, [dim]: this.testPick[dim] === value ? '' : value };
      },
      get testPicked(){ return DIMENSIONS.filter(d => this.testPick[d.key]); },
      clearDims(){ this.testPick = {}; },
      // Which of a row's assertions are boot checks, as a Set for the list to
      // mark. Indices, because that is the level the property lives at.
      smokeSet(t){ return new Set(t.boot_smoke || []); },
      get testGroups(){
        const groups = new Map();
        for (const t of (this.testsReg?.tests || [])) {
          if (DIMENSIONS.some(d => this.testPick[d.key] && d.of(t) !== this.testPick[d.key])) continue;
          if (!groups.has(t.method)) groups.set(t.method, []);
          groups.get(t.method).push(t);
        }
        return METHOD_ORDER.filter(m => groups.has(m))
          .map(method => ({ method, hint: METHOD_HINT[method] || '', tests: groups.get(method) }));
      },
      testTitle(t){ return t.path.replace('node/test/', '').replace(/\.(test\.)?mjs$/, ''); },
      // The suite as the strip has cut it, flattened out of its groups. The
      // deck pages what the reader is looking at, so a filter narrows the deck
      // with it; the order is the groups' order, which is the order on screen.
      get testShown(){ return this.testGroups.flatMap(g => g.tests); },
      // A CHECK IS A DOCUMENT HERE, which is the whole reason the row moved off
      // openHubFile: the Tests subview's subject is what each check protects, and
      // the answer is prose at the top of the file. The Files view is where you
      // work on one; this is where you read them.
      //
      // `key` carries the filter, since two different cuts are two different
      // sets and a deck reopened on the same key would page the old one.
      openTestDeck(t){
        const files = this.testShown;
        return this.openFileDeck(files, files.findIndex(f => f.path === t.path), {
          icon: 'ph-flask', key: 'tests:' + JSON.stringify(this.testPick),
          context: 'Tests',
          label: (x) => ({ title: this.testTitle(x), subtitle: x.protects || '' }),
        });
      },
      kindTone(k){ return KIND_TONE[k] || 'badge-ghost'; },
      async loadToolsReg(){
        if (this.toolsReg || this.toolsLoading) return;
        this.toolsLoading = true;
        this.toolsErr = '';
        try {
          const gh = new window.GH({ token: window.TOKEN, repo: this.hub(), ref: useRef() });
          const raw = (await gh.get(TOOLS_MANIFEST)).text;
          const parsed = { tools: window.Csv.rows(raw).map(t => ({
            ...t, lines: +t.lines || 0,
            emits: t.emits === 'yes', named: t.named === 'yes', tested: t.tested === 'yes',
          })) };
          if (!parsed.tools.length) throw new Error('no tools block');
          window.SourcePeek?.seed(this.peek(TOOLS_MANIFEST), raw);
          this.toolsReg = parsed;
          // Non-fatal on its own, as the Docs tab's growth payload is: the
          // steps open one row, and a missing file costs that row its list.
          try {
            const legsRaw = (await gh.get(HOOK_LEGS)).text;
            window.SourcePeek?.seed(this.peek(HOOK_LEGS), legsRaw);
            this.hookLegs = window.Csv.rows(legsRaw).map(l => ({
              ...l, watches: window.Csv.list(l.watches), runs: window.Csv.list(l.runs),
              stages: window.Csv.list(l.stages),
            }));
          } catch { this.hookLegs = null; }
        } catch (e) {
          this.toolsErr = 'Harness registry load failed: ' + (e?.message || e);
        } finally { this.toolsLoading = false; }
      },
      // The rail: every folder that holds a registry row, counts rolled up to
      // ancestors the same way the Docs rail rolls words, with the blank-role
      // count as the second figure. The invocation filter re-weights it.
      get harnessFolders(){
        const agg = new Map();
        for (const t of (this.toolsReg?.tools || [])) {
          const hit = this.harnessHit(t);
          let dir = t.layer;
          while (dir) {
            if (!agg.has(dir)) agg.set(dir, { n: 0, blank: 0 });
            if (hit) { const a = agg.get(dir); a.n++; if (!t.role) a.blank++; }
            dir = dir.includes('/') ? dir.slice(0, dir.lastIndexOf('/')) : '';
          }
        }
        return [...agg.entries()].sort(([a], [b]) => a.localeCompare(b))
          .map(([dir, a]) => ({
            dir, ...a,
            name: dir.slice(dir.lastIndexOf('/') + 1),
            depth: dir.split('/').length - 1,
          }));
      },
      // The prefixed families (npm:showing, git:pre-commit, ci:pull_request)
      // fold to one pill each; the bare routes match exactly.
      harnessHit(t){
        if (!this.harnessInvoke) return true;
        return PREFIXED_INVOKE.includes(this.harnessInvoke)
          ? t.invocation.startsWith(this.harnessInvoke + ':')
          : t.invocation === this.harnessInvoke;
      },
      get harnessInvokeCounts(){
        const rows = this.toolsReg?.tools || [];
        const gloss = {
          npm: 'a package.json script invokes it',
          driver: 'passed by path to npm run shot --script; named nowhere is its normal state',
          imported: 'another harness file imports or invokes it',
          argv: 'carries a shebang; run by hand',
          env: 'the setup script, fetched and run by the claude.ai environment settings when a snapshot is built',
          git: 'a git hook; the filename is the event',
          session: 'a session-*.sh, run by the plugin dispatcher at session start',
          hook: 'a plugin hook; the event comes from hooks.json',
          ci: 'a workflow; the events come from its on: block',
          'none found': 'no route the derivation can see, the warning state',
        };
        return ['npm', 'driver', 'imported', 'argv', 'env', 'git', 'session', 'hook', 'ci', 'none found'].map(key => ({
          key,
          tone: INVOKE_TONE[key] || 'badge-ghost',
          gloss: gloss[key],
          n: rows.filter(t => PREFIXED_INVOKE.includes(key)
               ? t.invocation.startsWith(key + ':') : t.invocation === key).length,
        })).filter(r => r.n);
      },
      get harnessDirFiles(){
        return (this.toolsReg?.tools || []).filter(t =>
          this.harnessHit(t) && t.layer === this.harnessDir);
      },
      get toolTotals(){
        const rows = this.toolsReg?.tools || [];
        return {
          files: rows.length,
          named: rows.filter(t => t.named).length,
          tested: rows.filter(t => t.tested).length,
          blank: rows.filter(t => !t.role).length,
        };
      },
      toggleHarnessInvoke(key){ this.harnessInvoke = this.harnessInvoke === key ? '' : key; },
      // The Harness Automation subview's door, in the Docs Inventory shape: a
      // folder rail, a selected folder, and its direct files as filtered.
      openHarnessDeck(t){
        const files = this.harnessDirFiles;
        return this.openFileDeck(files, files.findIndex(f => f.path === t.path), {
          icon: 'ph-wrench', key: 'harness:' + this.harnessDir,
          label: (x) => ({ title: this.toolTitle(x), subtitle: x.role || '' }),
        });
      },
      toolTitle(t){ return t.path.split('/').pop(); },
      invokeTone(inv){ const fam = PREFIXED_INVOKE.find(p => inv.startsWith(p + ':')); return INVOKE_TONE[fam || inv] || 'badge-ghost'; },
      // ── Kits ──────────────────────────────────────────────────────────────
      // ── Outposts ──────────────────────────────────────────────────────────
      async loadOutposts(){
        if (this.outpostsReg || this.outpostsLoading) return;
        this.outpostsLoading = true;
        this.outpostsErr = '';
        try {
          const gh = new window.GH({ token: window.TOKEN, repo: this.hub(), ref: useRef() });
          const [o, d] = await Promise.all([gh.get(OUTPOSTS_MANIFEST), gh.get(ACCOUNT_SKILLS_MANIFEST)]);
          const outposts = window.Csv.rows(o.text);
          if (!outposts.length) throw new Error('no outpost rows');
          window.SourcePeek?.seed(this.peek(OUTPOSTS_MANIFEST), o.text);
          window.SourcePeek?.seed(this.peek(ACCOUNT_SKILLS_MANIFEST), d.text);
          this.outpostsReg = { outposts, declared: Object.fromEntries(window.Csv.rows(d.text).map(r => [r.name, r])) };
        } catch (e) {
          this.outpostsErr = 'Outposts registry load failed: ' + (e?.message || e);
        } finally { this.outpostsLoading = false; }
        this.loadAccountObserved();
      },
      async loadAccountObserved(){
        if (this.accountObs || !this.hasToken()) return;
        try {
          const reg = new window.GH({ token: window.TOKEN, repo: this.registry(), ref: ctxPrivRef() });
          this.accountObs = window.Csv.rows((await reg.get(ACCOUNT_OBSERVED)).text);
        } catch (e) {
          this.accountObs = [];
          this.accountObsErr = ACCOUNT_OBSERVED + ' in ' + this.registry() + ' did not load: ' + (e?.message || e);
        }
      },
      // A part's value is a locator (owner/repo:path), a container path
      // (~/...), or words for an observation that arrives by hand. A folder
      // opens the tree; a file opens through the peek like every other tab.
      outpostPart(v){
        const m = String(v || '').match(/^([\w.-]+\/[\w.-]+):(.+)$/);
        if (!m) return { text: v, code: /^~\//.test(v || '') };
        const [, repo, path] = m;
        if (path.endsWith('/')) return { text: repo.split('/')[1] + ':' + path, href: 'https://github.com/' + repo + '/tree/main/' + path };
        const addr = repo === this.hub() ? this.peek(path) : (window.SourcePeek?.addr(repo, 'main', path) || null);
        return { text: (repo === this.hub() ? '' : repo.split('/')[1] + ':') + path, addr };
      },
      outpostParts(o){
        return OUTPOST_PARTS.filter(([k]) => o[k]).map(([k, label]) => ({ k, label, ...this.outpostPart(o[k]) }));
      },
      // The account's skills, needing attention first, each with its declared note.
      get accountGroups(){
        const rows = (this.accountObs || []).map(r => ({ ...r, note: this.outpostsReg?.declared?.[r.name]?.note || '' }));
        return [
          { key: 'attention', label: 'Needs attention', rows: rows.filter(r => r.attention === 'yes') },
          { key: 'declared', label: 'As declared', rows: rows.filter(r => r.attention !== 'yes') },
        ].filter(g => g.rows.length);
      },
      get accountObservedOn(){ return (this.accountObs || [])[0]?.observed || ''; },

      async loadKitsReg(){
        if (this.kitsReg || this.kitsLoading) return;
        this.kitsLoading = true;
        this.kitsErr = '';
        try {
          const gh = new window.GH({ token: window.TOKEN, repo: this.hub(), ref: useRef() });
          const raw = (await gh.get(KITS_MANIFEST)).text;
          const kits = window.Csv.rows(raw).map(k => ({
            ...k, lines: +k.lines || 0, users: +k.users || 0,
            boot: k.boot === 'yes', demo: k.demo === 'yes', tested: k.tested === 'yes',
            name: k.path.split('/').pop().replace(/\.js$/, ''),
          }));
          if (!kits.length) throw new Error('no kit rows');
          window.SourcePeek?.seed(this.peek(KITS_MANIFEST), raw);
          this.kitsReg = { kits };
        } catch (e) {
          this.kitsErr = 'Kits registry load failed: ' + (e?.message || e);
        } finally { this.kitsLoading = false; }
      },
      // The filter strip. The first two are facts a reader browses by; the
      // last three are the warning states, counted here so the figure the tab
      // exists to show is on the strip and not only in the row tone.
      get kitFilterCounts(){
        const rows = this.kitsReg?.kits || [];
        const defs = [
          { key: 'boot', label: 'boot', tone: 'badge-info', gloss: 'gh-boot.js loads it on every chain-boot page: part of what a page pays to start', hit: k => k.boot },
          { key: 'demo', label: 'demo', tone: 'badge-success', gloss: 'a page under lib/kits/demos/ shows it running', hit: k => k.demo },
          { key: 'unloaded', label: 'nothing loads it', tone: 'badge-warning', gloss: 'no file under lib/, pages/ or app/ names its load path', hit: k => !k.users },
          { key: 'unnamed', label: 'no gloss', tone: 'badge-warning', gloss: 'the header comment does not open with a sentence, so the tab has nothing to say for it', hit: k => !k.gloss },
          { key: 'untested', label: 'untested', tone: 'badge-warning', gloss: 'no file under node/test/ names it', hit: k => !k.tested },
        ];
        return defs.map(d => ({ ...d, n: rows.filter(d.hit).length })).filter(d => d.n);
      },
      kitHit(k){
        const d = this.kitFilterCounts.find(x => x.key === this.kitFilter);
        return !d || d.hit(k);
      },
      get kitRows(){ return (this.kitsReg?.kits || []).filter(k => this.kitHit(k)); },
      get kitTotals(){
        const rows = this.kitsReg?.kits || [];
        return {
          kits: rows.length,
          demos: rows.filter(k => k.demo).length,
          boot: rows.filter(k => k.boot).length,
          lines: rows.reduce((n, k) => n + k.lines, 0),
        };
      },
      toggleKitFilter(key){ this.kitFilter = this.kitFilter === key ? '' : key; },
      kitDemoPath(k){ return KITS_DEMOS + k.name + '.html'; },
      // The demo opens as an APP VIEW of this app rather than as a bare page:
      // the frame stack then reads app over renderer over page in the FAB's
      // layer strip, and every take the drawer offers aims at the demo. The
      // same door a promoted page gets; a kit demo is one this repo promotes.
      kitDemoHref(k){
        const p = new URLSearchParams({ view: 'app', appRepo: this.hub(), appPath: this.kitDemoPath(k), appLabel: k.name });
        const ref = useRef();
        if (ref && ref !== 'main') p.set('appRef', ref);
        return '?' + p.toString();
      },
      openKitDeck(k){
        const files = this.kitRows;
        return this.openFileDeck(files, files.findIndex(f => f.path === k.path), {
          icon: 'ph-toolbox', key: 'kits:' + this.kitFilter,
          label: (x) => ({ title: x.name, subtitle: x.gloss || '' }),
        });
      },
      toggleToolLayer(key){ this.toolLayer = this.toolLayer === key ? '' : key; },
      toggleReach(key){ this.docReach = this.docReach === key ? '' : key; },
      // An unchecked copy or paraphrase is the fact this tab exists to show,
      // so it renders in the warning tone; a pointer or live read needs no
      // check and stays neutral.
      checkText(r){
        if (r.check) return r.check;
        return (r.relation === 'pointer' || r.relation === 'live read') ? 'no check needed' : 'unchecked';
      },
      checkTone(r){
        const fine = r.relation === 'pointer' || r.relation === 'live read';
        const held = r.check && !/^none/i.test(r.check);
        return 'text-sm ' + (fine || held ? 'text-base-content/40' : 'text-warning');
      },

    };
  });
});
