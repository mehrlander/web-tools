# The loader contract

Most pages here load their own code at runtime instead of shipping a bundle:
a page imports `gh-api.js`, then calls `gh.load(...)` for each component and
kit it needs, and each file is fetched (through the GitHub contents API) and
run on the spot. There is no build step in the authoring loop: edit a file in
`lib/`, reload, and the next run uses it.

The repo has two tiers of pages:

- **Simple pages** are self-contained: CDN Tailwind, Phosphor and Alpine (via
  `<script defer>`), then an inline `<script>` with the page's Alpine
  components, or one plain `<script src>` pulling a self-contained component
  file from `lib/`. They do not use the loader at all.
  `pages/stories/bookmarklets-story.html` is one.
- **Loader-based pages** use `gh-api.js` (whose bootstrap chains `gh-boot.js`
  and its auto-loads; `gh-store.js` stays opt-in) plus `alpine-bundle.js` to
  load reusable components off the repo at runtime.
  `lib/kits/demos/{persistence,messaging,io}.html` are the small ones;
  `pages/index.html` is loader-based too. `app/index.html` imports
  `dist/app.js`, its own pre-build, rather than running the load chain. Which
  pages exist is [`pages/pages.csv`](../pages/pages.csv)'s business.

This doc is about the second tier: the contract a file must honor to be
loadable this way, the timing invariants the boot sequence depends on, and,
because that same contract is what lets a page be frozen into an offline
**build**, how load and build are two readings of one set of rules (see
[Load and build are one contract](#load-and-build-are-one-contract)). The
build/bake tooling and the render harness live under
[`node/`](../node/README.md).

## The loader-based page pattern, annotated

Every loader-based page's `<head>` looks like this, with minor variation:

```html
<script src="https://cdn.jsdelivr.net/combine/npm/@tailwindcss/browser@4,npm/@phosphor-icons/web"></script>
<link href=".../daisyui@5/themes.css,npm/daisyui@5" rel="stylesheet" />
<script type="module">
  // ?use=<branch|tag|sha> pins everything entry.js loads to a ref; defaults to main.
  // entry.js imports gh-api.js at that ref, which sets window.gh and chains
  // gh-boot.js, so by the time the import resolves gh-boot.js's BOOT list is
  // loaded; gh-store.js stays opt-in.
  await import('https://mehrlander.github.io/web-tools/lib/entry.js');

  // await gh.load('gh-store.js');                // optional: write methods

  await gh.load('alpineComponents/repo.js');      // 1) register Alpine.data('repo', ...)
  await gh.load('alpineComponents/mention.js');   // 2) register Alpine.data('mention', ...)
  await gh.load('alpineComponents/viewer.js');    // 3) register Alpine.data('viewer', ...)
  await gh.load('alpine-bundle.js');              // 4) register magics + boot Alpine
</script>
```

The page body then has `<body x-data="app()" x-init="init()">` and the
components each use `x-data="repo()"`, `x-data="mention()"`,
`x-data="viewer()"`.

Every loader page gets the `?use=` hatch from `lib/entry.js`: append
`?use=<branch|tag|sha>` to the URL and every file loaded after `gh-api.js`
comes from that ref instead of main. The HTML itself, and `entry.js`, still
come from GitHub Pages on main; only the runtime-loaded files are ref-pinned.
`entry.js` brings `gh-api.js` in by one of two routes, and everything after
it loads through the contents API at the same ref either way:

- **Main** (no `?use=`): a native import of `gh-api.js` from beside
  `entry.js` on GitHub Pages, which serves JavaScript as JavaScript with a
  ten-minute cache.
- **Any other ref** (`?use=<ref>`): that ref's `gh-api.js` from
  `raw.githubusercontent`, fetched `no-store` and blob-imported, since raw
  serves `text/plain` with `nosniff`. The contents API is fresh on a push;
  raw serves `max-age=300`, so it tracks a push within minutes.

[`lib/entry.js`](../lib/entry.js)'s header gives the order in which it resolves
its ref (its own `?ref=` first, `main` last) and why the main route stays a
native import (the snag `shell-pin-kills-the-tab`).

### Under the toss

A page rendered by `pages/toss-render.html` has no query string of its own:
by default it runs in a `blob:` frame (top mode, below, is the exception). The renderer answers the page's reads of its own
address instead, through a params shim, and it tells the page which Web Tools
to load through these channels, each with one meaning:

| Channel | Meaning | Set when |
|---|---|---|
| `use`, answered by the shim | The effective Web Tools ref | Always, for a page with a ref to answer |
| `lib`, answered by the shim | The page query's own `lib`, never a default | The page query inside the address carries it |
| `window.__lib` | A Web Tools version that was asked for | The renderer's own `?lib=<ref>` is set, or the page query inside the address carries `lib` |
| `window.__ref` | The version of the displayed file itself | The address names a ref, or the selection chose one for the file |
| `window.__refs` | The link's selection, forwarded unchanged to nested views | Always; `{}` when the link asked for nothing |
| `window.__refsImplied` | What this page implies: its repository at its address's ref, and the Web Tools version it boots. Never forwarded | Always |
| `window.__refFor(repo, path)` | The resolver over the two above | Always |

The effective ref is the explicit one when there is one: the renderer's
`?lib=`, else the page query's `lib`. Otherwise it is the page's own ref for
a page of this repo, and `main` for a page of any other repo, since that
page's ref names a branch of a different repository. So a page tossed from
another repo loads `main` unless the link says otherwise, whether its boot
reads `use` or reads `lib` and then `window.__lib`. The renderer never
invents a `lib`: a default answered under that name looks like a selection
to anything that forwards selections, and a renderer run by another renderer
would impose the outer default on the page inside. A page that frames views of its own,
such as the app, reads `window.__lib` to tell a selection it must pass on
from a default each view derives for itself. The web-tools app does this in
`appViewAddress`: a view's own ref and `lib` win, then the app's page ref (for
a web-tools view) and the app's explicit selection, `main` included, then the
view's own default.

The shim answers only the page's reads of its own address:
`new URLSearchParams(location.search)`, and the `searchParams` of a `URL`
whose `href` is the document's own. One ambiguity is inherent: in a `blob:`
frame `location.search` is always empty, so a `URLSearchParams` built from
any other empty string looks the same and gets the address's answers. A page
that parses a string which may be empty should test it first.

**Top mode (`?top`).** With `?top` and an address the link carries, the
renderer builds the page as it would for a frame, with the same prelude,
inlining and fetch shim, and then replaces its own document with it. The page
then has a real query, of which the renderer owns some keys: `top`, the address
(`gh`, or a route key), and the selection. So the params shim differs from a
frame's: a `URLSearchParams` holding `top` is the page's address, and its reads
skip the renderer's keys and answer the same `use` and `src` a frame's shim
answers. A history shim keeps `top`, the address and the selection in every URL
the page writes, so navigation, reload and Back keep the page and its versions.
The channels in the table are stamped the same way, and `window.__tossTop`
(`{ repo, ref, path, lib }`) replaces `window.__fabHosted`, since no renderer
is on screen and the page mounts its own FAB. A forced width, a payload, and an
address pasted into the renderer's panel keep the frame.

### The selection

A link can say, for any repository the displayed file's code reads, which ref
to read it at. The grammar is one repeatable query key, read on the renderer's
own query, on a deployed page's query, and by the top-mode launcher:

| Entry | Covers |
|---|---|
| `refs=owner/repo@ref` | the whole repository |
| `refs=owner/repo@ref:path` | one file |
| `refs=owner/repo@ref:dir/` | every file under the folder |

`?lib=<ref>` on the renderer is the entry `mehrlander/web-tools@<ref>`, and
`?use=<ref>` on a deployed page is the same entry. The address's `@ref` is the
version of the displayed file alone.

**Precedence, strongest first.**

1. A ref the code names on purpose, `main` included (the exceptions below).
2. For the displayed file: the address's `@ref`, else the selection for that file or its repository, else the default branch. That version is `window.__ref`.
3. A page's own parameter for a repository (`?data=`), which the page reads before anything else.
4. The selection: the longest matching path entry, then the repository's entry.
5. What the page implies: its own repository at the ref its ADDRESS named (not a version a path entry gave the file alone), and for a web-tools page, the Web Tools it boots.
6. The code's default.

**Reads follow; writes do not.** A `GH` client whose caller named no ref
(the key absent, not `''`) reads through `readRef(path)`, which consults the
resolver. `gh.ref` keeps its meaning, the named ref or `main`, and is the only
branch any write uses; `gh-store` reads its conflict sha at `gh.ref` too. An
explicit ref pins every read, `main` and `''` included, and assigning `gh.ref`
pins as naming it did. A boot client (`follow: true`) keeps its own ref and
takes path entries only. A page that reads a file and writes it back reads it
at its write branch, never through the selection; its own parameter
(`?data=`) is the one thing that moves read and write together.

**Which resources follow which selection**, in a toss and on a deployed page:

| Resource | Version |
|---|---|
| The page file | The address's ref |
| The page's relative `<script src>` and `<link rel=stylesheet>` | The file's own entry in the selection, else the address's ref, inlined by the renderer, in both modes |
| The page's relative `fetch()` GETs | As above, through the renderer's fetch shim, in both modes |
| The page's relative `<img>`, CSS `url()`, `import()`, `<iframe src>`, and a relative favicon | The deployed site, main, through the stamped `<base>`, in both modes; absent for a private repository |
| `lib/entry.js` | The deployed site, always |
| `lib/gh-api.js` and every `gh.load` file | The Web Tools selection: raw and the contents API at that ref, or Pages for main |
| A pre-built bundle (`dist/app.js`, `dist/web-tools.js`, `dist/dictate.js`) | The Web Tools selection. Its cache answers only a read of its own repository that resolves to the ref it was loaded at, so one changed file previews over an unchanged build and a pinned client never gets the build's copy. A build GitHub Pages served takes the default branch as its ref whatever was asked, and a page whose own resolve fell back to it shows the unmet ask in the FAB |
| home's `surfacer.html` bundle | The Web Tools selection, resolved to a commit; main's deployed build, reporting main, if the resolve fails |
| A routed toss's viewer page (`#data=`, `#pdf=`) | The Web Tools selection, else the route's ref |
| The renderer, its FAB and its Alpine | main, in frame mode. In top mode the page replaces the renderer, and the page's own FAB follows the Web Tools selection |
| Another repository's data | The page's own parameter, else the selection, else main; the reads kept on main on purpose are below |
| A view the web-tools app frames | Its own ref and `lib`, else the app's, by `appViewAddress` ([Under the toss](#under-the-toss)) |

The `GH` client's reads (`get`, `bytes`, `ls`, `history`, `recentFiles`,
`rawUrl`, `flatTree`) resolve each path through the selection; reads a page
builds by hand take `GH.refFor(repo, path)`. The web-tools app and home's
budget-drs app forward the selection to every view and tenant they frame and
every toss link they mint.

**Kept on purpose, and why.**

| Reads that name their ref | Why |
|---|---|
| The registry and session store in `mehrlander/web-tools-private` (state, caches, notes, errands, jots, sessions) | Live shared state that crawls, devices and sessions write on `main`; a preview must show the current state |
| Device folders (`shortcuts/log`, `shortcuts/manifests`, `push-shortcuts`) | The device writes only to `main`; reading them at a preview ref was a real bug |
| `shortcut-log.html`'s main-versus-branch scoring | A deliberate comparison |
| Read-modify-write editors (`links`, `news`, `text-lab`, `dictate`, the library's prune ledger, `repo-proposals`) | What is read is written back; `?data=` moves both |
| The app's Files view and config form | A visible, user-chosen browse ref that also targets writes |
| `.web-tools.json` read for the shared config cache | Following a selection would bake a branch's config into shared state |
| Errands, `file-review`'s comparison base, `gh-transfer` | Operations and comparisons, not previews |
| `lib/entry.js`, bookmarklet and courier pointers | Bootstraps and deployed pointers |
| The renderer's own code (its FAB and drawer) | Always `main`: a renderer running Web Tools at a chosen ref while hosting a frame is the recorded Safari crash shape |
| The budget-drs appendix descriptors | `main` by default, the owner's live page; an explicit selection for that repository is honoured |

### What each piece contributes

Each file's header is its own account; these lines say what it is for.

- `lib/gh-api.js`: ESM default export, `class GH`, imported rather than
  `gh.load`ed, since it is the loader. A minimal root: `req / get / read /
  bytes / load` and the request and cache plumbing. Read methods
  (`gh-fetch.js`), write methods (`gh-store.js`) and token resolution
  (`gh-auth.js`) are loaded through `gh.load(...)` and patch `GH.prototype` in
  place. **Auto-bootstrap** triggers on one signal, `window.__ghBlobBoot =
  { repo, ref }`, set by `entry.js` before either import (a signal rather than
  `import.meta.url`, which is an opaque `blob:` URL on the `?use=` route): the
  file instantiates `window.gh`, sets `window.__bundleRef`, sets `loadBase` to
  `lib/` (so `gh.load('kits/x.js')` resolves under `lib/`), and chains
  `gh-boot.js`. A page that imports `gh-api.js` any other way sets no signal,
  so the bootstrap stays dormant and the page instantiates `GH` by hand.
- `lib/entry.js`: the page's one import, from GitHub Pages. Always main's copy,
  which is why it holds nothing but the boot.
- `gh-boot.js`: the startup list, kept out of `gh-api.js` so the loader itself
  changes rarely. Its `BOOT` manifest (the unconditional sequence) and
  `FAB_BOOT` (the FAB and its path picker, unless the page sets `data-no-fab`)
  are declared as data at the top of the file; read them there. It also fills
  the load registry and the read mirror on `window`, installs the `fetch`
  wrapper (all three below), and injects the project favicon when a page declares
  none. Nothing in it may break the boot chain.
- `gh-auth.js`: the token and boot-failure layer. Its header covers the
  `headers` and `req` patches, the `unhandledrejection` handler and
  `window.ghAuth`. Loaded automatically by `gh-boot.js` on bootstrap pages;
  a page that imports `gh-api.js` other than through `entry.js` sets no
  bootstrap signal and must `await gh.load('gh-auth.js')` itself.
- `vanilla-bundle.js`: framework-free ambient helpers (DOM utilities,
  `window.html`, `window.copy()`), first in `BOOT`. No dependencies;
  idempotent on re-load.
- `alpine-bundle.js`: IIFE. Inside an `alpine:init` handler it creates
  `Alpine.store('browser')`, `Alpine.store('toasts')`, and magics `$clip`,
  `$paste`, `$toast`; it then injects the Alpine collapse plugin and Alpine
  itself (invariant 3).
- `alpineComponents/*.js`: each calls `document.addEventListener('alpine:init', …)`
  with `Alpine.data('name', fn)` inside. They reach across to other
  components via `Alpine.store('browser')` and via per-element back-pointers
  (`this.$root.__viewer = this`).
- The view registry (Tabulator/Prism/Marked render modes) lives inside
  `alpineComponents/viewer.js` as a module-private constant.
  Pages don't load it separately.

### The ambient surface

What the boot chain leaves on `window`, in one place. A bootstrap page
(the `entry.js` import) gets all of it without loading anything
itself; a page that instantiates `GH` by hand gets only what it loads.

| Global | Installed by | What it is |
|---|---|---|
| `gh`, `GH` | `gh-api.js` bootstrap | the live loader instance; the class |
| `__bundleRef` | `gh-api.js` bootstrap | the ref the bundle booted from |
| `__consoleLogs` (+ `consolelog` event) | `gh-api.js` | flattened console capture; the fallback renderers use when `kits/console.js` is absent |
| `__loadedScripts` (+ `loadedscripts` event) | `gh-boot.js` | the load registry: path, timing, status, `by:` attribution; the FAB's Inspect tab reads it |
| `__reads` (+ `reads` event) | `gh-boot.js` | newest `read()` value per path; the export kit's input |
| `__traffic`, `__trafficTotals` (+ `traffic` event, coalesced to 250ms) | `gh-boot.js` | the request ledger: one row per `fetch`, with `method`, `via` (the repo path a `load()`/`read()` was fetching), status, elapsed, and `wire` from `content-length`. Rows are capped and the totals are not |
| `__trafficRate`, `__trafficRateAt`, `__trafficRateReset` | `gh-boot.js` | newest `x-ratelimit-remaining` seen on any response, when it was seen, and when the window resets |
| `__ghFiles` (+ `ghfiles` event) | `gh-boot.js` | per-path `{ bytes, inlined, sha }` from a `get()` wrapper; `inlined` marks a file the pre-build served from its cache |
| `Traffic` | `kits/traffic.js` | the pure read over the two above plus Resource Timing: classification, roll-ups, formatting, and the three-state size vocabulary (network / cached / undisclosed) |
| `ghAuth` | `gh-auth.js` | `resolve` / `save` / `clear` / `prompt` / `bootDone`, among others |
| `console.history` / `.subscribe` / `.filter`, `consoleKit` | `kits/console.js` | structured console retention over the base wrapper |
| `html`, the DOM helpers (`ea`, `el`, …), `copy()` | `vanilla-bundle.js` | ambient string/DOM utilities |
| Alpine stores `browser`, `toasts`; magics `$clip`, `$paste`, `$toast` | `alpine-bundle.js` | exist only after `alpine:init` |
| `__builtOffline` | a build (`build.js` output) | present only on baked/offline pages |
| `window.<kit>` namespaces | each kit | see the [Kits tab](https://mehrlander.github.io/web-tools/app/?view=map&tab=kits) and [`kits.csv`](kits.csv), whose `boot` column marks the kits `gh-boot.js` loads |

A new global installed by `gh-api.js`, `gh-boot.js` or a bundle with no row
here is a doc bug; add the row in the same change that adds the global. A kit
or component documents its own global in its header comment.

The chain patches one global: `gh-boot.js` replaces `window.fetch` with a
wrapper that records the URL, the status, the elapsed time, and
`content-length`. Its boundaries are what make it safe to keep:

- **It never touches the body.** The same `Response` comes back with its
  stream unread, so nothing downstream can be starved by the instrument; only
  the compressed length is known.
- **It never swallows an error.** A rejected fetch is recorded and rethrown
  unchanged.
- **It installs once**, guarded by `__trafficWrapped`, so a re-boot or a second
  bundle on the page does not stack wrappers.
- **It sees only what comes after it.** The document, the CDN tags and
  `gh-api.js` itself are Resource Timing's job, which is why the FAB's Traffic
  tab reads both and keeps them in separate bands.

A page that wraps `fetch` itself should do so before the bundle import or
accept that its wrapper sits outside this one.

## The load mechanism

`GH.prototype.load`, from `gh-api.js`, is deliberately almost nothing:

```js
const text = (await this.get(this.loadBase + path)).text;   // fetch the file
const scopedGh = new Proxy(this, { /* stamps `by:` on nested gh.load */ });
await new Function('gh', text)(scopedGh);                    // run it as-is
```

The file is fetched and run **verbatim, with no source rewriting.** (`read()`,
the data twin, runs a file the same way but returns its value, tries a local
sibling file first (rule 4), and does not apply `loadBase`: data paths are
repo-root paths.)

**We don't author modules.** A loaded file is a plain script body, not an ES
module that the loader de-modularizes. It runs inside
`new Function('gh', text)(...)`, so:

1. **No `import` / `export`, ever.** Either keyword inside a `new Function`
   body throws `SyntaxError` at load. A file that needs a library reaches a
   global (a `<script>` already on the page) or uses `await import(...)`,
   which is an ordinary expression and is fine.
2. **`gh` is in scope.** The loader injects the instance as the function's
   one argument, so a loaded file calls `gh.load(...)` / `gh.get(...)`
   directly; the injected `gh` is a proxy that records which file each
   nested load came from (`by:` attribution). `window.gh` works too.
3. **`load()` discards the return value; it runs files for their side
   effects.** A loaded file makes itself available by *doing* something:
   `window.X = …`, `Alpine.data('name', …)` inside an `alpine:init` listener,
   or patching `GH.prototype` (as `gh-fetch.js` / `gh-store.js` do). Top-level
   `const`/`let` are local to the run and vanish.
4. **`read()` is the value-returning twin.** When a file's job is to
   *produce* a value rather than register a side effect, it ends with a
   top-level `return X;` and the caller uses `gh.read(path)` (or, for a local
   sibling file on `file://`, deposits on `document.currentScript.value`).
   That's the data path, distinct from code loading.

The consequence for outside code: anything genuinely modular, such as Alp's
`utils/kits/` with `import { brotli } from './brotli.js'`, **cannot go
through `gh.load()`**. It's ESM; load it with native `import()` instead.

## The timing invariants, stated explicitly

These hold in the current loader-based pages and must not be broken by
anything we add:

1. **`gh-api.js` is imported first**, via native `import()`. Nothing else
   has dependencies. The augmentations are then loaded through
   `gh.load(...)`: `gh-boot.js` handles `gh-auth.js` and `gh-fetch.js`,
   and `gh-store.js` stays opt-in. They require `window.GH` to already exist
   and will throw if pulled directly from a `<script type="module">`.
2. **Any `alpine:init` handler must be registered before Alpine boots.**
   Concretely: every `gh.load('alpineComponents/*.js')` call must happen
   *before* `gh.load('alpine-bundle.js')`. Alpine doesn't start until
   alpine-bundle injects the Alpine `<script>` tag, so the serial `await`s
   in the module script guarantee this. Registering after it is a race on
   Alpine's CDN speed, so it fails intermittently. `alpineComponents/viewer.js`
   is exempt: it registers at once if Alpine is already running.
3. **`alpine-bundle.js` is the boot signal.** It registers the `browser`
   and `toasts` stores on `alpine:init`, then appends Alpine's script tag.
   Whenever Alpine loads, its `alpine:init` fires, our handlers run, stores
   exist, and only then does Alpine walk the DOM and call `init()` on each
   `x-data` component. Stores therefore do not exist at a file's top level:
   reach `Alpine.store(...)` inside `init()`, methods or getters.
4. **`x-init="init()"` on the body still races the module script.** That's
   why `app/index.html`'s `app.init()` opens with
   `const ready = await waitFor(() => window.GH);`, a bounded poll helper
   defined in the same file. Alpine can reach `init()` before the module
   script's final `gh.load(...)` resolves, because the two tasks (module script
   vs. Alpine boot) aren't coordinated.
5. **Component-to-component handles rely on element back-pointers.**
   `init() { this.$root.__viewer = this }` in `viewer.js`, and a caller reaches
   it as `el.__viewer?.show(...)`, after `$nextTick` where the element was just
   rendered. A caller that arrives early no-ops rather than blocking.
6. **Token sentinel `🎟️GitHubToken`.** Both `gh-api.js` (in `headers`) and
   pages look for that exact string and replace it (or fall back to the saved
   token). Anything we add that touches tokens must use the same sentinel and
   fall back through `window.ghAuth.resolve()`, which gh-boot loads on every
   page and which stays data-URL-safe. Only a file that runs before any library
   has loaded, or on a page that loads none, reads `localStorage.ghToken`
   itself; [`token-one-owner.test.mjs`](../node/test/token-one-owner.test.mjs)
   names each one.
7. **Boot failures are handled centrally by `gh-auth.js`.** Loader-based
   pages do not wrap their module script in `try { ... } catch { ... }`.
   The boot chain is just a sequence of `await` calls. Failures propagate
   as unhandled rejections; gh-auth.js's `unhandledrejection` handler
   renders either the 401/403 token-entry form (via the `req` patch) or a
   generic "Boot failed" UI (gated on `document.readyState === 'loading'`).
   Module top-level await keeps readyState at `'loading'` until the chain
   settles, so the gate distinguishes boot-time rejections from later ones
   (e.g., from a click handler). Pages whose boot lives in a classic-script
   IIFE, where readyState transitions before the IIFE's awaits resolve,
   should either convert to `<script type="module">` or call
   `window.ghAuth.bootDone()` at the end of their chain.
8. **A pre-build page boots Alpine inside its import, so its own `gh.load`
   chain always runs late.** This is invariant 4 in its sharpest form. A page
   that does `await import('../dist/web-tools.js')` gets the whole auto-boot
   chain, ending in `alpine-bundle.js`, before the import resolves; the
   `gh.load(...)` calls it writes underneath therefore run *after* Alpine has
   walked the DOM and called `init()`, and every kit such a page loads for
   itself is undefined at component-init time.

   The build forces the kits it needs itself into the auto-boot chain
   ([`node/build/build-lib.mjs`](../node/build/build-lib.mjs) says which and
   why). A kit only one page wants is the page's job, so such a page declares
   a **ready gate**: a plain `<script>` *above* the module creating
   `window.__depsReady`, the module resolving `window.__depsDone()` in a
   `finally`, and the component opening `init()` with
   `await window.__depsReady`. The promise has to be created above the module
   because a component that starts during the import would otherwise find the
   promise itself undefined. Held by
   [`node/test/page-deps-gate.test.mjs`](../node/test/page-deps-gate.test.mjs),
   which is static: the failure is a race, so a passing run proves nothing and
   only the shape can be pinned.

## Load and build are one contract

The same rules that make a file *loadable* also make a page *buildable* into a
single offline artifact, because the build is the loader, not a separate
pipeline. `node/build/build.mjs` (and the in-browser FAB export) emit the
real `gh-api.js` with exactly one thing overridden: `GH.prototype.get` reads
from an inlined `path → source` cache instead of the network. Everything
above still applies verbatim; only the *origin of the bytes* changes.

So the contract has two readings:

- **Load** (runtime, the dev loop): own code is fetched per-file through the
  contents API, freshest-wins, ref-pinnable with `?use=<ref>`. This is what
  the rest of this doc describes.
- **Build** (delivery): the reachable set of own-code files is frozen into
  `dist/<page>.js`, which a page adopts by importing the local build instead
  of `entry.js`. `bake` goes one further and inlines that into the page's
  HTML, so the page opens with zero own-code network. The build still honors
  `?use=<ref>` (an explicit ref falls through to the network), so a built page
  can be re-pinned for review.

A file that honors the contract is buildable for free. Two consequences follow
from the mechanism:

- **Dependency edges must be statically discoverable.** The build's graph
  walker finds what to cache by scanning source for *string-literal*
  `gh.load('…')` / `_selfLoad('…')` arguments. A path computed at runtime
  (`gh.load(name)`, a template literal) loads but is invisible to the build,
  so it is not cached and the offline page silently falls back to the network
  for it.
- **`gh.load`-style vs. native ESM also decides build-portability.** A
  `gh.load`-loaded file rides into the build automatically; a file pulled in
  with native `import()` is opaque to the build the same way a third-party CDN
  lib is, and stays on the network.

The operational side (the four verbs `load → build → bake → export`, the
commands, and the byte-identical `verify-build` guarantee) lives in
[`node/README.md`](../node/README.md).

## Consumers in other repos

A page in another repository that uses a `lib/` file takes the same two
routes this repo's own pages take, and no third:

- **The chain**, for a page that wants a few files: import `lib/entry.js`
  from GitHub Pages, then `gh.load()` each file, then `alpine-bundle.js` last
  when a loaded file registers an Alpine component. Every file after
  `entry.js` is fetched at main's tip through Pages and the contents API, on
  the token the browser holds, and is current on the next load. Tossed, the
  page loads `main` unless the link asks for another version (see
  [Under the toss](#under-the-toss)). A page may still pin the import itself:
  `entry.js?ref=<ref>` wins over everything, and the budget-drs pages in
  `mehrlander/home` pass their `?lib=` that way.
- **The pre-build**, for a page that wants the library whole: resolve `main`
  to its commit through the commits API, fetch `dist/web-tools.js` from
  raw.githubusercontent at that SHA, and blob-import it, which is the app's
  own `?use=` boot in `app/index.html`. A SHA is an address no cache can hold
  stale.

**Not a plain `<script src>` for a `lib/` file.** Raw cannot back one (its
`nosniff`), and GitHub Pages can only for main, which would skip `?use=`. That
is why `entry.js` is the only file a page loads by URL. Third-party libraries
keep their CDN tags on both routes.

Two things differ from a page in this repo:

- **`window.__ref` is the displayed file's version, not the library's, and
  not the ref to read siblings at.** Under the toss shell and the budget-drs
  app's frame it names the version the page's own file was read at. A read of
  another file in the page's repository asks the resolver,
  `window.__refFor(repo, path)`, which answers a link's selection first and
  then what the page implies ("The selection" above). The library's ref
  arrives as `use` and `lib` (and as `window.__lib` when it was asked for),
  which is `main` unless a link says otherwise. A consumer that picks its
  library itself reads `?lib=`, then `window.__lib`, then the selection's
  web-tools entry, as the budget-drs pages do.
- **The page brings no Alpine tag.** A deferred CDN tag starts Alpine before
  the chain has registered anything; `alpine-bundle.js` starts it after. A
  framed page sets `data-no-fab` on `<html>`, since the FAB belongs to the
  shell.

Worked examples in `mehrlander/home`: `projects/budget-drs/app/view/app.html` (the chain),
`projects/surfacer/app/surfacer.html` (the pre-build).

## Quick checklist for "can I load this file through gh.load?"

- [ ] No `import` / `export` (load mechanism, rule 1).
- [ ] A value for the caller is `read()`, not `load()` (rule 4).
- [ ] Side effects are exposed via `window.X`, `Alpine.data(...)`, or a
      `GH.prototype` patch, not a top-level `const` (rule 3).
- [ ] Keep load paths literal; see [Load and build](#load-and-build-are-one-contract).
- [ ] Alpine registration sits inside `alpine:init`, in a file loaded before
      `alpine-bundle.js`, and `Alpine.store(...)` is read only after it
      (invariants 2 and 3).
- [ ] A token comes through the sentinel (invariant 6).
- [ ] No backtick inside an HTML or CSS comment in a template literal: it ends
      the JavaScript string even though the markup treats it as a comment.
      Name the term in plain words and run `node --check` before the build;
      [`lib-parses.test.mjs`](../node/test/lib-parses.test.mjs) also checks
      that loadable files compile as function bodies.

If a file is genuinely modular (real `import`/`export`), use a native
`import()` instead of `gh.load()` for it. Mixing is fine: a page can do

```js
import GH from '.../lib/gh-api.js';
const { text } = await import('.../compression/text.js');
const gh = new GH({ token, repo });
await gh.load('gh-fetch.js');
await gh.load('alpineComponents/foo.js');
await gh.load('alpine-bundle.js');
```

and everything orders correctly as long as each `await` completes before
the next starts.
