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

    const match = clean.match(/(?:class|function)\s+(\w+)/);
    const name = match ? match[1] : null;
    const body = name ? `${clean}; return ${name};` : clean;
    return new Function(body)();
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
