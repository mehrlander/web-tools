# Paragraph rewrite proposals

Overnight deliverable from **Chief of Staff (Grok)** (signed **2026-09-16**).

## What this is

A complete inventory of blank-line-separated paragraphs across every `.md` file on `main`, plus half-length rewrite proposals for verbose live (non-archive) prose.

**Live documentation is not edited in place.** Everything here is reviewable proposal material.

## Upload status (honest)

GitHub MCP `push_files` cannot carry the full ~6.5MB `inventory.jsonl` / 222 by-file tree in one go. This PR holds the **human entry points** (SUMMARY, sample by-file reviews, assemble scripts). The **complete local deliverable** (full inventory + all by-file reviews + b64 shards) was produced on the agent machine and is available as the overnight tarball handed to Mark in chat: `web-tools-paragraph-rewrites-2026-09-16.tar.gz`.

To rebuild on a machine that has the tarball:

```bash
tar -xzf web-tools-paragraph-rewrites-2026-09-16.tar.gz
cd DELIVERABLE
bash assemble-inventory.sh   # rebuilds inventory.jsonl from shards if present
```

## Layout (when fully assembled)

| Path | Role |
|------|------|
| `inventory.jsonl` | Complete inventory + drafts (9081 lines) |
| `inventory-index.csv` | Lightweight index |
| `inventory-b64-shards/` | `cat` + `base64 -d` + `gunzip` → full `inventory.jsonl` |
| `drafts-parts/` | Draft-only jsonl parts |
| `SUMMARY.md` | Counts, ratios, top unre written longs |
| `by-file/*.md` | Human review: original vs proposed |
| `assemble-inventory.sh` | Rebuild helpers |

## Quick stats

- **314** markdown files
- **9081** paragraph blocks
- **2275** rewritten (avg ratio **0.543**)
- Agent: `Chief of Staff (Grok)` · `2026-09-16`

## Review workflow

1. Read `SUMMARY.md` for coverage.
2. Open `by-file/` for docs you care about (full set in the tarball).
3. Filter `inventory.jsonl` where `draft != null`.
4. Cherry-pick accepted drafts into a follow-up docs PR.
