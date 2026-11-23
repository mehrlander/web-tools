# House policies

Each policy states a single preference as something to do; a thing to avoid goes in the [peeves list](https://github.com/mehrlander/web-tools/blob/main/skills/peeves/peeves.md). A policy that applies only to a private repo goes in that repo's CLAUDE.md.

## Writing

### Qualified writing · `h:qualify`

Write clearly and precisely: account for what the reader lacks, qualify noun phrases, and claim no more than the evidence supports.

**Backed by:** [QUALIFIED-WRITING.md](https://github.com/mehrlander/web-tools/blob/main/docs/QUALIFIED-WRITING.md): [Perspective](https://github.com/mehrlander/web-tools/blob/main/docs/QUALIFIED-WRITING.md#perspective), [Qualifiers](https://github.com/mehrlander/web-tools/blob/main/docs/QUALIFIED-WRITING.md#qualifiers) and [Accuracy](https://github.com/mehrlander/web-tools/blob/main/docs/QUALIFIED-WRITING.md#accuracy).

### Showing · `h:show`

Show rather than explain.

- Quote a source rather than characterize it.
- Include a screenshot or a measurement rather than describe behavior.
- Let structure and labels carry relationships rather than explanatory prose.

### What earns space · `h:critical`

In a document that future sessions read to decide what to do, include content only where it changes what the reader does.

- If the reader would succeed without a passage, leave it out.
- Include a reason only where it clarifies intent, and keep it minimal.
- Before adding to such a document, check whether code derives the fact, a test enforces it, or another document owns it, and link instead.

**Backed by:** [doc-craft](https://github.com/mehrlander/web-tools/blob/main/skills/doc-craft/SKILL.md); [web-tools CLAUDE.md](https://github.com/mehrlander/web-tools/blob/main/CLAUDE.md#where-the-rest-of-the-system-lives), the check before adding to a doc.

### Stay current · `h:current`

Living text says what is true now; history goes to the records built to hold it.

- A comment, doc or skill states the present, not when it changed, what prompted the change, figures measured at the time, or what it used to do.
- When a living sentence is wrong, fix the sentence; add no "formerly" or "corrected" note and no dated update line.
- History belongs in commit messages, a task's progress log and dated or write-once records.

**Backed by:** [doc-craft](https://github.com/mehrlander/web-tools/blob/main/skills/doc-craft/SKILL.md#general-principles), "State current reality".

## Handover

### Links · `h:link`

Link every file, pull request, session and page a reply mentions.

- Each link lands on the item it names.
- For a change a person can see, the link renders the change, and the session opens the link to confirm before handing it over.

**Backed by:** [CONVERSATION.md](https://github.com/mehrlander/web-tools/blob/main/docs/CONVERSATION.md#a-reply-that-changed-files), "Reference is a link"; in web-tools, [showing.md](https://github.com/mehrlander/web-tools/blob/main/docs/showing.md) and `npm run showing`.

### Merged means closed · `h:merged`

A merged branch takes no further commits; follow-up work starts again from the current tip of the target branch and opens a new pull request.

**Backed by:** [post-merge-branch-mutation.md](https://github.com/mehrlander/web-tools/blob/main/docs/github/post-merge-branch-mutation.md#rule-of-thumb); [CONVERSATION.md](https://github.com/mehrlander/web-tools/blob/main/docs/CONVERSATION.md#every-reply), the 🟣 Merged state.

## Evidence and confidence

### Look first · `h:look`

Observe before explaining.

- Reproduce the failure, read the log or run a control before proposing a cause.
- Propose a fix only for a cause that has been observed.
- When reasoning stalls, add an observation, not more reasoning.
- Hold a plan as provisional: before acting on an interpretation, look for evidence that would challenge it.
- Name the assumption the plan depends on most.

### Checking · `h:check`

Verify a claim with a check that could have failed.

- Ask whether the observation itself could be wrong.
- A check that runs through the component in doubt cannot show that component works.
- Pair a positive result with a negative control where one is possible.

### Readings · `h:salt`

Report an inference, a paraphrase or a grouping as a reading, with the qualifiers its source gave it, such as "possibly" or "for now".

- When you cite repo text, say who wrote it, if known, and apply it only to the cases it was written for.
- When you sort items into categories of your own, say so.
- When a new category name would go into a registry column, a file name or a document that sessions read, bring it to the owner first.

**Backed by:** [QUALIFIED-WRITING.md](https://github.com/mehrlander/web-tools/blob/main/docs/QUALIFIED-WRITING.md#accuracy), rule 6, which every session loads.

## Authority

### Be bold · `h:bold`

Advance the work as far as sound judgment permits. Seek the involvement the matter warrants, and make review practical and timely.

Owner involvement runs a spectrum:

- Act: Exercise your judgment and proceed.
- Inform: Proceed and make the work known.
- Request approval: Present a developed course for authorization.
- Request direction: Seek substantive judgment about which course to take.

Careful use of closing state markers helps involve the owner efficiently, and especially use of 🟢 where direction has already been settled and only a prod is needed (the anti-pattern is where every turn ends with an open ended question of what if anything to do next).

Common cases that are found to benefit from owner attention are set up with a form to elicit the call efficiently.

**Backed by:** [tend](https://github.com/mehrlander/web-tools/blob/main/skills/tend/SKILL.md#principles), especially "Prepare the calls"; [Conversation](https://github.com/mehrlander/web-tools/blob/main/docs/CONVERSATION.md#every-reply), closing states; [doc-craft](https://github.com/mehrlander/web-tools/blob/main/skills/doc-craft/SKILL.md#review), documentation review and approval.

### Align now · `h:align`

When you notice names, text or structure that disagree with each other or with what is true, align them in the same session. A misalignment counts as soon as it is seen, before it causes any confusion.

- Carry a rename to every place the name appears, including links to it in our own repos.
- Fix unclear or inconsistent wording where you meet it, including text held in code.
- When alignment cannot finish in this session, say so and make it the next step.

The caution against fixes for hypothetical problems is meant for new guards, rules and channels, such as a check added after one miss in a process with chance in it. It does not apply to alignment.

**Backed by:** the [peeves list](https://github.com/mehrlander/web-tools/blob/main/skills/peeves/peeves.md): P38 (Unfinished work), P65 (Compatibility clutter) and P12 (One name per thing).

## Code placement

### Library folders · `h:place`

A file under `lib/` goes in the folder named by what it attaches to.

**Backed by:** [code-layers.md](https://github.com/mehrlander/web-tools/blob/main/docs/code-layers.md), checked by `node/test/code-layers.test.mjs`.

### Scripts · `h:tool`

A script outside `lib/` goes with its caller.

**Backed by:** [code-layers.md](https://github.com/mehrlander/web-tools/blob/main/docs/code-layers.md#outside-lib), "Outside `lib/`".

### Edit the source · `h:source`

Change a generated file by changing its source and running its generator.

**Backed by:** [web-tools CLAUDE.md](https://github.com/mehrlander/web-tools/blob/main/CLAUDE.md#the-pre-build--the-build-on-commit-hook), "The pre-build & the build-on-commit hook".

## Addresses

### Address parameters · `h:route`

Give each parameter a page reads from its address one of four kinds, and give it only that kind's behavior.

- A **route** names a place: a view, a tab, or a record inside it. It stays in the address, which then names where the reader is. A route that names a record scrolls to it and marks it on arrival. Reaching a place through a tab, a link or an icon tapped in a diagram adds a history entry. Stepping between records in a list, by a row, a swipe or an arrow, replaces the entry. Back then returns to the last place reached.
- An **action** is done once on arrival and then dropped from the address, and a reload does not repeat it.
- A **look** points the reader at something on the page and changes nothing, as a link carrying the look kit's `#show=` or `#steps=` does.
- A **setting** changes how the page runs.

**Backed by:** [app-routes.csv](https://github.com/mehrlander/web-tools/blob/main/docs/app-routes.csv), the Web Tools app's routes; [lib/kits/land.js](https://github.com/mehrlander/web-tools/blob/main/lib/kits/land.js), how a route lands; [lib/kits/linked-swiper.js](https://github.com/mehrlander/web-tools/blob/main/lib/kits/linked-swiper.js), how a list tells a step from a followed link; [lib/kits/look.js](https://github.com/mehrlander/web-tools/blob/main/lib/kits/look.js), looks.
