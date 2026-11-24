# Diagnose a document's outline

Use this reference to assess what a document is for and how its parts serve that purpose. The result is a diagnosis and, when useful, a proposed outline. The source stays unchanged during the analysis.

## Establish the premise

Read the whole document at a named revision. Identify its reader, the situation that brings the reader to it, and the outcome it supports. State the resulting premise in one sentence. Distinguish what the opening declares from what the body suggests and what the user proposes. Cite the passages supporting an inference; an absent opening does not establish an absent purpose.

Use the document's genre and access pattern. A procedure depends on execution order; an argument depends on reasoning; a reference may serve lookup through independent entries. Judge the organization against that use. Chronological order is one possible structure, not the default for every document.

When two plausible premises would change what belongs, name the alternatives and their consequences. Continue the parts of the analysis that do not depend on choosing between them. Ask for a decision only when the choice is needed to revise the document.

## Recover the existing organization

Build a functional outline at the smallest grain that exposes the problem. For each substantial part, record its source location, the reader question it answers and the work it performs, such as orientation, rule, rationale, definition, procedure, example or delegation. These are descriptive terms, not a required classification system. A section can perform several functions.

Recover relationships the headings omit: prerequisites, groups of peers, general rules with specific cases, and material used in separate lookup tasks. Keep the existing order visible. A polished replacement outline cannot serve as evidence of the source's organization.

Read neighboring documents when an ownership question affects a finding. For an overlap, distinguish independent coverage, an explicit delegation back to this document, a conflict and an unchecked link. A search match or matching heading alone does not establish that a passage can be removed. Record which sources and revisions were checked; qualify gaps in access or version.

## Diagnose the consequential mismatches

Compare the functional outline with the premise. Separate findings about:

- **Premise and scope:** the opening and body promise different jobs, a reader task lacks needed guidance, or a substantial topic serves another document.
- **Hierarchy:** neighboring sections mix levels or functions in a way that hides their relationship; a parent heading does not describe its children.
- **Sequence and flow:** a prerequisite arrives after its use, a transition depends on an unstated relationship, or related lookup material is hard to find.
- **Ownership:** explanations repeat an existing owner, local choices lack a home, or documents delegate the same responsibility back to each other.

For each finding, name the location, the observed mismatch, its consequence for the reader and the smallest useful response. Different section functions are evidence to examine, not a defect by themselves. Report when the current structure serves its purpose. Do not manufacture a reorganization to fill a report.

## Propose a structure

When a change is warranted, state the proposed premise and grouping principle before listing headings. Explain how that principle serves the reader's task. The organizing principle might be task, lifecycle, subject hierarchy or argument.

Map each existing section to its proposed destination. Note a split when a section mixes functions. A proposed deletion needs the source that already states the requirement, or an explicit decision to retire it. A proposed move needs a destination and any references that must change with it. Keep unresolved ownership questions visible rather than treating them as permission to cut.

Stop at the diagnosis and proposed structure unless revision was requested. When revision is authorized, use the repository's documentation-editing workflow; [doc-craft](../doc-craft/SKILL.md) governs this library's edits. [succinct-text](../succinct-text/SKILL.md) handles reduction and its claim crosswalk, [shape-text](../shape-text/SKILL.md) handles the forms expressing relationships, and [doc-audit](../doc-audit/SKILL.md) handles sentence review.

## Formalize the opening

An opening can make the premise inspectable. Propose one or two visible sentences naming the document's purpose, intended reader or use, and scope. Add a boundary or a link to a neighboring owner when the analysis found a specific ambiguity. Test the opening against the body; wording alone cannot settle competing purposes.

For example:

> This document directs sessions working in Web Tools to the guidance their tasks require and records repository-specific choices. Procedures and explanations live in the linked topical documents.

The example is a proposed role for a repository entry point. It does not describe a document that still owns procedures delegated back to it.

For a proposed documentation convention, use purpose, reader or use, and scope as the questions an opening must answer. Check any existing metadata or index before proposing new fields. YAML front matter is a separate format choice: retain fields a consumer already uses, and name the consumer and source of truth for any proposed additions. Keep the premise visible to a reader whose renderer hides metadata. An analysis does not adopt a repository-wide metadata requirement.

## Hand over the analysis

Scale the report to the question. A mandate question may need only a sentence and its basis. A full diagnosis should make the following inspectable:

- The source revision, stated and inferred premise, and any proposed premise.
- The existing functional outline, with source locations.
- The consequential findings, including checked neighboring owners.
- A proposed outline and section destinations when a change is warranted.
- A candidate opening and unresolved decisions when those help the next step.

Keep observation, interpretation and recommendation distinct. Use locations instead of numeric ratings of coherence. See [the worked example](examples/claude.md) for a diagnosis that preserves local obligations while proposing a narrower role.

## Related approaches

- [Purdue OWL's reverse outlining](https://owl.purdue.edu/owl/general_writing/the_writing_process/reverse_outlining.html) distinguishes a paragraph's topic from its contribution to the argument. That distinction is useful when recovering the functions beneath headings.
- [The Diátaxis compass](https://diataxis.fr/compass/) distinguishes documentation needs by the reader's activity. Use it when a passage's purpose is unclear, alongside the document's actual reader and situation.
