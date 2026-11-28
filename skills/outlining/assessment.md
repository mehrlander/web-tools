# Assessment

An assessment judges a document's higher-order concerns: whether its premise,
scope, audience, level of detail, flow, organization and placement serve its
reader. Wording is a lower-order concern, which `doc-audit` and the
`peeves-critic` agent judge. Run an assessment before either, since a
misplaced passage can read well sentence by sentence.

The subject is a document, or an edit to one. For an edit, assess the document
as edited, mark the claims the edit adds or changes, and put first the
findings the edit causes or worsens.

## The dimensions

| Dimension | The question | Evidence |
| --- | --- | --- |
| Premise | What situation does the document answer, and what should its reader come away able to do? | the root question ([`tree.md`](tree.md)); `purpose` claims ([`ladders.md`](ladders.md)); the opening |
| Scope | What does the document's charge cover, and what does it leave to other documents? | `scope` claims; claims that answer no reader's question (`fit: none`) |
| Audience | Who reads it, what do they already hold, and what are they there to do? | explanation cost, counted against the reader named in step 1 |
| Level of detail | How fine is the material, for the whole document and for each passage against the passages beside it? | depth and rung; a claim's depth against the other claims in its section |
| Flow | Does each part build on what came before? | the order of questions in the tree; a term used before the document introduces it |
| Organization | What job does each section do, and does each claim serve the job of the section it sits in? | the questions and rungs of each section |
| Placement | Where does the document sit, and how do its readers reach it? Where should each of its statements live? | outside the document: see step 4 |

## Procedure

1. **Name the reader and the use.** Take them from the caller, or from the
   document's opening, and mark them `inferred` when the opening gives
   neither.
2. **Chart the sections.** Write one line per section: the question it
   answers, its job (the rungs most of its claims take), and its size in
   claims. For an edit, chart the sections it touches as they stood before
   the edit, from its base.
3. **Read the claims.** Inventory them ([`claims.md`](claims.md)), place each
   on a rung and on the tree, and record explanation cost. For a long
   document, or for an edit that leaves the premise and scope as they were,
   inventory only the sections the use concerns or the edit touches, and
   chart the rest.
4. **Read beyond the document** for placement. Search the repository for
   links and references to the document. Read what summons it: a skill's
   description, a `CLAUDE.md` line, a charter's table. For each statement
   that another document may own, apply the house policy [What earns space
   (`h:critical`)](https://mehrlander.github.io/web-tools/app/?view=map&tab=policy&h=critical),
   and in web-tools bring the statement to the Content program's Rule
   placement process.
5. **Run the tests.** Each test yields a candidate, not a verdict:
   - **Job.** A claim's rung is not among its section's rungs, or the claim
     falls on another genre's ladder.
   - **Home.** A claim answers a question that another section answers, or a
     question that another document owns.
   - **Detail.** A claim sits more than one level deeper or shallower than
     the other claims in its section, or a section's size is out of line with
     the weight of its question.
   - **Order.** A question presupposes a term the document introduces later,
     or the document defines a term after using it.
   - **Reach.** The readers the premise names have no route to the document,
     or a route leads readers the document does not serve.

## Output

`sections.csv`: `section,question,job,claims`, one row per section, as step 2
charts it.

`assessment.csv`: `dimension,where,finding,evidence,edit`, one row per
finding. `where` is a section and a quoted span, `evidence` names the claim
numbers, test or file behind the finding, and `edit` is `true` when the edit
causes or worsens the finding. Quote every field.

For a human reader, give the section chart first, then the findings by
dimension, most consequential first, and list the dimensions with no finding
in one line.

## Limits

The thresholds in step 5 (a rung shared by most of a section's claims, one
level of depth) are starting points that have been tried on few documents.
Compare depths only within one reader's tree ([`tree.md`](tree.md)). A
practice document may define the terms it uses: a definition in a Practice
section is a candidate for the job test to weigh, not a fault.
