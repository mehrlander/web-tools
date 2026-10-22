# Surfacing program

The surfacing program keeps the standard for how a session's work reaches its
reader in chat: the closing state each reply ends on, the link that shows a
change, and the caption that points at the session's record. Its files are
declared under `programs` in [`.web-tools.json`](../../.web-tools.json); a
program is defined in [CONSTELLATION.md](../../docs/CONSTELLATION.md#projects-and-research).

## Standard

| File | States |
| --- | --- |
| [`SURFACING.md`](../../docs/SURFACING.md), indexed by [`surfacing.csv`](../../docs/surfacing.csv) | the primitives every session loads |
| [`surfacing-course.md`](../../docs/surfacing-course.md) | the pull request lifecycle |
| [`showing.md`](../../docs/showing.md), [`showing-mechanisms.csv`](../../docs/showing-mechanisms.csv), `npm run showing` | which link shows a change |
| the [look-markers](../../skills/look-markers/SKILL.md) and [claude-markdown](../../skills/claude-markdown/SKILL.md) skills | look links, and how the Claude app displays a reply |
| [`reply-check.py`](../../skills/hooks/reply-check.py) | the closing line a reply is sent back for |

## Measures

| Measure | Data | Working means |
| --- | --- | --- |
| Closing states | web-tools-private `state/closings.json`: each day's closing states, counted from the session records | the share of closings that put a call to the reader falls, while Direction needed and Ready to assess take the replies whose next step is unclear |

## Reviewers

A proposed change to a governed file goes to
[owner-proxy](../../skills/agents/owner-proxy.md), for how a reply reads to the
owner, and to [peeves-critic](../../skills/agents/peeves-critic.md), for the
corrections the owner has repeated, before the owner sees it.

## Not this program's

The prose rules in [`QUALIFIED-WRITING.md`](../../docs/QUALIFIED-WRITING.md) and the
approval of documentation wording ([doc-craft](../../skills/doc-craft/SKILL.md)).
