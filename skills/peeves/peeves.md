# Pet peeves

Each entry names a behavior the owner has corrected an assistant for repeatedly, stated so a reviewer can check work against it. The [peeves skill](SKILL.md) says how to use the entries. The commit hook writes [`peeves.csv`](peeves.csv) from this file. Edit this file and do not hand-edit the CSV.

## Entries

### Documentation bloat · `P01`

Instructions growing through rationale, duplicated claims, correction notes and comments that explain readable code.

**Look for:** a doc edit that adds a paragraph; sentences explaining why a rule exists, what a section is about, or how it came to be written

**Owner:** web-tools CLAUDE.md (before adding to a doc, ask whether another document owns it)

**Area:** writing · **Detector:** reader · **Sessions:** 100 · **Status:** active

### Dramatic prose · `P04`

Slogans, posturing, emphatic absolutes and sentences that sound profound while saying little.

**Look for:** 'it does one thing', 'is the floor', 'held to', 'carries weight', 'does the work', 'deliberately', 'never' used for emphasis; a sentence that sounds wise and says little

**Area:** writing · **Detector:** reader · **Sessions:** 35 · **Status:** active

### Vague writing · `P05`

Claims a reader cannot check, unnamed subjects and pronouns whose referents the reader has to recover.

**Look for:** 'a file here', 'some cases', 'it is complicated'; a sentence that cannot be checked; two replies that disagree silently

**Owner:** docs/QUALIFIED-WRITING.md (rules 3 and 4)

**Area:** writing · **Detector:** reader · **Sessions:** 30 · **Status:** active

### Em dashes · `P07`

Em dashes, en dashes or double hyphens used to join ideas in prose.

**Look for:** an em dash, en dash or double hyphen between clauses

**Owner:** docs/QUALIFIED-WRITING.md (no em dashes); home tools/lint-conventions.py catches em dashes and double hyphens in home only

**Area:** writing · **Detector:** reader · **Sessions:** 8 · **Status:** active

### Term loading · `P10`

Giving ordinary or specialized terms a private meaning, or assuming the reader shares meanings drawn from unspecified context.

**Look for:** a familiar word used for a special local concept; an unexplained coined, metaphorical or insider term; a meaning imported from another discussion or file without introducing it; competing names that leave the referent unclear

**Area:** naming · **Detector:** reader · **Sessions:** 45 · **Status:** active

### Missing context · `P14`

Summaries that assume the reader followed the session, already understands the subject or authored pasted material.

**Look for:** a summary, assessment or reorientation that starts mid-thought, relies on earlier turns, or credits pasted text to the owner; an ordinary reply may rely on the turn it answers

**Owner:** docs/QUALIFIED-WRITING.md; home me/common-ground.md

**Area:** chat-reply · **Detector:** reader · **Sessions:** 95 · **Status:** active

### Subtle veering · `P16`

Quietly taking the work in a different direction from the owner's proposal, leaving the owner to discover the departure later.

**Look for:** a change in scope, approach, output or framing that is not called out when the direction changes; explaining the departure only after the owner notices

**Area:** process · **Detector:** reader · **Sessions:** 40 · **Status:** active

### Shallow defense · `P18`

Treating an available rationale, measurement or precedent as sufficient to dismiss the owner's challenge. A choice can have justification and still be bad. Entertain the criticism, examine the tradeoff and revise the choice when warranted.

**Look for:** a rationale or measurement offered as if it settles whether a choice is good; a challenged choice repeated without considering the criticism; weak reasons used to dismiss an idea

**Area:** chat-reply · **Detector:** reader · **Sessions:** 22 · **Status:** active

### Lazy questions · `P21`

Asking the owner to inspect available evidence, settle a question the assistant can resolve or approve an already agreed next step.

**Look for:** 'Shall I proceed?' or 'Want me to...?' on a path already agreed; a question whose answer is in the repo

**Owner:** home CLAUDE.md (AskUserQuestion); docs/CONVERSATION.md (🟢 for confirmation)

**Area:** questions · **Detector:** reader · **Sessions:** 100 · **Status:** active

