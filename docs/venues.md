# Venues: where work can run

Agent work in this estate can run in the places listed below.

| Venue | What can act there | Reaches | Started by |
| --- | --- | --- | --- |
| **Anthropic's cloud** | Claude Code on the web (attended; unattended when a Routine starts it); Cowork on web and mobile (scheduled tasks unattended) | an ephemeral clone, connectors, an allowlisted network, headless Chromium; none of your files | a session, a Routine, or `create_session` |
| **OpenAI's cloud** | Codex cloud tasks (unattended; unused here) | a clone of a connected repo; none of your files | a task in Codex |
| **Home laptop** | attended: Claude Code, Cowork, Remote Control, Dispatch, Gemini in Antigravity, the Codex app; unattended: the Gemini daemon | the laptop as you: files, apps, browser | a session there; a `computer-use` errand; a `laptop-daemon` errand |
| **Work machine** | you, and any agent installed there (attended) | work files, under work's rules | an `ise-f5` errand, run by hand |
| **GitHub's runners** | GitHub Actions (unattended) | open egress, CPU only, no local files | `workflow_dispatch`, `repository_dispatch` or `push`; on a schedule, through web-tools-private's `data/design/scheduled-tasks.csv` |

This account has no self-hosted Claude Code Remote pool (`ccpool_`), as of
2026-10-13.

- Dispatch's scheduled tasks need the desktop awake with the app open, as does a
  scheduled check in the Codex app (checked 2026-10-01, web-tools-private
  `probes/codex-commit-trigger/`). Antigravity is assumed to behave the same.
- The Gemini daemon polls web-tools-private's `main`: errands wait while the
  laptop sleeps, and after a reboot the daemon stays down until restarted.
- Remote Control (on a session started there) and Dispatch reach the laptop
  from the phone.

An errand's `run.venue` and [writers.csv](writers.csv)'s `machine` name these
places more finely; the tracker's `venue:` tag names programs instead.

Checked 2026-10-13 against this account's environments, the pull requests behind
the `codex/` branches, and press reports of Anthropic's Cowork and Dispatch
announcements.
