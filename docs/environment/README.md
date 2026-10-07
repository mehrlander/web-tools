# Environment

The execution environments and harnesses that power development across this estate:
split by concern so each page answers one question.

## Claude Code Cloud Environment

The remote container sandbox running on Anthropic infrastructure:

* **[container.md](container.md)**: what the box is and what carries across
  sessions: the ephemeral container, the baked-image working tree, resource
  ceilings, and the provenance of state (what persists, what is isolated).
* **[capabilities.md](capabilities.md)**: what the box can run and reach:
  the toolchain, git transport, network egress, the pre-installed Chromium, and
  the session and subagent mechanics. What the **GitHub MCP layer** does moved to
  [`../github/mcp.md`](../github/mcp.md) on 2026-09-07.
* **[testing.md](testing.md)**: the sensible way to test HTML and JS in the container:
  choosing the lightest tool that proves the claim, driving Chromium for
  screenshots, rendering a repo page, and the jsdom and Alpine logic recipe.
* **[extending.md](extending.md)**: how Claude Code itself is extended: the
  component model (skills, agents, MCP, hooks, plugins, LSP) and the hooks this
  repo actually runs (the SessionStart install hook).

## Antigravity Local Host Environment

The persistent local machine environment running on the developer workstation:

* **[antigravity-local.md](antigravity-local.md)**: what the local host is, how its
  `language_server.exe` daemon and SQLite databases operate, the `brain/` workspace
  trajectory model, and the tombstone protocol.

## Harness Comparison

* **[harness-comparison.md](harness-comparison.md)**: defining what a harness is,
  with a side-by-side architecture diagram and capability matrix comparing the
  Claude Code cloud harness and the Antigravity local harness.

---

## Updating these docs

* These are the **single source of truth** for the environment. Don't spawn a
  parallel capabilities doc; edit these.
* Keep them **succinct**: the key facts, not a transcript.
* **Date every claim** (`*(verified YYYY-MM-DD)*`) in `container.md`,
  `capabilities.md`, and `testing.md` (and `antigravity-local.md` on the host): the sandbox and
  host tooling shift over time. When a finding changes, **edit it in place** and
  update the date. Do not stack stale entries; git holds the history.
* Prefer a **re-runnable probe** over a bare assertion, and observe facts
  directly (`ls` the path, read the env, inspect the header) rather than
  inferring them from a status code or a failed command.
