if (typeof window !== 'undefined' && !window.__consoleLogs) {
  window.__consoleLogs = [];
  ['log', 'warn', 'error', 'info'].forEach(level => {
    const orig = console[level];
    console[level] = (...args) => {
      const entry = {
        level,
        msg: args.map(a => {
          try { return typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a); }
          catch (e) { return String(a); }
        }).join(' '),
        time: Date.now()
      };
      window.__consoleLogs.push(entry);
      window.dispatchEvent(new CustomEvent('consolelog', { detail: entry }));
      orig.apply(console, args);
    };
  });
  window.addEventListener('error', e => {
    const entry = { level: 'error', msg: e.message || String(e), time: Date.now() };
    window.__consoleLogs.push(entry);
    window.dispatchEvent(new CustomEvent('consolelog', { detail: entry }));
  });
  // A rejected dynamic import() (e.g. cm6's module load) surfaces here, not via
  // 'error'. Capturing it means __consoleLogs carries the cause next time.
  window.addEventListener('unhandledrejection', e => {
    const r = e.reason;
    const entry = { level: 'error', msg: 'Unhandled rejection: ' + ((r && (r.message || r.stack)) || String(r)), time: Date.now() };
    window.__consoleLogs.push(entry);
    window.dispatchEvent(new CustomEvent('consolelog', { detail: entry }));
  });
}

export default class GH {
  constructor(conf = {}) {
    this.token = conf.token || '';
    this.repo = conf.repo || '';
    this.ref = conf.ref || 'main';
  }

  async load(path) {
    let text;
    if (path.startsWith('http')) {
      const url = path.includes('raw.github') && !path.includes('?')
        ? `${path}?t=${Date.now()}`
        : path;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to load script: ${res.status}`);
      text = await res.text();
    } else {
      const file = await this.get(path);
      text = file.text;
    }

    const clean = text
      .replace(/export\s+default\s+/g, '')
      .replace(/export\s+/g, '');

    new Function(clean)();
  }

  get headers() {
    const h = { 'Accept': 'application/vnd.github.v3+json' };
    if (this.token && !this.token.includes('🎟')) {
      h.Authorization = `Bearer ${this.token.trim()}`;
    }
    return h;
  }

  async req(path, opts = {}) {
    const base = path.startsWith('/')
      ? 'https://api.github.com'
      : `https://api.github.com/repos/${this.repo}`;

    const url = path.startsWith('http')
      ? path
      : `${base}/${path.replace(/^\//, '')}`;

    const res = await fetch(url, { headers: this.headers, ...opts });

    if (!res.ok) {
      const limit = res.headers.get('x-ratelimit-remaining');
      const err = new Error(`GitHub Error ${res.status} (Rate Rem: ${limit})`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  async get(path) {
    const data = await this.req(`contents/${path}?ref=${this.ref}`);
    if (Array.isArray(data)) throw new Error('Path is a directory');
    return {
      text: this.decode(data.content),
      sha: data.sha,
      size: data.size,
      url: data.html_url
    };
  }

  decode(str) {
    const binString = atob(str.replace(/\s/g, ''));
    return new TextDecoder().decode(Uint8Array.from(binString, c => c.charCodeAt(0)));
  }
}

// Auto-bootstrap when loaded from a jsDelivr @<ref> URL: parses the
// ref out of import.meta.url and exposes a ready-to-use window.gh.
// See README.md for the ?use= page convention.
const m = typeof window !== 'undefined' &&
  import.meta.url.match(/\/\/cdn\.jsdelivr\.net\/gh\/([^/]+\/[^/@]+)@(.+?)\/gh-api\.js/);
if (m) {
  const [, repo, ref] = m;
  window.GH = GH;
  window.gh = new GH({ repo, ref });
  window.__bundleRef = ref;
  await window.gh.load('gh-auth.js');
}
