# Session startup (the SessionStart hook)

Plain-language explanation of what runs when a Claude Code **web** session
starts, and why. The mechanics live in two files; this page is the "what and
why" so nobody has to reverse-engineer the script.

## The short version

Every web session begins from a fresh clone of this repo with nothing
installed. A small hook runs `npm install` at startup so the repo's
**devDependencies** are on disk before any work begins. Without it, the first
test or preview each session has to stop and install packages first.

## What actually runs

- **`.claude/settings.json`** registers a `SessionStart` hook (it fires on a new
  session and on resume).
- **`.claude/hooks/session-start.sh`** is the script it runs. It:
  1. **Exits immediately on a local machine.** It only does work when
     `CLAUDE_CODE_REMOTE=true`, i.e. in Claude Code on the web. Your laptop
     manages its own dependencies.
  2. **Skips if the packages are already there.** If `node_modules/jsdom` and
     `node_modules/alpinejs` exist (e.g. a cached environment), it does nothing
     and exits. Safe to run any number of times.
  3. **Otherwise runs `npm install`** — pulling the four devDependencies below.

That's the whole "startup task": install the test/preview dependencies, once,
quietly.

## Why these dependencies exist

The packages in `package.json` aren't shipped to users — the live pages load
their UI libraries from CDNs at runtime. These four are **tooling for working
on the repo**:

| Package | What it's for |
|---|---|
| `jsdom` | A fake browser DOM in Node, so component logic can be tested without a real browser. |
| `alpinejs` | The real Alpine runtime, loaded into jsdom to drive components the way a page would. |
| `fake-indexeddb` | An in-memory IndexedDB, so storage-backed code runs under Node. |
| `idb-keyval` | The tiny IndexedDB wrapper several kits use; needed when exercising them. |

They power two jobs:

- **The preview harness** — `npm run preview <page-path>` (`tools/preview.mjs`)
  loads a page under jsdom, swaps CDN/repo scripts for local files, and reports
  which Alpine components mounted. A quick "does this page boot" check without a
  browser.
- **The jsdom + Alpine logic tests** — the recipe in
  [ENVIRONMENT.md](ENVIRONMENT.md) for driving a component with the real Alpine
  runtime and asserting on its state. Used to catch real bugs in component
  logic.

## Notes

- **Network:** `npm install` needs `registry.npmjs.org`, which the sandbox
  allows (see [ENVIRONMENT.md](ENVIRONMENT.md)). It would fail only under a
  "None" network policy.
- **Web-only is deliberate.** The script exits immediately unless
  `CLAUDE_CODE_REMOTE=true`. Local checkouts manage their own dependencies, so
  there's nothing for it to do there. (The docs also describe SessionStart hooks
  as something that can run everywhere; we scope this one to the web on purpose.)
- **Synchronous:** the session waits for the install to finish before starting,
  so dependencies are guaranteed ready. It can be switched to async (faster
  start, small race-condition risk) if that tradeoff is ever preferred.
- **Not cached across fresh sessions.** A SessionStart hook runs on every
  session and is *not* part of the environment's filesystem snapshot — only a
  cloud **setup script** is cached that way. So the skip-if-present check mainly
  saves time on **resume** (same container); a brand-new web session starts from
  a clean clone and runs the full `npm install` (~6s). That's the expected
  pattern for `npm install` and it's cheap. If startup speed ever outweighs
  keeping setup committed in the repo, the cache-it-once alternative is a setup
  script (configured in the web UI, cloud-only, so not visible in the repo) —
  see [ENVIRONMENT.md](ENVIRONMENT.md) and the web docs.
- **Takes effect after merge:** a hook only runs for sessions started from a
  branch that contains it. Once this is on the default branch, every future web
  session picks it up.