### Raw options · `P22`

Handing the owner choices without the assessment and recommendation needed to decide.

**Look for:** a list of options without a recommendation; a question with no context to answer it

**Owner:** home CLAUDE.md; the portable ask-question-guard hook refuses only the AskUserQuestion tool, not a menu written in prose

**Area:** questions · **Detector:** reader · **Sessions:** 75 · **Status:** active

### Missing links · `P23`

References without usable links, render links that miss the changed view and links that stop short of the named item.

**Look for:** a viewable change with no render link; a link that loads blank or lands on the wrong view; a standalone page link where the app route renders it (framed pages excepted, per home CLAUDE.md)

**Owner:** docs/CONVERSATION.md (npm run showing picks the link)

**Area:** reporting · **Detector:** reader · **Sessions:** 115 · **Status:** active

### Untested claims · `P25`

Reporting an inferred result as demonstrated, handing over an unexamined screenshot or proposing a fix before checking the cause.

**Look for:** 'should work'; a screenshot sent without comment on what it shows; asking the owner to run the test

**Owner:** skills/screenshot-review/SKILL.md; docs/CONVERSATION.md (a screenshot)

**Area:** reporting · **Detector:** reader · **Sessions:** 65 · **Status:** active

### Three options for a visual choice · `P26`

For an open visual choice, show about three options as screenshots and recommend one.

**Look for:** a single guess, or options described in words

**Area:** reporting · **Detector:** reader · **Sessions:** 15 · **Status:** guidance

### Reinventing the wheel · `P33`

Adding a mechanism, category or separate interface when an existing one serves the job. One-off interfaces bypass the app shell, file viewer or shared component without a reason the existing interface cannot serve.

**Look for:** a new folder, registry, name or layer next to one that already exists; a workaround mechanism for a simple problem

**Area:** process · **Detector:** reader · **Sessions:** 40 · **Status:** active

### Reduce when cleaning up · `P34`

When cleaning up, reduce rather than add; do not add rules, guards or documentation for a single incident or a hypothetical, and do not widen the scope (orchestration, fan-outs) without being asked.

**Look for:** a guard script for one mistake; a fan-out nobody asked for; a cleanup that added lines

**Owner:** web-tools CLAUDE.md (wary of improvements for hypothetical problems)

**Area:** process · **Detector:** reader · **Sessions:** 25 · **Status:** guidance

### Read the guide first · `P35`

Before acting or asserting what exists, read the relevant skill or style guide and check the latest main, other repos and open branches.

**Look for:** a page built without html-style; 'there is no X' from a stale or shallow clone

**Area:** process · **Detector:** reader · **Sessions:** 40 · **Status:** guidance

### Micromanaged handoffs · `P36`

Handoff prompts that prescribe detailed steps, solutions or option rankings beyond the goal and necessary context.

**Look for:** a step-by-step handoff where an outcome and constraints would suffice; instructions that leave the receiving session little room to exercise judgment

**Owner:** chat-histories CLAUDE.md (post-merge handoff prompts)

**Area:** process · **Detector:** reader · **Sessions:** 10 · **Status:** active

### Unfinished work · `P38`

Leaving feasible work for another session, stopping before an authorized merge or declaring a tool failure after trying one route.

**Look for:** stopping at 'ready for your review' after being told to merge; a PR left with a conflict

**Owner:** docs/CONVERSATION.md (Ready to merge)

**Area:** git-pr · **Detector:** reader · **Sessions:** 135 · **Status:** active

### PR babysitting · `P39`

Timed check-ins and redundant status messages about unchanged PR or CI state. A new failure, review or merge can warrant a message.

**Look for:** a scheduled CI check-in; the same status repeated after each event; redundant PR or CI status messages when the state has not changed

**Owner:** docs/CONVERSATION.md (PR events); the portable send-later guard refuses only send_later

**Area:** git-pr · **Detector:** reader · **Sessions:** 8 · **Status:** active

### Explanatory prose · `P42`

Pages spending space explaining their purpose or controls when the structure and labels could make the purpose clear.

**Look for:** a sentence on the page saying what the page or a section is for

