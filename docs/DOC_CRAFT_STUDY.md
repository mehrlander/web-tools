# Technical Documentation Audit: Analysis of Model-Authored Text

**Scope:** `mehrlander/web-tools`, `mehrlander/home`, `mehrlander/web-tools-private`  
**Date:** 2026-09-19  
**Status:** Historical exploratory analysis; drafting principles superseded  

**2026-09-23 update:** The proposed rules in section 4 and the original specimen rewrites are retained as a record of the investigation. They are superseded by [Doc Craft](../skills/doc-craft/SKILL.md), which uses document classification, integrated edits, actionable rationale, and observable verification without mandatory genre frontmatter or the ORIT retention gate.

---

## 1. Background & Scope of Inquiry

This audit examines recurring problems in documentation written by or with large language models (specifically Claude) across three repositories. The primary complaints driving this work are:
1. **Tone and angle:** Documentation frequently adopts a discursive, pedagogical, or conversational tone rather than acting as a direct technical specification.
2. **Post-struggle narratives:** Authorship struggle, past grep errors, dead ends, and prior drafts are often written directly into living specifications.
3. **Dogmatic rules from local bugs:** Transient vendor quirks or unexplained crashes are frequently generalized into sweeping prohibitions (*"Never do X"*).
4. **Coined slang:** Colloquial or metaphorical terminology is sometimes used in place of precise state or data descriptions.

---

## 2. Methodological Evolution & Retractions

### Retraction of Initial Quantitative Claims
An initial script (`tools/adjudicate.py`) claimed to classify 361 flagged passages into "refutations" and "confirmed pathologies." This script relied on hardcoded string whitelists (`SOUND_GUARDRAILS = ['rev-parse head', ...]`) chosen after manually browsing candidate matches. 

Because the classification rules were derived from the evaluated data and hardcoded into the filter, the reported numbers (such as an "89.2% refutation rate") were circular artifacts of target leakage. Those quantitative claims are retracted.

### Boundary of Lexical Matching (Negative Control Results)
To measure what simple regular expressions can and cannot detect, the candidate search patterns were run against 1,288 lines of reference text from RFC 2119, PEP 8, PEP 20, and the Git rebase manual (`git-rebase.adoc`).

- **`POST_STRUGGLE_EXHALE`** (narrating past debug struggles): 0 hits across reference docs.
- **`LITERARY_APHORISM`** (metaphorical slang): 0 hits across reference docs (though note that searching for specific slang tokens tests token identity, not the broader concept of ungrounded mottos).
- **`SWEEPING_MAXIM`** (`never`): 1 false positive on PEP 20 (*"Errors should never pass silently"*).
- **`THEATRICAL_PATTER`** (`worth noting`): 1 false positive on PEP 8 (*"it's worth noting that..."*).

**Result:** Simple lexical pattern matching can surface candidates for review, but cannot determine whether a statement is an unwarranted generalization or an actual invariant without human or contextual evaluation.

---

## 3. Case Studies in Living Documents

Detailed examination of three specific files identified distinct drafting issues:

### 1. Palimpsest / Debugging Narrative: `web-tools/docs/APP.md`
- **Location:** Lines 41–96 (approximately 55 lines).
- **Issue:** The document argues with its own past revisions from 2026-08-27 and 2026-09-08, detailing why previous sentences were wrong, how an earlier grep command missed 608 commits, and why renaming costs were misjudged.
- **Impact:** An architectural specification intended to define current system structure is instead dominated by authorial history. Downstream readers and tools must parse dead debates to find active invariants.
- **Remedy:** Move the historical deliberation to a dated record (`chron/`) and state the active naming rules directly in a table.

### 2. Generalizing from an Edge Case: `web-tools/docs/showing.md`
- **Location:** Lines 62–66.
- **Issue:** The document states: *"Never pin both documents... on an iPhone that kills Safari's web process on the first tap of the FAB... Measured, not explained."*
- **Impact:** A specific, uninvestigated WebKit mobile browser crash was elevated into a permanent, unqualified negative rule (*"Never"*).
- **Remedy:** Convert the categorical ban into an explicit limitation note specifying the trigger (`?use=` plus `@ref`), the failure mode (WebKit mobile process crash), and the boundary (mobile Safari viewports).

### 3. Jargon Inflation: `web-tools/docs/github/post-merge-branch-mutation.md`
- **Location:** Lines 42–86.
- **Issue:** Half of the document defines coined slang (*"necromerging"*, *"zombie branch"*, *"ancestral vandalism"*, *"merge-termath"*) alongside conversational aphorisms (*"A branch is a workbench, not a second home"*).
- **Impact:** Colloquial labels substitute for precise descriptions of Git ref mutability and pull request lifecycle states.
- **Remedy:** Replace the glossary with a standard 3-state lifecycle diagram (`Active -> Integrated -> Deleted`) and explicit command sequences for post-merge updates.

---

## 4. Proposed Drafting Principles (`doc-craft v2`)

The following structural rules were formulated to constrain model-authored documentation:

1. **Genre Separation:**
   - **Living specifications (`genre: living`):** Present tense only. State what the system currently is and does. Exclude dates, past grep counts, and authorial struggle.
   - **Historical records (`genre: record`):** Dated, immutable logs (`chron/`, postmortems) where debugging history and decision records belong.
   - **Standoff references:** Living specs may include at most a single link to a dated record for provenance.

2. **The Operational Regression & Invariant Test (ORIT):**
   A sentence in a living specification is justified if cutting it increases the risk of an engineer or agent:
   - Violating an unenforced runtime invariant.
   - Breaking an architectural boundary or layer.
   - Re-introducing a known, measured bug.
   - Running an unsafe or breaking operational command.  
   Sentences that exist only for conversational cushioning, throat-clearing, or personal reflection fail this test and should be excised.

3. **Conditional Failure Form:**
   Avoid blanket prohibitions. State negative rules with:
   - The specific trigger condition.
   - The observed runtime or environment failure.
   - The operational boundary or workaround.

---

## 5. Known Limitations & Unresolved Questions

1. **Instrument Blindness:** Running `audit.py` (TF-IDF and literal counting) on `APP.md` reported zero redundancy. Deterministic word-overlap tools cannot detect palimpsestic narrative because the paragraphs discuss different dates and files with low lexical reuse.
2. **Local Model Availability:** The local Ollama installation currently fails on inference due to a missing runner binary (`llama-server.exe`). Any workflow assuming local open-weight model evaluation on this machine is currently inoperable.
3. **Behavioral Transfer:** Formatting these rules in `SKILL.md` does not guarantee that an LLM will adhere to them consistently in complex sessions. Model behavior under these constraints requires empirical validation across real documentation tasks.
