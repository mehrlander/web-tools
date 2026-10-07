// lib/kits/visit-log.js — the allowlist that decides what a visit may store.
//
// The property this file exists to hold is one sentence: NO OUTPUT ROW EVER
// CONTAINS ANY PART OF AN INPUT PAYLOAD. Everything else here is a detail of
// how that is arranged.
//
// The design under test is an allowlist that RE-MINTS rather than a filter that
// strips. A filter is a list of the payload forms someone thought of, so the
// last test below is the one that matters: it feeds a corpus of adversarial
// addresses through and asserts that no serialized row contains the payload
// marker any of them carried. That test passes for reasons the other tests
// spell out, and it would keep passing if a payload form nobody has imagined
// yet were added tomorrow, because the module writes only fields a template
// declared.
//
// Read against docs/routes-modes.csv and docs/app-routes.csv, the two governed
// registries that ARE the allowlist. The module joins them rather than carrying
// its own copy, so these tests load the real files: a test against a fixture
// would pass while the registry it ships beside said something else.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';
import { parseCsv } from '../build/registries-load.mjs';

const win = {};
new Function('window', readFileSync(path.join(repoRoot, 'lib/kits/visit-log.js'), 'utf8'))(win);
const V = win.VisitLog;

const rows = (f) => parseCsv(readFileSync(path.join(repoRoot, 'docs', f), 'utf8'));
const modes = rows('routes-modes.csv');
const routes = rows('app-routes.csv');
const tossRoutes = rows('routes-routes.csv');
const at = (href) => V.classify(href, { modes, routes, tossRoutes, now: 1_700_000_000_000 });

const APP = 'https://mehrlander.github.io/web-tools/app/';
const TOSS = 'https://mehrlander.github.io/web-tools/pages/toss-render.html';

// A payload that is recognizable wherever it turns up. Long enough that a
// truncating bug would still leave a trace, and shaped like the base64url the
// real encoders emit.
const MARK = 'PAYLOADMARKER';
const BLOB = 'H4sIAAAAAAAA_' + MARK + 'x'.repeat(200) + MARK;

test('the registries are the allowlist, and they are read rather than copied', () => {
  // The module classifies nothing without them, which is what makes the join
  // real: a caller that forgets the tables gets refusals, not a permissive
  // fallback that would silently store whatever it saw.
  const bare = V.classify(TOSS + '#gh=mehrlander/web-tools:pages/index.html', { now: 0 });
  assert.equal(bare.kind, 'unrecognized');
  const carries = new Set(modes.map(m => m.carries));
  assert.deepEqual([...carries].sort(), ['inline', 'reference'],
    'routes-modes.csv grew a third `carries` value; visit-log treats anything but reference as inline');
});

test('an address-mode toss is stored, rebuilt field by field', () => {
  const r = at(TOSS + '#gh=mehrlander/web-tools@claude/some-branch:pages/index.html');
  assert.equal(r.kind, 'toss');
  assert.equal(r.repo, 'mehrlander/web-tools');
  assert.equal(r.ref, 'claude/some-branch');
  assert.equal(r.path, 'pages/index.html');
  // Nothing beyond the template's fields and the row's own frame.
  assert.deepEqual(Object.keys(r).sort(), ['at', 'kind', 'path', 'ref', 'repo'].sort());
});

test('a payload mode is refused by name, with its size and no bytes', () => {
  for (const mode of ['gz', 'html', 'url', 'u']) {
    const r = at(`${TOSS}#${mode}=${BLOB}`);
    assert.equal(r.kind, 'payload', mode + ' was not refused');
    assert.equal(r.mode, mode);
    assert.ok(r.bytes > 200, 'the size is worth keeping: ' + mode);
    assert.ok(!JSON.stringify(r).includes(MARK), mode + ' leaked its payload');
  }
});

test("the `u` alias is the case a filter would miss", () => {
  // Until 2026-09-17 docs/routes-modes.csv described `url` and not its alias
  // `u`, which pages/toss-render.html has always read. A filter stripping known
  // payload keys would not have known `u`. This module never matched it, so it
  // refused by default; now that `u` has a row it refuses by name. Both
  // outcomes store nothing, and that is the point: the allowlist was safe
  // through the window when the registry was wrong.
  const described = modes.find(m => m.param === 'u');
  assert.ok(described, 'docs/routes-modes.csv lost the u row');
  assert.equal(described.carries, 'inline');
  const r = at(`${TOSS}#u=${BLOB}`);
  assert.equal(r.kind, 'payload');
  assert.ok(!JSON.stringify(r).includes(MARK));
});

