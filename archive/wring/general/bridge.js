/**
 * bridge.js
 *
 * The grammar→records *bridge* and the end-to-end `induce()` driver, shared by
 * every front-end. Extracted from the CLI (`induce.js`) so that browser pages
 * run exactly the same orchestration the CLI does, rather than a hand-mirrored
 * copy.
 *
 * The bridge turns the document (via its grammar) into a set of "records"
 * (near-repeated spans) for Stage 3 at TOKEN granularity, so a slot is a whole
 * field, not a chance run of characters. Two record strategies (the bridge is
 * the open research question, so try both):
 *   - 'lines':  split the token stream on newlines. Robust for logs; the record
 *               boundary is given, the grammar is used only for diagnosis.
 *   - 'anchor': grammar-driven. Split the start rule at its most frequent
 *               repeated rule, the dominant anchor, so the record boundary
 *               *emerges from repetition* with no delimiter told in advance.
 *
 * Dependency-free; runs in Node and the browser.
 */

import { tokenize } from './tokenize.js';
import { induceGrammar, expandRule } from './grammar.js';
import { groupByTemplate, reconstruct } from '../core/group-by-template.js';
import { groupByAlignment, reconstructAlign } from './align-group.js';

// Internal token separator for feeding token arrays to groupByTemplate as
// strings. NUL never appears in normal text (and we strip it from input), so
// splitting a joined record by NUL recovers exactly the original tokens.
export const NUL = '\u0000';

// ─── Bridge: grammar → records (token arrays) ─────────────────────────────────

/** Split a token array into records at newline-bearing tokens (newline kept). */
export function recordsByLines(tokens) {
  const records = [];
  let cur = [];
  for (const tok of tokens) {
    cur.push(tok);
    if (tok.includes('\n')) { records.push(cur); cur = []; }
  }
  if (cur.length) records.push(cur);
  return records.filter((r) => r.length > 0);
}

/**
 * Grammar-driven records: find the most frequently referenced rule at the top
 * level of the start rule and treat each of its occurrences as the start of a
 * record. Returns null if no rule repeats at the top level (caller falls back).
 */
export function recordsByAnchor(grammar) {
  const startBody = grammar.rules.get(grammar.start);
  const freq = new Map();
  for (const sym of startBody) {
    if (sym.rule !== undefined) freq.set(sym.rule, (freq.get(sym.rule) || 0) + 1);
  }
  let anchor = null, best = 1;
  for (const [id, c] of freq) if (c > best) { best = c; anchor = id; }
  if (anchor === null) return null;

  const records = [];
  let cur = null;
  for (const sym of startBody) {
    const isAnchor = sym.rule === anchor;
    if (isAnchor) {
      if (cur) records.push(cur);
      cur = [];
    } else if (cur === null) {
      cur = []; // leading material before the first anchor
    }
    // Expand this symbol to terminal tokens and append.
    const toks = sym.rule !== undefined ? expandRule(grammar, sym.rule) : [sym.t];
    cur.push(...toks);
  }
  if (cur && cur.length) records.push(cur);
  return records.filter((r) => r.length > 0);
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

/**
 * Run the full pipeline on a document:
 *
 *   Tokenize (Stage 1) → Grammar (Stage 2) → Bookend Merge or structural
 *   alignment + MDL (Stages 3-4) → reconstruction check (Stage 5)
 *
 * @param {string} text
 * @param {Object} [options]
 * @param {'punct'|'word'|'char'|'line'} [options.tokens='punct']
 * @param {'lines'|'anchor'} [options.records='lines']
 * @param {'bookend'|'align'} [options.group='bookend'] - Stage 3 strategy
 * @param {number} [options.maxSlots=1]
 * @param {'compress'|'specific'} [options.strategy='compress']
 * @param {number} [options.minGroupSize=2]
 * @param {number} [options.threshold=0.5] - positional-agreement threshold (align)
 * @returns {{ tokens, grammar, records, result, strategy, group, fidelity }}
 */
export function induce(text, options = {}) {
  const {
    tokens: tokMode = 'punct',
    records: recordMode = 'lines',
    group = 'bookend',   // Stage 3 strategy: 'bookend' (literal anchors) or 'align' (positional)
    maxSlots = 1,
    strategy = 'compress',
    minGroupSize = 2,
    threshold = 0.5,
  } = options;

  const clean = text.split(NUL).join(''); // guarantee NUL is purely a separator
  const tokens = tokenize(clean, tokMode);
  const grammar = induceGrammar(tokens);

  let records, usedStrategy = recordMode;
  if (recordMode === 'anchor') {
    records = recordsByAnchor(grammar);
    if (!records || records.length < 2) { records = recordsByLines(tokens); usedStrategy = 'lines (anchor fallback)'; }
  } else {
    records = recordsByLines(tokens);
  }

  let result, fidelity;
  if (group === 'align') {
    // Stage 3 by positional agreement, on token arrays directly.
    result = groupByAlignment(records, { threshold, minGroupSize });
    let pass = 0, total = 0;
    for (const g of result.groups) {
      for (const m of g.members) {
        total++;
        if (reconstructAlign(g.template, m.slots) === m.original) pass++;
      }
    }
    fidelity = { pass, total };
  } else {
    // Stage 3 by Bookend Merge, on NUL-joined records (token granularity).
    const recordStrings = records.map((r) => r.join(NUL));
    result = groupByTemplate(recordStrings, { maxSlots, strategy, minGroupSize, delimiter: NUL });
    let pass = 0, total = 0;
    for (const g of result.groups) {
      for (const m of g.members) {
        total++;
        if (reconstruct(g.template, m.slots, NUL) === m.original) pass++;
      }
    }
    fidelity = { pass, total };
  }

  return {
    tokens, grammar, records, result,
    strategy: usedStrategy, group, fidelity,
  };
}
