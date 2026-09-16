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
| Rewrites in 40–60% band | 1503 (66.1%) |
| Archive paragraphs (inventoried; drafts deprioritized) | 1953 (rewritten: 0) |

### By priority (all inventory)

| Priority | Count |
|----------|------:|
| high | 2045 |
| medium | 1428 |
| low | 5608 |

### By kind

| Kind | Count |
|------|------:|
| prose | 5558 |
| list | 991 |
| blockquote | 38 |
| other | 2494 |

## Coverage focus

Attack-first and other verbose live docs received the densest rewrite coverage. `archive/**` is inventoried with drafts left null.

### Attack-first draft counts
- `docs/SURFACING.md`: 3 drafts (of 3 high/medium prose candidates)
- `docs/surfacing-extended.md`: 8 drafts (of 9 high/medium prose candidates)
- `docs/stage.md`: 57 drafts (of 65 high/medium prose candidates)
- `docs/show-repo.md`: 220 drafts (of 240 high/medium prose candidates)
- `docs/APP.md`: 14 drafts (of 15 high/medium prose candidates)
- `docs/loader.md`: 24 drafts (of 28 high/medium prose candidates)
- `README.md`: 17 drafts (of 20 high/medium prose candidates)
- `CLAUDE.md`: 13 drafts (of 16 high/medium prose candidates)
- `docs/QUALIFIED-WRITING.md`: 2 drafts (of 2 high/medium prose candidates)
- `docs/SNAGS.md`: 147 drafts (of 156 high/medium prose candidates)
- `docs/manifest.md`: 64 drafts (of 76 high/medium prose candidates)
- `docs/branch-overlay.md`: 61 drafts (of 65 high/medium prose candidates)
- `docs/text-content.md`: 50 drafts (of 58 high/medium prose candidates)
- `docs/TRACKER.md`: 29 drafts (of 37 high/medium prose candidates)

## Top unrewritten live prose (by words)

| Words | Priority | ID |
|------:|----------|----|
| 243 | high | `pages/drop/fills-concepts/CATALOG.md:p009` |
| 205 | high | `docs/SNAGS.md:p085` |
| 194 | high | `tracker/tasks/data-view-mobile-chrome-x5plcv.md:p018` |
| 163 | high | `docs/show-repo.md:p012` |
| 155 | high | `docs/ios-sheet-drags.md:p036` |
| 152 | high | `docs/SNAGS.md:p066` |
| 152 | high | `tracker/tasks/branch-page-as-navigation-adi9ha.md:p018` |
| 142 | high | `lib/kits/README.md:p163` |
| 140 | high | `docs/environment/testing.md:p039` |
| 136 | high | `tracker/tasks/show-repo-first-class-projects-7stibm.md:p004` |
| 133 | high | `docs/branch-overlay.md:p041` |
| 132 | high | `skills/caveman/SKILL.md:p022` |
| 131 | high | `tracker/tasks/consolidate-escape-helpers-gxverk.md:p014` |
| 127 | high | `docs/environment/container.md:p025` |
| 126 | high | `lib/kits/README.md:p062` |
| 118 | high | `pages/wsl-sync/README.md:p005` |
| 115 | high | `tracker/tasks/session-titles-from-export-4vgu4x.md:p019` |
| 114 | high | `skills/state-the-rule/LOG.md:p079` |
| 112 | high | `tracker/tasks/app-views-estate-level-btp6m4.md:p008` |
| 109 | high | `skills/question-margin/SKILL.md:p035` |
| 107 | high | `docs/manifest.md:p099` |
| 106 | high | `tracker/tasks/branch-review-view-show-repo-rwwmrj.md:p015` |
| 104 | high | `docs/text-content.md:p082` |
| 103 | high | `CLAUDE.md:p034` |
| 103 | high | `lib/kits/README.md:p093` |

## How to review

1. Skim `by-file/*.md` for human-readable original vs proposed pairs.
2. Filter `inventory.jsonl` where `draft != null` and `priority == "high"`.
3. Accept by editing the live doc in a follow-up PR; this PR only lands proposals.

## Method notes

- Paragraph = blank-line-separated block; fenced code and YAML frontmatter skipped.
- Priority: high if words≥80 or (`docs/**` and words≥50); medium if words≥40; else low.
- Rewrites target ~half length (40–60%), keep links/identifiers, full sentences.
- Automated condensation for live high/medium prose, plus manual quality pass on `docs/SURFACING.md` and `docs/QUALIFIED-WRITING.md`.
