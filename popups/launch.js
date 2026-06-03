/*
 * popups/launch.js — the popup launcher menu.
 *
 * The launcher bookmarklet opens ONE blank window from the host page. That
 * window inherits the host's origin, and the bookmarklet fetches this file's
 * text through the GitHub API and runs it inside that window — the same load
 * path the popups use, so no GitHub Pages or CDN is involved. Everything here
 * runs ON THE HOST ORIGIN, and window.opener stays a live handle to the host
 * page — the whole point of a popup.
 *
 * Inputs ride in on globals the bookmarklet set on the popup window:
 *   window.__ghToken — GitHub token (see README "Popups"); edit it there.
 *   window.__ghRepo / window.__ghRef — which repo/ref to read popups from,
 *     defaulting to this repo's main.
 *
 * Flow:
 *   1. List popups/ via the GitHub contents API.
 *   2. Paint a menu into THIS window.
 *   3. On pick, fetch the chosen popup's HTML (contents API + base64 decode,
 *      same path lib/gh-api.js uses) and document.write it into THIS same
 *      window. The menu "flops over" into the tool while the window object —
 *      and thus the host origin and window.opener — never change.
 */
(async () => {
  const REPO = window.__ghRepo || 'mehrlander/web-tools';
  const REF = window.__ghRef || 'main';
  const token = window.__ghToken || '';
  const headers = token ? { Authorization: 'Bearer ' + token } : {};

  // Host page we're coupled to (same origin, so this read is allowed).
  let host = 'this origin';
  try { host = window.opener.location.hostname || host; } catch (_) {}

  const css = `
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body { margin: 0; font: 14px/1.4 system-ui, -apple-system, sans-serif;
      background: #0f172a; color: #e2e8f0; min-height: 100vh;
      display: grid; place-items: start center; padding: 28px 16px; }
    .card { width: 100%; max-width: 460px; }
    h1 { margin: 0 0 2px; font-size: 17px; }
    .sub { margin: 0 0 16px; color: #94a3b8; font-size: 12px; }
    .sub b { color: #cbd5e1; }
    .list { display: flex; flex-direction: column; gap: 6px; }
    button { display: flex; align-items: center; justify-content: space-between;
      width: 100%; text-align: left; padding: 12px 14px; cursor: pointer;
      background: #1e293b; color: #e2e8f0; border: 1px solid #334155;
      border-radius: 10px; font: inherit; transition: .12s; }
    button:hover { background: #283548; border-color: #6366f1; }
    .name { font-weight: 600; }
    .chev { color: #64748b; }
    button:hover .chev { color: #a5b4fc; }
    .err { color: #fca5a5; }
    .hint { color: #94a3b8; font-size: 12px; }
  `;
  const shell = body => {
    document.title = 'Popups';
    document.body.innerHTML = `<style>${css}</style><div class="card">${body}</div>`;
  };

  // 1. List popups/
  let files;
  try {
    const data = await fetch(
      `https://api.github.com/repos/${REPO}/contents/popups?ref=${REF}`, { headers }
    ).then(r => r.json());
    if (!Array.isArray(data)) throw new Error(data.message || 'unexpected API response');
    files = data.filter(f => f.name.endsWith('.html') && f.name !== 'launch.js');
  } catch (e) {
    shell(`<h1>Popups</h1>
      <p class="err">Couldn't list popups: ${e.message}</p>
      <p class="hint">Check the token in the bookmarklet, or wait out the rate limit.</p>`);
    return;
  }

  // 3. Flop this window over into the chosen popup. The raw Accept header
  // returns the file's text directly, so there's no base64 to decode — the
  // same load the bootstrap uses for this file.
  const flop = async f => {
    shell(`<h1>Loading ${f.name.replace(/\.html$/, '')}…</h1>`);
    try {
      const html = await fetch(f.url, {
        headers: { ...headers, Accept: 'application/vnd.github.raw' }
      }).then(r => r.text());
      document.open(); document.write(html); document.close();
    } catch (e) {
      shell(`<p class="err">Couldn't load ${f.name}: ${e.message}</p>`);
    }
  };

  // 2. Paint the menu.
  shell(`<h1>Open a popup</h1>
    <p class="sub">on <b>${host}</b> · ${files.length} available</p>
    <div class="list">${files.map((f, i) => `<button data-i="${i}">
      <span class="name">${f.name.replace(/\.html$/, '')}</span>
      <span class="chev">→</span></button>`).join('')}</div>`);

  document.body.querySelector('.list').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b) flop(files[+b.dataset.i]);
  });
})();
