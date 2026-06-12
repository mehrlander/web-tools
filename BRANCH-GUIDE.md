# Branch guide: claude/practical-noether-ks7579

A standalone, self-contained pension RCW crosswalk page, now built over the complete RCW corpus: the PENSION_MAP semantics (systems, plans, governance, adjacent, specials) layered onto every title, chapter, and section caption, with search (pension-only filter), expandable per-chapter section detail, and a full-code browse tree. Compact legal styling.

⭐ [View pension-map.html](https://github.com/mehrlander/web-tools/blob/claude/practical-noether-ks7579/pages/wsl-sync/pension-map.html) (self-contained, ~3.8 MB with the embedded corpus; no `?use=` boot, so the live Pages URL appears only after merge)

**Changed:**
- pages/wsl-sync/pension-map.html (new; corpus embedded as `[cite,type,name]` tuples, refresh command in the header comment)

**Next steps / open threads:**
- Pension semantics mirrored by hand from `lib/kits/wsl-core.js` PENSION_MAP; corpus is the 2025 RCW archive (won't reflect 2026 session law, e.g. ch. 68 amending 41.50.255, until the corpus refreshes).
- Thumbnail refresh deferred to wrap-up.
