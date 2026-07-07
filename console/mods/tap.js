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
// Each capture also dispatches window CustomEvent 'tap' ({detail: hit}) for
// live consumers (e.g. the deck).
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
  window.tap = tap;
})();
