// .gitattributes as a declaring file: the attributes it gives each tracked
// file, and the vocabulary that says what each value means.
//
// Every read goes through `git check-attr`, never the file's text, so a
// pattern, a later line and a folder's own .gitattributes count as git counts
// them. The values' meanings are rows of docs/vocabularies.csv under registry
// `gitattributes`; the engine that holds a commit to its `edit` value is
// skills/hooks/check-edit-policy.py, run by .githooks/commit-msg and by the
// edit-policy job in .github/workflows/test.yml.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';
import { parseCsv } from '../build/registries-load.mjs';

// Only the committed declarations: no user or system attribute file.
const ENV = { ...process.env, GIT_ATTR_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' };

/** [path, attribute, value] for every tracked file and every attribute it carries,
 *  or for one attribute (value 'unspecified' where none is given). */
function attributes(name) {
  const files = spawnSync('git', ['ls-files', '-z'], { cwd: repoRoot }).stdout;
  const out = spawnSync('git', ['check-attr', '--stdin', '-z', name || '--all'], { cwd: repoRoot, env: ENV, input: files })
    .stdout.toString().split('\0');
  const found = [];
  for (let i = 0; i + 2 < out.length; i += 3) found.push([out[i], out[i + 1], out[i + 2]]);
  return found;
}
const attribute = (name) => Object.fromEntries(attributes(name).map(([p, , v]) => [p, v]));

const vocab = parseCsv(readFileSync(path.join(repoRoot, 'docs/vocabularies.csv'), 'utf8'))
  .filter(r => r.registry === 'gitattributes');

test("the edit-policy engine's own cases pass", () => {
  const r = spawnSync('python3', [path.join(repoRoot, 'skills/hooks/check-edit-policy.py'), '--self-test'],
    { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr || r.stdout);
});

test('every attribute value a tracked file carries has a definition in docs/vocabularies.csv', () => {
  // The Map view's Attributes tab shows each value with its definition, so a
  // value with none would reach the reader as a bare word.
  const defined = new Set(vocab.map(r => r.property + '=' + r.value));
  const used = new Set(attributes().map(([, name, value]) => name + '=' + value));
  assert.ok(used.has('edit=in-place'), 'no tracked file carries edit, so this test checks nothing');
  assert.deepEqual([...used].filter(k => !defined.has(k)).sort(), []);
});

test('every file docs/docs.csv marks record is write-once, and every write-once file is a record', () => {
  // A record is preserved as it stood, which is what write-once holds. The two
  // declarations name the same set, so the test holds them to each other.
  const records = parseCsv(readFileSync(path.join(repoRoot, 'docs/docs.csv'), 'utf8'))
    .filter(r => r.status === 'record').map(r => r.path).sort();
  const once = Object.entries(attribute('edit')).filter(([, v]) => v === 'write-once').map(([p]) => p).sort();
  assert.ok(records.length, 'docs/docs.csv marks no record, so this test checks nothing');
  assert.deepEqual(once, records);
});
