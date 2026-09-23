---
title: The Web Tools app
genre: living
invariants: strict
---

> Historical specimen from the 2026-09-19 study, retained for review. It is not current guidance or an approved replacement. See [Doc Craft](../SKILL.md) for the current skill.

# The Web Tools app

⭐ **Open it:** [Web Tools](https://mehrlander.github.io/web-tools/app/)

One hosted page is the front door to the development estate. GitHub is the system of record; the app is the operating surface over it, rendering repositories, branches, sessions, pages, and tools operable from a single URL. 

Reference manuals:
- [show-repo.md](show-repo.md): The underlying browser execution shell.
- [showing.md](showing.md): Display doctrine and frame mechanics.

---

## The Name Split: Product vs. Shell Identifiers

The system enforces a functional split between the user-facing product name and internal mechanical identifiers:

| Scope | Identifier | Application Surface | Invariant & Consequences |
| :--- | :--- | :--- | :--- |
| **Product Surface** | `Web Tools` | Browser tab title, UI captions, user notifications, commit signatures. | **Reader Addressing:** All automated commit messages emitted by the app sign as `via Web Tools`. |
| **Shell & Route** | `show-repo` | URL query params (`?view=show-repo`), route registry keys in `app-routes.csv`, slash commands (`/show-repo`). | **Mechanical Denotation:** Denotes the execution harness. Renaming breaks existing saved shortcuts and bookmarked routes. |
| **Field Holdings** | `show-repo` | `consumer` column in `manifest-fields.csv` (55 of 58 rows). | **Data Integrity:** Identifies the consumer schema. |

### Legacy Redirection Invariant
The path `pages/show-repo/show-repo.html` is a permanent redirect stub preserving query parameters and URL fragments. 

> [!WARNING]
> **Do not delete the redirect stub.** 151 files across sibling repositories link directly to the legacy address. Deleting the stub breaks external deep links. Active application logic lives exclusively in `app/index.html`.

> [!NOTE]
> **Architectural Provenance:** For the dated deliberation log, code string audits, and test renaming history, see [chron/2026-09-08-naming-split.md](file:///C:/Users/mehrl/Code/gh/home/chron/2026-09-08-naming-split.md).

---

## Durable Goals

A feature belongs in the app only when it serves one of these five core goals:

1. **One front door:** The estate is legible from a single URL; no task requires guessing which repository to open first.
2. **Surface, don't store:** The app renders work in place; source content remains in its owning repository.
3. **Wrap GitHub, never wall it:** Every view provides a direct link to the GitHub presentation of the underlying asset.
4. **Continuity:** Work remains inspectable across session, branch, and venue boundaries.
5. **Action:** The app operates as well as displays: stages and moves files, writes repo configs, and tracks tasks.

---

## Product Boundary

- **Built-in Shell Views:** Views whose subject is the estate itself are compiled directly into the shell.
- **Promoted App Views:** Views whose subject is repository content are app views promoted via that repository's `.web-tools.json` configuration. Mechanics are defined in [show-repo.md](show-repo.md).
