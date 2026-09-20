# GEMINI.md

Gemini and Antigravity pair programming instructions for `web-tools`.

Follow the repository contract in [CLAUDE.md](CLAUDE.md) and [AGENTS.md](AGENTS.md).

## Operational Rules
- Checkout setup: run `npm run setup` once per checkout. It wires the commit hook that refreshes `dist/`, the registry CSVs and the word counts in the same commit as their sources. Without it every commit leaves those behind and the pull request check goes red on `derived-artifacts` or `docs-registry`.
- Preflight: run `npm run preflight` before opening a pull request. It runs setup, `npm run artifacts:refresh`, then `npm test`.
- Never merge a pull request whose check is red. The failing assertion names the command that repairs it (`npm run tools-index`, `npm run docs-reach`, `npm run tests-index`, `npm run build:app`).
- Branch prefix: Always use `gemini/<slug>` for feature branches. A branch without it classifies as unclassified in the Activity view, not as Gemini.
- Commit attribution: Always append the following trailer to every `git commit` (both on feature branches and direct to `main`):
  ```
  Co-Authored-By: Gemini <gemini@google.com>
  ```
- Operational modes: Follow GitHub flow for features and docs, and Real-time mode (direct to `main`) for shared tracker/registry updates as defined in [docs/surfacing-course.md](docs/surfacing-course.md).
- Prose constraint: Never use em dashes in prose or documentation.
