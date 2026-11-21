// .gitattributes as a declaring file: the attributes it gives each tracked
// file, and the vocabulary that says what each of the estate's own values means.
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
import { repoRoot, loadKit } from './bootstrap.mjs';
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

test("every value of the estate's own attributes has a definition in docs/vocabularies.csv", () => {
  // The Map view's Attributes tab shows each value with its definition, so a
  // value with none would reach the reader as a bare word. An attribute git or
  // GitHub acts on is defined in their documentation, which the tab links.
  const { BUILT_IN } = loadKit('git-attributes').GitAttributes;
  const defined = new Set(vocab.map(r => r.property + '=' + r.value));
  const used = new Set(attributes().filter(([, name]) => !BUILT_IN[name]).map(([, name, value]) => name + '=' + value));
  assert.ok(used.has('edit=in-place'), 'no tracked file carries edit, so this test checks nothing');
  assert.deepEqual([...used].filter(k => !defined.has(k)).sort(), []);
});

test('a write-once doc has no living status in docs/docs.csv, and a blank status is write-once', () => {
  // Which docs are records is said once, by edit=write-once here; docs.csv
  // leaves a record's status blank. The Content program's status panel labels
  // the blank bucket "record", which holds only while every blank is one.
  const edit = attribute('edit');
  const docs = parseCsv(readFileSync(path.join(repoRoot, 'docs/docs.csv'), 'utf8'));
  assert.ok(docs.some(d => edit[d.path] === 'write-once'), 'no doc is write-once, so this test checks nothing');
  assert.deepEqual(docs.filter(d => edit[d.path] === 'write-once' && d.status === 'living').map(d => d.path), [],
    'write-once but status living');
  assert.deepEqual(docs.filter(d => !d.status && edit[d.path] !== 'write-once').map(d => d.path), [],
    'blank status but not write-once');
});

test('every file a commit rule rebuilds whole is regenerated, and every regenerated file has a builder', () => {
  // docs/commit-rules.csv names each rule's outputs. An output is rebuilt
  // whole unless it is a registry with an authored property or authored rows,
  // which the rule only updates in part (docs/docs.csv, pages/pages.csv). A
  // registry whose properties and membership are all computed is rebuilt
  // whole, and so is any output that is not a registry. An output folder
  // stands for the files under it.
  const rules = parseCsv(readFileSync(path.join(repoRoot, 'docs/commit-rules.csv'), 'utf8'));
  const regs = parseCsv(readFileSync(path.join(repoRoot, 'docs/registries.csv'), 'utf8'));
  const props = parseCsv(readFileSync(path.join(repoRoot, 'docs/properties.csv'), 'utf8'));
  const edit = attribute('edit');
  const files = Object.keys(edit);
  const staged = [...new Set(rules.flatMap(r => (r.outputs || '').split(';').map(s => s.trim()).filter(Boolean)))];
  const whole = staged.filter(s => {
    const reg = regs.find(r => r.path === s);
    if (!reg) return true;
    return reg.membership === 'computed' && props.filter(p => p.registry === reg.id).every(p => p.mode === 'computed');
  }).flatMap(s => files.filter(f => f === s || f.startsWith(s.replace(/\/$/, '') + '/')));
  assert.ok(whole.length, 'no rule has an output, so this test checks nothing');
  assert.deepEqual(whole.filter(f => edit[f] !== 'regenerated').sort(), [], 'rebuilt whole by a rule but not edit=regenerated');
  // The reverse: a regenerated file is a rule's output, or is a page thumbnail,
  // which `npm run pages-shots` rebuilds once a session (CLAUDE.md, "Per-session refresh").
  const built = (f) => staged.some(s => f === s || f.startsWith(s.replace(/\/$/, '') + '/')) || f.startsWith('pages/thumbs/');
  assert.deepEqual(files.filter(f => edit[f] === 'regenerated' && !built(f)).sort(), [], 'edit=regenerated with no rule that builds it');
});
