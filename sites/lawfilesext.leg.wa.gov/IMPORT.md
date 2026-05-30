# Import provenance

Imported from [`mehrlander/wa-bills`](https://github.com/mehrlander/wa-bills)
at commit `c3a9f4a` on 2026-05-07.

| Here | Source in wa-bills |
|---|---|
| `format-bill.html` | `format/format-bill.html` |
| `lawhop.html` | `format/lawhop.html` |
| `snippets/helper.js` | `format/helper.js` |
| `snippets/parse-bill-data.js` | `format/parse-bill-data.js` |
| `docs/hierarchy.md` | `format/hierarchy.md` |

Files are byte-for-byte copies of the upstream sources.

## Notes

- `format/helper-new.js` in the source repo was byte-identical to `helper.js`
  and was not imported.
- All four scripts assume a `lawfilesext.leg.wa.gov` URL shape:
  `/Biennium/{biennium}/{Htm|Xml|Pdf}/Bills/{chamber}/{number}{suffix}.{ext}`.
  They read `opener.location.href` (or `location.href` if standalone) and
  fetch sibling files under that path.
- `lawhop.html` uses an IndexedDB cache (`lawHop2` database, `docs` store) on
  the lawfilesext origin; that DB will be created on first use.
