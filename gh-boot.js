// gh-boot.js — auto-loaded by gh-api.js's bootstrap. The list of scripts
// pulled at startup lives here, not in gh-api.js, so adding new entries
// doesn't require purging gh-api.js from the jsDelivr cache.
//
// gh.load() awaits its loaded script's return value, so we return the
// async IIFE's promise to make the boot chain awaitable.
//
// Also wraps GH.prototype.load so each load pushes an entry onto
// window.__loadedScripts ({path, t, endT, status, error}). The FAB's
// Scripts tab reads that registry to answer "is X actually loaded?"
// without dev tools. Seeded with gh-api.js (loaded via <script
// type=module>) and gh-boot.js itself, since both arrived before the
// wrapper was installed.

return (async () => {
  if (!window.gh) throw new Error('gh-boot.js requires window.gh');

  const now = Date.now();
  window.__loadedScripts = [
    { path: 'gh-api.js',  t: now, endT: now, status: 'ok' },
    { path: 'gh-boot.js', t: now, endT: now, status: 'ok' }
  ];
  const fire = () => window.dispatchEvent(new CustomEvent('loadedscripts'));
  fire();

  // A load whose underlying fetch never returns leaves its entry on
  // 'pending' forever — a silent spinner in the Scripts tab with no signal.
  // After STALL_MS, flip a still-pending row to a visible 'error' with the
  // elapsed time so the stall surfaces. It's diagnostic, not fatal: the
  // original promise stays alive, so if the load later settles the try/catch
  // below overwrites this with the real ok/error outcome (self-healing).
  const STALL_MS = 15000;
  const proto = window.gh.constructor.prototype;
  const origLoad = proto.load;
  proto.load = async function(path) {
    const entry = { path, t: Date.now(), status: 'pending' };
    window.__loadedScripts.push(entry);
    fire();
    const stallTimer = setTimeout(() => {
      if (entry.status !== 'pending') return;
      entry.status = 'error';
      entry.error = `stalled: no response in ${STALL_MS}ms`;
      entry.endT = Date.now();
      fire();
    }, STALL_MS);
    try {
      const r = await origLoad.call(this, path);
      clearTimeout(stallTimer);
      entry.status = 'ok';
      entry.error = null;
      entry.endT = Date.now();
      fire();
      return r;
    } catch (e) {
      clearTimeout(stallTimer);
      entry.status = 'error';
      entry.error = (e && e.message) || String(e);
      entry.endT = Date.now();
      fire();
      throw e;
    }
  };

  await window.gh.load('gh-auth.js');
  await window.gh.load('gh-fetch.js');
  // Console retention layer — extends console.* with history/subscribe/filter
  // on top of gh-api.js's wrapper, so any page can render captured logs.
  await window.gh.load('kits/console.js');
})();
