---
name: doc-audit
description: "Summoned when someone wants a document's wording checked sentence by sentence before approving it, to see which sentences are weak or wrong and the shortest fix for each. Not for shortening a document; use reduction-panel."
---

# Document Audit

## Premise

An owner approving a document reads it one sentence at a time, and many objections are to wording: a phrase without a referent, a term a general reader does not know, a claim stronger than the document supports. Readers working in parallel can make that pass first, every sentence read twice, and `pages/audit-render.html` lets the owner step through what they flagged and record a verdict on each unit. The readers propose; the owner decides. Family: text processing.

## Goal and output

One `audit/1` payload per document, to the contract in [`docs/envelopes/audit.md`](https://github.com/mehrlander/web-tools/blob/main/docs/envelopes/audit.md), with [`vocab.tsv`](vocab.tsv) as its vocabulary: every unit labeled OK, WEAK or WRONG with a KEEP or DROP verdict, and each flag with a note giving the shortest fix. It is handed over as a link that opens the page on Review, with the findings no unit label can hold listed beside it.

## Process

Run the commands from a web-tools checkout, with `S` set to this skill's folder (`skills/doc-audit` there, `${CLAUDE_PLUGIN_ROOT}/doc-audit` under the plugin) and `RUN` to a new directory outside any repo. Without a checkout, fetch `segment.py`, `audit-payload.py`, `ops.py` and `materialize.py` from `https://raw.githubusercontent.com/mehrlander/web-tools/main/python/annotate/`; each uses only the standard library.

1. **Fix the document.** Copy it, at the revision to be approved, into `$RUN` under its own file name, which becomes the payload's title, and segment it: `python3 python/annotate/segment.py $RUN/<name>.md 1 <last line> > $RUN/units.jsonl`.
2. **Slice it.** `python3 $S/scripts/run.py slices $RUN` writes `slice-A.tsv` and `slice-B.tsv`, two halves of equal word count.
3. **Read it.** Start five Sonnet agents in one round. Four take a half each, two per half: each gets the whole document, its slice, `vocab.tsv` and the reader brief below, and writes `$RUN/read-<half>-<n>.tsv`. The fifth reads the whole document for findings that span units (one thing under two names, a rule stated twice, a passage in the wrong section) and returns a numbered list, each item naming its uids. In the same round, run the `peeves-critic` agent over the document.
4. **Merge.** `python3 $S/scripts/run.py merge $RUN` writes `labels.tsv` and `notes.json`. A unit both readers flag takes the more confident reader's label, and DROP only if both said DROP; a unit one reader flags stays OK and keeps that reader's note.
5. **Build the payload.**
   ```
   python3 python/annotate/audit-payload.py standoff $RUN/<name>.md $RUN --vocab $S/vocab.tsv --question "is this unit's wording weak or wrong?" --addr <owner/repo@ref:path>
   python3 python/annotate/ops.py $RUN/standoff.json $RUN/notes.json $RUN/<name>.md --write
   python3 python/annotate/audit-payload.py payload $RUN/<name>.md $RUN > $RUN/payload.json
   ```
6. **Check provenance.** For each DROP, and each note that cuts a phrase, run `python3 $S/scripts/run.py provenance <sessions-store> "<phrase>"`, where the store is the checkout the `sessions` skill attaches, and read its top hits.
7. **Hand it over.** `python3 $S/scripts/run.py link $RUN/payload.json` prints the link. Hand it over as `⭐ [Document audit: <document>](<url>)`, followed by the fifth reader's findings, the peeves-critic's, and any provenance match.
8. **Apply the review.** The owner's verdicts return as the patch the page's patch dialog copies or downloads, or in chat. `python3 python/annotate/ops.py $RUN/standoff.json <patch.json> $RUN/<name>.md --write` applies a patch. `python3 python/annotate/materialize.py $RUN/standoff.json $RUN/<name>.md --out <draft.md>` then removes the DROP units and lists each kept unit's note as the brief for the rewrite.

## The reader brief

Give each half-reader this, with the paths filled in.

> Read all of DOC, then label each row of SLICE in a TSV with a header row and the columns `uid label verdict confidence note`, one row per unit. Write it to OUT and change nothing in DOC.
> - `label` is one of VOCAB's: OK, WEAK (unclear, hard to read, or unneeded) or WRONG (false, or stronger than the document supports). If the fix would change what the sentence claims, the label is WRONG; otherwise it is WEAK.
> - Judge by doc-craft's General Principles (`skills/doc-craft/SKILL.md`) and the Qualified writing rules (`docs/QUALIFIED-WRITING.md`). A term DOC defines elsewhere is not unexplained.
> - `verdict` is DROP when DOC reads as well without the unit, otherwise KEEP.
> - `confidence` is high or low.
> - `note`, on a WEAK or WRONG unit only: the words at fault in quotes, the flaw in a few words, then the shortest wording that fixes it, or "Cut." Prefer cutting a phrase to qualifying it. One line, no tabs.

## Key insights

- **A flag is a proposal.** The readers' labels, notes and DROP verdicts propose; the owner's verdicts in the page decide. The document stays unchanged until the owner has walked the audit.
- **A label needs both readers**, which keeps the Review list to the units worth the owner's time.
- **The shortest fix.** Readers asked for a plain register lengthen most sentences they touch, which is why the brief asks for the shortest wording and prefers a cut.
- **Provenance before a cut.** A phrase a reader would cut may be the owner's own, reworded by a session, so an exact-phrase search misses it; `run.py provenance` matches the phrase's rarer words by stem.
- **The peeves check predicts the owner.** The `peeves-critic` agent predicted the objections a read of the owner's recorded prompts found. Use the prompt history for provenance, not for prediction.
- **Findings across units go beside the link.** A unit's label cannot say that two units name one thing differently. The fifth reader's list holds those, each item naming its uids so the owner can find them in the page.

## Bundled

- [`vocab.tsv`](vocab.tsv): the three labels with their definitions and colours, passed to `audit-payload.py` and to each reader.
- [`scripts/run.py`](scripts/run.py): `slices`, `merge`, `link` and `provenance`. Its docstring states the merge rule and the reader file's columns.
- [`references/shorter.json`](references/shorter.json): the worked example, a run of this skill over `docs/envelopes/shorter.md` by readers that had not seen it. Open it at `https://mehrlander.github.io/web-tools/pages/toss-render.html#audit=mehrlander/web-tools:skills/doc-audit/references/shorter.json`.
