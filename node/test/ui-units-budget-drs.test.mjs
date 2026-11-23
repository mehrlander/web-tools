// The budget-drs app's UI units are read from the budget-drs checkout and kept
// in home's store. The app was home's projects/budget-drs until 2026-11-10,
// when it became mehrlander/budget-drs; node/ui-units.mjs still read it from
// home, so a refresh would have written home's store without the app's 118
// rows. This runs the script against a small estate of two fixture repos and
// writes home's store only (--store home), so the public tables are untouched.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { repoRoot } from '../repo-root.mjs';
import { parseCsv } from '../build/registries-load.mjs';

const write = (root, rel, text) => {
  mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  writeFileSync(path.join(root, rel), text);
};
const git = (root, ...a) => execFileSync('git', ['-C', root, '-c', 'user.name=t', '-c', 'user.email=t@example.invalid',
  '-c', 'commit.gpgsign=false', ...a]).toString().trim();
const repo = (root, files) => {
  mkdirSync(root, { recursive: true });
  for (const [rel, text] of Object.entries(files)) write(root, rel, text);
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '--no-verify', '-m', 'fixture');
  return git(root, 'rev-parse', '--short=12', 'HEAD');
};

// The shape node/ui-units.mjs reads: VIEWS keys six spaces in, closed by
// `\n    };`, and RENDER naming each drawn view's function.
const APP = `<script>
    const VIEWS = {
      funding: { label: "Funding" },
      search: { label: "Search" },
      pensions: { label: "Pensions", embed:{ repo:"mehrlander/home", path:"projects/pl/display/explorer.html", ref:"main" } },
      spend: { label: "Spend", embed:{ repo:"mehrlander/spend-wa", path:"pages/spend.html", ref:"main" } },
    };
    const RENDER = { funding: renderFunding, search: renderSearch };
</script>
`;

test('the budget-drs app is read from its own repo and its rows stay in home', () => {
  const estate = mkdtempSync(path.join(tmpdir(), 'ui-units-bd-'));
  try {
    const homeAt = repo(path.join(estate, 'home'), {
      '.web-tools.json': JSON.stringify({ pages: [{ path: 'app/index.html', title: 'home', appView: true }] }),
      'app/index.html': '<main x-data="{}"></main>\n',
      'projects/pl/display/explorer.html': '<main></main>\n',
      'data/.keep': '',
    });
    const bdAt = repo(path.join(estate, 'budget-drs'), {
      '.web-tools.json': JSON.stringify({ pages: [{ path: 'app/view/app.html', title: 'Budget DRS', appView: true }] }),
      'app/view/app.html': APP,
      'app/view/views/funding.js': 'function renderFunding(el) { swipeDeck.open({}); fundingRows(); }\n',
      'app/view/views/rows.js': 'function fundingRows() { return []; }\n',
      'app/view/views/search.js': 'function renderSearch(el) { el.innerHTML = ""; }\n',
      'app/atlas/atlas.html': '<main></main>\n',
      'data/design/views.csv': 'view,title,kind\nfunding,Funding,main\nsearch,Search,main\npensions,Pensions,frame\nspend,Spend,frame\n',
      'data/design/view-tabs.csv': 'view,tab,control\nfunding,Requests,tab\nfunding,Notes,tab\nfunding,mode,switch\n',
    });
    const publicUnits = readFileSync(path.join(repoRoot, 'data/ui-units/units.csv'), 'utf8');

    execFileSync(process.execPath, [path.join(repoRoot, 'node/ui-units.mjs'),
      '--estate', estate, '--date', '2026-11-20', '--write', '--store', 'home']);

    assert.equal(readFileSync(path.join(repoRoot, 'data/ui-units/units.csv'), 'utf8'), publicUnits,
      '--store home must leave the public units.csv as it was');
    const units = new Map(parseCsv(readFileSync(path.join(estate, 'home/data/ui-units/units.csv'), 'utf8')).map(u => [u.unit, u]));
    assert.deepEqual([...units.keys()].sort(), [
      'budget-drs:app/atlas/atlas.html',
      'budget-drs:app/view/app.html',
      'budget-drs:view/funding/Notes',
      'budget-drs:view/funding/Requests',
      'budget-drs:view/search',
      'home:app/index.html',
      'home:projects/pl/display/explorer.html',
      'spend-wa:pages/spend.html',
    ]);
    const tab = units.get('budget-drs:view/funding/Requests');
    assert.equal(tab.repo, 'budget-drs');
    assert.equal(tab.at, bdAt, 'a budget-drs unit is stamped with the budget-drs commit it was read at');
    assert.equal(tab.files, 'app/view/views/funding.js;app/view/views/rows.js');
    assert.equal(tab.deck_open, '1');
    assert.equal(tab.ring_basis, 'VIEWS.funding in budget-drs:app/view/app.html, promoted by budget-drs');
    const framed = units.get('home:projects/pl/display/explorer.html');
    assert.equal(framed.app_ring, '2');
    assert.equal(framed.at, homeAt, 'a page the app frames from home stays home\'s');
    const away = units.get('spend-wa:pages/spend.html');
    assert.equal(away.app_ring, '2', 'a page framed from a repo outside home\'s store is still the app\'s');
    assert.equal(away.reachable, 'not checked out');
    assert.equal(units.get('budget-drs:app/view/app.html').app_ring, '1');
    assert.equal(units.get('budget-drs:app/atlas/atlas.html').app_ring, '3');

    const files = parseCsv(readFileSync(path.join(estate, 'home/data/ui-units/signals.csv'), 'utf8')).map(f => f.file);
    assert.ok(files.includes('budget-drs:app/view/views/funding.js'), files.join(', '));
    assert.ok(!files.some(f => f.startsWith('home:projects/budget-drs')), files.join(', '));
  } finally {
    rmSync(estate, { recursive: true, force: true });
  }
});
