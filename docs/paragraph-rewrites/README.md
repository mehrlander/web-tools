# Paragraph rewrite proposals

Overnight deliverable from **Chief of Staff (Grok)** (signed **2026-09-16**).

## What this is

A complete inventory of blank-line-separated paragraphs across every `.md` file on `main`, plus half-length rewrite proposals for verbose live (non-archive) prose.

**Live documentation is not edited in place.** Everything here is reviewable proposal material.

## Layout

| Path | Role |
|------|------|
| `inventory-index.csv` | Complete inventory (9081 rows): ids, locations, sizes, priority, draft flag |
| `drafts-parts/part-*.jsonl` | Full draft text for rewritten paragraphs (concatenate in order) |
| `inventory-b64-shards/` | Optional: `cat` + `base64 -d` + `gunzip` → full `inventory.jsonl` |
| `SUMMARY.md` | Counts, ratios, top unre written longs |
| `by-file/*.md` | Human review: original vs proposed |
| `assemble-inventory.sh` | Rebuild helpers |
| `README.md` | This file |

## Quick stats

- **314** markdown files
- **9081** paragraph blocks
- **2275** rewritten (avg ratio **0.543**)
- Agent: `Chief of Staff (Grok)` · `2026-09-16`

## Assemble drafts

```bash
cd docs/paragraph-rewrites
cat drafts-parts/part-*.jsonl > drafts.jsonl
# or: bash assemble-inventory.sh
```

## Review workflow

1. Read `SUMMARY.md` for coverage.
2. Open `by-file/` for docs you care about.
3. Join `inventory-index.csv` with `drafts.jsonl` on `id` to accept rewrites.
4. Cherry-pick into a follow-up docs PR.
