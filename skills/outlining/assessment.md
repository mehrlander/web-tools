# Assessment

An assessment judges a document's higher-order concerns: whether its premise, scope, audience, level of detail, flow, organization and placement serve its reader. Wording is a lower-order concern. The [`doc-audit`](../doc-audit/SKILL.md) skill judges it sentence by sentence. The [`peeves-critic`](../agents/peeves-critic.md) agent judges it against the owner's pet peeves. Run an assessment before either.

The subject is a document, or an edit to one. For an edit, assess the document as edited and mark the claims the edit adds or changes. List first the findings the edit causes or worsens.

## The dimensions

The evidence comes from the outlining files. A claim's rung is its role on its genre's ladder, such as `purpose`, `rule` or `pointer` ([`ladders.md`](ladders.md)). A claim's depth is its level in the question tree ([`tree.md`](tree.md)). A request may name a dimension by one of the other names in the Also called column.

| Dimension | Also called | The question | Evidence |
| --- | --- | --- | --- |
| Premise | thesis, rationale | What situation does the document answer, and what should its reader come away able to do? | the root question ([`tree.md`](tree.md)); `purpose` claims ([`ladders.md`](ladders.md)); the opening |
| Scope | charge, mandate, remit, coverage | What is the document meant to cover, and what does it leave to other documents? | `scope` claims; the note [`tree.md`](tree.md#placing-claims) writes on a claim that fits no question |
| Audience | readership, intended reader | Who reads it, what do they already hold, and what are they there to do? | explanation cost ([`tree.md`](tree.md#explanation-cost)): what the reader named in step 1 must already hold to understand each question |
| Level of detail | altitude, granularity | How fine is the material, for the whole document and for each passage against the passages beside it? | depth and rung; a claim's depth against the other claims in its section |
| Flow | sequence, progression, coherence | Does each part build on what came before? | the order of questions in the tree; the first use of each term against its introduction |
| Organization | structure, arrangement | What job does each section do, and does each claim serve the job of the section it sits in? | the questions and rungs of each section |
| Placement | positioning, exposure, findability | Where does the document sit, and how do its readers reach it? Where should each of its statements live? | links to the document, what loads or cites it, and documents that own its statements (step 4) |

## Procedure

1. **Name the reader, the use and the root question.** Take them from the caller, or from the document's opening. Mark them `inferred` when the opening gives neither. The root question is the one question the whole document answers for that reader ([`tree.md`](tree.md)).
2. **Chart the sections.** Write one row per section: the question it answers, its job (the rungs most of its claims take) and its size in claims. A section is a heading, or a numbered item when other documents cite the items by number. For an edit, chart the sections it touches as they stood at its base.
3. **Read the claims.** Inventory them ([`claims.md`](claims.md)), place each on a rung and on the tree, and record explanation cost. A long document may need only the sections the use concerns. An edit that leaves the premise and scope as they were may need only the sections it touches. Chart the other sections with an approximate claim count. Build the tree from the inventoried sections, under the root question from step 1.
4. **Read beyond the document.**
   - Search the repository for links and references to the document.
   - Read what loads or cites it, such as a skill's description, a `CLAUDE.md` line or a program's charter.
   - For each statement that another document may own, apply the owner's policy on [what earns space](https://mehrlander.github.io/web-tools/app/?view=map&tab=policy&h=critical) in a document. Report a statement that belongs elsewhere as a placement finding.
   - In web-tools, the Content program is the standing process that governs the repository's documentation. The caller takes a placement finding to its [Rule placement](https://github.com/mehrlander/web-tools/blob/main/programs/content/manager.md#rule-placement) process.
5. **Run the tests.** A test identifies a candidate. Keep a candidate as a finding when it would mislead the reader named in step 1, delay them or send them elsewhere. State each finding with its evidence.
   - **Premise.** The opening states no situation or use, or the question it implies differs from the one the sections answer.
   - **Scope.** A claim answers no question the named reader would ask, or answers a question that another document owns.
   - **Audience.** A claim presupposes a term that the named reader lacks, and the document neither defines it nor links it.
   - **Level of detail.** A claim sits more than one level deeper or shallower than the other claims in its section. A section's claim count is more than twice, or less than half, the median count of the sections beside it.
   - **Flow.** A claim uses a term that the document introduces later.
   - **Organization.** A claim's rung is outside its section's rungs. Two sections answer the same question.
   - **Placement.** The readers the premise names have no route to the document. A file that loads or cites the document sends readers to it for a task its premise does not name. A statement restates one that another document owns.

## Output

- `claims.csv`, as [`claims.md`](claims.md) gives it, for the inventoried sections. Findings cite its claim numbers.
- `sections.csv`: `section,question,job,claims,inventoried`, one row per section, as step 2 charts it. `inventoried` is `true` or `false`, and a `false` row gives an approximate count.
- `assessment.csv`: `dimension,where,finding,evidence,edit`, one row per finding. `where` is a section and a quoted span. `evidence` names the claim numbers, test or file behind the finding. For an edit's findings, `edit` is `causes` when the edit creates the problem, `worsens` when it enlarges one, and `exposes` when the problem was there before and the edit brings it into view. It is empty otherwise. Quote every field, and double a quotation mark inside one.

For a human reader, give the section chart first, then the findings by dimension, most consequential first. List the dimensions with no finding in one line.

## Limits

- The numeric thresholds in step 5 are starting points, tried on few documents so far.
- Compare depths only within one reader's tree ([`tree.md`](tree.md)).
- A document that mixes genres takes each section's rungs from that section's own ladder.
- The Practice ladder has no `definition` rung, yet a practice document may define the terms it uses. Keep a definition in a Practice section as a finding only when no later section uses the term.
