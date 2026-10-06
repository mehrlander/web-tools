// docs/context-sources.csv and docs/context-topics.csv: what enters a session,
// the Map view's Context tab. The closed domains are checked by the properties
// gate; this holds the registry to the tree it describes.
//
// The strongest check here is the one that derives: every hook the plugin
// registers must have a row, so a hook added to hooks.json without a row fails
// rather than entering sessions unaccounted for. The private half lives in
// web-tools-private; where that checkout sits beside this one it is held to
// the same schema, and where it does not (CI) those checks skip.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';
import { parseCsv } from '../build/registries-load.mjs';

const HUB = 'mehrlander/web-tools';
const read = (p) => readFileSync(path.join(repoRoot, p), 'utf8');
const header = (text) => text.split(/\r?\n/, 1)[0];
const srcText = read('docs/context-sources.csv');
const rows = parseCsv(srcText);
const topics = parseCsv(read('docs/context-topics.csv'));
const topicKeys = new Set(topics.map(t => t.topic));
const privPath = path.join(repoRoot, '..', 'web-tools-private', 'environment', 'context-sources.csv');
const privText = existsSync(privPath) ? readFileSync(privPath, 'utf8') : null;
const privRows = privText ? parseCsv(privText) : [];

test('every row has exactly the header\'s columns, so an unquoted comma cannot split a row', () => {
  for (const [name, text] of [['docs/context-sources.csv', srcText], ['docs/context-topics.csv', read('docs/context-topics.csv')], ...(privText ? [['private half', privText]] : [])]) {
    const width = header(text).split(',').length;
    const lines = text.split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      let n = 1, q = false;
      for (const ch of line) { if (ch === '"') q = !q; else if (ch === ',' && !q) n++; }
      assert.equal(n, width, name + ': ' + line.slice(0, 60));
    }
  }
});

test('ids are unique across both halves', () => {
  const ids = [...rows, ...privRows].map(r => r.id);
  assert.equal(new Set(ids).size, ids.length, 'a context source id appears twice');
});

test('every public row that names a web-tools file points at one that exists', () => {
  for (const r of rows.filter(r => r.repo === HUB)) {
    assert.ok(r.path, r.id + ': a web-tools row names its path');
    const file = r.path.split('#')[0];
    assert.ok(existsSync(path.join(repoRoot, file)), r.id + ': ' + file + ' does not exist');
  }
});

test('a row either names a file or says where it is defined', () => {
  for (const r of [...rows, ...privRows]) {
    assert.ok((r.repo && r.path) || r.defined_in, r.id + ': no path and no defined_in, so a reader cannot find it');
  }
});

test('every hook the plugin registers has a row', () => {
  const hooks = JSON.parse(read('skills/hooks/hooks.json')).hooks;
  const scripts = new Set();
  for (const entries of Object.values(hooks))
    for (const e of entries) for (const h of e.hooks)
      for (const m of h.command.matchAll(/hooks\/([\w.-]+\.sh)/g)) scripts.add('skills/hooks/' + m[1]);
  const claimed = new Set(rows.map(r => r.path));
  for (const s of scripts) assert.ok(claimed.has(s), s + ' enters sessions but has no row in docs/context-sources.csv');
});

test('every topic a row names is declared, and every declared topic is used', () => {
  const used = new Set();
  for (const r of [...rows, ...privRows])
    for (const k of String(r.topics || '').split(';').map(s => s.trim()).filter(Boolean)) {
      assert.ok(topicKeys.has(k), r.id + ': topic "' + k + '" is not in docs/context-topics.csv');
      used.add(k);
    }
  for (const k of topicKeys) {
    // A topic spoken to only by private rows is legitimate; without the
    // private half this direction cannot be decided.
    if (!privText && !rows.some(r => String(r.topics).includes(k))) continue;
    assert.ok(used.has(k), 'topic "' + k + '" is declared and no row speaks to it');
  }
});

test('a settings link, where given, is a claude.ai page', () => {
  for (const r of [...rows, ...privRows].filter(r => r.link))
    assert.match(r.link, /^https:\/\/claude\.ai\//, r.id + ': link "' + r.link + '"');
});

test('tally keys have one of the two shapes the Measured lens joins on', () => {
  for (const r of [...rows, ...privRows].filter(r => r.tally))
    assert.match(r.tally, /^(startup|skill):\S+$/, r.id + ': tally "' + r.tally + '"');
});

test('the private half, where present, shares the base schema and holds only private circles', { skip: !privText && 'web-tools-private is not checked out beside this repo' }, () => {
  const optional = new Set(['assistant', 'discretion']);
  const columns = text => header(text).split(',');
  assert.deepEqual(columns(privText).filter(c => !optional.has(c)), columns(srcText).filter(c => !optional.has(c)), 'the two halves have different base columns');
  for (const c of columns(privText)) assert.ok(columns(srcText).includes(c), 'unknown private column: ' + c);
  const deliveryValues = new Set(['injected', 'prodded', 'reactive', 'pulled', 'outside']);
  for (const r of privRows.filter(r => r.discretion)) assert.ok(deliveryValues.has(r.discretion), r.id + ': unknown delivery classification');
  const allowed = new Set(['account', 'environment', 'user', 'repo']);
  for (const r of privRows) assert.ok(allowed.has(r.circle), r.id + ': circle "' + r.circle + '" belongs in the public half');
});
