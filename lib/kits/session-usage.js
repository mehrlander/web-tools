// kits/session-usage.js — a session record as what each prompt cost and how
// much context it left behind.
//
//   SessionUsage.read(record) -> { prompts, compactions, totals }
//   SessionUsage.fromExtract(extract)  the same, from a usage extract
//   SessionUsage.PRICES        the price table, USD per million tokens
//   SessionUsage.isOwnerPrompt(row)  a prompt the owner typed
//   SessionUsage.stepCost(step)      { cost, reload-free parts } for one step
//   SessionUsage.compactionName(record, at)  the compactions store's file name
//
// Pure: no network and no DOM, so the session view's Cost tab and a test read
// the same arithmetic. The record format is web-tools-private's
// sessions/README.md.
//
// A STEP is one row of `record.responses` (schema 16 on) that carries `usage`:
// one model call in the main conversation. Subagents' calls are not in that
// list, which is why the modelled total sits below the harness's own
// `cost.totalCostUSD`, which counts them. Its context is everything the call
// read in: fresh input, cache reads and cache writes.
//
// A PROMPT is a row of `record.prompts` with no `origin`: the owner typed it.
// Rows with an origin came from another session or the harness (session-render
// keeps the same distinction for search). Each step belongs to the latest
// prompt at or before it, and a step before the first prompt to the first.
//
// AN IDLE RE-LOAD: the prompt cache lasts an hour, so a step after a longer gap
// writes the whole context again. Read off the step itself rather than the
// clock: more than half its context written, on a context over 150,000 tokens,
// and neither the session's first step nor the first after a compaction, which
// write a fresh context for other reasons. What it costs over a warm step is
// the written tokens at the write price less the read price.
//
// A USAGE EXTRACT is web-tools-private's sessions/usage/YYYY/MM/<record
// name>.json (schema usage/1, sessions/tools/usage.py): the same rules applied
// there, in Python, kept as tokens per prompt and per model, so a view can draw
// a session without its record. It carries no dollars; fromExtract prices it
// with the table below, and node/test/session-usage-extract.test.mjs holds it
// to read() of the record it came from.
(function () {
  // Anthropic's API list prices as of 2026-11-10, USD per million tokens. A
  // cache write is priced off `input`: twice it for the one-hour cache, 1.25
  // times for the five-minute one. A model missing here gets no price.
  const PRICES = {
    'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.20 },
    'claude-fable-5-2': { input: 8, output: 40, cacheRead: 0.20 },
  };
  const WRITE_1H = 2;
  const WRITE_5M = 1.25;
  const IDLE_CONTEXT = 150000;

  const num = (v) => (Number.isFinite(v) ? v : 0);
  const time = (iso) => { const t = Date.parse(iso || ''); return Number.isNaN(t) ? null : t; };

  const isOwnerPrompt = (p) => !!p && typeof p === 'object' && !p.origin;

  // The written tokens split by cache lifetime. An unsplit count is one-hour,
  // which is what the harness writes for the main conversation.
  function writes(u) {
    const total = num(u.cache_creation_input_tokens);
    const s = u.cache_creation;
    if (!s || typeof s !== 'object') return { total, h1: total, m5: 0 };
    const m5 = num(s.ephemeral_5m_input_tokens);
    const h1 = num(s.ephemeral_1h_input_tokens);
    // A split that does not cover the count leaves the rest as one-hour.
    return { total, h1: h1 + Math.max(0, total - h1 - m5), m5 };
  }

  // One step's tokens and, where its model is priced, its cost in dollars.
  function stepCost(step) {
    const u = (step && step.usage) || {};
    const w = writes(u);
    const input = num(u.input_tokens), read = num(u.cache_read_input_tokens), output = num(u.output_tokens);
    const context = input + read + w.total;
    const p = PRICES[step && step.model];
    if (!p) return { context, input, read, output, written: w.total, cost: null, writeCost: null, readPrice: null };
    const writeCost = (w.h1 * p.input * WRITE_1H + w.m5 * p.input * WRITE_5M) / 1e6;
    const cost = (input * p.input + read * p.cacheRead + output * p.output) / 1e6 + writeCost;
    return { context, input, read, output, written: w.total, cost, writeCost, readPrice: p.cacheRead };
  }

  // The compactions store names a summary `<day>-<short>-<UTC time>.md`, the
  // time to the second: 2026-11-03-b2cdc8ac-20261105T032503Z.
  function compactionName(record, at) {
    const r = record || {};
    const stamp = String(at || '').replace(/[-:]/g, '').slice(0, 15);
    return r.day && r.short && stamp.length === 15 ? r.day + '-' + r.short + '-' + stamp + 'Z' : '';
  }

  function read(record) {
    const r = record || {};
    const measured = Array.isArray(r.responses) && r.responses.length > 0;
    const harness = r.cost && Number.isFinite(r.cost.totalCostUSD) ? r.cost.totalCostUSD : null;

    const prompts = [];
    (Array.isArray(r.prompts) ? r.prompts : []).forEach((p, i) => {
      if (!isOwnerPrompt(p)) return;
      prompts.push({ n: prompts.length + 1, prompt: i, at: p.at || '', t: time(p.at),
                     steps: 0, context: null, cost: 0, rest: 0, reload: 0, reloads: 0,
                     compaction: false, unpriced: false });
    });

    const comps = (Array.isArray(r.injected) ? r.injected : [])
      .filter((x) => x && x.kind === 'compaction' && time(x.at) != null)
      .map((x) => ({ at: x.at, t: time(x.at), name: compactionName(r, x.at),
                     chars: Number.isFinite(x.chars) ? x.chars : String(x.body || x.head || '').length,
                     before: null, after: null, prompt: null }))
      .sort((a, b) => a.t - b.t);

    const steps = [];
    for (const x of measured ? r.responses : []) {
      if (!x || !x.usage) continue;
      const t = time(x.at);
      if (t == null) continue;
      const c = stepCost(x);
      if (!c.context) continue;
      steps.push({ t, model: x.model || '', ...c });
    }
    steps.sort((a, b) => a.t - b.t);

    // The prompt a time belongs to: the latest at or before it, else the first.
    const owner = (t) => {
      let j = 0;
      for (let k = 0; k < prompts.length; k++) if (prompts[k].t != null && prompts[k].t <= t) j = k;
      return prompts[j] || null;
    };

    const unpriced = new Set();
    let modelled = 0, reloadTotal = 0, reloadCount = 0, ci = 0, fresh = true;
    for (const s of steps) {
      // A compaction between the previous step and this one: this step opens
      // the new context, so it cannot be an idle re-load.
      while (ci < comps.length && comps[ci].t < s.t) { fresh = true; ci++; }
      const row = owner(s.t);
      const idle = !fresh && s.context > IDLE_CONTEXT && s.written > s.context / 2;
      fresh = false;
      if (s.cost == null) unpriced.add(s.model || '(no model)');
      const reload = idle && s.cost != null ? s.writeCost - s.written * s.readPrice / 1e6 : 0;
      if (s.cost != null) modelled += s.cost;
      if (idle) { reloadTotal += reload; reloadCount++; }
      if (!row) continue;
      row.steps++;
      row.context = s.context;
      if (s.cost == null) row.unpriced = true;
      else row.cost += s.cost;
      if (idle) { row.reload += reload; row.reloads++; }
    }
    for (const p of prompts) p.rest = p.cost - p.reload;

    // Each compaction's context either side, and the prompt it fell inside.
    for (const c of comps) {
      for (const s of steps) {
        if (s.t <= c.t) c.before = s.context;
        else { c.after = s.context; break; }
      }
      const row = owner(c.t);
      if (row) { row.compaction = true; c.prompt = row.n; }
    }

    return {
      prompts: prompts.map(({ t, ...p }) => p),
      compactions: comps.map(({ t, ...c }) => c),
      totals: {
        measured,
        modelled: measured ? modelled : null,
        harness,
        reload: reloadTotal,
        reloads: reloadCount,
        steps: steps.length,
        prompts: prompts.length,
        compactions: comps.length,
        unpriced: [...unpriced].sort(),
      },
    };
  }

  // An extract's token sums for one model, priced: what its steps cost and
  // what its idle re-loads cost over warm steps. Null where it has no price.
  function sumsCost(model, m) {
    const p = PRICES[model];
    if (!p) return null;
    const v = (k) => num(m && m[k]);
    const cost = (v('input') * p.input + v('cache_read') * p.cacheRead + v('output') * p.output) / 1e6
      + (v('cache_write_1h') * p.input * WRITE_1H + v('cache_write_5m') * p.input * WRITE_5M) / 1e6;
    const reload = (v('reload_write_1h') * p.input * WRITE_1H + v('reload_write_5m') * p.input * WRITE_5M) / 1e6
      - v('reload_written') * p.cacheRead / 1e6;
    return { cost, reload };
  }

  function fromExtract(extract) {
    const e = extract || {};
    const unpriced = new Set();
    let modelled = 0, reloadTotal = 0, reloadCount = 0, stepCount = 0;
    // One bucket's models priced into a row, or into the totals alone.
    const price = (b, row) => {
      for (const [model, m] of Object.entries((b && b.models) || {})) {
        const c = sumsCost(model, m);
        if (!c) {
          unpriced.add(model || '(no model)');
          if (row) row.unpriced = true;
          continue;
        }
        modelled += c.cost;
        reloadTotal += c.reload;
        if (row) { row.cost += c.cost; row.reload += c.reload; }
      }
      reloadCount += num(b && b.reloads);
      stepCount += num(b && b.steps);
    };

    const prompts = (Array.isArray(e.prompts) ? e.prompts : []).map((p, k) => {
      const row = { n: k + 1, prompt: num(p.index), at: p.at || '', t: time(p.at),
                    steps: num(p.steps), context: Number.isFinite(p.context) ? p.context : null,
                    cost: 0, rest: 0, reload: 0, reloads: num(p.reloads), compaction: false, unpriced: false };
      price(p, row);
      row.rest = row.cost - row.reload;
      return row;
    });
    if (e.unowned) price(e.unowned, null);

    const owner = (t) => {
      let j = 0;
      for (let k = 0; k < prompts.length; k++) if (prompts[k].t != null && prompts[k].t <= t) j = k;
      return prompts[j] || null;
    };
    const comps = (Array.isArray(e.compactions) ? e.compactions : [])
      .filter((x) => x && time(x.at) != null)
      .map((x) => ({ at: x.at, t: time(x.at), name: compactionName(e, x.at), chars: num(x.chars),
                     before: Number.isFinite(x.context_before) ? x.context_before : null,
                     after: Number.isFinite(x.context_after) ? x.context_after : null, prompt: null }))
      .sort((a, b) => a.t - b.t);
    for (const c of comps) {
      const row = owner(c.t);
      if (row) { row.compaction = true; c.prompt = row.n; }
    }

    return {
      prompts: prompts.map(({ t, ...p }) => p),
      compactions: comps.map(({ t, ...c }) => c),
      totals: {
        measured: true,
        modelled,
        harness: Number.isFinite(e.harness_cost) ? e.harness_cost : null,
        reload: reloadTotal,
        reloads: reloadCount,
        steps: stepCount,
        prompts: prompts.length,
        compactions: comps.length,
        unpriced: [...unpriced].sort(),
      },
    };
  }

  window.SessionUsage = { PRICES, WRITE_1H, WRITE_5M, IDLE_CONTEXT, isOwnerPrompt, stepCost, compactionName, read, fromExtract };
})();
