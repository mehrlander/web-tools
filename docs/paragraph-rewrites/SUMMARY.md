# Paragraph rewrite SUMMARY

**Agent:** Chief of Staff (Grok)  
**Signed:** 2026-09-16  
**Branch intent:** proposal artifacts only under `docs/paragraph-rewrites/` (live docs untouched)

## Counts

| Metric | Value |
|--------|------:|
| `.md` files inventoried | 314 |
| Paragraph blocks inventoried | 9081 |
| Files with ≥1 draft | 240 |
| Paragraphs rewritten | 2275 |
| Average draft/original word ratio | 0.543 |
| Rewrites in 40–60% band | ~66% of drafts |
| Archive paragraphs (inventoried; drafts deprioritized) | included (rewrites left null) |

See this file on the branch for full tables (priority/kind breakdown, attack-first counts, top unre written longs).

## How to review

1. Skim `by-file/*.md` for human-readable original vs proposed pairs.
2. Filter `inventory.jsonl` where `draft != null` and `priority == "high"`.
3. Accept by editing the live doc in a follow-up PR; this PR only lands proposals.

## Method notes

- Paragraph = blank-line-separated block; fenced code and YAML frontmatter skipped.
- Priority: high if words≥80 or (`docs/**` and words≥50); medium if words≥40; else low.
- Rewrites target ~half length (40–60%), keep links/identifiers, full sentences.
- Automated condensation for live high/medium prose, plus manual quality pass on `docs/SURFACING.md` and `docs/QUALIFIED-WRITING.md`.
