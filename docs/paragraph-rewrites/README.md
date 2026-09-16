# Paragraph rewrite proposals

Overnight deliverable from **Chief of Staff (Grok)** (signed **2026-09-16**), plus the long-lived **revision-index contract** for ongoing work.

## Start here for future runs

**Read [`CONTRACT.md`](./CONTRACT.md) first.** That is the intended model:

- Paragraph **text** is the primary key (content-addressed `paragraphId`).
- File paths are **sightings**, not identity.
- Each paragraph accumulates a **list** of signed proposals at chosen `targetRatio` values (e.g. `0.5`, later `0.25` / `0.75`).
- Drafts do **not** re-enter the index until accepted into a live file and re-observed.
- Background loop: scan → upsert sightings → append missing target proposals → **never** edit live docs.

The overnight JSONL below is a **first batch** in an older file-keyed shape (`path:pN` + single optional `draft` at ~0.5). Migrate toward the contract before adding new targets.

## What the overnight pass is

A complete inventory of blank-line-separated paragraphs across every `.md` file on `main`, plus half-length rewrite proposals for verbose live (non-archive) prose.

**Live documentation is not edited in place.** Everything here is reviewable proposal material.

## Upload status (honest)

GitHub MCP `push_files` cannot carry the full ~6.5MB `inventory.jsonl` / 222 by-file tree in one go. This PR holds the **human entry points** (CONTRACT, SUMMARY, sample by-file reviews, assemble scripts). The **complete local deliverable** (full inventory + all by-file reviews + b64 shards) was produced on the agent machine and is available as the overnight tarball: `web-tools-paragraph-rewrites-2026-09-16.tar.gz`.

To rebuild on a machine that has the tarball:

```bash
tar -xzf web-tools-paragraph-rewrites-2026-09-16.tar.gz
cd DELIVERABLE
bash assemble-inventory.sh   # rebuilds inventory.jsonl from shards if present
```

## Layout (when fully assembled)

| Path | Role |
|------|------|
| `CONTRACT.md` | Long-lived handoff for future assistants |
| `inventory.jsonl` | Overnight inventory + drafts (9081 lines; migrate toward contract) |
| `inventory-index.csv` | Lightweight index |
| `inventory-b64-shards/` | `cat` + `base64 -d` + `gunzip` → full `inventory.jsonl` |
| `drafts-parts/` | Draft-only jsonl parts |
| `SUMMARY.md` | Counts, ratios, top unre written longs |
| `by-file/*.md` | Human review: original vs proposed |
| `assemble-inventory.sh` | Rebuild helpers |

## Quick stats (overnight)

- **314** markdown files
- **9081** paragraph blocks
- **2275** rewritten (avg ratio **0.543**)
- Agent: `Chief of Staff (Grok)` · `2026-09-16`
- Target filled: **`0.5` only** (other ratios are future work)

## Review workflow

1. Read `CONTRACT.md` for the target index model.
2. Read `SUMMARY.md` for overnight coverage.
3. Open `by-file/` for docs you care about (full set in the tarball).
4. Filter `inventory.jsonl` where `draft != null`.
5. Cherry-pick accepted drafts into a follow-up docs PR.
