# Peeve names and consolidation proposal

The owner's peeves should name memorable annoyances. The proposed list has 24 core entries and nine secondary entries, reduced from the earlier proposal's 37 entries. Eight existing entries become examples or working guidance. The proposal covers all 66 existing peeves and incorporates the owner's review on 27 October 2026. The branch's [peeve list](../skills/peeves/peeves.csv) and Map preview apply the proposed names and groupings for review.

## Core list

Core entries combine recurrent concerns with the priorities the owner emphasized in the review. The labels name the disliked behavior; the descriptions preserve the scope a reviewer needs.

| Proposed name | Existing entries | What earns the name |
| --- | --- | --- |
| Documentation bloat | P01, P02, P08, P60 | Instructions growing through rationale, duplicated claims, correction notes and comments that explain readable code. |
| Explanatory prose | P42 | Pages spending space explaining their purpose or controls when the structure and labels could make the purpose clear. |
| Invented terminology | P10, P12, P13 | Coined categories, metaphorical names and competing names for the same subject. Name drift stays recognizable as a case within the entry. |
| List synonyms | P66 | Calling a list a ledger, census, catalog or similar term and expecting the word to establish the list's meaning. The defined uses of registry and stream retain their existing exceptions. |
| Unexplained jargon | P03 | Familiarity with a local or specialized term being assumed of the reader. An established technical term can still need an introduction. |
| Vague writing | P05, P06 | Claims a reader cannot check, unnamed subjects and pronouns whose referents the reader has to recover. |
| Missing context | P14 | Summaries that assume the reader followed the session, already understands the subject or authored pasted material. |
| Rambling replies | P15, P17 | Buried conclusions, side issues and detail that distracts from the owner's question. |
| Lazy questions | P21, P29 | Asking the owner to inspect available evidence, settle a question the assistant can resolve or approve an already agreed next step. |
| Option menus | P22 | Handing the owner choices without the assessment and recommendation needed to decide. |
| Unapproved changes | P16, P30, P32, P37 | Treating a request to discuss as permission to act, or widening approved work into wording changes, tasks or removals the owner did not authorize. |
| Unfinished work | P31, P38, P41 | Leaving feasible work for another session, stopping before an authorized merge or declaring a tool failure after trying one route. |
| Untested claims | P25, P28 | Reporting an inferred result as demonstrated, handing over an unexamined screenshot or proposing a fix before checking the cause. |
| Missing or misplaced links | P23, P24, P62 | References without usable links, render links that miss the changed view and links that stop short of the named item. |
| Reinventing the wheel | P33, P45, P53 | Adding a mechanism, category or separate interface when an existing one serves the job. One-off interfaces is the memorable UI case: bypassing the app shell, viewer or shared component. |
| Wasted space | P43, P44, P47 | Repeated headings and controls, unnecessary boxes and padding, or an artificially narrow reading column. Comfortable text size and contrast remain requirements. |
| Heavy styling | P49, P51 | Dark tooltips and overlays, heavy outlines and saturated controls. Tooltip construction remains governed by the component guidance. |
| Wordy labels | P50 | Labels that spend several words on an action a plain word or recognizable icon could express. |
| Inline expanders | P52 | Accordion rows and nesting that hide list structure or interrupt reading. The list and separate detail panel used for Peeves is the preferred example. |
| Hard-coded data | P58 | Information embedded in presentation or scripts, a Markdown table parsed to recover structured rows, or stored values already available from git or the app. |
| Forced line breaks | P63 | Source paragraphs broken across lines at an arbitrary width. Paragraphs remain continuous; the renderer controls visual wrapping. |
| Percussive negation and contrast | P64; contrast added in this review | Repeated denials of outcomes the reader never expected, or repeated contrasts that manufacture an alternative to reject. Keep the two patterns identifiable: percussive negation and percussive contrast. |
| Em dashes | P07 | Dashes used to join ideas in prose. The existing entry also covers en dashes and double hyphens used for that purpose. |
| PR babysitting | P39 | Timed check-ins and redundant status messages about unchanged PR or CI state. A new failure, review or merge can warrant a message. |

## Secondary list

Secondary entries have narrower scope or lower priority in this review. Their evidence supports keeping the concern available, even where the proposed short label needs more care.

| Proposed name | Existing entries | Scope and reason to keep |
| --- | --- | --- |
| Shallow defense | P18 | Treating an available rationale, measurement or precedent as sufficient to dismiss the owner's challenge. A choice can have justification and still be poor. Entertain the criticism, examine the tradeoff and change the choice when warranted. The old label, Concede and fix, overstates the case for automatic agreement. |
| Dramatic prose | P04 | Slogans, posturing, emphatic absolutes and sentences that sound profound while saying little. Wider than the repeated negation and contrast patterns. |
| Unclear status | P20, P27, P40 | Closings or PR descriptions that misstate what is finished, open, merged or verified on the current commit. P20's repeated-event-message example belongs under PR babysitting. |
| Missing attribution | P09 | A borrowed idea presented as the project's own view, or analysis presented as an authoritative verdict. A working link alone does not establish attribution. |
| Compatibility clutter | P65 | Aliases and fallbacks kept without a named dependency that requires them. A distinct, recently repeated concern: an outside caller can justify compatibility, and a migration can name a concrete completion step. |
| Stat cards | P48 | Label-over-big-number tiles. Keep the recognizable complaint separate from heavy styling, since pale stat cards can still trip the concern. |
| Bossy handoffs | P36 | Prompts to another session that prescribe a solution or rank options beyond the aim and necessary context. |
| Internal clutter | P54 | Opaque identifiers used as labels and warnings for ordinary conditions. The saved examples give less support to the entry's broader ban on second-person page text. |
| Extra setup | P19, P59, P61 | Delivery that makes the owner download short copyable text, assemble patch fragments or save and configure a script intended to run directly in the PowerShell ISE. |

