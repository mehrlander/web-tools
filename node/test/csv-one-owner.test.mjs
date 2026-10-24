// ONE CSV PARSE. lib/kits/csv.js was written because a third copy of the
// quote-aware line split appeared, and the second, node/build/registries-load.mjs,
// stayed beside it byte for byte until 2026-10-24, when the code-jobs probe's
// identifier scan ranked the two as one function. The loader now reads the kit
// through node/build/kit-shim.mjs, so the commit hook and the Map's Registries
// tab parse a registry with the same code.
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
