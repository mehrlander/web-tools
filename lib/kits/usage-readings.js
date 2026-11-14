// kits/usage-readings.js — every session's usage extract folded into five
// readings of where token spending goes, for the app's Usage tab.
//
//   UsageReadings.fold(extracts, { now }) -> { now, sessions, spend, calls,
//       reloads, continue, compactions }
//   UsageReadings.session(extract, now)       one session's part of each
//   UsageReadings.breakEven(before, typical)  the calls a typical compaction
//       of that context needs to pay for itself, or null
//
// Pure: no network and no DOM. An extract is web-tools-private's
// sessions/usage/YYYY/MM/<record name>.json (schema usage/1,
// sessions/tools/usage.py), tokens and times only. Every dollar is those
// tokens at kits/session-usage.js's prices (PRICES, WRITE_1H, WRITE_5M), read
// when fold runs: this file holds no price. A model that table lacks adds
// nothing, and spend.unpriced names it.
//
//   spend        the cost in four parts: reading the context on each call
//                (cache reads, and the little input no cache held), idle
//                re-loads (what the steps that re-wrote a lapsed context
//                wrote), other cache writes, output. The same per session.
//   calls        model calls per owner prompt, in bins of 1, 2-3, 4-7 and
//                doubling to 64 and over, as shares of prompts and of calls.
//   reloads      idle re-loads by what ended the idle gap, in the dollars
//                they wrote. An extract from before `idle_reloads` counts its
//                re-loads as `unlisted`, so the rows add up to spend's.
//   continue     what the next message to each session costs at `now`: its
//                context at the cache-read price, or at the one-hour write
//                price once its last step is over an hour old. `cold` is the
//                second figure either way.
//   compactions  what each compaction cost against what it saved.
//
// A COMPACTION'S COST IS PARTLY AN ESTIMATE. No record counts the call that
// writes the summary, so it is modelled: the old context read once, at the
// cache-read price, or at the one-hour write price where the compaction came
// over an hour after the step before it, plus an output of one token per two
// characters of summary. The first call afterwards, which writes the new
// context, is added as recorded.
//
// WHAT IT SAVED IS A DELIBERATELY SIMPLE MODEL: each call after it, up to the
// next compaction or the session's end, is taken to read the context the
// compaction removed at the cache-read price. That the context grows again,
// and would have grown without the compaction, is not modelled. Break-even is
// the cost over one call's saving.
(function () {
  const HOUR = 3600000;
  const BINS = [[1, 1], [2, 3], [4, 7], [8, 15], [16, 31], [32, 63], [64, Infinity]];
  const ENDERS = ['owner', 'session', 'pr', 'task', 'schedule', 'agent', 'restart', 'other'];

  const num = (v) => (Number.isFinite(v) ? v : 0);
  const time = (iso) => { const t = Date.parse(iso || ''); return Number.isNaN(t) ? null : t; };
  const median = (xs) => {
    if (!xs.length) return null;
    const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };

  // A model's prices per million tokens, the two cache-write rates worked out,
  // or null where the table has none.
  function rates(model) {
    const U = window.SessionUsage;
    const p = U && U.PRICES[model];
    return p ? { input: p.input, output: p.output, read: p.cacheRead, w1: p.input * U.WRITE_1H, w5: p.input * U.WRITE_5M } : null;
  }
  const wrote = (p, h1, m5) => (num(h1) * p.w1 + num(m5) * p.w5) / 1e6;

  // The model of the last step, for an extract written before
  // `last_step_model`: the busiest model of the last prompt that used one.
  function lastModel(buckets) {
    for (let i = buckets.length - 1; i >= 0; i--) {
      const ms = Object.entries(buckets[i].models || {});
      if (!ms.length) continue;
      const weight = (m) => Object.values(m).reduce((a, v) => a + num(v), 0);
      return ms.sort((a, b) => weight(b[1]) - weight(a[1]))[0][0];
    }
    return '';
  }

  function session(extract, now) {
    const e = extract || {};
    const prompts = Array.isArray(e.prompts) ? e.prompts : [];
    const buckets = e.unowned ? [...prompts, e.unowned] : prompts;
    const parts = { read: 0, reload: 0, write: 0, output: 0 };
    const unpriced = new Set();
    let calls = 0, reloadCount = 0;
    for (const b of buckets) {
      calls += num(b.steps);
      reloadCount += num(b.reloads);
      for (const [model, m] of Object.entries(b.models || {})) {
        const p = rates(model);
        if (!p) { unpriced.add(model || '(no model)'); continue; }
        const reload = wrote(p, m.reload_write_1h, m.reload_write_5m);
        parts.read += (num(m.cache_read) * p.read + num(m.input) * p.input) / 1e6;
        parts.reload += reload;
        parts.write += wrote(p, m.cache_write_1h, m.cache_write_5m) - reload;
        parts.output += num(m.output) * p.output / 1e6;
      }
    }
    const model = e.last_step_model || lastModel(buckets);

    const listed = Array.isArray(e.idle_reloads);
    const reloads = (listed ? e.idle_reloads : []).map((r) => {
      const p = rates(r.model);
      return { at: r.at || '', gap: num(r.gap_ms), ender: ENDERS.includes(r.ender) ? r.ender : 'other',
               model: r.model || '', cost: p ? wrote(p, r.write_1h, r.write_5m) : null };
    });

    const lastT = time(e.last_step_at);
    let cont = null;
    if (Number.isFinite(e.context_now) && e.context_now > 0 && lastT != null) {
      const p = rates(model);
      const idle = now - lastT, lapsed = idle > HOUR;
      const warm = p ? e.context_now * p.read / 1e6 : null, cold = p ? e.context_now * p.w1 / 1e6 : null;
      cont = { context: e.context_now, model, at: e.last_step_at, t: lastT, lapsed,
               cost: lapsed ? cold : warm, cold, left: lapsed ? 0 : Math.max(0, HOUR - idle) };
    }

    const compactions = (Array.isArray(e.compactions) ? e.compactions : []).filter((c) => c && time(c.at) != null).map((c) => {
      const before = Number.isFinite(c.context_before) ? c.context_before : null;
      const after = Number.isFinite(c.context_after) ? c.context_after : null;
      const followed = Number.isFinite(c.steps_after) ? c.steps_after : null;
      const row = { name: window.SessionUsage.compactionName(e, c.at), at: c.at, t: time(c.at), before, after,
                    chars: num(c.chars), calls: followed, model: c.model || model,
                    cost: null, summary: null, first: null, fixed: null, rate: null, perCall: null, saved: null, even: null, paid: null };
      const p = rates(row.model);
      if (!p || before == null) return row;
      // The summarizing call, estimated: the old context read once and the
      // summary written out. Then the first call after, as recorded. `fixed`
      // is the part of the cost that does not grow with the old context.
      const out = (row.chars / 2) * p.output / 1e6;
      row.summary = before * (num(c.gap_ms) > HOUR ? p.w1 : p.read) / 1e6 + out;
      row.first = wrote(p, c.write_1h, c.write_5m);
      row.cost = row.summary + row.first;
      row.fixed = out + row.first;
      row.rate = p.read;
      if (after == null || after >= before) return row;
      row.perCall = (before - after) * p.read / 1e6;
      row.even = row.cost / row.perCall;
      if (followed != null) { row.saved = followed * row.perCall; row.paid = row.saved >= row.cost; }
      return row;
    });

    return {
      id: (e.day || '') + '-' + (e.short || ''), short: e.short || '', day: e.day || '',
      ask: e.opening_ask || '', lastT,
      parts, cost: parts.read + parts.reload + parts.write + parts.output,
      unpriced: [...unpriced].sort(),
      steps: prompts.map((p) => num(p.steps)), calls,
      reloads, unlisted: listed || !reloadCount ? null : { n: reloadCount, cost: parts.reload },
      continue: cont, compactions,
    };
  }

  // The calls a compaction of `before` tokens needs before it has paid for
  // itself, for the typical compaction: the middle one's fixed cost (its
  // summary's output and its first write), context afterwards and read price.
  function breakEven(before, typical) {
    const t = typical || {};
    if (!(t.read > 0) || !(before > t.after)) return null;
    return (before * t.read / 1e6 + t.fixed) / ((before - t.after) * t.read / 1e6);
  }

  function fold(extracts, opts = {}) {
    const now = Number.isFinite(opts.now) ? opts.now : Date.now();
    const sessions = (Array.isArray(extracts) ? extracts : []).filter((e) => e && typeof e === 'object').map((e) => session(e, now));

    // Spend.
    const total = { read: 0, reload: 0, write: 0, output: 0 };
    const unpriced = new Map();
    for (const s of sessions) {
      for (const k of Object.keys(total)) total[k] += s.parts[k];
      for (const m of s.unpriced) unpriced.set(m, (unpriced.get(m) || 0) + 1);
    }
    const spendRows = sessions.filter((s) => s.cost > 0).sort((a, b) => b.cost - a.cost || a.id.localeCompare(b.id));
    const days = sessions.map((s) => s.day).filter(Boolean).sort();
    const lasts = sessions.map((s) => s.lastT).filter((t) => t != null);
    const spend = {
      parts: total, total: total.read + total.reload + total.write + total.output,
      rows: spendRows, max: spendRows.length ? spendRows[0].cost : 0,
      unpriced: [...unpriced].map(([model, n]) => ({ model, sessions: n })).sort((a, b) => b.sessions - a.sessions || a.model.localeCompare(b.model)),
      sessions: sessions.length, from: days[0] || '', to: lasts.length ? new Date(Math.max(...lasts)).toISOString() : '',
    };

    // Calls per prompt.
    const steps = sessions.flatMap((s) => s.steps);
    const made = steps.filter((n) => n > 0);
    const callTotal = made.reduce((a, n) => a + n, 0);
    const bins = BINS.map(([lo, hi]) => {
      const xs = made.filter((n) => n >= lo && n <= hi);
      const sum = xs.reduce((a, n) => a + n, 0);
      return { lo, hi, prompts: xs.length, calls: sum,
               promptShare: made.length ? xs.length / made.length : 0, callShare: callTotal ? sum / callTotal : 0 };
    });
    const calls = { bins, prompts: made.length, calls: callTotal, none: steps.length - made.length,
                    median: median(made), mean: made.length ? callTotal / made.length : null,
                    max: Math.max(0, ...bins.map((b) => Math.max(b.promptShare, b.callShare))) };

    // Idle re-loads by what ended the gap.
    const by = new Map();
    const enderRow = (k) => by.get(k) || by.set(k, { ender: k, n: 0, cost: 0, gaps: [] }).get(k);
    for (const s of sessions) {
      for (const r of s.reloads) {
        const row = enderRow(r.ender);
        row.n++; row.cost += num(r.cost); row.gaps.push(r.gap);
      }
      if (s.unlisted) { const row = enderRow('unlisted'); row.n += s.unlisted.n; row.cost += s.unlisted.cost; }
    }
    const reloadRows = [...by.values()].map((r) => ({ ender: r.ender, n: r.n, cost: r.cost, gap: median(r.gaps) }))
      .sort((a, b) => (a.ender === 'unlisted') - (b.ender === 'unlisted') || b.cost - a.cost || b.n - a.n);
    const reloads = { rows: reloadRows, n: reloadRows.reduce((a, r) => a + r.n, 0), cost: reloadRows.reduce((a, r) => a + r.cost, 0),
                      max: Math.max(0, ...reloadRows.map((r) => r.cost)) };

    // The next message. Dearest first; a session with no price goes last.
    const contRows = sessions.filter((s) => s.continue)
      .sort((a, b) => (b.continue.cost ?? -1) - (a.continue.cost ?? -1) || b.continue.t - a.continue.t);
    const cont = { rows: contRows, warm: contRows.filter((s) => !s.continue.lapsed).length,
                   lapsed: contRows.filter((s) => s.continue.lapsed).length,
                   max: Math.max(0, ...contRows.map((s) => num(s.continue.cost))) };

    // Compactions, newest first.
    const compRows = sessions.flatMap((s) => s.compactions.map((c) => ({ ...c, session: s.id, short: s.short, day: s.day, ask: s.ask })))
      .sort((a, b) => b.t - a.t || a.name.localeCompare(b.name));
    const costed = compRows.filter((c) => c.cost != null);
    const judged = compRows.filter((c) => c.paid != null);
    const compactions = {
      rows: compRows, n: compRows.length,
      cost: costed.reduce((a, c) => a + c.cost, 0), saved: judged.reduce((a, c) => a + c.saved, 0),
      judged: judged.length, paid: judged.filter((c) => c.paid).length,
      even: median(compRows.filter((c) => c.even != null).map((c) => c.even)),
      typical: {
        fixed: median(costed.map((c) => c.fixed)) || 0,
        after: median(compRows.filter((c) => c.after != null).map((c) => c.after)) || 0,
        read: median(costed.map((c) => c.rate)) || 0,
      },
    };

    return { now, sessions, spend, calls, reloads, continue: cont, compactions };
  }

  window.UsageReadings = { fold, session, breakEven };
})();
