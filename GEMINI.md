# GEMINI.md

For Gemini and Antigravity (Gemini's IDE agent) in `web-tools`. Follow [AGENTS.md](AGENTS.md) (checkout setup, preflight, red checks) and [CLAUDE.md](CLAUDE.md) (repository workflows). The prose rules, no em dashes among them, are [docs/QUALIFIED-WRITING.md](docs/QUALIFIED-WRITING.md); GitHub flow and the Real-time exceptions are in [docs/CONSTELLATION.md](docs/CONSTELLATION.md#principle-1-commit-discipline).

- **Branch prefix:** `gemini/<slug>`; `antigravity/<slug>` also reads as Gemini. A branch with neither reads as unclassified in the Activity view.
- **Commit trailer:** append it to every commit, on a feature branch or direct to `main`:
  ```
  Co-Authored-By: Gemini <gemini@google.com>
  ```
