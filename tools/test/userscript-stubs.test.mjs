// A userscript stub, its bookmarklet twin and the body they load are generated
// together by scripts/userscript-stub.py, and two of the three are the kind of
// artifact nobody re-reads. The failures they invite:
//
//   - The stub re-pinned and the bookmarklet left behind, so two routes claim
//     to run one body and run different ones, silently.
//   - A body edited without re-stamping, so the launcher reports a build id
//     that was true yesterday. That is worse than no id: an unlooked-up answer
//     reading as a good one is the failure the stamp exists to prevent.
//   - The published manifest disagreeing with the body, which would make an
//     up-to-date launcher announce that it is behind, or a stale one keep
//     quiet. The manifest is the one thing a reader on the phone cannot check
//     for themselves, so it is the one that most needs checking here.
//
// The pin is deliberately a BRANCH here, which an earlier version of this file
// refused. A commit pin made every edit a reinstall on the phone, and the
// install is the one step that costs a person something. The stamp is what
// makes the branch pin safe to read.
import { test } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '../..');
const stubs = fs.readdirSync(path.join(ROOT, 'userscripts'))
  .filter(f => f.endsWith('.user.js'));

const STAMP = /^const BUILD = '([^']*)';$/m;
const BUILT = /^const BUILT = '([^']*)';$/m;
const REF = /^const REF = '([^']*)';$/m;
const fnName = lib => 'wt' + lib.split('-').map(p => p[0].toUpperCase() + p.slice(1)).join('');
const stampOf = text => crypto.createHash('sha256').update(
  text.replace(/\r\n/g, '\n')
      .replace(STAMP, "const BUILD = '#BUILD#';")
      .replace(BUILT, "const BUILT = '#BUILT#';")
      .replace(REF, "const REF = '#REF#';")).digest('hex').slice(0, 7);
const manifest = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'userscripts', 'builds.json'), 'utf8'));

test('every stub loads a body that exists and defines what the stub calls', () => {
  assert.ok(stubs.length, 'no stubs found; this test would pass vacuously');
  for (const stub of stubs) {
    const lib = stub.replace('.user.js', '');
    const src = fs.readFileSync(path.join(ROOT, 'userscripts', stub), 'utf8');

    const req = src.match(/@require\s+(\S+)/);
    assert.ok(req, `${stub}: no @require`);
    assert.ok(req[1].split('?')[0].endsWith(`/userscripts/lib/${lib}.js`),
      `${stub}: @require does not point at userscripts/lib/${lib}.js`);

    const body = path.join(ROOT, 'userscripts', 'lib', `${lib}.js`);
    assert.ok(fs.existsSync(body), `${stub}: body ${lib}.js is missing`);
    const bodyCode = fs.readFileSync(body, 'utf8');
    assert.match(bodyCode, new RegExp(`window\\.${fnName(lib)}\\s*=`),
      `${lib}.js must define window.${fnName(lib)}; the stub calls it`);
    assert.doesNotThrow(() => new vm.Script(bodyCode, { filename: `${lib}.js` }),
      `${lib}.js has a syntax error that will break dynamic evaluation in loader`);
    assert.match(src, new RegExp(`window\\.${fnName(lib)}\\(`),
      `${stub} must call window.${fnName(lib)}`);
  }
});

// The two routes deliberately load the same file from DIFFERENT hosts: raw
// serves text/plain with nosniff, which a script tag will not execute, so the
// bookmarklet uses GitHub Pages while the userscript uses raw for its five
// minute cache. What has to match is the path, since that decides WHICH body
// runs; getting only one of them re-pointed is the drift.
test('the two routes load the same body from their own hosts', () => {
  for (const stub of stubs) {
    const lib = stub.replace('.user.js', '');
    const req = fs.readFileSync(path.join(ROOT, 'userscripts', stub), 'utf8')
      .match(/@require\s+(\S+)/)[1];
    assert.match(req, /^https:\/\/raw\.githubusercontent\.com\//,
      `${stub}: @require must read raw, whose cache is five minutes and which ` +
      'follows the ref the stub pins');

    const twin = path.join(ROOT, 'bookmarklets', `${lib}.js`);
    assert.ok(fs.existsSync(twin), `${stub}: no bookmarklet twin at bookmarklets/${lib}.js`);
    const src = fs.readFileSync(twin, 'utf8');
    assert.ok(src.includes(`https://mehrlander.github.io/web-tools/userscripts/lib/${lib}.js`),
      `bookmarklets/${lib}.js must read ${lib}.js from GitHub Pages: raw serves ` +
      'text/plain with nosniff, which a script tag refuses to execute. ' +
      'Re-run scripts/userscript-stub.py, which writes both.');
  }
});

