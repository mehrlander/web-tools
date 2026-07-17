// screenshot.mjs interaction scenario: open show-repo's Branches view with a
// populated survey.
//
//   node tools/render/screenshot.mjs pages/show-repo/show-repo.html \
//     --script tools/render/scenarios/branches-survey.mjs --full \
//     --out tools/.preview/branches-survey.png
//
// The sandbox proxy blocks direct api.github.com calls, so the live fetch
// path can't run here. Instead the scenario builds the view's exact API
// shapes (branch list, default-branch tree, per-branch compare files and tip
// tree) from the LOCAL git repo — real branch data, not invented fixtures —
// injects a stand-in gh over the shared store, and drives the real component.
// What the pixels prove: the real render over real branch shapes; what they
// don't: the network plumbing (covered by tools/test/branches-view.test.mjs).
import { execFileSync } from 'node:child_process';

export default async function (page, { repoRoot }) {
  const git = (...a) => execFileSync('git', ['-C', repoRoot, ...a], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  const lsTree = (ref) => git('ls-tree', '-r', ref).trimEnd().split('\n').filter(Boolean).map(l => {
    const [meta, p] = l.split('\t');
    const [, type, sha] = meta.split(/\s+/);
    return { path: p, type, sha };
  });

  const BASE = 'origin/main';
  const branches = git('for-each-ref', 'refs/remotes/origin', '--sort=-committerdate',
    '--format=%(committerdate:iso8601)|%(objectname)|%(refname:short)|%(subject)')
    .trimEnd().split('\n').filter(Boolean).map(l => {
      const [date, sha, ref, ...rest] = l.split('|');
      return { ref, name: ref.replace(/^origin\//, ''), date: new Date(date).toISOString(), sha, subject: rest.join('|') };
    }).filter(b => b.ref !== BASE && !b.ref.endsWith('/HEAD'));

  const fixture = {
    defaultRef: 'main',
    mainTree: lsTree(BASE),
    branches: branches.map(b => ({ name: b.name, date: b.date, sha: b.sha, subject: b.subject })),
    perBranch: Object.fromEntries(branches.map(b => {
      let files = [], ahead = null, noBase = false;
      try {
        git('merge-base', BASE, b.ref);
        ahead = +git('rev-list', '--count', b.ref, '--not', BASE).trim();
        files = git('diff', '--name-only', `${BASE}...${b.ref}`).split('\n').filter(Boolean);
      } catch {
        noBase = true;
        files = git('diff', '--name-only', `${b.ref}~1`, b.ref).split('\n').filter(Boolean);
      }
      return [b.name, { files, ahead, noBase, tipTree: lsTree(b.ref) }];
    })),
  };

  const ok = await page.evaluate((fx) => {
    if (!window.Alpine || !window.__shell) return 'no shell';
    const store = window.Alpine.store('browser');
    store.defaultRef = fx.defaultRef;
    const real = store.gh;
    store.gh = Object.assign(Object.create(Object.getPrototypeOf(real)), real, {
      async branchesDated() {
        return fx.branches.map(b => ({ ...b, ago: this.ago(b.date) }));
      },
      async compare(base, head) {
        const p = fx.perBranch[head];
        if (!p) throw Object.assign(new Error('GitHub Error 404'), { status: 404 });
        if (p.noBase) throw Object.assign(new Error('GitHub Error 404'), { status: 404 });
        return { ahead_by: p.ahead, files: p.files.map(f => ({ filename: f })), commits: [] };
      },
      async req(path) {
        const t = path.match(/^git\/trees\/([^?]+)\?recursive=1$/);
        if (t) {
          const key = decodeURIComponent(t[1]);
          if (key === fx.defaultRef) return { truncated: false, tree: fx.mainTree };
          const hit = fx.branches.find(b => b.sha === key || b.name === key);
          return { truncated: false, tree: (hit && fx.perBranch[hit.name].tipTree) || [] };
        }
        const c = path.match(/^commits\?sha=([^&]+)&per_page=/);
        if (c) {
          const name = decodeURIComponent(c[1]);
          const b = fx.branches.find(x => x.name === name);
          return [{ sha: b.sha, parents: [{ sha: b.sha + '~1' }],
                    commit: { message: b.subject, committer: { date: b.date } } }];
        }
        if (path.startsWith('compare/')) return { ahead_by: null, files: [], commits: [] };
        return real.req.call(this, path);
      },
    });
    // The fallback's compare(parent, tip) rides req? No — it calls compare();
    // route a parent~1 base through the per-branch file list too.
    const gh = store.gh, origCompare = gh.compare.bind(gh);
    gh.compare = async (base, head) => {
      const byTip = fx.branches.find(b => b.sha === head || b.name === head);
      if (byTip && String(base).endsWith('~1')) {
        const p = fx.perBranch[byTip.name];
        return { ahead_by: p.ahead, files: p.files.map(f => ({ filename: f })), commits: [] };
      }
      return origCompare(base, head);
    };
    window.__shell.goBranches();
    return true;
  }, fixture);
  if (ok !== true) throw new Error('branches scenario: ' + ok);

  // Wait for the survey pool to drain (every row leaves 'pending').
  await page.waitForFunction(() => {
    const host = [...document.querySelectorAll('[x-data]')]
      .find(el => (el.getAttribute('x-data') || '').includes('branches('));
    if (!host) return false;
    const d = window.Alpine.$data(host);
    return d.rows.length > 0 && !d.loading && !d.surveying && d.rows.every(r => r.state !== 'pending');
  }, { timeout: 30000 });
  await page.waitForTimeout(300);
}
