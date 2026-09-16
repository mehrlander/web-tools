# Paragraph rewrite proposals

Overnight deliverable from **Chief of Staff (Grok)** (signed **2026-09-16**).

## What this is

A complete inventory of blank-line-separated paragraphs across every `.md` file on `main`, plus half-length rewrite proposals for a large share of verbose live (non-archive) prose.

**Live documentation is not edited in place.** Everything here is reviewable proposal material.

## Layout

| Path | Role |
|------|------|
| `inventory.jsonl` | One JSON object per paragraph (original + optional draft) |
| `inventory-parts/` | Same inventory split for transport; `cat` in order equals `inventory.jsonl` |
| `SUMMARY.md` | Counts, ratios, top unrewritten longs |
| `by-file/*.md` | Human review: original vs proposed, per source file |
| `README.md` | This file |
| `assemble-inventory.sh` | `cat inventory-parts/part-*.jsonl > inventory.jsonl` |

## Quick stats

- **314** markdown files
- **9081** paragraph blocks
- **2275** rewritten (avg ratio **0.543**)
- Agent: `Chief of Staff (Grok)` · `2026-09-16`

## Review workflow

1. Read `SUMMARY.md` for coverage.
2. Open `by-file/` entries for docs you care about (start with `docs__show-repo.md`, `docs__SNAGS.md`, `docs__stage.md`, `README.md`).
3. Cherry-pick accepted drafts into a follow-up docs PR.

## Assemble inventory from parts (if needed)

```bash
cd docs/paragraph-rewrites && bash assemble-inventory.sh
# or: cat inventory-parts/part-*.jsonl > inventory.jsonl
```
