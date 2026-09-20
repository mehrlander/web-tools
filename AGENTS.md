# AGENTS.md

Read [CLAUDE.md](CLAUDE.md) first for repository workflows and conventions.

## Before a pull request

1. Once per checkout: `npm run setup`. It wires the commit hook and the CSV merge driver, so the derived artifacts (`dist/`, the registry CSVs, the word counts) refresh in the same commit as their sources. `npm run ready` checks without writing.
2. Before opening a PR: `npm run preflight`. It runs setup, refreshes every derived artifact, and runs the suite. A red check on GitHub names the command that repairs it.
3. A red check is not mergeable, whichever assistant opened the PR.

## Assistant identity and attribution

Every assistant identifies its work by branch prefix and commit trailer, so the Web Tools Activity view can classify a branch from what it declares. The table below repeats the one [docs/surfacing-course.md](docs/surfacing-course.md#assistant-identity-and-attribution) owns; change it there first.

| Assistant | Branch Prefix | Commit Signature / Trailer | Notes |
| :--- | :--- | :--- | :--- |
| **Claude** | `claude/<slug>` | `Claude-Session: <url>` | Automated by Claude Code harness |
| **Codex** | `codex/<slug>` | `Co-Authored-By: Codex <codex@openai.com>` | Include trailer on all commits |
| **Gemini** | `gemini/<slug>` | `Co-Authored-By: Gemini <gemini@google.com>` | Include trailer on all commits; `antigravity/` reads as Gemini |
| **Grok** | `grok/<slug>` | `Signed: Chief of Staff (Grok)` | Include signature on all commits |

A commit or branch that carries neither is **unclassified**, not human. A branch that went out without its prefix is declared, with the basis for the claim, in [docs/assistant-branches.csv](docs/assistant-branches.csv).

Batch output, an overnight pass proposing changes across many documents, lands in `mehrlander/home` as a run under `projects/text/runs/`, never as a PR editing the documents it proposes changes to.
