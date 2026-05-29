(() => {
  if (!window.GH) {
    throw new Error('gh-fetch.js requires window.GH (load gh-api.js first)');
  }

  const proto = window.GH.prototype;

  proto.repos = async function(user = 'anthropics') {
    const endpoint = this.headers.Authorization ? '/user/repos' : `/users/${user}/repos`;
    return this.req(`${endpoint}?sort=updated&per_page=100`);
  };

  proto.ls = async function(path = '') {
    const data = await this.req(`contents/${path}?ref=${this.ref}`);
    if (!Array.isArray(data)) throw new Error('Path is not a directory');
    return data.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'dir' ? -1 : 1;
    });
  };

  proto.branches = async function(per = 100) {
    return this.req(`branches?per_page=${per}`);
  };

  // GraphQL primitive: POST to the v4 endpoint reusing the REST token in
  // `this.headers`. The first GraphQL path in the codebase; REST `req()` can't
  // reach it (different host + verb), so this stands alongside rather than under it.
  proto.graphql = async function(query, variables = {}) {
    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: { ...this.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables })
    });
    if (!res.ok) {
      const err = new Error(`GitHub GraphQL Error ${res.status}`);
      err.status = res.status;
      throw err;
    }
    const json = await res.json();
    if (json.errors) throw new Error(json.errors.map(e => e.message).join('; '));
    return json.data;
  };

  // Branches with tip-commit dates, server-sorted newest-first. REST's
  // branches endpoint carries no commit date, so this goes through GraphQL.
  proto.branchesDated = async function(per = 100) {
    const [owner, name] = (this.repo || '').split('/');
    const data = await this.graphql(
      `query($owner:String!, $name:String!, $per:Int!) {
        repository(owner:$owner, name:$name) {
          refs(refPrefix:"refs/heads/", first:$per, orderBy:{field:COMMITTED_DATE, direction:DESC}) {
            nodes { name target { ... on Commit { committedDate } } }
          }
        }
      }`,
      { owner, name, per }
    );
    const nodes = (data && data.repository && data.repository.refs && data.repository.refs.nodes) || [];
    return nodes.map(n => {
      const date = n.target && n.target.committedDate;
      return { name: n.name, date: date || '', ago: date ? this.ago(date) : '' };
    });
  };

  proto.tags = async function(per = 100) {
    return this.req(`tags?per_page=${per}`);
  };

  proto.commit = async function(sha) {
    return this.req(`commits/${sha}`);
  };

  proto.compare = async function(base, head) {
    return this.req(`compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`);
  };

  proto.history = async function(path, limit = 20) {
    const data = await this.req(`commits?path=${encodeURIComponent(path)}&sha=${this.ref}&per_page=${limit}`);
    return data.map(c => ({
      sha: c.sha,
      msg: c.commit.message.split('\n')[0].slice(0, 80),
      date: c.commit.committer.date,
      ago: this.ago(c.commit.committer.date),
      author: c.commit.author.name
    }));
  };

  proto.ago = function(dateStr) {
    const s = (Date.now() - new Date(dateStr)) / 1000;
    const intervals = { y: 31536000, mo: 2592000, d: 86400, h: 3600, m: 60 };
    for (const [unit, v] of Object.entries(intervals)) {
      if (s >= v) return `${Math.floor(s/v)}${unit} ago`;
    }
    return 'just now';
  };

  proto.parseUrl = function(url) {
    const m = url.match(/github\.com\/([^\/]+)\/([^\/]+)(?:\/(?:tree|blob)\/([^\/]+))?(?:\/(.+))?/);
    if (!m) return null;
    return {
      repo: `${m[1]}/${m[2]}`,
      ref: m[3] || 'main',
      path: (m[4] || '').replace(/\/$/, '')
    };
  };
})();
