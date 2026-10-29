// lib/kits/git-attributes.js: the browser's reading of .gitattributes, held to
// git's own.
//
// The kit exists because a page cannot run `git check-attr`, so its one claim
// is that it answers as git does. The first test makes that claim for every
// tracked file in this checkout and every attribute any of them carries, with
// the user's and the system's attribute files switched off so the only
// declarations in play are the committed ones. The rest pin the rules this
// repository's file does not exercise yet, each against git in a throwaway
// repository, since a rule tested only on the lines that happen to exist
// passes until someone writes the first line that needs it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { repoRoot, loadKit } from './bootstrap.mjs';

const { GitAttributes: GA } = loadKit('git-attributes');
const ENV = { ...process.env, GIT_ATTR_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' };

/** git's answer: { path: { name: word } }, every specified attribute. */
function gitAll(cwd, files) {
  const out = spawnSync('git', ['check-attr', '--stdin', '-z', '--all'], { cwd, env: ENV, input: files.join('\0') + '\0' })
    .stdout.toString().split('\0');
  const got = Object.fromEntries(files.map(f => [f, {}]));
  for (let i = 0; i + 2 < out.length; i += 3) got[out[i]][out[i + 1]] = out[i + 2];
  return got;
}

/** The kit's answer in the same shape. */
function kitAll(files, sources) {
  const r = GA.compile(sources);
  return Object.fromEntries(files.map(f => [f, Object.fromEntries(Object.entries(r.of(f)).map(([k, v]) => [k, GA.word(v)]))]));
}

test('the kit gives every tracked file the attributes git gives it', () => {
  const files = spawnSync('git', ['ls-files', '-z'], { cwd: repoRoot }).stdout.toString().split('\0').filter(Boolean);
  const sources = Object.fromEntries(files.filter(f => path.basename(f) === '.gitattributes')
    .map(f => [path.dirname(f) === '.' ? '' : path.dirname(f), readFileSync(path.join(repoRoot, f), 'utf8')]));
  assert.ok(Object.keys(sources).length, 'no .gitattributes is tracked, so this test checks nothing');
  const want = gitAll(repoRoot, files), got = kitAll(files, sources);
  const canon = (o) => JSON.stringify(Object.entries(o).sort());
  const differ = files.filter(f => canon(got[f]) !== canon(want[f]))
    .slice(0, 5).map(f => `${f}: git ${JSON.stringify(want[f])}, kit ${JSON.stringify(got[f])}`);
  assert.deepEqual(differ, []);
});

/** A throwaway repository with these .gitattributes, asked about these paths. */
function versus(sources, paths) {
  const root = mkdtempSync(path.join(tmpdir(), 'gitattr-'));
  try {
    spawnSync('git', ['init', '-q'], { cwd: root, env: ENV });
    for (const [dir, text] of Object.entries(sources)) {
      mkdirSync(path.join(root, dir), { recursive: true });
      writeFileSync(path.join(root, dir, '.gitattributes'), text);
    }
    return [gitAll(root, paths), kitAll(paths, sources)];
  } finally { rmSync(root, { recursive: true, force: true }); }
}

/** Each case asserts the kit answers as git does in a throwaway repository. */
const same = (sources, paths) => { const [want, got] = versus(sources, paths); assert.deepEqual(got, want); };

test('a later line wins, and !name clears an earlier one', () => same(
  { '': '* edit=in-place\nlog/*.jsonl edit=append-only\nlog/keep.jsonl !edit\n' },
  ['a.md', 'log/x.jsonl', 'log/keep.jsonl', 'log/deep/x.jsonl']));

test('a pattern with no slash matches a name at any depth; one with a slash is anchored', () => same(
  { '': '*.csv merge=derived-csv\ndocs/*.md doc\n/top.md top\n' },
  ['a.csv', 'x/y/b.csv', 'docs/a.md', 'docs/sub/a.md', 'other/docs/a.md', 'top.md', 'x/top.md']));

test('a double star crosses folders only beside a slash', () => same(
  { '': 'a/**/b.md deep\nc/** under\n**/z.txt anyz\nm**n.txt star\n' },
  ['a/b.md', 'a/x/y/b.md', 'c/d/e.txt', 'c', 'z.txt', 'q/r/z.txt', 'mxn.txt', 'mx/n.txt']));

test("a folder's own file beats its parent's, and is anchored at that folder", () => same(
  { '': '* edit=in-place\n*.md kind=root\n', sub: '*.md kind=sub\n/only.md here\n' },
  ['a.md', 'sub/a.md', 'sub/deep/a.md', 'sub/only.md', 'sub/deep/only.md', 'only.md']));

test('brackets, a question mark, and a trailing slash or negative pattern that assigns nothing', () => same(
  { '': 'f[0-9].txt digit\nf[!0-9].txt other\ng?.txt one\nfolder/ dir\n!neg.txt neg\n' },
  ['f1.txt', 'fa.txt', 'g1.txt', 'g12.txt', 'folder/x.txt', 'neg.txt']));

test('a macro expands when set, and a later line can still override its parts', () => same(
  { '': '[attr]generated linguist-generated -diff\n*.bin binary\n*.bin text\ndist/* generated\n' },
  ['a.bin', 'dist/a.js', 'b.txt']));
