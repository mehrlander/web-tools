# Plugin marketplace

This repo publishes its portable set as a Claude Code **plugin marketplace**: the native distribution channel for skills, agents, hooks, and scripts, replacing hand-rolled raw-URL fetch lists. The catalog is [`.claude-plugin/marketplace.json`](../.claude-plugin/marketplace.json). Official reference: [Create and distribute a plugin marketplace](https://code.claude.com/docs/en/plugin-marketplaces); companions are [Create plugins](https://code.claude.com/docs/en/plugins) and [Discover and install plugins](https://code.claude.com/docs/en/discover-plugins).

## What it publishes

| Plugin | Skills | What it is |
| :--- | :--- | :--- |
| `portable` | the 15 skills explicitly listed under its `.claude/skills/` source in the marketplace catalog, cross-referenced one row per piece in [`portable.csv`](portable.csv) | The to-go bag: the conventions loader and its surfacing contract, the tracker operator, and the rest of the set. This file deliberately does not enumerate the roster: the catalog is the definition and the Distribution registry is its reader-facing crosswalk |
| `daisy-alpine` | `/daisy-alpine:daisy-alpine` | The house style for pages, model-invocable so it fires on matching artifact work; the DaisyUI 5 + Tailwind 4 + Alpine.js mechanics ride beside it in `references/mechanics.md` |

Plugin skills are namespaced by plugin name, so `/tasks` installed by hand and `/portable:tasks` installed by plugin coexist without conflict.

Neither plugin declares a `version`, so every commit to `main` is a new version and consumers track the tip on auto-update. That matches the doctrine the raw-fetch hook already followed: the hub is always current, nothing is pinned. Pin a `version` (or a `ref` on the consumer side) only when a consumer needs stability.

## How to subscribe

One-off, in any session:

```
/plugin marketplace add mehrlander/web-tools
/plugin install portable@web-tools
```

Standing, for a repo (the committed form; cloud sessions install these at session start):

```json
{
  "extraKnownMarketplaces": {
    "web-tools": {
      "source": { "source": "github", "repo": "mehrlander/web-tools" }
    }
  },
  "enabledPlugins": {
    "portable@web-tools": true,
    "daisy-alpine@web-tools": true
  }
}
```

## Conventions for publishers

- **One catalog per repo.** A project inside a repo publishes by adding an entry to its repo's catalog with a relative `source` path, not by minting its own marketplace.
- **Scope the `source` to the subtree the plugin needs.** Install copies the whole source directory to the consumer's cache; a root-sourced plugin drags the entire repo along, and a directory that mixes shareable and repo-local files ships both. The `source` boundary is the sharing boundary, and it can only follow directory lines: draw it at the deepest directory that holds everything the plugin ships and nothing it doesn't, splitting the plugin into per-subtree entries when no single such directory exists. The entries here source `./.claude/skills` (not `./.claude`, whose `hooks/` and `settings.json` are this repo's own machinery) and `./skills/daisy-alpine` (not the whole skill library), not `./`.
- **`strict: false` when the files already live where the repo wants them.** The catalog entry is then the complete plugin definition and no `plugin.json` or file moves are needed.
- **Validate before pushing:** `claude plugin validate .` from the repo root, and when in doubt install from the local path and inspect `~/.claude/plugins/cache/`.

## Relationship to the Distribution registry

The marketplace catalog defines what the platform installs. [`portable.csv`](portable.csv)
is the authored crosswalk of everything selected to travel, including plugin
skills and files consumed by live read, reference, one-time adoption, or
on-demand fetch. It does not restate installation recipes and has no prose
parent. Where a consumer cannot install the plugin, the row's canonical path is
the raw-fetch source; the owning skill or document carries any procedure needed
to use it.

## Why the hooks ship here

Eight pieces of the `portable` plugin run on their own rather than being invoked:
the session dispatcher, the session recorder, the default-skill directive, the
PR-subscribe hint, the MCP failure hint, the reading-column guard, the
governing-docs warner, and the send-later guard. They ship in the plugin because
the per-container settings file they would otherwise live in is provisioned
fresh each session, so a hand-installed copy works for exactly one session and
then vanishes. Mechanics and measurements:
[environment/extending.md](environment/extending.md).
