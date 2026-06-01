# The Claude Code Extension Model

A map of how Claude Code is extended. The pieces nest cleanly once you understand their purpose. Some change what Claude knows, some spin up a second worker, some connect Claude to the outside world, and others trigger automatically. A plugin is simply the container you pack a chosen few into for distribution.

This page is the conceptual frame; where this repo actually configures one of these mechanisms, the concrete details live alongside the relevant component (today, only the [SessionStart hook](#the-hook-this-repo-runs-sessionstart-install) under Hooks).

## The Components

### Skills: What Claude Knows

Knowledge, loaded on demand. A SKILL.md file teaches Claude how to execute a convention, pattern, or methodology. Claude reads the frontmatter at session start and pulls the full skill into context only when required.

Slash commands are no longer separate; they are now folded into skills. A command is simply a skill triggered explicitly with /name instead of relying on auto-detection. It is the same file accessed differently.

Use a skill when you want Claude to know *how* to perform a task your way. (The root `CLAUDE.md` is the always-on form of this layer: project instructions Claude carries every session rather than loading on demand.)

### Agents (Subagents): A Bounded Second Worker

A separate Claude instance with its own context window, system prompt, and tool permissions. It takes a focused task, works in isolation, and reports back a summary to keep your main session lean.

The system prompt acts as the persona. An agent comes in cold, avoiding your main thread’s assumptions or half-finished reasoning. A code reviewer that never absorbed your justifications provides better feedback. Pair the persona with a strict toolset: a reviewer gets read-only access, while a test writer gets write access but is instructed to leave the source alone. The agent's identity and permissions are tightly coupled.

Use an agent when your main context suffers from bloat or bias and requires a fresh, bounded worker.

### MCP Servers: Reaching the Outside World

The wiring to external systems like databases, APIs, calendars, or issue trackers. While skills tell Claude *how* to do something, MCP gives Claude something to *act on*.

Note the cost asymmetry. A skill description is cheap, but an MCP connection can be expensive because it pulls large tool definitions into context.

Use MCP when a task requires data or actions beyond the current session.

### Hooks: Reflexes

Automated actions that fire at specific lifecycle moments rather than on request. They require no persona or knowledge, just a trigger and an action. Examples include running a linter on file save or blocking a commit that fails a check. The work happens automatically.

Use a hook when you want a behavior to be automatic instead of requested.

#### The hook this repo runs: SessionStart install

Every web session begins from a fresh clone of this repo with nothing installed. A small `SessionStart` hook runs `npm install` at startup so the repo's **devDependencies** are on disk before any work begins. Without it, the first test or preview each session has to stop and install packages first.

**What actually runs:**

- **`.claude/settings.json`** registers a `SessionStart` hook (it fires on a new session and on resume).
- **`.claude/hooks/session-start.sh`** is the script it runs. It:
  1. **Exits immediately on a local machine.** It only does work when `CLAUDE_CODE_REMOTE=true`, i.e. in Claude Code on the web. Your laptop manages its own dependencies.
  2. **Skips if the packages are already there.** If `node_modules/jsdom` and `node_modules/alpinejs` exist (e.g. a cached environment), it does nothing and exits. Safe to run any number of times.
  3. **Otherwise runs `npm install`** — pulling the four devDependencies below.

**Why these dependencies exist.** The packages in `package.json` aren't shipped to users — the live pages load their UI libraries from CDNs at runtime. These four are **tooling for working on the repo**:

| Package | What it's for |
|---|---|
| `jsdom` | A fake browser DOM in Node, so component logic can be tested without a real browser. |
| `alpinejs` | The real Alpine runtime, loaded into jsdom to drive components the way a page would. |
| `fake-indexeddb` | An in-memory IndexedDB, so storage-backed code runs under Node. |
| `idb-keyval` | The tiny IndexedDB wrapper several kits use; needed when exercising them. |

They power two jobs: the **preview harness** (`npm run preview <page-path>`, `tools/preview.mjs`) that loads a page under jsdom and reports which Alpine components mounted, and the **jsdom + Alpine logic tests** (the recipe in [testing.md](testing.md)) for driving a component with the real Alpine runtime and asserting on its state.

**Notes:**

- **Network:** `npm install` needs `registry.npmjs.org`, which the sandbox allows (see [capabilities.md](capabilities.md)). It would fail only under a "None" network policy.
- **Web-only is deliberate.** The script exits immediately unless `CLAUDE_CODE_REMOTE=true`. Local checkouts manage their own dependencies, so there's nothing for it to do there.
- **Synchronous:** the session waits for the install to finish before starting, so dependencies are guaranteed ready. It can be switched to async (faster start, small race-condition risk) if that tradeoff is ever preferred.
- **Not cached across fresh sessions.** A SessionStart hook runs on every session and is *not* part of the environment's filesystem snapshot — only a cloud **setup script** is cached that way. So the skip-if-present check mainly saves time on **resume** (same container); a brand-new web session starts from a clean clone and runs the full `npm install` (~6s). If startup speed ever outweighs keeping setup committed in the repo, the cache-it-once alternative is a setup script (configured in the web UI, cloud-only, so not visible in the repo) — see [capabilities.md](capabilities.md) and the web docs.
- **Takes effect after merge:** a hook only runs for sessions started from a branch that contains it. Once this is on the default branch, every future web session picks it up.

### LSP Servers: Language Plumbing

Language Server Protocol definitions that give Claude richer code intelligence for specific languages. This is essential plumbing but not something to configure manually early on. Acknowledge its existence and ignore it for now.

## The Box

### Plugins: The Distribution Unit

A plugin bundles a selected set of the components above into one installable package. Its value lies in distribution, not runtime behavior. The plugin itself does nothing; it simply packages functional tools so a teammate can run a single install and inherit your entire setup, fully versioned, namespaced, and updatable.

Skills are namespaced as /pluginName:skillName to avoid collisions. If names clash, precedence follows this order: **enterprise > user > project > plugin**.

## The Token Tax

Every skill and agent description sits in your context regardless of whether it fires. Consequently, a bloated plugin taxes every session, even when idle. Claude Code provides a /plugin inspector that displays a plugin’s component inventory and splits its cost two ways:

 * **Always-on:** Tokens added to every session by listing text (skill descriptions, agent descriptions, command names), regardless of execution.
 * **On-invoke:** Tokens a component costs when it actually runs.

This provides honest accounting. Bundle deliberately.

## The One-Line Mental Model

| Component | What it is | Reach for it when |
|---|---|---|
| **Skill** | Knowledge, loaded on demand | Claude should know *how* to do a task your way |
| **Agent** | A persona in its own context, with bounded tools | Your main context needs a fresh or isolated worker |
| **MCP server** | A connection to an external system | The task needs outside data or actions |
| **Hook** | A trigger-and-action reflex | A behavior should be automatic, not requested |
| **LSP server** | Language tooling | Later. Plumbing. |
| **Plugin** | The suitcase you pack a few of these into | You want to share or version a coordinated setup |
