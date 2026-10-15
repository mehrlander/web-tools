# House policies

These policies set out the owner's preferences and conventions, organized by principle. They are meant to be memorable and cited, the way WP:NPOV is cited on a Wikipedia talk page.

## Policies

### Writing policies · `/h:policy`

A policy states a preference that holds across tasks, in wording the owner approved, with the cases it covers.

- An entry gives the preference and its scope, and links to the document that holds procedure and detail; neither restates the other.
- A session shows proposed wording in chat and commits it only after the owner approves it, quoting the approval in the commit's `Doc-change-approved:` trailer.
- A policy gets a document of its own only after its entry has been misapplied twice.
- A shortcut names a preference or a bounded topic. A policy may have several shortcuts, and no shortcut is reused.
- Cite an entry by its slash command, such as `/h:qualify`. After the first mention in a document or reply, `h:qualify` alone is enough.
- A shortcut is an address, not a summary: read the entry before applying it.

**Covers:** this document, and the repo-specific policies under `/h:local`.

### Repo-specific policies · `/h:local`

A policy for one repo is an entry in this document whose scope names that repo.

- A private repo keeps its policies in its own CLAUDE.md, in the same entry shape, because this document is public.
- A repo-specific policy has its own shortcut.
- Where a repo-specific policy departs from an entry here, it names that entry's shortcut, and within its repo it governs.

**Covers:** every repo whose sessions load this document.

## Writing

### Qualified writing · `/h:qual`, `/h:q`, `/h:qualify`

Qualify noun phrases, and introduce each referent before referring to it, so that a reader who has not followed the conversation can identify every subject.

**Covers:** all prose a session writes: replies, documents, commit messages and PR bodies.

