# Context: what enters a session

The registry behind the Map view's Context tab. Column meanings and allowed values: `context-sources` rows in [`properties.csv`](properties.csv).

- **Where a row goes.** Public sources (the plugin, web-tools, the session) go in [`context-sources.csv`](context-sources.csv). The account, environment, user scope and private repos go in web-tools-private `environment/context-sources.csv`, with the same base columns. `assistant`, `discretion` and `role` are optional there; a row without them reads as Claude Code, unclassified. A setting with no file gets a dated copy in `environment/account.md`.
- **Topics.** `topics` joins a row to [`context-topics.csv`](context-topics.csv). Each topic has one verdict: layered, redundant, conflicting or transitional.
- **Connections.** [`context-links.csv`](context-links.csv) declares the directed delivery connections between public sources, one `from`, `to` and `kind` per row with its condition in `gloss`. Hook registration is derived from `skills/hooks/hooks.json` as the `registers` kind, so that kind has no row here.
- **Tally.** `tally` (`startup:<path>`, `skill:<name>`) joins a row to the session store's counts in web-tools-private `state/sessions.json`.
- **Gate.** [`context-sources.test.mjs`](../node/test/context-sources.test.mjs) fails when a plugin hook has no row, a web-tools path is missing, a topic is undeclared, or a connection names an unknown source or the `registers` kind.
