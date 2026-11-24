# Worked diagnosis: web-tools CLAUDE.md

This example diagnoses a document at revision [`6e75e044caf3cdef3dc43b4e2227b0303703f558`](https://github.com/mehrlander/web-tools/tree/6e75e044caf3cdef3dc43b4e2227b0303703f558). Every source below is pinned to that revision. The example is an illustrative structural assessment, not current repository policy or a proposed rewrite.

## Mandate and proposed role

**Observed:** the opening identifies the cross-repo contract and distinguishes that contract from the local material below. The document then mixes source pointers, instructions, local settings, and explanations under ten peer headings.

**Inferred mandate:** enable a session to work in web-tools, find governing sources, maintain repository state, and deliver verified changes. The document does not state that mandate as a visible opening.

**Proposed role:** a startup guide that routes a task to its governing sources and retains the local decisions and actions that a session must know before consulting those sources. Adopting that role would require the preservation checks below; the role is this assessment's recommendation.

## Functional outline

The unit is an existing heading. The second column describes what the section does, rather than shortening its topic label. Every heading reaches an entry.

| Source section | Function |
| --- | --- |
| [Where the rest of the system lives](https://github.com/mehrlander/web-tools/blob/6e75e044caf3cdef3dc43b4e2227b0303703f558/CLAUDE.md#where-the-rest-of-the-system-lives) | Establish shared ownership, plugin delivery, deliberate absence of imports, and local defaults. |
| [The Web Tools app](https://github.com/mehrlander/web-tools/blob/6e75e044caf3cdef3dc43b4e2227b0303703f558/CLAUDE.md#the-web-tools-app) | Name the product and route product questions to [APP.md](https://github.com/mehrlander/web-tools/blob/6e75e044caf3cdef3dc43b4e2227b0303703f558/docs/APP.md). |
| [Showing: which link shows what](https://github.com/mehrlander/web-tools/blob/6e75e044caf3cdef3dc43b4e2227b0303703f558/CLAUDE.md#showing-which-link-shows-what) | Route link selection through a command and retain the honesty rule. |
| [Per-session refresh: thumbnails](https://github.com/mehrlander/web-tools/blob/6e75e044caf3cdef3dc43b4e2227b0303703f558/CLAUDE.md#per-session-refresh-thumbnails) | Specify the pre-merge trigger, refresh scope, schedule, and private commit destination. |
| [Guide-PR support: platform auto-create is on](https://github.com/mehrlander/web-tools/blob/6e75e044caf3cdef3dc43b4e2227b0303703f558/CLAUDE.md#guide-pr-support-platform-auto-create-is-on) | State account behavior, manual fallback, guide ownership, and retirement cleanup. |
| [The pre-build & the build-on-commit hook](https://github.com/mehrlander/web-tools/blob/6e75e044caf3cdef3dc43b4e2227b0303703f558/CLAUDE.md#the-pre-build--the-build-on-commit-hook) | Explain artifacts; prescribe source reading, setup, verification, repair, and CI boundaries. |
| [Project tracker](https://github.com/mehrlander/web-tools/blob/6e75e044caf3cdef3dc43b4e2227b0303703f558/CLAUDE.md#project-tracker) | Set local tracker scope, placement, and generator. |
| [Registries](https://github.com/mehrlander/web-tools/blob/6e75e044caf3cdef3dc43b4e2227b0303703f558/CLAUDE.md#registries) | Trigger source reading and restate registration and ownership constraints. |
| [Snags](https://github.com/mehrlander/web-tools/blob/6e75e044caf3cdef3dc43b4e2227b0303703f558/CLAUDE.md#snags) | Specify the shared record, filing behavior, commit branch, and citation handle. |
| [Environment & testing](https://github.com/mehrlander/web-tools/blob/6e75e044caf3cdef3dc43b4e2227b0303703f558/CLAUDE.md#environment--testing) | Require visual evidence and route testing, network, and environment upkeep. |

## Consequential findings

1. **Peer headings carry different functions.** A product-reference pointer sits beside a thumbnail procedure and a build section containing architecture, setup, repair, and verification. The heading structure gives no distinction between orientation, a triggered action, and supporting explanation. Grouping by the session's task would expose those differences without making every section a narrative.

2. **Related actions are separated.** A page change connects source-reading prerequisites, independent verification, screenshots, link selection, and pre-merge thumbnails. Those actions span four sections. Grouping their prerequisites and delivery duties would reduce the connections a reader must reconstruct. The document remains a reference; its order need not impose one workflow on every task.

3. **Topical coverage does not establish topical ownership.** The [refresh model](https://github.com/mehrlander/web-tools/blob/6e75e044caf3cdef3dc43b4e2227b0303703f558/node/README.md#the-refresh-model) explains commit rules but routes thumbnail scheduling and repair instructions back to CLAUDE.md. The [showing reference](https://github.com/mehrlander/web-tools/blob/6e75e044caf3cdef3dc43b4e2227b0303703f558/docs/showing.md#the-fabs-ref-check) attributes the honesty rule to CLAUDE.md. The [tracker contract](https://github.com/mehrlander/web-tools/blob/6e75e044caf3cdef3dc43b4e2227b0303703f558/docs/TRACKER.md#extension-points-set-in-local-claudemd) deliberately leaves placement and registry decisions local. Replacing those passages with links would lose instructions or create circular routing.

4. **Reading triggers are substantive instructions.** Read [loader.md](https://github.com/mehrlander/web-tools/blob/6e75e044caf3cdef3dc43b4e2227b0303703f558/docs/loader.md) before adding a library file or changing boot; read [registries.md](https://github.com/mehrlander/web-tools/blob/6e75e044caf3cdef3dc43b4e2227b0303703f558/docs/registries.md) before inventing a registry; consult environment documentation for testing, verification, or network work. A topical document's existence does not supply the condition that tells a session to open it. Retain those conditions beside their links.

## Candidate three-section outline

1. **Scope and shared contracts.** Destination for “Where the rest of the system lives” and “The Web Tools app”: shared ownership, plugin delivery and its diagnostic rationale, local defaults, distribution references, product name, and product-reference pointer.
2. **Work on the task.** Destination for the pre-build/build-on-commit section, Project tracker, Registries, Snags, and the environment reference and upkeep portion of Environment & testing. Use task subsections for source changes, shared records, and testing. Keep setup, verification, and repair here until another owner actually receives those instructions.
3. **Present and merge the result.** Destination for Showing, thumbnail refresh, Guide-PR support, and the visual-evidence instruction from Environment & testing. Preserve their separate triggers, fallback behavior, and destinations.

## Preservation and move prerequisites

All ten source sections have destinations above. Before shortening explanations, compare the claimed owner at this revision and retain any unmatched instruction. Before moving thumbnail or repair rules, put the complete procedures in their new owner and update the [README's reverse references](https://github.com/mehrlander/web-tools/blob/6e75e044caf3cdef3dc43b4e2227b0303703f558/node/README.md#the-refresh-model). Preserve the private thumbnail destination, snag filing semantics, account-specific PR fallback, retirement cleanup, and browser-free verification constraints. Recheck incoming links if headings change. Reorganization alone does not authorize policy changes.

A proposed visible opening:

> Use this file to find the governing sources and repository-specific actions for work in web-tools. The shared contracts arrive through the portable plugin; the local sections cover task prerequisites, shared records, verification, and delivery.
