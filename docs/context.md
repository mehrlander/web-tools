# Context: what enters a session

The registry behind the Map view's Context tab. Column meanings and allowed values: `context-sources` rows in [`properties.csv`](properties.csv).

- **Where a row goes.** Public sources (the plugin, web-tools, the session) go in [`context-sources.csv`](context-sources.csv). The account, environment, user scope and private repos go in web-tools-private `environment/context-sources.csv`, with the same columns. A setting with no file gets a dated copy in `environment/account.md`.
- **Topics.** `topics` joins a row to [`context-topics.csv`](context-topics.csv). Each topic has one verdict: layered, redundant, conflicting or transitional.
- **Tally.** `tally` (`startup:<path>`, `skill:<name>`) joins a row to the session store's counts in web-tools-private `state/sessions.json`.
- **Gate.** [`context-sources.test.mjs`](../node/test/context-sources.test.mjs) fails when a plugin hook has no row, a web-tools path is missing, or a topic is undeclared.
