/**
 * group-by-template.js
 *
 * Groups strings by discovering shared templates with interpolation slots.
 *
 * Core algorithm: Bookend Merge finds the shared prefix/suffix of token sequences,
 * treat the divergent middle as an interpolation slot. This implements Stages 3-4
 * of the Wring pipeline (ARCHITECTURE.md).
 *
 * This is the shared, use-case-independent engine: it is pure string-in / string-out
 * (configurable `delimiter`), so both front-ends call it — the DOM path
 * (`dom/`) feeds it `tag#id.class.class` signatures, and the general-text path
 * (`general/`) feeds it NUL-joined token records. A DOM signature is just one
 * example input: a dot-separated string like "div.flex.items-center.gap-2", which
 * a template like "div.flex.${0}.gap-2" turns into one slot capturing the
 * variable portion.
 *
 * The function discovers the best grouping by:
 *   1. Pairwise Bookend Merge to enumerate candidate templates
 *   2. Match all strings against each candidate
 *   3. Score by MDL-inspired compression gain: (groupSize - 1) * literalChars
 *   4. Greedy selection of non-overlapping groups
 *   5. Character-level refinement of slot boundaries
 *   6. Optional multi-slot refinement via LCS-based internal anchor discovery
 */

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Groups an array of strings by discovering shared templates with interpolation slots.
 *
 * @param {string[]} strings - Input strings to group
 * @param {Object}   [options]
 * @param {number}   [options.maxSlots=1]         - Maximum interpolation slots per template
 * @param {number}   [options.minLiteralChars=3]  - Minimum total literal characters for a valid template
 * @param {number}   [options.minGroupSize=2]     - Minimum members per group
 * @param {string}   [options.delimiter='.']      - Token delimiter
 * @param {boolean}  [options.refineSlots=true]   - Apply character-level slot boundary refinement
 * @param {'compress'|'specific'} [options.strategy='compress']
 *   - 'compress': maximize total compression gain (MDL-optimal, prefers broad groups)
 *   - 'specific': prefer most-specific templates first (finer-grained sub-groups)
 * @returns {{ groups: TemplateGroup[], ungrouped: string[] }}
 *
 * @typedef {Object} TemplateGroup
 * @property {string}   template  - Template string with ${N} markers
 * @property {Member[]} members   - Grouped strings with their slot bindings
 * @property {number}   score     - MDL compression gain
 *
 * @typedef {Object} Member
 * @property {string}   original  - The original input string
 * @property {string[]} slots     - Value bound to each slot
 */
export function groupByTemplate(strings, options = {}) {
  const {
    maxSlots = 1,
    minLiteralChars = 3,
    minGroupSize = 2,
    delimiter = '.',
    refineSlots = true,
    strategy = 'compress',
  } = options;

  const entries = strings.map((s, i) => ({
    original: s,
    index: i,
    segs: s.split(delimiter),
  }));

  // Phase 1: Discover candidate templates via pairwise Bookend Merge
  const candidates = discoverTemplates(entries);

  // Phase 2: For each template, find ALL matching strings (not just the originating pair)
  for (const tmpl of candidates.values()) {
    tmpl.members = findAllMatches(entries, tmpl.prefix, tmpl.suffix, delimiter);
  }

  // Phase 3: Filter by quality thresholds and score
  const ranked = [...candidates.values()]
    .filter(t => t.members.length >= minGroupSize)
    .filter(t => litChars(t.prefix, t.suffix, delimiter) >= minLiteralChars)
    .map(t => ({
      ...t,
      score: (t.members.length - 1) * litChars(t.prefix, t.suffix, delimiter),
    }));

  if (strategy === 'specific') {
    // Most specific first: longest literal content wins, break ties by group size
    ranked.sort((a, b) => {
      const la = litChars(a.prefix, a.suffix, delimiter);
      const lb = litChars(b.prefix, b.suffix, delimiter);
      return lb - la || b.members.length - a.members.length;
    });
  } else {
    // Compress (default): highest MDL compression gain first
    ranked.sort((a, b) => b.score - a.score);
  }

  // Phase 4: Greedy assignment, most valuable template first
  const assigned = new Set();
  const groups = [];

  for (const tmpl of ranked) {
    const available = tmpl.members.filter(m => !assigned.has(m.index));
    if (available.length < minGroupSize) continue;

    for (const m of available) assigned.add(m.index);

    const group = {
      template: renderBookend(tmpl.prefix, tmpl.suffix, delimiter),
      members: available.map(m => ({
        original: m.original,
        slots: [m.slotSegs.join(delimiter)],
      })),
      score: (available.length - 1) * litChars(tmpl.prefix, tmpl.suffix, delimiter),
    };

    groups.push(group);
  }

  // Phase 5: Character-level slot boundary refinement
  if (refineSlots) {
    for (const group of groups) {
      refineCharBoundaries(group);
    }
  }

  // Phase 6: Multi-slot refinement via LCS internal anchors
  if (maxSlots > 1) {
    for (const group of groups) {
      refineMultiSlot(group, maxSlots, delimiter);
    }
  }

  const ungrouped = entries
    .filter(e => !assigned.has(e.index))
    .map(e => e.original);

  return { groups, ungrouped };
}

