---
id: estate-rows-tests-stale-7r39ry
title: Update estate tests to the groupSections layout
status: backlog
opened: 2026-07-18
---
# Update estate tests to the groupSections layout

tools/test/estate-rows.test.mjs fails 6 of its tests on main. PR #236 shipped the estate as snap-scrolled rows and the suite asserts that shape (data.rows, showChild nesting). Follow-up commits (353f0bf, faad95d, f0cce18) refactored the layout to grouped grid sections (groupSections) without updating the suite, so the failures are a stale test file, not a product bug. Done means: the suite asserts the groupSections shape (group membership, ordering, the -private companion nesting and face() toggle as they now work), npm test green.

## Progress log
- 2026-07-18: Filed from the mobile-nav session, which hit the failures while verifying an unrelated show-repo change and traced them to the post-#236 layout refactor.
