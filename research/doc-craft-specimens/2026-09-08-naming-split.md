---
title: Name split holding audit and commit attribution refactoring
date: 2026-09-08
type: record
genre: record
status: archived
---

> Historical specimen from the 2026-09-19 study, retained for review. It is not current guidance or an approved replacement. See [Doc Craft](../../skills/doc-craft/SKILL.md) for the current skill.

# Deliberation Record: Name Split Holding Audit & Commit Attribution Refactoring

## 1. Context & Prior Assumptions

On 2026-08-27, a session recorded that the test for keeping an identifier was "whether renaming is expensive and invisible to a reader." 

Upon further analysis during the 2026-09-08 recount, this formulation was identified as flawed:
- Expense is what a fix costs, not whether it is owed.
- Invisible is backwards: a name nobody reads is the cheapest to correct, not the safest to leave inaccurate.

## 2. The String Literal & Commit Message Audit

An earlier manual grep count concluded that only two occurrences of `show-repo` were reader-facing in the repository. That count was erroneous because the grep only surveyed prose in Markdown documents and omitted string literals embedded in code.

### Recount Findings (2026-09-08)
1. **Commit Messages:** 24 string literals across 6 source files signed automated git writes with `via show-repo`. This meant 608 existing commits in the estate carried the internal shell name on the user-facing commit line:
   - `web-tools-private`: 584 commits
   - `home`: 23 commits
   - `web-tools`: 1 commit
2. **Remediation:** The literals in code were updated to emit `via Web Tools`. Existing historical commit messages remain unchanged to preserve immutability of the git record.
3. **Route Registry Correction:** `app-routes.csv` was verified not to contain the string `show-repo`. Its 21 keys are functional route names (`shell`, `landing`, `estate`, `stage`). The actual consumer holding was identified as `manifest-fields.csv`'s `consumer` column (55 of 58 rows).
4. **Test Harness Renaming:** Test files carrying the prefix were renamed to `shell-*.test.mjs` to align with `window.__shell`.