/**
 * Pretty-print a groupByTemplate result.
 * @param {{ groups: TemplateGroup[], ungrouped: string[] }} result
 * @returns {string}
 */
export function summarize(result) {
  const lines = [];

  for (let i = 0; i < result.groups.length; i++) {
    const g = result.groups[i];
    lines.push(`Group ${i + 1}  (${g.members.length} members, score ${g.score})`);
    lines.push(`  Template: ${g.template}`);

    const slotCount = g.members[0].slots.length;
    for (let s = 0; s < slotCount; s++) {
      const vals = g.members.map(m => m.slots[s]);
      const label = slotCount === 1 ? 'Slot values' : `Slot ${s}`;
      // Show up to 6 values, abbreviate if more
      const shown = vals.length <= 6 ? vals : [...vals.slice(0, 5), `… +${vals.length - 5} more`];
      lines.push(`  ${label}: ${shown.map(v => v === '' ? '(empty)' : `"${v}"`).join(', ')}`);
    }
    lines.push('');
  }

  if (result.ungrouped.length > 0) {
    lines.push(`Ungrouped  (${result.ungrouped.length} strings)`);
    for (const s of result.ungrouped) {
      lines.push(`  ${s}`);
    }
  }

  return lines.join('\n');
}


/**
 * Reconstruct the original string from a template and slot values.
 * Handles empty slots by collapsing adjacent delimiters.
 *
 * @param {string}   template  - Template with ${N} markers
 * @param {string[]} slots     - Slot values
 * @param {string}   [delimiter='.']
 * @returns {string}
 */
export function reconstruct(template, slots, delimiter = '.') {
  let result = template;
  // Process in reverse to handle multi-digit indices correctly.
  // Replacements use a function so that "$&", "$$" etc. in slot values are
  // inserted verbatim instead of being treated as replacement patterns.
  for (let i = slots.length - 1; i >= 0; i--) {
    const marker = '${' + i + '}';
    const val = slots[i];
    if (val === '') {
      // Remove marker and collapse one adjacent delimiter
      if (result.includes(delimiter + marker + delimiter)) {
        result = result.replace(delimiter + marker + delimiter, () => delimiter);
      } else if (result.includes(delimiter + marker)) {
        result = result.replace(delimiter + marker, '');
      } else if (result.includes(marker + delimiter)) {
        result = result.replace(marker + delimiter, '');
      } else {
        result = result.replace(marker, '');
      }
    } else {
      result = result.replace(marker, () => val);
    }
  }
  return result;
}


// ─── Bookend Merge ──────────────────────────────────────────────────────────

/**
 * For a pair of segment arrays, compute the shared prefix and suffix.
 * Returns { prefix: string[], suffix: string[] } or null if trivial.
 */
function computeBookend(segsA, segsB) {
  let prefixLen = 0;
  const maxPrefix = Math.min(segsA.length, segsB.length);
  while (prefixLen < maxPrefix && segsA[prefixLen] === segsB[prefixLen]) {
    prefixLen++;
  }

  let suffixLen = 0;
  const maxSuffix = Math.min(segsA.length - prefixLen, segsB.length - prefixLen);
  while (
    suffixLen < maxSuffix &&
    segsA[segsA.length - 1 - suffixLen] === segsB[segsB.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  const prefix = segsA.slice(0, prefixLen);
  const suffix = suffixLen > 0 ? segsA.slice(segsA.length - suffixLen) : [];

  return { prefix, suffix };
}

/**
 * Check if a segment array matches a bookend template (prefix + slot + suffix).
 */
function matchesBookend(segs, prefix, suffix) {
  if (segs.length < prefix.length + suffix.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (segs[i] !== prefix[i]) return false;
  }
  for (let i = 0; i < suffix.length; i++) {
    if (segs[segs.length - 1 - i] !== suffix[suffix.length - 1 - i]) return false;
  }
  return true;
}

/**
 * Extract the slot segments (the middle between prefix and suffix).
 */
function extractSlotSegs(segs, prefix, suffix) {
  return segs.slice(prefix.length, segs.length - suffix.length);
}


// ─── Template Discovery ─────────────────────────────────────────────────────

/**
 * Enumerate candidate templates by computing bookends for all pairs.
 * Deduplicates by (prefix, suffix) key.
 * Returns Map<string, { prefix: string[], suffix: string[] }>
 */
function discoverTemplates(entries) {
  const map = new Map();

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const bookend = computeBookend(entries[i].segs, entries[j].segs);
      if (bookend.prefix.length + bookend.suffix.length === 0) continue; // trivial

      const key = templateKey(bookend.prefix, bookend.suffix);
      if (!map.has(key)) {
        map.set(key, { prefix: bookend.prefix, suffix: bookend.suffix });
      }
    }
  }

  return map;
}

