(() => {
  if (!window.GH) {
    throw new Error('gh-fetch.js requires window.GH (load gh-api.js first)');
  }

  const proto = window.GH.prototype;

  proto.repos = async function(user = 'anthropics', opts = {}) {
    const endpoint = this.headers.Authorization ? '/user/repos' : `/users/${user}/repos`;
    return this.req(`${endpoint}?sort=updated&per_page=100`, opts);
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

  // Branches with tip-commit dates, sorted newest-first. REST's branches
  // endpoint carries no commit date, so this goes through GraphQL. Sorting is
  // client-side: RefOrderField has only ALPHABETICAL and TAG_COMMIT_DATE, and
  // the latter only orders refs/tags/ — there's no server-side commit-date sort
  // for refs/heads/. committedDate is ISO-8601, so a string sort is chronological.
  // Each row also carries the tip sha and subject line (additive; the same one
  // call already fetches the commit), which the branches view keys on.
  // Server pages are alphabetical, so ONE page of a many-branch repo is the
  // alphabetical first `per`, not the newest — hence pagination up to `max`
  // refs (per page-size steps), so "sorted newest-first" stays honest.
  proto.branchesDated = async function(per = 100, max = 500) {
    const [owner, name] = (this.repo || '').split('/');
    const out = [];
    let cursor = null;
    while (out.length < max) {
      const data = await this.graphql(
        `query($owner:String!, $name:String!, $per:Int!, $cursor:String) {
          repository(owner:$owner, name:$name) {
            refs(refPrefix:"refs/heads/", first:$per, after:$cursor) {
              pageInfo { hasNextPage endCursor }
              nodes { name target { ... on Commit { oid committedDate messageHeadline } } }
            }
          }
        }`,
        { owner, name, per: Math.min(per, max - out.length), cursor }
      );
      const refs = (data && data.repository && data.repository.refs) || {};
      out.push(...(refs.nodes || []));
      if (!refs.pageInfo || !refs.pageInfo.hasNextPage) break;
      cursor = refs.pageInfo.endCursor;
    }
    return out
      .map(n => {
        const t = n.target || {};
        return { name: n.name, date: t.committedDate || '', ago: t.committedDate ? this.ago(t.committedDate) : '',
                 sha: t.oid || '', subject: t.messageHeadline || '' };
      })
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  };

  // branchesDated plus, per branch tip, the blob id of ONE path — and the
  // default branch's copy to compare against — so a caller can mark where a
  // file differs from the default branch without a per-branch compare call.
  // Commit.file(path:) resolves the tree entry at that commit; a null there
  // means the path doesn't exist on that branch. Same pagination honesty as
  // branchesDated. Returns { defaultBranch, defaultOid, branches }, branches
  // sorted newest-first, each { name, date, ago, sha, subject, fileOid }.
  proto.branchesForPath = async function(path, per = 100, max = 500) {
    const [owner, name] = (this.repo || '').split('/');
    const out = [];
    let defaultBranch = '', defaultOid = null, cursor = null;
    while (out.length < max) {
      const data = await this.graphql(
        `query($owner:String!, $name:String!, $path:String!, $per:Int!, $cursor:String) {
          repository(owner:$owner, name:$name) {
            defaultBranchRef { name target { ... on Commit { file(path:$path) { oid } } } }
            refs(refPrefix:"refs/heads/", first:$per, after:$cursor) {
              pageInfo { hasNextPage endCursor }
              nodes { name target { ... on Commit {
                oid committedDate messageHeadline file(path:$path) { oid } } } }
            }
          }
        }`,
        { owner, name, path, per: Math.min(per, max - out.length), cursor }
      );
      const repo = (data && data.repository) || {};
      const dbr = repo.defaultBranchRef;
      if (dbr) {
        defaultBranch = dbr.name || '';
        defaultOid = (dbr.target && dbr.target.file && dbr.target.file.oid) || null;
      }
      const refs = repo.refs || {};
      out.push(...(refs.nodes || []));
      if (!refs.pageInfo || !refs.pageInfo.hasNextPage) break;
      cursor = refs.pageInfo.endCursor;
    }
    const branches = out
      .map(n => {
        const t = n.target || {};
        return { name: n.name, date: t.committedDate || '', ago: t.committedDate ? this.ago(t.committedDate) : '',
                 sha: t.oid || '', subject: t.messageHeadline || '',
                 fileOid: (t.file && t.file.oid) || null };
      })
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return { defaultBranch, defaultOid, branches };
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
