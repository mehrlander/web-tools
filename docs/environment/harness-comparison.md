# Harness Comparison: Claude Cloud vs. Antigravity Local

A structural comparison of the estate's two primary execution environments,
defining what a harness is and how each runtime scaffolds its model.
*(verified 2026-10-01)*

---

## 1. What Is "The Harness"?

The **harness** is the operational scaffolding wrapped around the model:

* **Senses:** How files, repository maps, instructions, and messages enter the session.
* **Hands:** The tool runtime that executes bash commands, file edits, and searches.
* **Boundaries:** The safety guards, hooks, and commit gates that constrain actions.
* **Memory & State:** How transcripts, working files, and session artifacts persist.
* **Interface Bridge:** How the session connects to the user, whether through an IDE,
  a terminal, a web browser, or mobile remote control.

---

## 2. Side-by-Side Matrix

| Dimension | Claude Code Cloud Harness | Antigravity Local Harness |
| :--- | :--- | :--- |
| **Host System** | Ephemeral Linux container (baked image). | Persistent Windows workstation (`T14MAY23`). |
| **Shell & Tooling** | Linux `bash`, POSIX coreutils, pre-installed Chromium. | Windows PowerShell, Windows command line, native Git. |
| **Persistence** | Reclaimed after inactivity; only pushed commits are durable ([container.md](container.md)). | Full filesystem persistence; files and databases remain. |
| **Hook Lifecycle** | Plugin hooks and dispatched `.claude/hooks/session-*.sh` scripts ([extending.md](extending.md)). | Native application rules, skills, and configuration files. |
| **Session Capture** | Whole-session JSON exported to `web-tools-private`. | Local SQLite index + JSONL transcript in `brain/<uuid>/`. |
| **Telemetry Format** | Monolithic JSON with turn history and tool inputs. | Multi-part: SQLite summaries, JSONL trajectory, artifact files. |
| **Remote Control** | Web chat via Anthropic cloud infrastructure. | Push sync via Google Cloud Hub (`daily-cloudcode-pa`). |
| **Attribution** | `Claude-Session: <url>` commit trailer; `claude/*` branch. | `Co-Authored-By: Gemini` trailer; `gemini/*` branch. |

---

## 3. Cross-Harness Continuity

Because both harnesses operate across the same repository collection under
`C:\Users\mehrl\Code\gh\`:

1. **Shared Standards:** Both harnesses obey the conventions in `CLAUDE.md`,
   `docs/QUALIFIED-WRITING.md`, and `docs/CONVERSATION.md`.
2. **Git Coordination:** Neither harness assumes the other's environment:
   * Claude sessions rely on the plugin's hooks and Linux toolchains.
   * Antigravity sessions execute native PowerShell and Windows scripts.
3. **Session Ingestion:** Antigravity transcripts can be normalized through
   `sessions/tools/import_antigravity.py` to enter `web-tools-private/sessions/`,
   allowing the Web Tools Activity view (`?view=sessions`) to index both harnesses
   under a unified timeline.