/**
 * Find all entries matching a bookend template. Returns array of match objects.
 */
function findAllMatches(entries, prefix, suffix, delimiter) {
  const matches = [];
  for (const e of entries) {
    if (matchesBookend(e.segs, prefix, suffix)) {
      matches.push({
        index: e.index,
        original: e.original,
        slotSegs: extractSlotSegs(e.segs, prefix, suffix),
      });
    }
  }
  return matches;
}


// ─── Scoring & Rendering ────────────────────────────────────────────────────

function templateKey(prefix, suffix) {
  return prefix.join('\x00') + '\x01' + suffix.join('\x00');
}

function litChars(prefix, suffix, delimiter) {
  const parts = [];
  if (prefix.length > 0) parts.push(prefix.join(delimiter));
  if (suffix.length > 0) parts.push(suffix.join(delimiter));
  return parts.join(delimiter).length;
}

function renderBookend(prefix, suffix, delimiter) {
  const parts = [];
  if (prefix.length > 0) parts.push(prefix.join(delimiter));
  parts.push('${0}');
  if (suffix.length > 0) parts.push(suffix.join(delimiter));
  return parts.join(delimiter);
}


// ─── Character-level Slot Refinement ────────────────────────────────────────

/**
 * Within a group, find common character-level prefix/suffix of all slot values
 * and absorb them into the template literals. Mutates group in place.
 *
 * Example: slot values ["h3#_r_14a_", "h3#_r_14k_", "h3#_r_d1_"]
 *   -> common prefix "h3#_r_", common suffix "_"
 *   -> template absorbs these, slot values become ["14a", "14k", "d1"]
 */
function refineCharBoundaries(group, minCharLen = 2) {
  const slotValues = group.members.map(m => m.slots[0]);

  // Skip if any slot is empty (nothing to refine)
  if (slotValues.some(v => v === '')) return;

  let cpre = longestCommonPrefix(slotValues);
  let csuf = longestCommonSuffix(slotValues);

  // Only absorb if the common prefix/suffix meets minimum length
  if (cpre.length < minCharLen) cpre = '';
  if (csuf.length < minCharLen) csuf = '';

  // Ensure prefix + suffix don't overlap within the shortest slot value
  const minLen = Math.min(...slotValues.map(v => v.length));
  if (cpre.length + csuf.length > minLen) {
    csuf = csuf.slice(0, Math.max(0, minLen - cpre.length));
    if (csuf.length < minCharLen) csuf = '';
  }

  if (cpre.length === 0 && csuf.length === 0) return;

  // Update template string (function replacer: cpre/csuf are data and may
  // contain "$" replacement patterns)
  group.template = group.template.replace('${0}', () => cpre + '${0}' + csuf);

  // Update slot values
  for (const m of group.members) {
    const v = m.slots[0];
    m.slots[0] = v.slice(cpre.length, csuf.length > 0 ? -csuf.length : undefined);
  }
}

function longestCommonPrefix(strings) {
  if (strings.length === 0) return '';
  let prefix = strings[0];
  for (let i = 1; i < strings.length; i++) {
    let j = 0;
    while (j < prefix.length && j < strings[i].length && prefix[j] === strings[i][j]) j++;
    prefix = prefix.slice(0, j);
    if (prefix.length === 0) return '';
  }
  return prefix;
}

function longestCommonSuffix(strings) {
  if (strings.length === 0) return '';
  const reversed = strings.map(s => [...s].reverse().join(''));
  const rp = longestCommonPrefix(reversed);
  return [...rp].reverse().join('');
}


