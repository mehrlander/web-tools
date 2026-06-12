# Branch guide: claude/practical-noether-ks7579

Adds a standalone, self-contained page rendering the pension RCW crosswalk (wsl-core's `PENSION_MAP`) as a browsable, filterable tree: systems with plan section ranges, administration/funding chapters, governance, adjacent chapters, and special cites nested under their parents, enriched with official RCW chapter titles.

⭐ [View pension-map.html](https://github.com/mehrlander/web-tools/blob/claude/practical-noether-ks7579/pages/wsl-sync/pension-map.html) (self-contained page; no `?use=` boot, so the live Pages URL appears only after merge)

**Changed:**
- pages/wsl-sync/pension-map.html (new)

**Next steps / open threads:**
- Data mirrored by hand from `lib/kits/wsl-core.js` PENSION_MAP (no generator); a comment in both files should keep them honest if the map changes.
- Thumbnail refresh deferred to wrap-up.
