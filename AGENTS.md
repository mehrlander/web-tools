# AGENTS.md

Read [CLAUDE.md](CLAUDE.md) first for repository workflows and conventions.

## Assistant Identity and Attribution

Four AI assistants contribute to this repository. Each assistant must identify its work using its dedicated branch prefix and commit attribution so the Web Tools Activity view and automated crawlers can classify work accurately:

| Assistant | Branch Prefix | Commit Signature / Trailer | Notes |
| :--- | :--- | :--- | :--- |
| **Claude** | `claude/<slug>` | `Claude-Session: <url>` | Automated by Claude Code harness |
| **Codex** | `codex/<slug>` | PR guide format | Standard Codex branch workflow |
| **Gemini** | `gemini/<slug>` | `Co-Authored-By: Gemini <gemini@google.com>` | Include trailer on all commits |
| **Grok** | `grok/<slug>` | `Signed: Chief of Staff (Grok)` | Include signature on all commits |

Any commit or branch that carries no assistant prefix or trailer is human work by definition.