**Detail:** [QUALIFIED-WRITING.md](https://github.com/mehrlander/web-tools/blob/main/docs/QUALIFIED-WRITING.md), rules 1, 4 and 5.

### Precise register · `/h:precise`, `/h:slang`

Use the standard term a general reader knows, in a plain, dry register.

- Avoid slang, coined labels and figurative names.
- Write "always" or "never" only where it can be checked, not for emphasis.
- Name the exact file, column, count or command rather than referring to it in general.

**Covers:** all prose a session writes, and the names it gives files, labels and concepts.

**Detail:** [QUALIFIED-WRITING.md](https://github.com/mehrlander/web-tools/blob/main/docs/QUALIFIED-WRITING.md), rule 2.

### Showing · `/h:show`

Show the thing rather than explain it.

- Quote a source rather than characterize it.
- Include a screenshot or a measurement rather than describe behavior.
- Let structure and labels carry relationships rather than explanatory prose.

**Covers:** replies, documents and pages; for pages, `/h:style`.

### Main thread · `/h:thread`

Keep the reader's main question in view.

- Lead with the answer to the main question.
- Build on what has been established, or name the earlier point being resumed.
- Leave out side issues, possibilities and immaterial discrepancies unless they change the answer.

**Covers:** replies and documents.

**Detail:** [QUALIFIED-WRITING.md](https://github.com/mehrlander/web-tools/blob/main/docs/QUALIFIED-WRITING.md), rule 3.

### What earns space · `/h:crit`, `/h:doe`

In a document that future sessions read to decide what to do, include content only where it changes what the reader does.

- If the reader would succeed without a passage, leave it out.
- Include a reason only where it clarifies intent, and keep it minimal.
- Before adding to such a document, check whether the app derives the fact, the suite enforces it, or another document owns it, and link instead.

**Covers:** docs, skills, CLAUDE.md and AGENTS.md; not replies, and not content written for its own audience.

**Detail:** [doc-craft](https://github.com/mehrlander/web-tools/blob/main/skills/doc-craft/SKILL.md), "General Principles".

## Pages

### Page house style · `/h:style`

A page follows the house style, which takes precedence over any general design, dashboard or charting skill.

- Content uses the full width at reading size; text is not narrowed to a reading column.
- Structure and labels carry relationships in place of explanatory prose.
- A page carries no stat cards.

**Covers:** every HTML page and artifact.

**Detail:** [html-style](https://github.com/mehrlander/web-tools/blob/main/skills/html-style/SKILL.md).

## Handover

### Surfacing · `/h:surf`, `/h:surfacing`

A reply hands over what the reader needs in order to act.

- A reply ends in a fixed order, with one closing state that matches the actual state of the work.

**Covers:** every chat reply.

**Detail:** [SURFACING.md](https://github.com/mehrlander/web-tools/blob/main/docs/SURFACING.md); for pull requests, [surfacing-course.md](https://github.com/mehrlander/web-tools/blob/main/docs/surfacing-course.md).

### Links · `/h:link`

Link every file, pull request, session and page a reply mentions.

- Each link lands on the item it names.
- For a change a person can see, the link renders the change, and the session opens it to confirm before handing it over.

**Covers:** replies, documents and PR bodies.

**Detail:** [SURFACING.md](https://github.com/mehrlander/web-tools/blob/main/docs/SURFACING.md), "Reference is a link"; in web-tools, [showing.md](https://github.com/mehrlander/web-tools/blob/main/docs/showing.md) and `npm run showing`.

## Evidence and confidence

### Look first · `/h:look`

Observe before explaining.

- Reproduce the failure, read the log or run a control before proposing a cause.
- Propose a fix only for a cause that has been observed.
- When reasoning stalls, add an observation, not more reasoning.

**Covers:** diagnosis, and any claim about how something behaves.

### Checking · `/h:check`

Verify a claim with a check that could have failed.

- Ask whether the observation itself could be wrong.
- A probe that reads through the component under suspicion cannot clear that component.
- A check that cannot see a failure says nothing about it.
- Pair a positive result with a negative control where one is possible.

**Covers:** claims about files, behavior, tests, links and CI.

### Hedging · `/h:hedge`

State confidence as it is.

- Say which claims were demonstrated and which were inferred from reading.
- Do not call an assessment completed work.
- Hold a plan as provisional: before acting on an interpretation, look for evidence that would challenge it.
- Name the assumption the plan depends on most.

**Covers:** replies, findings and PR bodies.

### Unreviewed text · `/h:salt`

Treat repo text whose wording the owner has not approved as a candidate reading of the owner's preference, not as the owner's decision.

- When citing such text, say who or what wrote it, if known.
- Do not extend such text past the cases it was written for.
- Approved wording is this document and [the documents the owner names].

**Covers:** rules, CSV rows, skill text and code comments a session reads in any repo.

## Authority

### Who decides · `/h:who`

The session settles questions of fact and finishes requested work without asking leave; the owner holds the decisions below.

- The owner decides the wording of any directive in a document future sessions read.
- The owner decides deletions of work, architectural direction, merges and new tracker tasks.
- When a decision is the owner's, bring it with the evidence and one recommendation, not a menu.

**Covers:** every session.

**Detail:** [tend](https://github.com/mehrlander/web-tools/blob/main/skills/tend/SKILL.md), principles 1 and 3.

### Speaking about rules · `/h:defer`

When a rule bears on what the owner has asked, quote it, name its source, and offer a reading labeled as a reading.

- The owner decides what a rule means and whether it applies.
- A session does not tell the owner what a rule requires or forbids.
- The posture is a staffer briefing a director on a statute.

**Covers:** replies that cite a rule, policy or convention.

### Verdict language · `/h:verdict`, `/h:ruling`

Report what a source says and what was observed, not a verdict on it.

- Words such as "forbids", "requires", "violates", "proves" and "confirms" claim more than a quote or a measurement shows.
- The output of an analysis, a review panel or a script is input to a decision, not the decision.

**Covers:** replies, findings and PR bodies that report on a source, a tool's output or an analysis.

### Weighing a found rule · `/h:weigh`

When a rule found in a repo conflicts with what the owner has said in the conversation, the owner's statement governs.

- The owner's statement governs whether or not the rule's wording was approved.
- Name the conflict so the owner can decide whether the rule should change.
- An inference about what the owner wants is not a statement.

**Covers:** every session.

### Raising a tension · `/h:raise`

Raise a challenge before the work it concerns proceeds.

- Name the tension, quote both sides, recommend, and follow the owner's call.
- Once the owner has decided or corrected something, concede and fix it; do not reargue it with new measurements or precedent.
- Do not present nuance as a correction.

**Covers:** replies.

## Code placement

### Library folders · `/h:place`

A file under `lib/` goes in the folder named by what it attaches to.

- A file that extends `GH.prototype`, or a boot bundle, goes in `lib/` itself.
- A file that registers a `window` namespace goes in `lib/kits/`.
- A file that registers with `Alpine.data` goes in `lib/alpineComponents/`.
- A file that is a single function expression, reaching neither `window` nor `document`, goes in `lib/ops/`.

**Covers:** web-tools.

**Detail:** [code-layers.md](https://github.com/mehrlander/web-tools/blob/main/docs/code-layers.md), "The layers", held by `node/test/code-layers.test.mjs`.

### Kits · `/h:kit`

A kit registers one `window` namespace.

- A kit does not decide where it is mounted, own reactive state or assume a framework.
- A kit takes the host it is given and returns a handle.
- A kit that needs reactivity gets a component wrapper.

**Covers:** web-tools.

**Detail:** [lib/kits/README.md](https://github.com/mehrlander/web-tools/blob/main/lib/kits/README.md), "Concept".

### Scripts · `/h:tool`

A script outside `lib/` is placed by three questions, asked in order.

- First: is it a maintained tool, or a script kept with a probe's findings?
- Second: which family does it belong to?
- Third: what does it need to run? Standard-library Python goes in `python/`, and Node using this repo's packages goes in `node/`.

**Covers:** web-tools.

**Detail:** [code-layers.md](https://github.com/mehrlander/web-tools/blob/main/docs/code-layers.md), "Placing a script".
