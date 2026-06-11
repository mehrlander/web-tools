# Research Findings

This directory contains deep research on each of the core questions for the Wring project.

## Structure

**Start here:** [`FINDINGS.md`](FINDINGS.md) is the consolidated synthesis across all
research areas — read it first for the distilled conclusions. [`FirstReview.md`](FirstReview.md)
captures the critical review that fed the Sequitur + Bookend Merge pivot now described
in [`ARCHITECTURE.md`](../../ARCHITECTURE.md).

Each research question then has its own folder:

1. **01-tokenization-typing/** - What representation best supports template discovery?
2. **02-repeat-primitives/** - Which primitives yield high-signal candidates while avoiding pattern explosion?
3. **03-template-formation/** - How to convert repeated spans into parameterized templates?
4. **04-objective-selection/** - What scoring and selection regime works in practice?
5. **05-adjacent-domains/** - Which existing solutions apply and what adaptations are needed?
6. **06-implementation/** - JS/WASM architecture for practical use

Each folder contains:
- **question.md** - The focused research question posed to AI deep research engines
- **gemini-report.md**, **gpt-report.md** - The raw reports collected back (01-05)
- **distilled.md** - The findings distilled for that question (01-05)

Folders 01-05 are complete (question + reports + distilled). 06-implementation is
question-only so far.

## Usage

### Querying AI Engines

Each `question.md` file is designed to be provided to AI deep research engines along with the main README.md. The questions reference the project README for full context.

**Example workflow:**
```bash
# Provide both files to get focused research
cat README.md docs/research/01-tokenization-typing/question.md | [ai-engine]
```

### Recording Findings

Research reports should be added to the appropriate question folder. Later, findings will be distilled and organized separately from the question files.

### Cross-references

When findings in one area inform another, add cross-references between folders:
```markdown
See also: [Research Question 3: Template Formation](../03-template-formation/)
```

## Status

Questions 01-05 have been researched and distilled, and their conclusions are
consolidated in [`FINDINGS.md`](FINDINGS.md). Question 06 (implementation) remains
open as a question only. The research has already been acted on: it produced the
Sequitur + Bookend Merge architecture that [`ARCHITECTURE.md`](../../ARCHITECTURE.md)
now describes and the code implements.