test('every body carries a stamp matching its own contents', () => {
  for (const stub of stubs) {
    const lib = stub.replace('.user.js', '');
    const text = fs.readFileSync(path.join(ROOT, 'userscripts', 'lib', `${lib}.js`), 'utf8');
    const m = text.match(STAMP);
    assert.ok(m, `${lib}.js has no BUILD line for the generator to stamp`);
    assert.equal(m[1], stampOf(text),
      `${lib}.js was edited without re-stamping, so it would report build ` +
      `${m[1]} while running something else: python3 scripts/userscript-stub.py ${lib} …`);
  }
});

test('the published manifest agrees with every body it names', () => {
  for (const stub of stubs) {
    const lib = stub.replace('.user.js', '');
    const text = fs.readFileSync(path.join(ROOT, 'userscripts', 'lib', `${lib}.js`), 'utf8');
    const row = manifest[lib];
    assert.ok(row, `userscripts/builds.json has no row for ${lib}`);
    assert.equal(row.build, text.match(STAMP)[1],
      `builds.json says ${lib} is at ${row.build} and the body says ` +
      `${text.match(STAMP)[1]}, so a current launcher would report itself stale`);
    assert.equal(row.built, text.match(BUILT)[1], `${lib}: build times disagree`);
    assert.ok(!Number.isNaN(Date.parse(row.built)),
      `${lib}: built is not a date the launcher can subtract from now`);
  }
});

test('the manifest names nothing that has no body', () => {
  const libs = new Set(stubs.map(f => f.replace('.user.js', '')));
  const orphans = Object.keys(manifest).filter(k => !libs.has(k));
  assert.deepEqual(orphans, [],
    'these rows outlived their script and would answer for a build nobody ' +
    'ships: ' + orphans.join(', '));
});

test('launcher body includes the swipe deck and artifact definitions, and no errand list', () => {
  const text = fs.readFileSync(path.join(ROOT, 'userscripts', 'lib', 'launcher.js'), 'utf8');
  assert.doesNotMatch(text, /courier\/errands\.json/, 'errands are private now; the Stage popup runs them');
  assert.match(text, /deck-track/, 'launcher must have a swipe deck track');
  assert.match(text, /meta-toggle/, 'launcher must have a page metadata disclosure');
  assert.match(text, /data-take-html/, 'launcher must support copying HTML');
  assert.match(text, /r\.jina\.ai/, 'launcher must support Jina AI Reader integration');
  assert.match(text, /data-slide-id="sel"/, 'launcher must support selective selection slide visibility');
  assert.match(text, /const getSlides =/, 'launcher must dynamically calculate active slides');
});

test('stubs include @version, versioned @require, and auto-update storage loader', () => {
  for (const stub of stubs) {
    const lib = stub.replace('.user.js', '');
    const src = fs.readFileSync(path.join(ROOT, 'userscripts', stub), 'utf8');
    const row = manifest[lib];
    assert.match(src, new RegExp(`// @version\\s+${row.build}`), `${stub}: missing @version ${row.build}`);
    assert.match(src, new RegExp(`@require\\s+\\S+\\?v=${row.build}`), `${stub}: @require missing ?v=${row.build}`);
    assert.match(src, /@grant\s+GM\.getValue/, `${stub}: missing @grant GM.getValue`);
    assert.match(src, /@grant\s+GM\.setValue/, `${stub}: missing @grant GM.setValue`);
    assert.match(src, /@grant\s+GM\.xmlHttpRequest/, `${stub}: missing @grant GM.xmlHttpRequest`);
    assert.match(src, new RegExp(`wt_${lib}_code`), `${stub}: missing storage cache key`);
  }
});

