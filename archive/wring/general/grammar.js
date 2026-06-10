/**
 * grammar.js
 *
 * Stage 2 of the Wring pipeline: grammar induction over a token stream.
 *
 * ARCHITECTURE.md names Sequitur for this stage. We implement the closely
 * related **Re-Pair** (Larsson & Moffat, 2000) instead, behind a neutral
 * grammar interface. Both build a hierarchical grammar of *exact* repeats;
 * Re-Pair is offline and greedily replaces the globally most-frequent digram,
 * which is simpler to implement correctly and tends to find the dominant
 * repeated structure first. Those are the anchors Bookend Merge (Stage 3) then
 * generalizes from exact to near-repeats. Sequitur (online, linear-time) can be
 * dropped in later behind this same `{ start, rules, ruleUses }` contract.
 *
 * Dependency-free; runs in Node and the browser. Tokens may be strings or
 * numbers; equality is by value.
 *
 * Grammar shape (serializable):
 *   {
 *     start: 0,                         // id of the start rule
 *     rules: Map<number, Symbol[]>,     // ruleId → body
 *     ruleUses: Map<number, number>,    // ruleId → reference count (≥2 for non-start)
 *   }
 * A body Symbol is either { t: <token> } (terminal) or { rule: <id> } (non-terminal).
 */

// ─── Re-Pair ──────────────────────────────────────────────────────────────

const symKey = (s) => (s.rule !== undefined ? 'r' + s.rule : 't' + s.t);
const pairKey = (a, b) => symKey(a) + '\u0000' + symKey(b);

/** Greedy left-to-right count of NON-overlapping occurrences of one pair. */
function nonOverlapCount(seq, key) {
  let count = 0;
  for (let i = 0; i + 1 < seq.length; ) {
    if (pairKey(seq[i], seq[i + 1]) === key) { count++; i += 2; }
    else i++;
  }
  return count;
}

/** Replace every non-overlapping occurrence of `key` with a {rule:id} symbol. */
function replacePair(seq, key, id) {
  const out = [];
  for (let i = 0; i < seq.length; ) {
    if (i + 1 < seq.length && pairKey(seq[i], seq[i + 1]) === key) {
      out.push({ rule: id });
      i += 2;
    } else {
      out.push(seq[i]);
      i++;
    }
  }
  return out;
}

/**
 * Induce a grammar from a token array via Re-Pair.
 *
 * @param {Array<string|number>} tokens
 * @param {Object} [options]
 * @param {number} [options.minPairCount=2] - Stop when no digram occurs this often.
 * @returns {{ start: number, rules: Map<number, object[]>, ruleUses: Map<number, number> }}
 */
export function induceGrammar(tokens, options = {}) {
  const { minPairCount = 2 } = options;
  let seq = tokens.map((t) => ({ t }));
  const rules = new Map();
  let nextId = 1; // 0 is reserved for the start rule

  for (;;) {
    // Count overlapping digram occurrences; remember a representative pair.
    const counts = new Map(); // key -> { count, a, b }
    for (let i = 0; i + 1 < seq.length; i++) {
      const k = pairKey(seq[i], seq[i + 1]);
      const e = counts.get(k);
      if (e) e.count++;
      else counts.set(k, { count: 1, a: seq[i], b: seq[i + 1] });
    }

    // Candidates sorted by frequency; verify true non-overlapping count.
    const candidates = [...counts.entries()]
      .filter(([, e]) => e.count >= minPairCount)
      .sort((x, y) => y[1].count - x[1].count);

    let chosen = null;
    for (const [k, e] of candidates) {
      if (nonOverlapCount(seq, k) >= minPairCount) { chosen = { k, e }; break; }
    }
    if (!chosen) break;

    const id = nextId++;
    rules.set(id, [
      chosen.e.a.rule !== undefined ? { rule: chosen.e.a.rule } : { t: chosen.e.a.t },
      chosen.e.b.rule !== undefined ? { rule: chosen.e.b.rule } : { t: chosen.e.b.t },
    ]);
    seq = replacePair(seq, chosen.k, id);
  }

  rules.set(0, seq);

  // Rule utility: Re-Pair can leave a rule referenced only once after a later
  // replacement absorbs its occurrences (e.g. "abcabc" → R1=ab, R2=R1·c leaves
  // R1 used once). Inline every such single-use rule into its lone call site.
  pruneSingleUseRules(rules);

  // Reference counts across all bodies.
  const ruleUses = computeUses(rules);

  return { start: 0, rules, ruleUses };
}

/** Tally how many times each rule id is referenced across all rule bodies. */
function computeUses(rules) {
  const uses = new Map();
  for (const [, body] of rules) {
    for (const sym of body) {
      if (sym.rule !== undefined) uses.set(sym.rule, (uses.get(sym.rule) || 0) + 1);
    }
  }
  return uses;
}

/** Inline (and remove) any non-start rule referenced fewer than twice. */
function pruneSingleUseRules(rules, start = 0) {
  for (;;) {
    const uses = computeUses(rules);
    let victim = null;
    for (const id of rules.keys()) {
      if (id === start) continue;
      if ((uses.get(id) || 0) < 2) { victim = id; break; }
    }
    if (victim === null) return;

    const victimBody = rules.get(victim);
    rules.delete(victim);
    // Splice the victim's body into wherever it is referenced (at most once).
    for (const [, body] of rules) {
      for (let i = 0; i < body.length; i++) {
        if (body[i].rule === victim) {
          body.splice(i, 1, ...victimBody.map((s) => ({ ...s })));
          break;
        }
      }
    }
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Fully expand a rule (by id) into its terminal token sequence.
 * @returns {Array<string|number>}
 */
export function expandRule(grammar, ruleId) {
  const out = [];
  const walk = (id) => {
    for (const sym of grammar.rules.get(id)) {
      if (sym.rule !== undefined) walk(sym.rule);
      else out.push(sym.t);
    }
  };
  walk(ruleId);
  return out;
}

/** Reconstruct the original token stream (expands the start rule). */
export function reconstructTokens(grammar) {
  return expandRule(grammar, grammar.start);
}

// ─── Node.js / browser compatibility ────────────────────────────────────────

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { induceGrammar, expandRule, reconstructTokens };
}
