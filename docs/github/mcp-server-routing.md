# Two GitHub MCP servers, one allowlist

*(observed 2026-07-15)*

A session can have more than one GitHub MCP server connected at once, and a
call's approval behavior depends on which one it lands on.

**The situation.** This session ran with the stable server `mcp__github__*` and,
after a mid-session reconnect, a second GitHub server under a UUID name
(`mcp__<uuid>__*`). Both expose the same tools (`create_pull_request`,
`update_pull_request`, and the rest).

**The symptom.** Identical operations behaved differently by server.
`create_pull_request` and `update_pull_request` on `mcp__github__*` ran with no
prompt. `update_pull_request` on the UUID server returned "MCP tool call
requires approval," and approving it did not clear the already-errored call, so
it looked like the approval itself was broken.

**The cause.** The permission allowlist is keyed to the *server name*, not the
tool name. The stable `mcp__github__*` server is on the allowlist; a
freshly-reconnected UUID-named server is not, so the same operation prompts
there. Nothing about the approval flow is broken; the call was simply routed to
an un-allowlisted twin.

**The move.** Prefer the stable `mcp__github__*` tools. When a GitHub MCP call
unexpectedly requires approval, do not re-approve on the duplicate: reload the
equivalent stable tool with ToolSearch (`select:mcp__github__<tool>`) and
reissue the call there. In this session the body sync that "required approval"
on the UUID server went through untouched on `mcp__github__update_pull_request`.

**The general heuristic.** The reshuffle that spawns a UUID twin is incidental,
but the routing rule recurs whenever a provider has more than one server
connected: a permission surprise on one server is often a routing problem, not a
permission wall. Check for a sibling server exposing the same tool before
treating the wall as real. To stop the prompts for good, add the reconnecting
server's tools to `.claude/settings.json` (the `/update-config` path) so either
server is pre-approved.
