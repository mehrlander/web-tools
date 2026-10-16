// ── traffic-log: the app writes down what its calls did worth reading ──────
//
// The Traffic pane shows one open page's calls, and only to the person looking
// at it, and only until a reload. The question it was built for (is the app
// making calls it does not need, or pulling data nobody reads) needs the record
// where a session can read it, across tabs and devices and days. So the app
// files it: a JSON file per finding window in web-tools-private's logs/traffic/,
// committed through the viewer's own token, the channel kits/page-report.js
// already uses for logs/page/.
//
// IT WRITES WHAT IS OF INTEREST, NOT A SCHEDULE. Every five minutes, and when
// the tab is hidden, it reads the calls the window held and asks
// Traffic.trafficFindings for what stands out: a call repeated, calls made while
// the tab was hidden, a failure, a large download, a heavy window, or the
// token's calls falling fast. A window with none of those writes nothing. A
// finding filed within the hour on this device is left out, so a steady poll
// is filed once an hour with its rate rather than every five minutes.
//
// WHAT IT NEVER WRITES: the token or any header. URLs name private repos and
// paths, which is why the log lives in the private repo.
//
// Its own writes are calls too. They run as the job "Traffic log", so the
// Traffic pane lists them, and a window leaves them out of its findings.
//
// Off for good with TrafficLog.disable(), or for one load with ?report=off, the
// switch page reports honor. Started by the app (app/index.html); loading this
// file starts nothing. Attaches window.TrafficLog.
(function () {
  const CFG = { repo: 'mehrlander/web-tools-private', dir: 'logs/traffic', everyMs: 5 * 60000, quietMs: 60 * 60000 };
  const OFF_KEY = 'trafficLog:off';
  const SEEN_KEY = 'trafficLog:seen';
  const get = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const drop = (k) => { try { localStorage.removeItem(k); } catch (e) {} };
  const off = () => get(OFF_KEY) === '1' || /[?&]report=off\b/.test(location.search);
  const own = (e) => /\/contents\/logs\/traffic\//.test(String(e.url || ''));
  const tab = Math.random().toString(36).slice(2, 8);

  // The signatures filed lately on this device, with when.
  const seen = () => { try { return JSON.parse(get(SEEN_KEY) || '{}'); } catch (e) { return {}; } };
  function remember(sigs, now) {
    const s = seen();
    for (const k of Object.keys(s)) if (now - s[k] >= CFG.quietMs) delete s[k];
    for (const sig of sigs) s[sig] = now;
    set(SEEN_KEY, JSON.stringify(s));
  }

  // Where the last window ended: the ledger's running call number, the clock,
  // and the token's remaining calls with the hour they count against.
  let last = { n: 0, calls: 0, at: Date.now(), rate: null, reset: null };
  let checking = false, lastCheck = 0, timer = null;

  // As page reports ask it: gh-auth fills the instance's token only when a
  // request is about to be made, so storage is the answer before that.
  function token(gh) {
    try { return gh.token || localStorage.getItem('ghToken') || ''; } catch (e) { return ''; }
  }
  function jobName(id) {
    const j = (window.__jobs || []).find(x => x.id === id);
    return j ? j.name : 'job ' + id;
  }

  async function check(why = 'timer') {
    const T = window.Traffic;
    if (checking || off() || !T || typeof GH !== 'function') return { ok: false, why: 'not running' };
    checking = true;
    lastCheck = Date.now();
    try {
      const now = Date.now();
      const totals = window.__trafficTotals || {};
      const rows = (window.__traffic || []).filter(e => e.n > last.n && !own(e));
      const rate = window.__trafficRate;
      const reset = window.__trafficRateReset || null;
      const findings = T.trafficFindings(rows, {
        owner: (e) => e.job != null ? jobName(e.job) : e.where ? 'view ' + e.where : 'page load',
        rate: { from: reset === last.reset ? last.rate : null, to: rate },
      });
      const win = { from: new Date(last.at).toISOString(), to: new Date(now).toISOString(),
                    calls: (totals.calls || 0) - last.calls, held: rows.length,
                    wire: rows.reduce((n, e) => n + (typeof e.wire === 'number' ? e.wire : 0), 0),
                    hidden: rows.filter(e => e.hidden).length };
      const views = [...new Set(rows.map(e => e.where).filter(Boolean))];
      last = { n: totals.calls || last.n, calls: totals.calls || 0, at: now, rate, reset };

      const s = seen();
      const fresh = findings.filter(f => !(s[f.sig] && now - s[f.sig] < CFG.quietMs));
      if (!fresh.length) return (TrafficLog.last = { ok: false, why: 'nothing new', at: now });
      const gh = new GH({ repo: CFG.repo, ref: '' });
      if (!token(gh)) return (TrafficLog.last = { ok: false, why: 'no token', at: now });

      // The memory the page holds as it writes: the JS heap (Chrome alone
      // reports it) and the elements on the page.
      let heap = null;
      try { if (performance.memory) heap = performance.memory.usedJSHeapSize; } catch (e) {}
      const doc = {
        v: 1, at: new Date(now).toISOString(), tab, why,
        page: location.pathname + location.search,
        device: (() => { try { return matchMedia('(pointer: coarse)').matches ? 'touch' : 'pointer'; } catch (e) { return null; } })(),
        openMin: Math.round((now - (performance.timeOrigin || now)) / 60000),
        window: win, views, rate: { remaining: rate ?? null },
        memory: { heap, elements: document.getElementsByTagName('*').length },
        findings: fresh,
      };
      const stamp = doc.at.slice(11, 19).replace(/:/g, '');
      const path = `${CFG.dir}/${doc.at.slice(0, 10)}/${stamp}-${tab}.json`;
      // Remembered before the write, as page reports learned to: two triggers
      // racing would otherwise both pass the quiet check and file twice.
      remember(fresh.map(f => f.sig), now);
      const write = () => gh.save(path, doc, 'Log tab traffic (logs/traffic)');
      await (window.__job ? window.__job('Traffic log', { cause: 'timer' }, write) : write());
      return (TrafficLog.last = { ok: true, path, findings: fresh.length, at: now });
    } catch (e) {
      return (TrafficLog.last = { ok: false, why: String(e && e.message || e).slice(0, 200), at: Date.now() });
    } finally {
      checking = false;
    }
  }

  const TrafficLog = {
    last: null,
    start() {
      if (timer) return this;
      timer = setInterval(() => check('timer'), CFG.everyMs);
      // A tab going to the background is the moment its record is most
      // likely to matter and least likely to be looked at; a minute's floor
      // keeps flipping between tabs from checking on every flip.
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && Date.now() - lastCheck > 60000) check('hide');
      });
      return this;
    },
    check,
    disable() { set(OFF_KEY, '1'); return this; },
    enable() { drop(OFF_KEY); return this; },
    // For a reader who wants the next occurrence of everything filed.
    forget() { drop(SEEN_KEY); return this; },
  };
  window.TrafficLog = TrafficLog;
})();