test('a stage link stores its refs and leaves the folded-in locals behind', () => {
  const link = `${APP}#stage=mehrlander/home:a.md,b.md&gz=${BLOB}&prompts=W3sibGFiZWwi&mode=diff`;
  const r = at(link);
  assert.equal(r.kind, 'stage');
  assert.equal(r.spec, 'mehrlander/home:a.md,b.md');
  assert.ok(!JSON.stringify(r).includes(MARK), 'the stage link leaked its local text');
  assert.ok(!JSON.stringify(r).includes('W3sibGFiZWwi'), 'the authored commentary was stored');
});

test('an app route stores the view and the record, never a free string', () => {
  const r = at(APP + '?view=sessions&session=2bf8fcae&lens=table&grain=turn&set=a,b');
  assert.equal(r.kind, 'route');
  assert.equal(r.view, 'sessions');
  assert.equal(r.session, '2bf8fcae');
  // `lens`, `grain` and `set` are reading parameters. They are not in the app
  // template's fields, so they are not written, and the key below folds two
  // readings of one screen into one row.
  assert.equal(r.lens, undefined);
  assert.equal(r.grain, undefined);
  assert.equal(r.set, undefined);
});

test('?on= is the fragment fallback, so it is a payload here too', () => {
  const r = at(APP + '?view=app&app=budget-drs&on=' + encodeURIComponent('pkg=abs&data=' + BLOB));
  assert.equal(r.kind, 'payload');
  assert.equal(r.mode, 'on');
  assert.ok(!JSON.stringify(r).includes(MARK));
});

test('an unrecognized address keeps the pathname and nothing else', () => {
  const r = at(TOSS + '#somethingNobodyDescribed=' + BLOB);
  assert.equal(r.kind, 'unrecognized');
  assert.equal(r.path, '/web-tools/pages/toss-render.html');
  assert.ok(r.why, 'an unrecognized row says why, or it cannot surface the drift');
  assert.ok(!JSON.stringify(r).includes(MARK));
  // The pathname is safe to keep because every payload form in this system
  // rides in the fragment or the query. If that ever stops being true, this
  // assertion is where it should fail.
  assert.ok(!r.path.includes('?') && !r.path.includes('#'));
});

test('a field that fails its grammar is refused rather than trimmed', () => {
  // repo-address.js accepts `(.+)` for a path because it parses what git
  // allows. This module is deciding what to WRITE, so a path carrying a nested
  // query is refused outright: trimming is the sanitizing move the design
  // avoids, and a refusal lands somewhere visible.
  const r = at(TOSS + '#gh=mehrlander/web-tools:app/index.html?on=' + BLOB);
  assert.equal(r.kind, 'unrecognized');
  assert.ok(!JSON.stringify(r).includes(MARK));
  // And an owner that is not owner/repo shaped.
  assert.equal(at(TOSS + '#gh=javascript:alert(1):x').kind, 'unrecognized');
});

test('a misrecognized route is a wrong label, never a leak', () => {
  // The design accepts being wrong about WHICH route an address names. What it
  // does not accept is carrying content while being wrong. Here a typed toss
  // key that happens to collide with an app route key still mints through a
  // template, so the worst case is a row pointing at the wrong screen.
  const r = at(TOSS + '#data=mehrlander/home@main:projects/budget-drs/data/rows.csv');
  assert.equal(r.kind, 'toss');
  assert.equal(r.route, 'data');
  assert.equal(r.path, 'projects/budget-drs/data/rows.csv');
  assert.deepEqual(Object.keys(r).sort(), ['at', 'kind', 'path', 'ref', 'repo', 'route'].sort());
});

test('the dedupe key folds readings together and splits places apart', () => {
  const list = at(APP + '?view=sessions&session=abc&lens=list');
  const table = at(APP + '?view=sessions&session=abc&lens=table&grain=turn');
  assert.equal(V.key(list), V.key(table), 'a lens change split one screen into two rows');

  const setTab = at(APP + '?view=map&tab=set');
  const viewsTab = at(APP + '?view=map&tab=views');
  assert.notEqual(V.key(setTab), V.key(viewsTab), "Map's tabs are panes, not readings");

  // Every unrecognized visit to one page collapses, which is what makes the
  // count readable as "this page did not match, N times".
  assert.equal(V.key(at(TOSS + '#a=' + BLOB)), V.key(at(TOSS + '#b=' + 'zz'.repeat(50))));
});

