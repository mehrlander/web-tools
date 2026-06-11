/**
 * mdl-select.js
 *
 * Stage 4 (Selection) of the Wring pipeline, the fuller version.
 *
 * `groupByTemplate` (Stage 3) already does a greedy MDL slice, but it assigns
 * each *record* to at most one template and assumes records don't overlap. The
 * general problem, especially when candidate templates come from a repeat
 * enumerator and their instances overlap on the same characters, is:
 *
 *   Choose a set of templates and a non-overlapping set of their instances that
 *   MINIMIZES the total description length:
 *
 *     totalCost = dictionaryCost(used templates)
 *               + dataCost(selected instances)
 *               + residualCost(characters left uncovered)
 *
 * Two ingredients, matching ARCHITECTURE.md:
 *   1. Weighted interval scheduling: an exact O(n log n) DP that picks the
 *      max-gain non-overlapping subset of instances. (Verified optimal against
 *      brute force in the tests.)
 *   2. Greedy template inclusion (Krimp-style), because each template carries a
 *      fixed dictionary cost paid once, the joint problem is NP-hard; we add
 *      templates one at a time, keeping a template only while it lowers total
 *      cost. The scheduling sub-problem inside each step is solved exactly.
 *
 * Dependency-free; runs in Node and the browser.
 *
 * @typedef {Object} Template
 * @property {string|number} id
 * @property {number} dictBytes   - Cost to store this template in the dictionary
 *                                  (literal bytes + slot overhead).
 * @typedef {Object} Instance
 * @property {string|number} templateId
 * @property {number} start       - Inclusive start offset in the document.
 * @property {number} end         - Exclusive end offset. Covers [start, end).
 * @property {number} encBytes    - Cost to encode this instance (ref + slot values).
 */

// ─── Weighted interval scheduling ─────────────────────────────────────────────

/**
 * Select the maximum-weight subset of non-overlapping intervals.
 * Intervals are half-open [start, end); two are compatible when one's end is
 * ≤ the other's start. Non-positive-weight intervals are never selected.
 *
 * @param {Array<{start:number,end:number,weight:number}>} intervals
 * @returns {{ selected: object[], totalWeight: number }}
 */
export function weightedIntervalSchedule(intervals) {
  const items = intervals.filter((x) => x.weight > 0).slice()
    .sort((a, b) => a.end - b.end);
  const n = items.length;
  if (n === 0) return { selected: [], totalWeight: 0 };

  // P[i] = index of the rightmost interval that ends ≤ items[i].start, else -1.
  const P = new Array(n);
  for (let i = 0; i < n; i++) {
    let lo = 0, hi = i - 1, res = -1;
    const s = items[i].start;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (items[mid].end <= s) { res = mid; lo = mid + 1; }
      else hi = mid - 1;
    }
    P[i] = res;
  }

  const dp = new Array(n).fill(0);
  const take = new Array(n).fill(false);
  for (let i = 0; i < n; i++) {
    const incl = items[i].weight + (P[i] >= 0 ? dp[P[i]] : 0);
    const excl = i > 0 ? dp[i - 1] : 0;
    if (incl >= excl) { dp[i] = incl; take[i] = true; }
    else { dp[i] = excl; take[i] = false; }
  }

  const selected = [];
  for (let i = n - 1; i >= 0; ) {
    if (take[i]) { selected.push(items[i]); i = P[i]; }
    else i--;
  }
  selected.reverse();
  return { selected, totalWeight: dp[n - 1] };
}

// ─── MDL cost accounting ──────────────────────────────────────────────────────

/**
 * Total description length for a given selection.
 *
 * @param {object[]} selectedInstances - chosen, non-overlapping instances
 * @param {Map<string|number, Template>} templateById
 * @param {number} docLength    - total characters in the document
 * @param {number} [residualRate=1] - cost per uncovered character
 * @returns {{ total:number, dictionaryCost:number, dataCost:number, residualCost:number, covered:number }}
 */
export function mdlCost(selectedInstances, templateById, docLength, residualRate = 1) {
  const used = new Set();
  let dataCost = 0;
  let covered = 0;
  for (const inst of selectedInstances) {
    used.add(inst.templateId);
    dataCost += inst.encBytes;
    covered += inst.end - inst.start;
  }
  let dictionaryCost = 0;
  for (const id of used) dictionaryCost += templateById.get(id).dictBytes;
  const residualCost = (docLength - covered) * residualRate;
  return {
    total: dictionaryCost + dataCost + residualCost,
    dictionaryCost, dataCost, residualCost, covered,
  };
}

// ─── Selection driver ─────────────────────────────────────────────────────────

/**
 * Select templates + instances to minimize total description length.
 *
 * @param {Object} input
 * @param {Template[]} input.templates
 * @param {Instance[]} input.instances
 * @param {number} input.docLength
 * @param {number} [input.residualRate=1]
 * @returns {{
 *   templates: Template[],          // templates kept (used by ≥1 instance)
 *   instances: object[],            // chosen, non-overlapping instances
 *   cost: object,                   // mdlCost breakdown for the selection
 *   baselineCost: number,           // cost of encoding everything as residual
 *   saved: number,                  // baselineCost - cost.total
 * }}
 */
export function selectTemplates(input) {
  const { templates, instances, docLength, residualRate = 1 } = input;
  const templateById = new Map(templates.map((t) => [t.id, t]));

  // Each instance's scheduling weight is the residual it removes minus its
  // encoding cost: (end - start) * residualRate - encBytes.
  const weightOf = (inst) => (inst.end - inst.start) * residualRate - inst.encBytes;
  const byTemplate = new Map();
  for (const inst of instances) {
    if (!byTemplate.has(inst.templateId)) byTemplate.set(inst.templateId, []);
    byTemplate.get(inst.templateId).push({ ...inst, weight: weightOf(inst) });
  }

  const baselineCost = docLength * residualRate;
  const chosen = new Set();

  const evaluate = (templateSet) => {
    const pool = [];
    for (const id of templateSet) pool.push(...(byTemplate.get(id) || []));
    const { selected } = weightedIntervalSchedule(pool);
    const cost = mdlCost(selected, templateById, docLength, residualRate);
    return { selected, cost };
  };

  let best = evaluate(chosen); // empty selection → all residual
  for (;;) {
    let bestAdd = null;
    for (const t of templates) {
      if (chosen.has(t.id)) continue;
      const trial = new Set(chosen).add(t.id);
      const res = evaluate(trial);
      if (res.cost.total < best.cost.total &&
          (!bestAdd || res.cost.total < bestAdd.res.cost.total)) {
        bestAdd = { id: t.id, res };
      }
    }
    if (!bestAdd) break;
    chosen.add(bestAdd.id);
    best = bestAdd.res;
  }

  // Report only templates that actually have a selected instance.
  const usedIds = new Set(best.selected.map((i) => i.templateId));
  return {
    templates: templates.filter((t) => usedIds.has(t.id)),
    instances: best.selected,
    cost: best.cost,
    baselineCost,
    saved: baselineCost - best.cost.total,
  };
}

// ─── Node.js / browser compatibility ────────────────────────────────────────

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { weightedIntervalSchedule, mdlCost, selectTemplates };
}
