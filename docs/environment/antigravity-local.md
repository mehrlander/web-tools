# Antigravity Local Environment

What the Google Antigravity **local host environment** is, how its engine and
storage operate on the machine, and how state persists across sessions.
*(verified 2026-10-01)*

---

## 1. The Local Host

Unlike the ephemeral Claude Code container, Antigravity operates directly on the
user's host workstation:

* **Host Machine:** Windows host (`T14MAY23`), running under the user's native
  user profile (`C:\Users\mehrl\`).
* **Toolchain Access:** Direct access to host tools including Node.js, Python 3,
  PowerShell, Git, and local repository clones under `C:\Users\mehrl\Code\gh\`.
* **Persistence:** Working trees, scratch scripts, build artifacts, and databases
  persist indefinitely on the local filesystem rather than discarding state when
  a session ends.

---

## 2. Process Architecture & The Language Server Engine

Antigravity couples an interface surface (the desktop application or browser) to
a background language server:

```
[Antigravity Desktop App / IDE] ──(HTTP / gRPC)──┐
                                                 │
[iPhone Safari / Web Remote] ──(Cloud Hub API)───┼──> [language_server.exe] ──> [Gemini Models]
                                                 │       (Port 518xx / 51999)
[CLI / Automation Scripts] ──────(agentapi)──────┘
```

* **Binary:** `C:\Users\mehrl\AppData\Local\Programs\antigravity\resources\bin\language_server.exe`
* **Transport:** Listens on local loopback TCP ports (for HTTP and gRPC).
* **Modes (`--subclient_type`):**
  * `hub`: Connects outbound to Google Cloud Hub (`daily-cloudcode-pa.googleapis.com`).
    Publishes local session summaries to the user's cloud account and pushes
    live updates to Safari on mobile devices (`antigravity.google.com`).
  * `cli`: Runs purely as a local headless daemon. Disables cloud hub publishing,
    preventing automated scripts from cluttering the user's mobile feed.
* **Authentication:** Uses the user's Google Antigravity subscription via local
  OAuth tokens stored in `~/.gemini/antigravity/` (zero per-token API charges).

---

## 3. Storage Topology (`~/.gemini/antigravity/`)

All Antigravity configuration, session history, and execution context live in
the user's home directory under `~/.gemini/antigravity/`:

```
~/.gemini/antigravity/
├── conversation_summaries.db   # Master SQLite catalog of all sessions
├── agyhub_summaries_proto.pb   # Binary cache of cloud-synced summaries
├── antigravity_state.pbtxt     # Host identity (installation_uuid) and onboarding state
├── conversations/
│   └── <uuid>.db               # Turn-by-turn chat message store per session
├── brain/
│   └── <uuid>/                 # Execution workspace for each conversation
│       ├── .system_generated/
│       │   ├── logs/
│       │   │   ├── transcript.jsonl       # Step trajectory (prompts, tools, outputs)
│       │   │   └── transcript_full.jsonl  # Full un-truncated trajectory
│       │   ├── tasks/                     # Logs for background commands (task-*.log)
│       │   └── steps/                     # Individual tool execution outputs
│       ├── .user_uploaded/                # Media and screenshots pasted by the user
│       ├── implementation_plan.md         # Active planning artifact
│       ├── walkthrough.md                 # Verification and review artifact
│       └── scratch/                       # Temporary scripts and diagnostic files
└── annotations/
    └── <uuid>.pbtxt            # Read telemetry and last-viewed timestamps
```

---

## 4. Session Records & The Tombstone Protocol

Antigravity tracks conversations through a two-tier database and workspace model:

1. **Catalog Index (`conversation_summaries.db`):**
   * Indexed by `conversation_id` (UUID).
   * Holds `title`, `step_count`, `last_modified_time`, `workspace_uris`, and the
     active status flags.
2. **Trajectory Log (`transcript.jsonl`):**
   * Stored inside `brain/<uuid>/.system_generated/logs/transcript.jsonl`.
   * Line-delimited JSON recording every user ask, agent thinking block, tool
     call with exact arguments, and terminal response.
3. **The Deletion Tombstone (`killed = 1`):**
   * Simply deleting a row from SQLite (`DELETE FROM conversation_summaries`) fails
     to remove it from the cloud remote control, because Google Cloud Hub retains
     its cached device snapshot.
   * Proper deletion requires setting `killed = 1` and `title = ''`. The local
     language server broadcasts this tombstone to Cloud Hub, which removes the
     session from the cloud index and mobile view within seconds.

---

## 5. Headless Worker Profiles

When running automated background agents (such as CI commit analyzers):
* **Profile Isolation:** Use a separate directory such as `~/.gemini/antigravity-worker/`.
* **Distinct UUID:** Ensure `antigravity_state.pbtxt` contains an independent
  `installation_uuid` so the worker does not overwrite the primary machine session.
* **CLI Subclient:** Pass `--subclient_type=cli` and `--headless` to prevent the
  daemon from broadcasting to the mobile remote control.
