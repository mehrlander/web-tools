// gh-auth.js — token resolution patch for gh-api.js.
//
// Loaded via gh.load() after gh-api.js bootstraps. Patches the
// GH.prototype.headers getter so that the first request after
// construction reads localStorage.ghToken when the constructor's token
// is missing or still contains the 🎟️GitHubToken sentinel. This means
// pages can do:
//
//   const { default: GH } = await import('.../gh-api.js');
//   window.GH = GH;
//   const gh = new GH({ repo: 'foo/bar' });
//   await gh.load('gh-auth.js');           // anonymous load (small)
//   await gh.load('something-else.js');    // authenticated if a token is saved
//
// without plumbing a token through the constructor on every page. The
// 🎟️GitHubToken sentinel is preserved so pages embedded in iOS Shortcut
// data: URLs (where the shortcut substitutes a real token in for the
// sentinel before launching) keep working — if the substitution
// happened, this.token won't contain 🎟 and the patched getter is a
// no-op; if it didn't, the localStorage fallback fires.
//
// Also patches GH.prototype.req so that a 401/403 from the GitHub API
// automatically takes over the page with a token-entry form. This is
// what makes a stale token recoverable on mobile — without it, pages
// just die mid-load with no UI to paste a new token. The prompt is
// idempotent: a cascade of failed requests won't thrash the DOM.
//
// Also exposes a small window.ghAuth helper for pages that want to
// manage the saved token explicitly (e.g. a paste-and-reload form, or
// raising the prompt before any failure).

(() => {
  if (!window.GH) {
    throw new Error('gh-auth.js requires window.GH (load gh-api.js first)');
  }

  const proto = window.GH.prototype;
  const desc  = Object.getOwnPropertyDescriptor(proto, 'headers');
  const orig  = desc && desc.get;
  if (!orig) {
    throw new Error('gh-auth.js could not find GH.prototype.headers getter');
  }

  const readSaved = () => {
    try { return localStorage.getItem('ghToken') || ''; } catch { return ''; }
  };

  Object.defineProperty(proto, 'headers', {
    configurable: true,
    get() {
      if (!this.token || this.token.includes('🎟')) {
        const saved = readSaved();
        if (saved) this.token = saved;
      }
      return orig.call(this);
    }
  });

  let promptShown = false;
  const showPrompt = (msg) => {
    if (promptShown || typeof document === 'undefined' || !document.body) return;
    promptShown = true;
    const safe = String(msg || '').replace(/[<&]/g, c => c === '<' ? '&lt;' : '&amp;');
    document.body.innerHTML = `
      <form id="__ghAuthForm" class="max-w-md mx-auto mt-10 p-4">
        <h2 class="font-semibold text-lg mb-2">GitHub token needed</h2>
        <p class="text-sm opacity-70 mb-4 break-words">${safe}</p>
        <div class="flex flex-wrap gap-2 mb-2">
          <input name="t" type="password" placeholder="GitHub token"
            class="input input-bordered input-sm flex-1 min-w-56 font-mono"
            autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">
          <button class="btn btn-sm">Save &amp; retry</button>
        </div>
        <button name="clear" class="btn btn-link btn-xs opacity-60 px-0">Retry without token</button>
      </form>
    `;
    const f = document.getElementById('__ghAuthForm');
    f.onsubmit = (e) => {
      e.preventDefault();
      const clear = e.submitter?.name === 'clear';
      const t = clear ? '' : f.querySelector('[name=t]').value.trim();
      try { t ? localStorage.setItem('ghToken', t) : localStorage.removeItem('ghToken'); } catch {}
      location.reload();
    };
  };

  const origReq = proto.req;
  proto.req = async function (path, opts = {}) {
    try {
      return await origReq.call(this, path, opts);
    } catch (e) {
      if (e && (e.status === 401 || e.status === 403)) showPrompt(e.message);
      throw e;
    }
  };

  window.ghAuth = {
    resolve() { return readSaved(); },
    save(t)   { try { localStorage.setItem('ghToken', String(t).trim()); } catch {} },
    clear()   { try { localStorage.removeItem('ghToken'); } catch {} },
    prompt(msg) { showPrompt(msg); }
  };
})();