**Owner:** skills/html-style/SKILL.md (rule 2)

**Area:** page-design · **Detector:** reader · **Sessions:** 100 · **Status:** active

### Wasted space · `P44`

Repeated headings and controls, unnecessary boxes and padding, or an artificially narrow reading column. Comfortable text size and contrast remain requirements.

**Look for:** generous padding, a card inside a card, a rounded box inside a full-bleed viewer; small or pale text bought for compactness

**Owner:** skills/html-style/SKILL.md (rules 6 and 7)

**Area:** page-design · **Detector:** reader · **Sessions:** 45 · **Status:** active

### Works at phone width · `P46`

Make every view work at phone width: no sideways page scroll, tables scroll inside their container under sticky headers, controls neither wrap nor shift, inputs at 16px.

**Look for:** horizontal page overflow at 390px; a control row that wraps; layout that moves when a count gains a digit

**Owner:** web-tools page-measures (npm run shot --measure) reports sideways overflow only; the rest is a reader's check

**Area:** page-design · **Detector:** reader · **Sessions:** 65 · **Status:** guidance

### Stat cards · `P48`

Tiles that put a label over a big number without the comparison, baseline or movement needed to interpret the figure.

**Look for:** stats, stat-value, a KPI grid

**Owner:** skills/html-style/SKILL.md (rule 1); page-measures

**Area:** page-design · **Detector:** measure · **Sessions:** 13 · **Status:** active

### Wordy labels · `P50`

Labels that spend several words on an action a plain word or recognizable icon could express.

**Look for:** 'Open the guide', 'Copy to stage'; a book icon followed by the word Read

**Area:** page-design · **Detector:** reader · **Sessions:** 30 · **Status:** active

### Heavy styling · `P51`

Dark tooltips and overlays, heavy outlines and saturated controls. Tooltips use the app components and remain brief, light and dismissible on touch.

**Look for:** black fills or pills, outlined buttons inside an outlined card, dark text on saturated red

**Area:** page-design · **Detector:** reader · **Sessions:** 18 · **Status:** active

### Inline expanders · `P52`

Accordions and nesting that hide list structure or interrupt reading. The list and separate detail panel used for Peeves is the preferred example.

**Look for:** sections stacked down the page; collapse and expand used to hide structure

**Area:** page-design · **Detector:** reader · **Sessions:** 21 · **Status:** active

### Internal clutter · `P54`

Opaque identifiers used as labels, export dates or internal state shown without a reader purpose, and warnings for ordinary conditions.

**Look for:** a hash or id shown as a label; 'you' in page copy; a warning for an expected state

**Area:** page-design · **Detector:** reader · **Sessions:** 7 · **Status:** active

### Instant and undoable · `P55`

Interactions respond at once and can be undone: no hover delay or long animation, tooltips dismiss, there is a way to back out, destructive clicks confirm or undo.

**Look for:** a delay before highlight; a click that deletes with no undo

**Area:** page-design · **Detector:** reader · **Sessions:** 9 · **Status:** guidance

### Crafted first drafts · `P56`

Give a first draft craft: study the app's best existing views before designing, and never ship a stock template.

**Look for:** a generic prototype layout; the dashboard template's tiles and hero

**Owner:** skills/html-style/SKILL.md

**Area:** page-design · **Detector:** reader · **Sessions:** 14 · **Status:** guidance

### Aligned icons · `P57`

Align icons, pins and highlights with the line of text beside them, and check it in a screenshot.

**Look for:** an icon sitting a pixel or two high or low against its label

**Area:** page-design · **Detector:** reader · **Sessions:** 7 · **Status:** guidance

### Hard-coded data · `P58`

Information embedded in presentation or scripts, a Markdown table parsed to recover structured rows, or stored values already available from git or the app.

**Look for:** values typed into HTML or Python; a script that parses Markdown into a table; a stored date git already has

**Owner:** web-tools docs/registries.md

**Area:** code · **Detector:** reader · **Sessions:** 25 · **Status:** active

### Forced line breaks · `P63`