// ── The property, stated at the strength it actually holds ─────────────────
//
// The claim is about BULK, and it is worth writing down precisely, because the
// obvious phrasing ("no input ever reaches a row") is false and a test that
// asserted it would be lying in the reader's favour. A field that legitimately
// holds a short opaque token, a session id, say, will store a short opaque
// token, and it cannot tell one from another by shape. An adversarial sweep of
// 416 addresses puts 42-character strings into `project`, `ref` and `item` and
// they are stored, exactly as a real value of that length would be.
//
// That is the MISRECOGNIZED outcome, which the design accepts: a wrong label
// costs a wrong link. What it does not accept is a document, and a document is
// not 42 bytes. So the property is a bound, asserted two ways below: no field
// past its declared grammar length, and no row past ROW_CAP. A gzipped page is
// three orders of magnitude over both.
test('no field past its bound, so no row can carry bulk', () => {
  // The bounds themselves, read off the module, so this fails if one is
  // widened without a second thought rather than silently following it.
  const src = readFileSync(path.join(repoRoot, 'lib/kits/visit-log.js'), 'utf8');
  assert.match(src, /ROW_CAP = (\d+)/);
  const cap = Number(src.match(/ROW_CAP = (\d+)/)[1]);
  assert.ok(cap <= 512, 'ROW_CAP grew past what a handful of identifiers needs: ' + cap);
  for (const [name, bound] of [['OWNER_REPO', 39], ['REF', 100], ['PATH', 160], ['SLUG', 40]]) {
    const m = src.match(new RegExp(name + ' = /[^;]*?\\{1,(\\d+)\\}'));
    assert.ok(m, name + ' lost its length bound, so it can accept bulk again');
    assert.ok(Number(m[1]) <= bound, name + ' bound widened to ' + m[1]);
  }
});

test('no classified row contains a payload-sized input', () => {
  const corpus = [
    `${TOSS}#gz=${BLOB}`,
    `${TOSS}#html=${BLOB}`,
    `${TOSS}#url=${BLOB}`,
    `${TOSS}#u=${BLOB}`,
    `${TOSS}#gh=mehrlander/web-tools:app/index.html#gz=${BLOB}`,
    `${TOSS}#gh=mehrlander/web-tools:app/index.html?on=${BLOB}`,
    `${APP}#stage=mehrlander/home:a.md&gz=${BLOB}&prompts=${BLOB}`,
    `${APP}?view=search&sq=${BLOB}`,
    `${APP}?view=app&app=budget-drs&on=${BLOB}`,
    `${APP}?view=sessions&session=${BLOB}`,
    `${APP}?view=${BLOB}`,
    `${APP}?repo=${BLOB}`,
    // A mode nobody has described yet, which is the whole point.
    `${TOSS}#futureMode=${BLOB}`,
    `${TOSS}#GZ=${BLOB}`,
    `${TOSS}?gz=${BLOB}`,
    `${APP}?view=map&tab=${BLOB}`,
    `${APP}?view=project&project=${BLOB}`,
  ];
  for (const href of corpus) {
    const r = at(href);
    const seen = JSON.stringify(r);
    assert.ok(!seen.includes(MARK), 'payload reached the row for: ' + href.slice(0, 80));
    assert.ok(seen.length <= 400, 'a row grew large enough to be carrying content: ' + href.slice(0, 80));
  }
});

test('every app route key the registry declares is storable', () => {
  // The allowlist is only as good as its coverage: a route the app can reach
  // and this module refuses would be a permanent hole in the log, quietly
  // reported as drift that no edit fixes.
  for (const r of routes) {
    if (!r.key || r.key === 'shell') continue;
    const spelling = r.writes || r.key;
    const row = at(`${APP}?view=${spelling}`);
    assert.ok(row.kind === 'route' || row.kind === 'unrecognized',
      r.key + ' classified as ' + row.kind);
    if (row.kind === 'unrecognized') {
      assert.fail(`docs/app-routes.csv declares '${r.key}' (?view=${spelling}) and visit-log refuses it`);
    }
  }
});
