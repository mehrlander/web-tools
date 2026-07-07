// console/mods/tap.js — capture fetch/XHR responses as they fly by. The DOM
// is a lossy rendering of data that arrives as JSON; tap watches the wire
// instead. Works when the API speaks JSON or text (nearly always); it sees
// what's on the wire, so a payload the page decrypts client-side arrives
// as-is. Standalone (no base.js dependency).
//
//   tap()             arm, capture everything
//   tap(/api/)        arm with a url filter (regex, or string includes)
//   tap.hits          [{n, via, url, method, status, data}]  (data: parsed JSON or text)
//   tap.last          most recent hit
//   tap.find(v)       hits whose url matches v
//   tap.clear()       drop hits;  tap.stop()  unwrap fetch/XHR, keep hits
//
//   await tap.replay(0, {page: 7})               refetch hit 0 with mutated
//                                                query params; returns parsed data
//   await tap.walk(0, {param: 'page', to: 40})   walk a param across a range:
//                                                paginate the API without
//                                                scrolling; stops early when
//                                                `until(data)` (default: empty
//                                                array) says the well is dry
//
// Each capture also dispatches window CustomEvent 'tap' ({detail: hit}) for
// live consumers (e.g. the deck). Replays go through window.fetch, so an
// armed tap records them as new hits.
(() => {
  let armed = null;
  const hits = [];
  // Duck-typed regex check: instanceof fails cross-realm (console vs page
  // frame), and String.includes throws on a regex rather than coercing it.
  const isRe = f => !!f && typeof f === 'object' && typeof f.test === 'function';
  const matches = (url, f) => !f || (isRe(f) ? f.test(url) : String(url).includes(f));
  const parse = (body, ct) => {
    if (typeof body !== 'string') return body;
    if (/json/.test(ct || '') || /^\s*[\[{]/.test(body)) { try { return JSON.parse(body); } catch {} }
    return body;
  };
  const push = hit => {
    hit.n = hits.length;
    hits.push(hit);
    window.dispatchEvent(new CustomEvent('tap', { detail: hit }));
    console.log(`tap[${hit.n}] ${hit.method} ${hit.status} ${hit.url}`);
  };

  const tap = filter => {
    tap.filter = filter;
    if (armed) { console.log('tap: filter updated'); return tap; }

    const origFetch = window.fetch ? window.fetch.bind(window) : null;
    if (origFetch) {
      const isReq = v => typeof Request !== 'undefined' && v instanceof Request;
      window.fetch = async (...args) => {
        const res = await origFetch(...args);
        try {
          const url = isReq(args[0]) ? args[0].url : String(args[0]);
          if (matches(url, tap.filter)) {
            const method = ((isReq(args[0]) ? args[0].method : args[1]?.method) || 'GET').toUpperCase();
            res.clone().text()
              .then(t => push({ via: 'fetch', url, method, status: res.status, data: parse(t, res.headers?.get?.('content-type')) }))
              .catch(() => {});
          }
        } catch {}
        return res;
      };
    }

    const XP = window.XMLHttpRequest?.prototype;
    const origOpen = XP?.open, origSend = XP?.send;
    if (XP) {
      XP.open = function (method, url, ...rest) {
        this.__tap = { method: String(method).toUpperCase(), url: String(url) };
        return origOpen.call(this, method, url, ...rest);
      };
      XP.send = function (...a) {
        this.addEventListener('load', () => {
          const t = this.__tap;
          if (!t || !matches(t.url, tap.filter)) return;
          const body = (this.responseType === '' || this.responseType === 'text') ? this.responseText : this.response;
          push({ via: 'xhr', url: t.url, method: t.method, status: this.status, data: parse(body, this.getResponseHeader?.('content-type')) });
        });
        return origSend.apply(this, a);
      };
    }

    armed = { origFetch, XP, origOpen, origSend };
    console.log(`tap: armed${tap.filter ? ` (filter: ${tap.filter})` : ''} — tap.hits, tap.stop()`);
    return tap;
  };

  tap.hits = hits;
  Object.defineProperty(tap, 'last', { get: () => hits[hits.length - 1] });
  tap.find = v => hits.filter(h => matches(h.url, v));
  tap.clear = () => { hits.length = 0; return tap; };
  tap.stop = () => {
    if (!armed) { console.warn('tap: not armed'); return tap; }
    if (armed.origFetch) window.fetch = armed.origFetch;
    if (armed.XP) { armed.XP.open = armed.origOpen; armed.XP.send = armed.origSend; }
    armed = null;
    console.log(`tap: stopped — ${hits.length} hits kept`);
    return tap;
  };
  // A captured hit is a request template. GETs only — tap doesn't record
  // request bodies.
  tap.replay = async (h, params = {}) => {
    const hit = typeof h === 'number' ? hits[h] : h;
    if (!hit) { console.warn('tap.replay: no such hit'); return null; }
    const u = new URL(hit.url, (typeof location !== 'undefined' && location.href) || 'http://replay.local/');
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
    const res = await window.fetch(u.toString(), hit.method && hit.method !== 'GET' ? { method: hit.method } : undefined);
    const body = await res.text();
    return parse(body, res.headers?.get?.('content-type'));
  };

  tap.walk = async (h, { param, from = 1, to = from + 19, step = 1, delay = 250, until } = {}) => {
    if (!param) { console.warn('tap.walk: {param} is required'); return []; }
    const dry = until ?? (d => d == null || (Array.isArray(d) && d.length === 0));
    const out = [];
    for (let v = from; step > 0 ? v <= to : v >= to; v += step) {
      const data = await tap.replay(h, { [param]: v });
      if (dry(data)) { console.log(`tap.walk: dry at ${param}=${v}`); break; }
      out.push({ [param]: v, data });
      if (delay) await new Promise(r => setTimeout(r, delay));
    }
    console.log(`tap.walk: ${out.length} pages collected`);
    return out;
  };

  window.tap = tap;
})();