Source paragraphs broken across lines at an arbitrary width. Paragraphs remain continuous; the renderer controls visual wrapping.

**Look for:** a paragraph broken across lines at a fixed width in a .md file or a PR body

**Area:** writing · **Detector:** reader · **Sessions:** 2 · **Status:** active

### Percussive negation and contrast · `P64`

Repeated denials of outcomes the reader never expected, or repeated contrasts that manufacture an alternative to reject. Percussive negation and percussive contrast spend attention on those rejected alternatives. A necessary comparison or correction can still state a contrast.

**Look for:** 'draws no underline', 'adds no claim', 'names no file', 'open no new ones', 'nothing opens it'; several in one passage; excludes have, be and there is; repeated 'not X, but Y' contrasts; rejecting an alternative the reader never raised

**Area:** writing · **Detector:** reader · **Sessions:** 5 · **Status:** active

### Compatibility clutter · `P65`

Aliases and fallbacks kept without a named dependency that requires them. An outside caller can justify compatibility. A migration names the concrete completion step that allows the old form to be removed.

**Look for:** 'still resolves' or 'keeps a saved link working' with no outside reference found; an alias or legacy fallback whose consumers are all in the estate; a removal date with no completion step

**Area:** code · **Detector:** reader · **Sessions:** 5 · **Status:** active

### List synonyms · `P66`

Calling a list a ledger, census, catalog or similar term and expecting the word to establish the list's meaning. The defined uses of registry and stream retain their existing exceptions.

**Look for:** the news ledger, a skills catalog, the census test, a branch survey; a list term implying that a list is complete, append-only or authoritative without saying so

**Owner:** docs/registries.md (registries and streams); home CLAUDE.md (name the subject, not the genre)

**Area:** naming · **Detector:** reader · **Sessions:** 14 · **Status:** active

### Modal dialogs · `P67`

Avoid modal dialogs; consider a panel-tip, the deck takeover, or another more fluid alternative.

**Look for:** showModal(), modal-box, a dimmed backdrop

**Owner:** skills/html-style/SKILL.md (rule 12)

**Area:** page-design · **Detector:** reader · **Sessions:** 8 · **Status:** active

### Smug so · `P68`

A sentence that turns on "so", presenting one cause as forcing one result.

**Look for:** 'checks passed, so there's nothing to act on'; 'the data keys stay, so no markup or coding changes'; 'that is the prose the house style rules out, so it should go'; ', so a reader can stop there'

**Owner:** docs/house-policies.md (h:smug)

**Area:** writing · **Detector:** reader · **Sessions:** 1 · **Status:** active

### Diluting the owner's message · `P69`

Edits that weaken guidance that exists to steer away from model intuition. The problem can involve removing pointed language or softening it with material that emphasizes conventional rationales that the guidance intends to de-emphasize.

**Look for:** a line that steers against model intuition, cut or reworded into a general statement, such as 'especially use of 🟢 where direction has already been set' dropped from a policy urging the assistant to proceed; a caveat, exception or conventional rationale added beside such a line that restores the intuition, such as 'acting on it waits for the owner's word'

**Area:** writing · **Detector:** reader · **Sessions:** 3 · **Status:** active

### Bare admonishment · `P70`

Direction with an unclear standard and weak support. Broad guidance can be useful when surrounded by more detailed considerations. Otherwise, a directive that points the reader back to their own judgment is typically better left unsaid.

**Look for:** directive language, often not to take some action, based on subjective judgment; a last sentence of a paragraph punctuating an idea without adding clarity

**Area:** writing · **Detector:** reader · **Sessions:** 1 · **Status:** active

### Domain page links to GitHub, chats · `P71`

A page of a domain app, an app such as budget-drs's whose subject is a field of work, linking to or referencing GitHub or a chat. This peeve does not concern the Web Tools app, which focuses on interaction with GitHub and AI.

**Look for:** a link on a domain app page that opens github.com, claude.ai or chatgpt.com; a figure's source given as a chat

**Area:** page-design · **Detector:** reader · **Sessions:** 1 · **Status:** active

## Combined entries

### Fix the sentence, add no note · `P02`

