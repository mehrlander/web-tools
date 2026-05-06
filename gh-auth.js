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
// Also exposes a small window.ghAuth helper for pages that want to
// manage the saved token explicitly (e.g. a paste-and-reload form).

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

  window.ghAuth = {
    resolve() { return readSaved(); },
    save(t)   { try { localStorage.setItem('ghToken', String(t).trim()); } catch {} },
    clear()   { try { localStorage.removeItem('ghToken'); } catch {} }
  };
})();
