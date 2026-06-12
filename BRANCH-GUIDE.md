# Branch guide: claude/practical-noether-ks7579

A standalone, self-contained pension RCW crosswalk page over the complete RCW corpus: PENSION_MAP semantics layered onto every title, chapter, and section caption, with quick find (trust-fund expenses 41.50.255 highlighted), cite-scoped search (`41.50 payment`), a pension-only filter, expandable per-chapter detail, and a full-code browse tree. Plain styling; corpus embedded gzip+base64 (1.2 MB file), inflated at boot via native DecompressionStream.

⭐ [View pension-map.html](https://github.com/mehrlander/web-tools/blob/claude/practical-noether-ks7579/pages/wsl-sync/pension-map.html) (self-contained; no `?use=` boot, so the live Pages URL appears only after merge)

**Changed:**
- pages/wsl-sync/pension-map.html (new; corpus refresh command in the header comment)

**Next steps / open threads:**
- Pension semantics mirrored by hand from `lib/kits/wsl-core.js` PENSION_MAP; corpus is the 2025 RCW archive (won't reflect 2026 session law, e.g. ch. 68 amending 41.50.255, until refreshed).
- Quick-find list is a placeholder concept (5 entries); curate as needed.
- Thumbnail refresh deferred to wrap-up.
