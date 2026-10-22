# Surfacing program

The surfacing program covers how work reaches its reader, the owner: what a
reply hands over, the link that opens it, and the form it opens into. Its
files are declared under `programs` in [`.web-tools.json`](../../.web-tools.json);
a program is defined in [CONSTELLATION.md](../../docs/CONSTELLATION.md#projects-and-research).

## Reply

What a reply hands over: the closing state it ends on, its caption and its links.

| File | States |
| --- | --- |
| [`SURFACING.md`](../../docs/SURFACING.md), indexed by [`surfacing.csv`](../../docs/surfacing.csv) | the primitives every session loads |
| [`surfacing-course.md`](../../docs/surfacing-course.md) | the pull request lifecycle, being retired ([task](../../tracker/tasks/retire-surfacing-course-5szz7c.md)) |
| the [claude-markdown](../../skills/claude-markdown/SKILL.md) skill | how the Claude app displays a reply |
| the [look-markers](../../skills/look-markers/SKILL.md) skill | look links |
| [`reply-check.py`](../../skills/hooks/reply-check.py) | the closing line a reply is sent back for |

## Showing

The link that makes a thing openable.

| File | States |
| --- | --- |
| [`showing.md`](../../docs/showing.md), [`showing-mechanisms.csv`](../../docs/showing-mechanisms.csv), [`routes.json`](../../docs/routes.json) | which link shows a change, and the renderer's address grammar |
| [`showing.py`](../../python/showing.py) (`npm run showing`), [`look-link.py`](../../python/look-link.py) | the scripts that print those links |
| [`toss-render.html`](../../pages/toss-render.html) | the renderer a 🥏 link opens |
| [`showing-consolidation.md`](../../docs/showing-consolidation.md) | the plan that made the toss the preview link |
| the [screenshot-review](../../skills/screenshot-review/SKILL.md) and [show-diff](../../skills/show-diff/SKILL.md) skills | a screenshot where no link reaches a change, and a change shown as a diff |

## Forms

A form is the standard way to show content of a kind.

| File | States |
| --- | --- |
| [`docs/forms/`](../../docs/forms/), [`subjects.csv`](../../docs/subjects.csv) | the standing forms, a branch and a session |
| [`branch.html`](../../pages/branch.html), [`session.html`](../../pages/session.html), `branch-brief.js`, `session-brief.js` | the standing forms' pages and components |
| [`docs/envelopes/`](../../docs/envelopes/README.md) | the formats of what a session puts in front of the owner, each rendered by one page |
| the approve, data-view, shorter, chat-results, passage-reader, audit-render and inquiry pages | the envelope pages |
| `waiting.js`, `user-call-form.js` | the Waiting view, where calls put to the owner collect |

## Measures

| Area | Measure | Working means |
| --- | --- | --- |
| Reply | web-tools-private `state/closings.json` on the background branch: each day's closing states, counted from the session records | the share of closings that put a call to the reader falls, while Direction needed and Ready to assess take the replies whose next step is unclear |
| Showing | none yet; a candidate is the replies that changed a page, counted with and without a render link | every reply that changed a page carries a render link |
| Forms | none yet; a candidate is the share of form pages classified in the UI codebook (`data/ui-units/`) and built on a shared kit | a form met mid-session is recognizable by its kind |

## Reviewers

A proposed change to a governed file goes, before the owner sees it, to
[owner-proxy](../../skills/agents/owner-proxy.md), for how it reads to the owner,
and [peeves-critic](../../skills/agents/peeves-critic.md), for the corrections the
owner has repeated. A change to a page also goes to
[house-style-critic](../../skills/agents/house-style-critic.md).

## Not this program's

- How a page looks: the [html-style](../../skills/html-style/SKILL.md) skill.
- The prose rules in [`QUALIFIED-WRITING.md`](../../docs/QUALIFIED-WRITING.md) and the
  approval of documentation wording ([doc-craft](../../skills/doc-craft/SKILL.md)).
- The Tending view, which belongs to tending.

An area that gains a measure and reviewers of its own, and tasks that no longer
touch the other areas, is a candidate for a program of its own.