Correct a living document by fixing the sentence: the smallest edit that removes the error, with no new paragraph and no 'formerly', 'corrected' or 'superseded' note.

**Look for:** an error fix that grows the file; a sentence recording what the text used to say

**Owner:** home CLAUDE.md (status markers retired: fix the sentence)

**Area:** writing · **Detector:** reader · **Sessions:** 22 · **Status:** active · **Merged into:** P01

### Unexplained jargon · `P03`

Familiarity with a local or specialized term being assumed of the reader. An established technical term can still need an introduction.

**Look for:** a coinage or insider term (pin, hunk, emitter, the estate, guide delimiter) used without a definition

**Owner:** docs/QUALIFIED-WRITING.md (rule 2: standard terms)

**Area:** writing · **Detector:** reader · **Sessions:** 60 · **Status:** active · **Merged into:** P10

### Name the referent · `P06`

Introduce the subject before referring to it, and name the referent each time: no bare 'this', 'it', 'that one file'; each bullet must stand alone.

**Look for:** a pronoun or definite phrase whose referent is several sentences back; a bullet that only makes sense after the one before

**Owner:** docs/QUALIFIED-WRITING.md (rules 1 and 4)

**Area:** writing · **Detector:** reader · **Sessions:** 15 · **Status:** active · **Merged into:** P05

### Say a thing once · `P08`

Say a thing once: one owner per statement, linked from elsewhere, never restated in a second file, a header and its list, or a table and its caption.

**Look for:** the same claim in two documents, or in a heading and the line under it

**Owner:** web-tools docs/registries.md (one owner per assertion)

**Area:** writing · **Detector:** reader · **Sessions:** 13 · **Status:** active · **Merged into:** P01

### Retired words · `P11`

Do not use the words the owner has retired: register in a coined sense, carry as a verb for what a file holds, carrier for a data file, and tray.

**Look for:** a guidance register, a file that carries a list, a data carrier, a tray of material

**Owner:** home tools/lint-conventions.py (register coinages)

**Area:** naming · **Detector:** reader · **Sessions:** 25 · **Status:** active · **Merged into:** P10

### One name per thing · `P12`

Give one thing one name everywhere: file name, label and title match, with no aliases, exception tables or number suffixes.

**Look for:** a file called one thing and labelled another; 'v2', 'new', or a second name for an old concept

**Area:** naming · **Detector:** reader · **Sessions:** 15 · **Status:** active · **Merged into:** P10

### Literal names · `P13`

Name things for what they are, not by metaphor or vague umbrella.

**Look for:** a figurative label (rack, a spicy name) or a catch-all group label (authored) where a plain descriptive one exists

**Area:** naming · **Detector:** reader · **Sessions:** 12 · **Status:** active · **Merged into:** P10

### Link what you mention · `P24`

Link every file, PR, session or page you mention.

**Look for:** a path or PR number in prose without a link

**Owner:** docs/CONVERSATION.md (reference is a link)

**Area:** reporting · **Detector:** reader · **Sessions:** 45 · **Status:** active · **Merged into:** P23

### Shown versus inferred · `P28`

Separate what was demonstrated from what was inferred from reading code, and hedge unverified claims; do not call an assessment completed work.

**Look for:** 'works' for something only read; 'all' or 'every' without having checked

**Area:** reporting · **Detector:** reader · **Sessions:** 8 · **Status:** active · **Merged into:** P25

### Resolve open questions · `P29`

Resolve open questions wherever the evidence allows; do not hand the owner new items to review.

**Look for:** an open-questions list that grew; items the session could have settled

**Owner:** web-tools skills/tend/SKILL.md

**Area:** reporting · **Detector:** reader · **Sessions:** 11 · **Status:** active · **Merged into:** P21

### Wording diff before commit · `P30`

Show proposed wording for a doc or skill as a diff in chat, with context and a link to the file, before committing it.

**Look for:** a doc or skill edit committed without the owner seeing the wording

**Owner:** web-tools .githooks/commit-msg via skills/hooks/commit-consent.py (modified Markdown only); skills/hooks/warn-governing-docs.sh at edit time

