# Surfacing program

The surfacing program covers how work reaches its reader, the owner. The files it
governs are declared under `programs` in [`.web-tools.json`](../../.web-tools.json)
and listed in the Map view's Programs tab; a program is defined in
[CONSTELLATION.md](../../docs/CONSTELLATION.md#projects-and-research).

## Areas

| Area | Covers |
| --- | --- |
| Reply | what a reply hands over: its closing state, caption and links, stated in [`SURFACING.md`](../../docs/SURFACING.md) |
| Showing | the link that makes a thing openable, stated in [`showing.md`](../../docs/showing.md) |
| Forms | the standard way to show content of a kind: the standing forms in [`docs/forms/`](../../docs/forms/), the envelopes in [`docs/envelopes/`](../../docs/envelopes/README.md), and the Waiting view |

## Measures

| Area | Measure | Working means |
| --- | --- | --- |
| Reply | web-tools-private `state/closings.json` on the `background` branch: each day's closing states in the session records | the share of Choice needed closings falls, while Direction needed and Ready to assess take the replies whose next step is unclear |
| Showing | web-tools-private `state/render-links.json` on the `background` branch: each day's turns that changed a page, sorted by what a reply after the edit gave | every turn that changed a page hands over a render link to it, or says why none reaches and sends a screenshot |
| Forms | none yet; a candidate is the share of form pages classified in the UI codebook (`data/ui-units/`) | a form met mid-session is recognizable by its kind |

## Reviewers

A proposed change to a governed file goes to
[owner-proxy](../../skills/agents/owner-proxy.md) and
[peeves-critic](../../skills/agents/peeves-critic.md) before the owner sees it; a
change to a page also goes to
[house-style-critic](../../skills/agents/house-style-critic.md).

## Not this program's

- How a page looks: the [html-style](../../skills/html-style/SKILL.md) skill.
- The prose rules in [`QUALIFIED-WRITING.md`](../../docs/QUALIFIED-WRITING.md) and the
  approval of documentation wording ([doc-craft](../../skills/doc-craft/SKILL.md)).

An area whose measure, reviewers and tasks no longer involve the other areas
could become a program of its own.
