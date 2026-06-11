/**
 * align-group.js
 *
 * A structural alternative to Bookend Merge for Stage 3.
 *
 * Bookend Merge (`group-by-template.js`) groups records by their longest shared
 * literal prefix/suffix. On records with many independent variable fields, such as a
 * log line, the longest shared literal is an *incidental* field (the
 * client IP), so records that merely share an IP get grouped while the real
 * template fractures. See `general/README.md` for that finding.
 *
 * This module groups by *positional agreement* instead, the idea behind log
 * template miners (Drain / LogMine):
 *
 *   1. Bucket records by token count. Different field structures usually differ
 *      in length, so this cheaply separates unrelated formats.
 *   2. Within a bucket, sequentially assign each record to a template it agrees
 *      with on ≥ `threshold` of positions. When a record joins, positions where
 *      it disagrees with the template become slots.
 *   3. Adjacent slot positions merge into one slot.
 *
 * Slots are still discovered purely from observed variance. No token is
 * declared "variable" by type. The result is one template with many field slots
 * rather than many templates split on an incidental literal.
 *
 * Operates on token arrays (string[][]). Lossless: a template's literal tokens
 * plus a member's slot tokens are contiguous slices of that member's token
 * array, so concatenating them reproduces the record exactly.
 *
 * Dependency-free; runs in Node and the browser.
 */

const SLOT = null; // sentinel marking a divergent (slot) position in a template

/**
 * @param {string[][]} records - each record is an array of tokens
 * @param {Object} [options]
 * @param {number} [options.threshold=0.5]   - min fraction of positions that must
 *                                              agree for a record to join a template
 * @param {number} [options.minGroupSize=2]  - templates with fewer members are ungrouped
 * @returns {{ groups: AlignGroup[], ungrouped: string[] }}
 *
 * @typedef {Object} AlignGroup
 * @property {string}   template  - template string with ${N} slot markers
 * @property {Member[]} members
 * @property {number}   score     - MDL-style gain: (members-1) * literalChars
 * @typedef {Object} Member
 * @property {string}   original
 * @property {string[]} slots
 */
export function groupByAlignment(records, options = {}) {
  const { threshold = 0.5, minGroupSize = 2 } = options;

  // 1. Bucket by token count.
  const buckets = new Map();
  records.forEach((toks, idx) => {
    const k = toks.length;
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push({ toks, idx });
  });

  // 2. Sequential agreement clustering within each bucket.
  const rawTemplates = [];
  for (const [len, recs] of buckets) {
    const temps = [];
    for (const rec of recs) {
      let best = null, bestSim = -1;
      for (const t of temps) {
        let match = 0;
        for (let i = 0; i < len; i++) {
          if (t.tokens[i] !== SLOT && t.tokens[i] === rec.toks[i]) match++;
        }
        const sim = len === 0 ? 1 : match / len;
        if (sim >= threshold && sim > bestSim) { best = t; bestSim = sim; }
      }
      if (best) {
        for (let i = 0; i < len; i++) {
          if (best.tokens[i] !== SLOT && best.tokens[i] !== rec.toks[i]) best.tokens[i] = SLOT;
        }
        best.members.push(rec);
      } else {
        temps.push({ tokens: rec.toks.slice(), members: [rec] });
      }
    }
    rawTemplates.push(...temps);
  }

  // 3. Build output groups: merge adjacent slot positions, extract slot values.
  const groups = [];
  const grouped = new Set();
  for (const t of rawTemplates) {
    if (t.members.length < minGroupSize) continue;
    const segs = segments(t.tokens);
    const litChars = segs.reduce((n, s) => n + (s.type === 'lit' ? s.tokens.join('').length : 0), 0);

    const members = t.members.map((m) => {
      const slots = [];
      for (const s of segs) if (s.type === 'slot') slots.push(m.toks.slice(s.from, s.to).join(''));
      grouped.add(m.idx);
      return { original: m.toks.join(''), slots };
    });

    groups.push({
      template: renderTemplate(segs),
      members,
      score: (members.length - 1) * litChars,
    });
  }
  groups.sort((a, b) => b.score - a.score);

  const ungrouped = records
    .map((toks, idx) => ({ toks, idx }))
    .filter((r) => !grouped.has(r.idx))
    .map((r) => r.toks.join(''));

  return { groups, ungrouped };
}

/** Reconstruct a record from an alignment template and its slot values. */
export function reconstructAlign(template, slots) {
  let k = 0;
  return template.replace(/\$\{\d+\}/g, () => slots[k++]);
}

// ─── helpers ─────────────────────────────────────────────────────────────────

// Partition a template's token array into contiguous literal / slot segments.
function segments(tokens) {
  const segs = [];
  let i = 0;
  while (i < tokens.length) {
    if (tokens[i] === SLOT) {
      let j = i; while (j < tokens.length && tokens[j] === SLOT) j++;
      segs.push({ type: 'slot', from: i, to: j });
      i = j;
    } else {
      let j = i; while (j < tokens.length && tokens[j] !== SLOT) j++;
      segs.push({ type: 'lit', tokens: tokens.slice(i, j) });
      i = j;
    }
  }
  return segs;
}

function renderTemplate(segs) {
  let k = 0;
  let out = '';
  for (const s of segs) out += s.type === 'lit' ? s.tokens.join('') : '${' + (k++) + '}';
  return out;
}

// ─── Node.js / browser compatibility ────────────────────────────────────────

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { groupByAlignment, reconstructAlign };
}
