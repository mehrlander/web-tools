# Branch guide: claude/review-main-commit-oya9hs

Digit-only strings in `_f` now text-match like every other string, instead of slicing the first N elements; the count shortcut made sense when glom's first argument was a selector, but after 2c7837a promoted strings to content filters, `glom('2')` silently meant "first 2 elements" instead of "text includes 2".

⭐ [console/base.js](https://github.com/mehrlander/web-tools/blob/claude/review-main-commit-oya9hs/console/base.js#L6-L10)

**Changed:**
- console/base.js ([new](https://github.com/mehrlander/web-tools/blob/claude/review-main-commit-oya9hs/console/base.js), [main](https://github.com/mehrlander/web-tools/blob/main/console/base.js))

**Next steps / open threads:**
- Number's index-filter meaning (`glom(2)` = element at index 2) kept as-is per discussion; revisit only if it proves confusing in practice.
- Verified in jsdom: `glom('2')` matches elements whose own text contains "2"; number, regex, and function branches unchanged.
