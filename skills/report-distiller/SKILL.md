---
name: report-distiller
description: "Distill research documents, reports, white papers, and academic papers into a structured summary following a specific analytical framework. Use this skill whenever a user shares a document (PDF, paste, or link) and asks for a summary, distillation, overview, analysis, or review, especially for research, policy, technical, or academic documents. Also trigger when users say \"summarize this\", \"what does this say\", \"give me the key points\", \"digest this for me\", or anything implying they want to understand a document without reading it in full. This skill produces a specific, opinionated output format, not a generic summary."
---

# Report Distiller

Produce a structured distillation of a research document following the framework below. Each section has a defined purpose and style. Take the document's full measure before writing any of it.

---

## Output Structure

### 1. Quick Read Header

Open with:

> **Quick Read:** *[Document Title]*

One topic sentence follows. It frames and characterizes the document: not just what it covers, but what kind of thing it is and what it is trying to do. (Is it a framework paper? An empirical study? A position argument? A vendor pitch dressed as research?) This sentence is the hardest one to write and the most important.

---

### 2. Questions Block

A short bulleted list of italicized questions the document addresses. These are the questions the reader would bring to the document. Derive them from the document's actual structure and claims, not from the title alone.

Each question may carry inline tags:

- **Coverage %**: estimated share of the source document devoted to this question. Rough is fine; the purpose is to signal weight, not precision.
- **Format tags**: single words signaling what kind of content addresses this question: `tables`, `code`, `figures`, `case studies`
- **Editorial tags**: honest judgment: `useful`, `fluffy`, `esoteric`, `preliminary`, `contested`, `well-sourced`

Tags stack. Example:

> - *How does the proposed method compare to baselines?* [35%, tables, useful]
> - *What are the theoretical foundations?* [10%, esoteric, preliminary]

---

### 3. Labeled Slots

Three labeled sections, each on its own line:

**Insights:** Numbered list. One sentence each. Each insight has an italic inline header: a short label that names what kind of insight it is before the sentence lands. The best insights answer the document's central question, but let's be honest.  Sometimes it wasn't the right question. A helpful redirect or compelling aside can earn its place.

Example format:
> 1. *Threshold effect:* The gains concentrate sharply above a context window of 32k tokens, below which the method underperforms vanilla retrieval.

**Alternate Titles:** Two to four alternatives. These are the angles the official title ducked. Livelier, more specific, or more honest. At least one should name the document's actual argument rather than its subject.

**TL;DR:** One or two sentences. Can be wry, sardonic, or mildly rude. Should be memorable. If the document oversells its contribution, the TL;DR can say so.

---

### 4. Key References

A dense short paragraph. Not a glossary. Terms appear **bolded on first introduction** within the paragraph. Organize terms by the questions they serve, following the order those questions appeared in the Questions block. Where a term is specific to this document or implementation (not field-standard), note that provenance.

Aim for 80–150 words. The goal is to give a reader the vocabulary to navigate the document, not to define every term.

---

### 5. Section Summary

Track the document's own structure, section by section.  Draw on Swales' rhetorical moves framework and Graff & Birkenstein's They Say / I Say. 

Some moves to name:
- Establishing a territory / staking a claim
- Planting a problem the document will pay off later
- Hedging a claim the authors know is vulnerable
- Handling an objection the authors knew was coming
- Committing to a method or scope
- Delivering the key finding
- Retreating to future work

Sections that carry weight get room. Gloss weak sections so we at least know what it's about and why it was included.  Introduce new terms on first use.

---

## Writing Principles

These apply throughout as a governing disposition.

**No em dashes.** Use periods. Use colons where structure is needed. Em dashes are a crutch.

**Support claims rather than layering on new ones.** After a claim, provide evidence or elaboration, not another claim.  Justify the thought, build a case.  Slow down when something matters. Let one claim stand on its legs before the next one arrives.

**Introduce before you use.** A term or concept must be named and briefly defined before it appears in a sentence that depends on it. This is the cardinal rule. The reader should never have to hold an undefined term in working memory while parsing the sentence that uses it. Introduce, then proceed.

**Sentences are short and discrete.** Each sentence completes a thought. Not every sentence must be terse, some claims need a clause, but the default is short. A string of short sentences often produces more clarity than one long one, and more rhythm.

**Language acts.** Every sentence is a speech act: it asserts, concedes, warns, commits, or qualifies. Know which one you are doing. If you cannot name the move, the sentence probably isn't earning its place.

---

## Edge Cases

**Very short documents (under 2 pages):** Collapse Questions and Labeled Slots into a single condensed block. Skip Key References if the vocabulary burden is low. Section Summary covers the whole document in a paragraph.

**Highly technical documents:** The Questions block and Key References matter most. Take extra care with the one-sentence glosses in Section Summary: introduce and define before proceeding.

**Vendor or advocacy documents:** The TL;DR can be more pointed. The Alternate Titles block should include at least one that names the persuasive intent ("Why You Should Buy Our Platform").

**Documents with no clear sections:** In Section Summary, construct your own structure based on the rhetorical arc. Note that the document lacks explicit structure.