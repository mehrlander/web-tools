// ONE CSV PARSE. lib/kits/csv.js is the quote-aware line split, and the
// registry loader (node/build/registries-load.mjs) reads it through
// node/build/kit-shim.mjs, so the commit hook and the Map's Registries tab
// parse a registry with the same code.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../repo-root.mjs';

const OWNER = 'lib/kits/csv.js';
// The shape of the copies: a character loop that toggles on a double quote.
const QUOTE_LOOP = /\bin(?:Q|Quotes?)\s*=\s*(?:true|false|!)/;

test('only csv.js carries a quote-aware CSV loop', () => {
  const files = execFileSync('git', ['ls-files', '-z', 'lib', 'node', 'pages', 'app', 'popups'], { cwd: repoRoot, encoding: 'utf8' })
    .split('\0').filter((f) => /\.(m?js|html)$/.test(f) && f !== OWNER && !/^lib\/vendor\/|\.min\.js$|^pages\/(drop|scratch)\//.test(f));
  const offenders = files.filter((f) => QUOTE_LOOP.test(readFileSync(join(repoRoot, f), 'utf8')));
  assert.deepEqual(offenders, [], 'these parse CSV by hand; read lib/kits/csv.js (window.Csv, or node/build/kit-shim.mjs in Node)');
});

test('the registry loader exports the kit\'s own functions', async () => {
  const m = await import('../build/registries-load.mjs');
  const { Csv } = (await import('../build/kit-shim.mjs')).loadKit(repoRoot, OWNER);
  assert.equal(m.parseCsv('a,b\n"x,1",2\n')[0].a, 'x,1');
  assert.deepEqual(m.parseCsvLine('"a ""q""",b'), Csv.parseLine('"a ""q""",b'));
  assert.equal(m.joinList(['x;y', 'z']), Csv.join(['x;y', 'z']));
  assert.deepEqual(m.splitList(m.joinList(['x;y', 'z'])), ['x;y', 'z'], 'a delimiter inside a value survives the round trip');
});

test('list cells keep the next value separate when a value ends in a backslash', async () => {
  const registry = await import('../build/registries-load.mjs');
  const { Csv } = (await import('../build/kit-shim.mjs')).loadKit(repoRoot, OWNER);
  const values = ['folder\\', 'next'];
  assert.deepEqual(Csv.split(Csv.join(values)), values);
  const text = registry.writeCsv([{ id: 'paths', values }], ['id', 'values']);
  const [row] = registry.parseCsv(text);
  assert.deepEqual(registry.splitList(row.values), values,
    'a generated registry cell keeps both entries when the browser reads the same format');
});

test('list escaping round-trips backslashes, semicolons, Unicode and empty values', async () => {
  const registry = await import('../build/registries-load.mjs');
  const { Csv } = (await import('../build/kit-shim.mjs')).loadKit(repoRoot, OWNER);
  const atoms = ['', 'plain', 'café 🚀', ';', '\\', '\\\\', '\\;', ';\\', '\\\\;\\\\',
    'unknown\\q', 'tail\\', 'comma, "quote"'];
  const cases = atoms.flatMap(a => [[a], ...atoms.map(b => [a, b])]);
  cases.push(atoms);
  for (const values of cases) {
    assert.deepEqual(Csv.split(Csv.join(values)), values, JSON.stringify(values));
    assert.deepEqual(registry.splitList(registry.joinList(values)), values, JSON.stringify(values));
    const text = registry.writeCsv([{ id: 'sample', values }], ['id', 'values']);
    const [row] = Csv.rows(text);
    assert.deepEqual(Csv.split(row.values), values, 'serialized registry cell: ' + JSON.stringify(values));
  }
});

test('list reads consume recognized escapes once and preserve other backslashes', async () => {
  const registry = await import('../build/registries-load.mjs');
  const { Csv } = (await import('../build/kit-shim.mjs')).loadKit(repoRoot, OWNER);
  for (const split of [Csv.split, registry.splitList]) {
    assert.deepEqual(split('unknown\\q;tail\\'), ['unknown\\q', 'tail\\']);
    for (let count = 0; count <= 6; count++) {
      const text = 'left' + '\\'.repeat(count) + ';right';
      const left = 'left' + '\\'.repeat(Math.floor(count / 2));
      const expected = count % 2 ? [left + ';right'] : [left, 'right'];
      assert.deepEqual(split(text), expected, 'backslashes before separator: ' + count);
    }
  }
  assert.deepEqual(Csv.split(''), [''], 'the low-level decoder retains an empty value');
  assert.deepEqual(Csv.split(';'), ['', '']);
  assert.deepEqual(Csv.list(''), [], 'a blank registry cell means no asserted list');
  assert.deepEqual(Csv.list(' ; value ; '), ['value'], 'list() still trims and drops empty values');
  assert.equal(Csv.join([]), '', 'an empty array keeps its existing wire format');
});