**Area:** reporting · **Detector:** hook · **Sessions:** 40 · **Status:** active · **Merged into:** P16

### Finish in this session · `P31`

Finish what can be finished in this session; do not defer it to a later session, a follow-up, or someone else.

**Look for:** 'left for a follow-up', 'out of scope', 'not mine to land' for work the session could do

**Area:** process · **Detector:** reader · **Sessions:** 70 · **Status:** active · **Merged into:** P38

### No unrequested tasks · `P32`

Do not file a tracker task unless the owner asks for one.

**Look for:** a new task file the owner did not endorse

**Owner:** web-tools skills/tasks/SKILL.md

**Area:** process · **Detector:** reader · **Sessions:** 18 · **Status:** active · **Merged into:** P16

### No unasked deletions · `P37`

Do not propose deleting a feature, page or branch unless its removal was clearly intended.

**Look for:** a cleanup that removes working features

**Area:** process · **Detector:** reader · **Sessions:** 4 · **Status:** active · **Merged into:** P16

### Try another route · `P41`

When a tool or PR route fails, try another route before reporting it blocked.

**Look for:** 'could not create the PR' after one failed call

**Area:** git-pr · **Detector:** reader · **Sessions:** 5 · **Status:** active · **Merged into:** P38

### No repeats or dead weight · `P43`

Remove what repeats or carries no use: a header that restates the tab, count badges on tabs, duplicate buttons, filters and pills nobody needs.

**Look for:** a heading echoing the selected tab; a count on every tab; two controls for one action

**Area:** page-design · **Detector:** reader · **Sessions:** 50 · **Status:** active · **Merged into:** P44

### Reuse app components · `P45`

Reuse the app's components and conventions (viewer, swipe deck, tooltip kits, toggles, tabs), and show content in the app's own viewer, keeping the GitHub link a view carries.

**Look for:** a one-off control where a kit exists; a link out where the viewer could show the file

**Owner:** skills/html-style/SKILL.md; docs/APP.md (every new view carries its GitHub link)

**Area:** page-design · **Detector:** reader · **Sessions:** 55 · **Status:** active · **Merged into:** P33

### Full width · `P47`

Use the full width; never narrow text to a reading column or a centered corridor.

**Look for:** max-w-prose, max-w-2xl to 4xl, container mx-auto, a ch cap

**Owner:** skills/html-style/SKILL.md (rule 3); the reading-column hook refuses class caps at edit time, and misses caps in CSS or written through the shell

**Area:** page-design · **Detector:** hook · **Sessions:** 16 · **Status:** active · **Merged into:** P44

### Built tooltips only · `P49`

Tooltips: never a fact in a title attribute, and never a daisyUI tooltip, data-tip or question-mark cursor; use the title-tip or panel-tip kit, a few words, light, closing on tap.

**Look for:** title=, data-tip, cursor-help, a dark tooltip, a tooltip paragraph

**Owner:** skills/html-style/SKILL.md (rule 10); npm run stranded-titles lists facts parked in a title, advisory

**Area:** page-design · **Detector:** reader · **Sessions:** 35 · **Status:** active · **Merged into:** P51

### Views inside the app · `P53`

Show new views inside the app shell at their route, and put findings in data the app displays, not in a standalone page or a Markdown report.

**Look for:** a standalone HTML page for something that belongs in a view; findings left only in a .md file

**Owner:** web-tools docs/APP.md

**Area:** page-design · **Detector:** reader · **Sessions:** 15 · **Status:** active · **Merged into:** P33

### Few short comments · `P60`

Keep code comments short and few.

**Look for:** long comment blocks explaining code that reads plainly

**Area:** code · **Detector:** reader · **Sessions:** 4 · **Status:** active · **Merged into:** P01

### Links land on the item · `P62`

A link lands on the specific item it names, and its text says what that item is.

**Look for:** a link that opens a tab or a document top instead of the item; the same generic link text repeated; a link whose text does not name its target

**Area:** page-design · **Detector:** reader · **Sessions:** 5 · **Status:** active · **Merged into:** P23