## Further consolidations

Four consolidations reduce the earlier proposal from 37 named entries to 33. The contrast pattern joins the existing negation entry, so the new concern does not add another entry.

| Earlier entries | Proposed home | Reason |
| --- | --- | --- |
| Repetition | Documentation bloat; Wasted space | P08 concerns duplicated statements; P43 concerns redundant UI. Each has a concrete home and examples, making a third generic entry unnecessary. |
| Name drift | Invented terminology | P10 already flags two names for one concept. P12 adds the file-name, label and title consistency case. |
| Overengineering; One-off interfaces | Reinventing the wheel | P33, P45 and P53 share the failure to reuse a suitable mechanism. P34's broader cleanup discipline becomes working guidance below. |
| File cards; Extra setup | Extra setup | P19, P59 and P61 describe delivery choices that make a small handover require extra operations. |

Some related complaints deserve separate names. List synonyms is an explicit and repeated dislike; unexplained jargon can involve entirely standard terms. Explanatory prose on a page has a different scope from documentation bloat. Lazy questions and option menus fail at different points: the first delegates work the assistant can do, while the second withholds the assessment an actual owner decision needs.

## Examples and working guidance

These eight existing entries retain useful material, with the narrower treatment below. Their retirement as standalone peeves would require approval alongside the new list.

| Existing entry | Proposed treatment | Evidence or scope concern |
| --- | --- | --- |
| P11 Retired words | Examples under Invented terminology and the applicable writing guidance. | A changing prohibited-word list is less memorable than the recurring naming failure. Preserve the specific corrections where they govern wording. |
| P26 Three options for a visual choice | Contextual visual-review procedure. | Requests for several examples support showing alternatives when a visual decision is open; they establish less about a universal count. |
| P34 Reduce when cleaning up | Cleanup guidance; reuse examples under Reinventing the wheel. | The entry combines reuse, speculative guards and unrequested scope expansion. Keep the cleanup procedure without stretching the wheel label across every clause. |
| P35 Read the guide first | Session preparation and verification procedure. | Reading the current instructions is a means of avoiding several peeves. |
| P46 Works at phone width | Responsive-design requirements and checks. | Overflow, input zoom, sticky headers and moving controls are distinct failures. Preserve the requirements in the design guidance. |
| P55 Instant and undoable | Separate response-time and recovery requirements in interaction guidance. | Delay and inability to back out have different causes and checks. |
| P56 Crafted first drafts | Design-review procedure. | The saved complaints about weak drafts support studying good existing views; they establish less about a universal ban on templates. |
| P57 Aligned icons | Screenshot review and visual checks. | A concrete defect that fits the visual checking procedure. |

P11 supplies examples for a retained entry; the other seven entries supply working guidance. Each existing ID has one primary assignment across the three lists above.

## Wording and evidence to review

The active list and the private [supporting evidence](https://github.com/mehrlander/web-tools-private/blob/main/sessions/peeves/evidence.csv) were read for this assessment: 66 entries and 190 excerpts from 142 distinct recorded sessions. The public `sessions` values are approximate frequency estimates. Counts for consolidated entries should be recomputed from distinct sessions rather than added together. Core and secondary are judgments about usefulness and priority, with the owner's latest emphasis carrying weight beyond the counts.

The latest review directly strengthens Lazy questions, PR babysitting, One-off interfaces, Wordy labels, Heavy styling, Hard-coded data, Forced line breaks and Em dashes. The review supplies the names Percussive negation and Percussive contrast, and the more careful meaning of Shallow defense. Contrast is a new proposed extension; P64's existing evidence concerns negation. A necessary comparison or correction can still use a contrast.

Several active descriptions need narrowing when the names are implemented. P42's exception for Map-tab introductory prose should be checked against the current About presentation. P52 combines section navigation with inline disclosure; the proposed name concerns inline expanders, and the owner's current preference favors separate detail. P54's screen-copy claims extend beyond its clearest examples. P58 supports structured data and avoiding duplicate storage more directly than a universal objection to every JSON file.

## References and implementation

A document reference identifies where a preference is written. Whether the preference has been addressed in a particular feature requires evidence about that feature. A blank reference therefore leaves the documentation question open; an existing reference establishes where to read the rule. The Peeves detail panel can show those references without treating their presence as a resolution status.

The branch retains all 66 stable peeve IDs. Each absorbed row names its retained entry through `merged_into`, and `tier` places retained entries in the core or secondary group. Seven guidance rows remain outside the short list. The Map combines source examples, document references and private quotes under the retained entry, and searching an absorbed ID finds that entry. The private quotes stay in the private repository. Merging the branch would apply the reviewed list to the live app and skill.
