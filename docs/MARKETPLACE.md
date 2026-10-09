# Plugin marketplace

This repo publishes its portable set as a Claude Code **plugin marketplace**: the native distribution channel for skills, agents, hooks, and scripts, replacing hand-rolled raw-URL fetch lists. The catalog is [`.claude-plugin/marketplace.json`](../.claude-plugin/marketplace.json). Official reference: [Create and distribute a plugin marketplace](https://code.claude.com/docs/en/plugin-marketplaces); companions are [Create plugins](https://code.claude.com/docs/en/plugins) and [Discover and install plugins](https://code.claude.com/docs/en/discover-plugins).

## What it publishes

| Plugin | Skills | What it is |
| :--- | :--- | :--- |
| `portable` | every skill folder under `skills/` that the catalog lists; [`portable.csv`](portable.csv) has a row for each | Skills created or adapted here. |
| `third-party-documents` | docx, pdf, pptx, xlsx | Third-party: Anthropic's official files, fetched unchanged from the revision in the marketplace entry. |
| `third-party-authoring` | skill-creator, doc-coauthoring | Third-party: Anthropic's official files, with only these two skills registered. |

`portable` declares the two Anthropic packages as dependencies. They are
selections from [Anthropic's official repository](https://github.com/anthropics/skills),
maintained by Anthropic, with their own `/third-party-documents:<name>` and
`/third-party-authoring:<name>` namespaces. Web Tools maintains the selection and
pin, not their instructions. Companion scripts and licenses arrive with the
source. [Claude Code dependency handling](https://code.claude.com/docs/en/plugins/dependencies)
installs them with portable; existing installations need a plugin update and
reload to resolve newly declared dependencies. The session refresher only
updates the portable files and is not evidence that dependencies installed.

Claude account copies and other hosts' built-in skills remain separate. Outside
Claude Code, use the host's supplied skill or install/fetch the complete official
folder before a dependent workflow. A source link does not register a skill.

Every skill's description sits in every session's context; the measured cost is in [environment/extending.md](environment/extending.md#context-cost).

Plugin skills are namespaced by plugin name, so `/tasks` installed by hand and `/portable:tasks` installed by plugin coexist without conflict.

The plugin declares no `version`, so every commit to `main` is a new version, and the plugin's own `SessionStart` hook moves each session to it. Why a hook rather than marketplace auto-update is in [environment/container.md](environment/container.md). Pin a `version` (or a `ref` on the consumer side) only when a consumer needs stability.

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
    "portable@web-tools": true
  }
}
```

## Conventions for publishers

- **One catalog per repo.** A project inside a repo publishes by adding an entry to its repo's catalog with a relative `source` path, not by minting its own marketplace.
- **Scope the `source` to the subtree the plugin needs.** Install copies the whole source directory to the consumer's cache; a root-sourced plugin drags the entire repo along, and a directory that mixes shareable and repo-local files ships both. The `source` boundary is the sharing boundary, and it can only follow directory lines: draw it at the deepest directory that holds everything the plugin ships and nothing it doesn't, splitting the plugin into per-subtree entries when no single such directory exists. The entry here sources `./skills`, which holds the skills and their hooks. Sourcing `./.claude` or `./` would ship this repo's own hooks and settings too.
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

The plugin's hooks run on their own rather than being invoked; `skills/hooks/hooks.json` registers them. They ship in the plugin because it is the one channel that reaches every session: no session can read or edit the environment setup script, and a repo's project settings are not read when a session's root sits above the checkouts. Mechanics and measurements:
[environment/extending.md](environment/extending.md).
