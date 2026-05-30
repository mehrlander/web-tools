// kits/data-shelf.js — shelf record schema + helpers.
//
// Defines the shape of records stored in
// `persistence.collection('dataShelf.items')` and provides predicates /
// coercion used by the importer to gate writes. UI metadata for each type
// (label, badge, exec) lives on the v2 page in cfg.types; the canonical
// set of valid type names lives here.
//
// Loaded via gh.load. Registers `window.dataShelf`.

(() => {
  const SHELF_TYPES = ['js', 'html', 'json', 'text'];

  // Minimal shape check. A record is "shelf-shaped" if it has a non-empty
  // string name, a recognized type, and a string-or-absent code field.
  function isShelfShaped(r) {
    if (!r || typeof r !== 'object') return false;
    if (typeof r.name !== 'string' || !r.name.trim()) return false;
    if (!SHELF_TYPES.includes(r.type)) return false;
    if (r.code != null && typeof r.code !== 'string') return false;
    return true;
  }

  // Returns a short human-readable reason a record fails validation, or
  // '' if it passes. Used by the importer to surface why a row was skipped.
  function describeRejection(r) {
    if (!r || typeof r !== 'object') return 'not an object';
    if (typeof r.name !== 'string' || !r.name.trim()) return 'missing name';
    if (!SHELF_TYPES.includes(r.type)) return `unknown type "${r.type ?? '∅'}"`;
    if (r.code != null && typeof r.code !== 'string') return 'code is not a string';
    return '';
  }

  // Best-effort normalization. Comma-string tags become an array; missing
  // optional fields get defaults; `context` is preserved if present and
  // stamped from `opts.defaultContext` only when absent. Coercion runs
  // before validation in the importer so loosely-shaped legacy rows still
  // count as recognized when the essentials are there.
  function coerceShelfRecord(r, opts) {
    opts = opts || {};
    const out = { ...r };
    if (typeof out.tags === 'string') {
      out.tags = out.tags.split(',').map(t => t.trim()).filter(Boolean);
    } else if (!Array.isArray(out.tags)) {
      out.tags = [];
    }
    if (typeof out.notes !== 'string') {
      out.notes = out.notes != null ? String(out.notes) : '';
    }
    out.autorun = !!out.autorun;
    if (!out.context && opts.defaultContext) out.context = opts.defaultContext;
    return out;
  }

  window.dataShelf = {
    SHELF_TYPES,
    isShelfShaped,
    describeRejection,
    coerceShelfRecord
  };
})();