// ─── Multi-slot Refinement via LCS ──────────────────────────────────────────

/**
 * Refine a single-slot group into a multi-slot template by finding
 * common internal anchors within the slot values. Mutates group in place.
 *
 * Uses Longest Common Subsequence of slot-value tokens to discover anchors.
 * Each anchor becomes a literal; gaps between anchors become additional slots.
 */
function refineMultiSlot(group, maxSlots, delimiter) {
  if (maxSlots <= 1) return;

  const slotValues = group.members.map(m => m.slots[0]);

  // Skip if any slot is empty
  if (slotValues.some(v => v === '')) return;

  const segArrays = slotValues.map(v => v.split(delimiter));

  // Find common subsequence across all members
  const anchors = multiLCS(segArrays);
  if (anchors.length === 0) return;

  // Align each member's slot value to the anchors, counting resulting slots
  const alignments = [];
  for (let i = 0; i < segArrays.length; i++) {
    const aligned = alignToAnchors(segArrays[i], anchors);
    if (!aligned) return; // alignment failed, abort refinement
    alignments.push(aligned);
  }

  // The alignment produces anchors.length + 1 gap regions (sub-slots).
  // If that exceeds maxSlots, prune the least valuable anchors.
  let effectiveAnchors = anchors;
  while (effectiveAnchors.length + 1 > maxSlots && effectiveAnchors.length > 0) {
    // Remove the shortest anchor (least literal content)
    let minIdx = 0;
    for (let i = 1; i < effectiveAnchors.length; i++) {
      if (effectiveAnchors[i].length < effectiveAnchors[minIdx].length) minIdx = i;
    }
    effectiveAnchors = [
      ...effectiveAnchors.slice(0, minIdx),
      ...effectiveAnchors.slice(minIdx + 1),
    ];
  }

  // Re-align with pruned anchors
  const finalAlignments = [];
  for (const segs of segArrays) {
    const aligned = alignToAnchors(segs, effectiveAnchors);
    if (!aligned) return;
    finalAlignments.push(aligned);
  }

  // Build the refined template string
  // Current template: "prefix.${0}.suffix"  or  "prefix.${0}"  etc.
  // We replace ${0} with: ${0}.anchor0.${1}.anchor1.${2}...
  const innerParts = [];
  for (let i = 0; i <= effectiveAnchors.length; i++) {
    innerParts.push('${' + i + '}');
    if (i < effectiveAnchors.length) {
      innerParts.push(effectiveAnchors[i]);
    }
  }
  const innerTemplate = innerParts.join(delimiter);
  // Function replacer: anchors are data and may contain "$" patterns.
  group.template = group.template.replace('${0}', () => innerTemplate);

  // Update member slot values
  for (let m = 0; m < group.members.length; m++) {
    group.members[m].slots = finalAlignments[m].gaps.map(g => g.join(delimiter));
  }
}

/**
 * Standard pairwise LCS on string arrays (token-level).
 */
function pairLCS(a, b) {
  const m = a.length, n = b.length;
  // DP table
  const dp = [];
  for (let i = 0; i <= m; i++) {
    dp[i] = new Uint16Array(n + 1); // fits segments up to 65535 long
  }
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  // Backtrack
  const result = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift(a[i - 1]);
      i--; j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return result;
}

/**
 * Incremental LCS across multiple arrays.
 */
function multiLCS(arrays) {
  if (arrays.length === 0) return [];
  let common = arrays[0];
  for (let i = 1; i < arrays.length; i++) {
    common = pairLCS(common, arrays[i]);
    if (common.length === 0) return [];
  }
  return common;
}

/**
 * Align a segment array to a sequence of anchor tokens.
 * Returns { gaps: string[][] } where gaps[i] is the segments between anchor i-1 and anchor i.
 * gaps has anchors.length + 1 entries (before first anchor, between each pair, after last).
 */
function alignToAnchors(segs, anchors) {
  const gaps = [];
  let searchFrom = 0;

  for (const anchor of anchors) {
    const pos = segs.indexOf(anchor, searchFrom);
    if (pos === -1) return null; // anchor not found, alignment fails
    gaps.push(segs.slice(searchFrom, pos));
    searchFrom = pos + 1;
  }
  gaps.push(segs.slice(searchFrom)); // trailing gap

  return { gaps };
}


// ─── Node.js / browser compatibility ────────────────────────────────────────

// Make available as CommonJS if module exists
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { groupByTemplate, summarize, reconstruct };
}
