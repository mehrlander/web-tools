---
id: retire-surfacing-course-5szz7c
title: Retire docs/surfacing-course.md into the documents that already cover its parts
status: backlog
opened: 2026-10-22
project: surfacing
size: M
---
# Retire docs/surfacing-course.md into the documents that already cover its parts

The surfacing program's first mission. The owner thinks the course may no longer be needed. Its closing Lifecycle sequence ("Each phase begins only on the user's word", "Plan. State the recommendation, options, and risks. End ⚖️") points sessions toward putting a call to the owner, which the owner does not want. Its other parts look covered elsewhere: the two modes and where work happens (docs/CONSTELLATION.md, docs/direct-to-main.csv, docs/venues.md), assistant identity (docs/assistant-branches.csv, AGENTS.md), and the PR-driving rules the platform's own prompt now states.

Map each section to where it is already covered, move what is unique (the guide-region template may be the only such piece) to the document that owns its subject, and remove the file and its delivery path. Run it through the surfacing program: its reviewers see the proposal, and the closing measure (web-tools-private state/closings.json) is the check afterwards. The Plan step has said "End 🆚" or "End ⚖️" since 2026-09-10, so a fall in the call share after removal would be some evidence that it was steering closings; it would not settle it, since other changes landed in the same weeks.

## Related

- `docs/surfacing-course.md`: the file to retire.
- `skills/hooks/pr-subscribe-hint.sh`: delivers the course when a PR opens; its delivery has to go with it.
- `skills/default/SKILL.md`, `skills/default/surfacing-course.md`, `node/build/vendor-docs.mjs`: the default skill loads the vendored copy the commit hook builds.
- `docs/SURFACING.md`: its Branch anchor bullet cites the course for commit trailers.
- `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `docs/house-policies.md`, `docs/policies.csv`: name the course or rules quoted from it.
- mehrlander/home `CLAUDE.md`: cites the course twice (working style, surfacing section).
- `node/test/assistant-mark.test.mjs`, `node/test/state-the-rule.test.mjs`, `node/test/mcp-link-safe.test.mjs`: read the course.
- `programs/surfacing/README.md`: the course is a governed file of the program once web-tools #1055 merges.

## Done when

docs/surfacing-course.md is gone, nothing in web-tools or home links it, no hook or skill delivers it, and any piece kept lives in the document that owns its subject.

## Progress log
- 2026-10-22: Filed at the owner's request in session 007acb88, as the surfacing program's first mission. Next: once web-tools #1055 merges, run /portable:programs surfacing and map the course's sections against the documents above.
