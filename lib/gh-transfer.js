(() => {
  if (!window.GH) {
    throw new Error('gh-transfer.js requires window.GH (load gh-api.js first)');
  }

  // Cross-repo file copy on top of the GH client. Loaded on demand (the
  // navigator lazy-loads it on first send), not by the boot chain.
  //
  // The payload stays base64 end to end — no decode/encode round trip — so
  // binaries copy as faithfully as text.
  //
  // Two routes, and the difference is the destination's history. copyTo writes
  // through the Contents API, one request and one commit per file, so an
  // eight-file deposit reads as eight commits. commitFiles writes through the
  // Git Data API (blobs → tree → commit → ref) and lands the whole set as one.
  //
  // Consumed by the .web-tools.json manifest convention: a repo's
  // stage.targets ("owner/repo:dir" strings) name where its staged files
  // usually go, and the show-repo UI feeds those through copyTo.

  const proto = window.GH.prototype;

  // Contents GET that keeps the payload base64. Files over the Contents API's
  // ~1 MB cap come back as metadata with an EMPTY content string, which is the
  // one answer this must never pass on: an empty string is valid base64 for
  // zero bytes, so handing it to a write lands an empty file at the
  // destination and reports success.
  //
  // THE SECOND READ IS THE FIX, not a guard. The write side of this file has
  // always gone through the Git Data API, whose blob ceiling is about 100 MB,
  // so a deposit could write a file it could not read and the cap was an
  // asymmetry rather than a limit of the transfer. The Contents response
  // carries the blob's `sha` even when it withholds the bytes, so the fallback
  // costs one request and only on the files that would otherwise have failed.
  // A read under the cap is untouched and still one call.
  //
  // Above roughly 100 MB the blob endpoint answers with `encoding: "none"` and
  // no content, which is a real limit rather than a representation choice, so
  // it throws and names the size. A caller sending one of those wants git, not
  // an API.
  proto.getRaw = async function(path) {
    const q = this.ref ? `?ref=${this.ref}` : '';
    const data = await this.req(`contents/${path}${q}`);
    if (Array.isArray(data)) throw new Error('Path is a directory');
    const content = (data.content || '').replace(/\s/g, '');
    if (content || !data.size) return { content, sha: data.sha, size: data.size };
    if (!data.sha) {
      throw new Error(`File too large for the Contents API (${(data.size / 1024).toFixed(0)} KB), and no blob sha to read it by`);
    }
    const blob = await this.req(`git/blobs/${data.sha}`);
    const big = (blob && blob.content || '').replace(/\s/g, '');
    if (!big) {
      throw new Error(`File too large to read through the API (${(data.size / 1048576).toFixed(1)} MB)`);
    }
    if (blob.encoding && blob.encoding !== 'base64') {
      throw new Error(`Blob came back as ${blob.encoding}, not base64`);
    }
    return { content: big, sha: data.sha, size: data.size };
  };

  // Contents PUT of base64 content, with the same stale-SHA recovery as
  // gh-store's save(): 409/422 means the file already exists (or a racing
  // write beat us), so refetch the current SHA and retry once. Writes to
  // `branch` when given, else the repo's default branch.
  proto.saveRaw = async function(path, content, message, branch) {
    const put = (sha) => {
      const body = { message, content };
      if (sha) body.sha = sha;
      if (branch) body.branch = branch;
      return this.req('contents/' + path, { method: 'PUT', body: JSON.stringify(body) });
    };
    try {
      return await put();
    } catch (e) {
      if (e.status !== 409 && e.status !== 422) throw e;
      const prevRef = this.ref;
      let sha;
      try {
        if (branch) this.ref = branch;
        sha = (await this.getRaw(path)).sha;
      } finally {
        this.ref = prevRef;
      }
      return put(sha);
    }
  };

  // Copy `paths` from this repo@ref into dest = { repo, dir, ref }, one commit
  // per file. For one commit over the whole set, read with getRaw and hand the
  // result to commitFiles below; that is what the stage's deposit does.
  // Sequential on purpose: ordered commits at the destination, no rate-limit
  // bursts. Each source path keeps its full path under dest.dir (provenance
  // preserved, collisions impossible). A failed file doesn't abort the batch;
  // the per-file result carries status 'ok' | 'error'.
  //   opts.message                 override the per-file commit message
  //   opts.onProgress(done, total, path, status)
  // Returns [{ path, to, status, error? }].
  proto.copyTo = async function(dest, paths, opts = {}) {
    if (!dest || !dest.repo) throw new Error('copyTo needs a destination repo');
    const destGh = new this.constructor({ token: this.token, repo: dest.repo });
    destGh.ref = dest.ref || ''; // '' = the destination's default branch
    const dir = (dest.dir || '').replace(/^\/+|\/+$/g, '');
    const results = [];
    for (let i = 0; i < paths.length; i++) {
      const path = paths[i];
      const to = (dir ? dir + '/' : '') + path;
      opts.onProgress?.(i, paths.length, path, 'copying');
      let r;
      try {
        const src = await this.getRaw(path);
        const msg = opts.message || `Copy ${path} from ${this.repo}@${this.ref}`;
        await destGh.saveRaw(to, src.content, msg, dest.ref || '');
        r = { path, to, status: 'ok' };
      } catch (e) {
        r = { path, to, status: 'error', error: e.message || String(e) };
      }
      results.push(r);
      opts.onProgress?.(i + 1, paths.length, path, r.status);
    }
    return results;
  };

  // ── One commit for a whole fileset ────────────────────────────────────────

  // The Contents API writes one path per request and makes one commit per
  // request, so a deposit of N files arrives at the destination as N commits.
  // A reader of that history sees a burst rather than a change, and there is no
  // single sha to revert or cite. This is the other route: upload each file as
  // a blob, build one tree over the branch's current one, make one commit, move
  // the ref.
  //
  // `files` is [{ path, content }] with content ALREADY base64, which is this
  // file's invariant end to end; `path` is destination-relative and whole.
  // Returns { sha, branch, tree, files }.
  //
  // Requests: one per file plus four, against one per file for the Contents
  // API. Never more, and fewer once the retry below would have fired.
  //
  // One limit this does NOT lift: a file's mode is not carried, since the
  // Contents API never returned one and never took one, so every file lands
  // 100644, exactly as copyTo already left it. The read-side cap that used to
  // sit beside it is gone; getRaw above falls back to this same Git Data API,
  // so read and write now meet at roughly 100 MB instead of 1 MB apart.
  proto.commitFiles = async function(files, opts = {}) {
    if (!files || !files.length) throw new Error('commitFiles needs at least one file');
    const branch = opts.branch || this.ref || await this.defaultBranch();

    if (opts.refuseDefaultBranch) {
      const defBranch = await this.defaultBranch();
      if (branch === defBranch) {
        throw new Error(`Refusing to commit directly to the default branch: ${branch}`);
      }
    }

    // Deliberately not encodeURIComponent, unlike createRef below: a ref path is
    // `heads/<name>` and a branch name may carry slashes (claude/some-branch),
    // which percent-encoding hides from the router.
    const refPath = 'git/refs/heads/' + branch;

    // Blobs are content-addressed, so they are uploaded once and survive a
    // rebuild: only the tree and the commit are remade if the branch moves.
    const tree = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      opts.onProgress?.(i, files.length, f.path, 'writing');
      if (f.sha === null) {
        // Deletion entry in Git tree
        tree.push({ path: f.path, mode: f.mode || '100644', type: 'blob', sha: null });
      } else if (f.content || f.bytes) {
        const toB64 = (bytes) => {
          let bin = '';
          for (let b = 0; b < bytes.length; b += 8192) {
            bin += String.fromCharCode.apply(null, bytes.subarray(b, b + 8192));
          }
          return btoa(bin);
        };
        const content = f.content || (this.constructor.toBase64 ? this.constructor.toBase64(f.bytes) : toB64(f.bytes));
        const blob = await this.req('git/blobs', {
          method: 'POST',
          body: JSON.stringify({ content, encoding: 'base64' }),
        });
        if (!blob || !blob.sha) throw new Error(`blob write returned no sha for ${f.path}`);
        tree.push({ path: f.path, mode: f.mode || '100644', type: 'blob', sha: blob.sha });
      } else if (f.sha) {
        // Blob already uploaded or provided
        tree.push({ path: f.path, mode: f.mode || '100644', type: 'blob', sha: f.sha });
      } else {
        throw new Error(`File ${f.path} must have content, bytes, or sha`);
      }
      opts.onProgress?.(i + 1, files.length, f.path, 'ok');
    }

    // Try reading branch tip
    let tip = null;
    try {
      tip = await this.req('git/ref/heads/' + branch, GH_FRESH());
    } catch (e) {
      if (!opts.createBranchIfAbsent) throw e;
    }

    // The ref move is not forced, so a branch that took a commit while the blobs
    // were uploading rejects it rather than losing that commit. Rebuilding on
    // the new tip is the honest recovery and costs two requests, not another
    // upload. The destination here is often a repo taking a commit on every
    // session Stop, so the race is real rather than theoretical.
    const TRIES = 3;
    for (let attempt = 1; ; attempt++) {
      let parent = tip && tip.object && tip.object.sha;
      let isNewBranch = false;

      if (!parent) {
        if (opts.createBranchIfAbsent && opts.baseCommit) {
          parent = opts.baseCommit;
          isNewBranch = true;
        } else {
          throw new Error(`could not read the tip of ${branch}`);
        }
      }

      // Fast-forward / base check if requested
      if (opts.requireBaseCommit && !isNewBranch && parent !== opts.requireBaseCommit) {
        const currentHead = await this.req('git/commits/' + parent);
        if (opts.expectedTree && currentHead?.tree?.sha?.toLowerCase() === opts.expectedTree.toLowerCase()) {
          return { sha: parent, branch, tree: currentHead.tree.sha, files: files.length, alreadyApplied: true };
        }
        throw new Error(`Branch ${branch} has moved: current tip ${parent.slice(0, 7)} does not match base ${opts.requireBaseCommit.slice(0, 7)}`);
      }

      const head = await this.req('git/commits/' + parent);
      const baseTree = opts.baseTree || (head && head.tree && head.tree.sha);
      if (!baseTree) throw new Error(`commit ${parent} carries no tree`);

      // Idempotency: if head tree already equals expectedTree, nothing to commit
      if (opts.expectedTree && head?.tree?.sha?.toLowerCase() === opts.expectedTree.toLowerCase()) {
        return { sha: parent, branch, tree: head.tree.sha, files: files.length, alreadyApplied: true };
      }

      const built = await this.req('git/trees', {
        method: 'POST',
        body: JSON.stringify({ base_tree: baseTree, tree }),
      });

      // Verification before ref movement: resulting tree SHA must match expectedTree
      if (opts.expectedTree && built.sha.toLowerCase() !== opts.expectedTree.toLowerCase()) {
        throw new Error(`Tree verification failed: GitHub created tree ${built.sha}, expected ${opts.expectedTree}`);
      }

      const commit = await this.req('git/commits', {
        method: 'POST',
        body: JSON.stringify({
          message: opts.message || `Add ${files.length} file${files.length === 1 ? '' : 's'}`,
          tree: built.sha,
          parents: opts.parents || [parent],
        }),
      });

      if (isNewBranch) {
        await this.req('git/refs', {
          method: 'POST',
          body: JSON.stringify({ ref: 'refs/heads/' + branch, sha: commit.sha }),
        });
        return { sha: commit.sha, branch, tree: built.sha, files: files.length, created: true };
      }

      try {
        await this.req(refPath, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha }) });
        return { sha: commit.sha, branch, tree: built.sha, files: files.length };
      } catch (e) {
        // 422 is "update is not a fast forward": the branch moved. Anything
        // else, and a fourth attempt, is real.
        if (e.status !== 422 || attempt >= TRIES || opts.requireBaseCommit) throw e;
        tip = await this.req('git/ref/heads/' + branch, GH_FRESH());
      }
    }
  };

  // The tip read must bypass the HTTP cache, for the reason gh-store.js records
  // at length: GitHub caches an API read for 60 seconds in the browser, so a
  // recovery read answered from cache hands back the very sha that was just
  // rejected and the retry is inert.
  const GH_FRESH = () => (window.GH && window.GH.FRESH) || { cache: 'no-store' };

  // ── Branch and pull-request creation ──────────────────────────────────────
  // The Contents API can write to a ref that exists but cannot make one, and
  // cannot open a pull request at all. Both are one POST each, and both live
  // here rather than in the boot chain because only a write path needs them.

  // The repo's default branch name, which the API knows and this client does
  // not: an empty ref means "the default" everywhere else, so anything that has
  // to NAME the branch (a PR base, a new branch's starting point) resolves it
  // here rather than guessing at 'main'.
  proto.defaultBranch = async function() {
    if (this._defaultBranch) return this._defaultBranch;
    const meta = await this.req('');
    this._defaultBranch = meta.default_branch || 'main';
    return this._defaultBranch;
  };

  // Create `branch` at the tip of `from` (the default branch when empty).
  // Returns { branch, sha, created }: an existing branch is reported rather
  // than treated as an error, since re-applying onto a branch that is already
  // there is a resume, not a collision.
  proto.createRef = async function(branch, from) {
    const base = from || await this.defaultBranch();
    const tip = await this.req(`git/ref/heads/${encodeURIComponent(base)}`);
    const sha = tip?.object?.sha;
    if (!sha) throw new Error(`could not read the tip of ${base}`);
    try {
      await this.req('git/refs', {
        method: 'POST',
        body: JSON.stringify({ ref: 'refs/heads/' + branch, sha }),
      });
      return { branch, sha, created: true };
    } catch (e) {
      // 422 is "reference already exists". Anything else is real.
      if (e.status !== 422) throw e;
      return { branch, sha, created: false };
    }
  };

  // Open a pull request. Draft is the default: a proposal arriving as a PR is
  // for reading, and marking it ready is the reviewer's move, the same rule the
  // session conventions apply to their own PRs.
  proto.createPull = async function({ title, head, base, body, draft = true }) {
    const target = base || await this.defaultBranch();
    try {
      return await this.req('pulls', {
        method: 'POST',
        body: JSON.stringify({ title, head, base: target, body: body || '', draft }),
      });
    } catch (e) {
      if (e.status === 422) {
        // A pull request already exists; try to lookup existing PR
        try {
          const owner = (this.repo || '').split('/')[0];
          const query = owner ? `pulls?head=${encodeURIComponent(owner + ':' + head)}&state=all` : 'pulls?state=all';
          const list = await this.req(query);
          if (Array.isArray(list)) {
            const found = list.find(p => p.head && p.head.ref === head) || list[0];
            if (found) return { ...found, created: false, alreadyExists: true };
          }
        } catch {}
      }
      throw e;
    }
  };
})();
