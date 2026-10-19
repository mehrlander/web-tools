// skills/doc-craft/doc-review.py prints the doc review doc-craft's Review
// section describes, from a briefing and the working tree's uncommitted edits.
// What it must never do is drop a change: an edit left out of the review would
// reach the commit unseen, so a hunk the briefing omits is an error.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const SCRIPT = path.join(repoRoot, 'skills/doc-craft/doc-review.py');
const env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t',
  GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t', GIT_CONFIG_COUNT: '1',
  GIT_CONFIG_KEY_0: 'commit.gpgsign', GIT_CONFIG_VALUE_0: 'false' };

const BEFORE = ['# Guide', '', 'Inline code gets a grey pill on desktop and none on the phone.', '',
  'Filler one.', 'Filler two.', 'Filler three.', 'Filler four.', '', 'A title never reaches a phone.', ''].join('\n');
const AFTER = BEFORE.replace('and none on the phone', 'and on the phone')
  .replace('A title never reaches a phone.', 'The browser draws a title only on hover.');

function fixture() {
  const work = mkdtempSync(path.join(tmpdir(), 'doc-review-'));
  const git = (...a) => execFileSync('git', ['-C', work, ...a], { encoding: 'utf8', env });
  git('init', '-q', '-b', 'main');
  mkdirSync(path.join(work, 'docs'));
  writeFileSync(path.join(work, 'docs/guide.md'), BEFORE);
  git('add', '-A'); git('commit', '-qm', 'seed');
  git('remote', 'add', 'origin', 'https://github.com/acme/notes.git');
  writeFileSync(path.join(work, 'docs/guide.md'), AFTER);
  return work;
}
const run = (work, args, input) => spawnSync('python3', [SCRIPT, ...args],
  { cwd: work, encoding: 'utf8', env, input });

const BRIEF = {
  topic: 'the guide', opening: 'Two edits to the guide.',
  documents: { 'docs/guide.md': { name: 'The guide', covers: 'What the app shows.' } },
  edits: [{ hunk: 'docs/guide.md#2', kind: 'Wording', origin: "this session's work",
    text: 'The reason becomes what the browser does.', reviewed: 'the style guide.' }],
  corrections: ['docs/guide.md#1'],
};

test('--list names each hunk of the uncommitted edits', () => {
  const r = run(fixture(), ['--list']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^docs\/guide\.md#1\t-1 \+1\t/m);
  assert.match(r.stdout, /^docs\/guide\.md#2\t-1 \+1\t/m);
});

test('a briefing renders as the doc review: heading, caption with its 🥏, label, diff, fields, corrections', () => {
  const r = run(fixture(), ['-'], JSON.stringify(BRIEF));
  assert.equal(r.status, 0, r.stderr);
  const out = r.stdout;
  assert.match(out, /^📝 \*\*Doc review: the guide\*\*\n\nTwo edits to the guide\.\n/);
  // HEAD is on no remote, so the link opens the document on main.
  assert.ok(out.includes('**The guide** · 🥏 [guide.md](https://mehrlander.github.io/web-tools/pages/toss-render.html#data=acme/notes@main:docs/guide.md)\nWhat the app shows.'));
  assert.ok(out.includes("**Edit 1 · Wording · this session's work.** The reason becomes what the browser does."));
  assert.ok(out.includes('```diff\n-A title never reaches a phone.\n+The browser draws a title only on hover.\n```'), out);
  assert.ok(out.includes('*Reviewed:* the style guide.'));
  assert.ok(out.includes('- The guide: "desktop and none on the" becomes "desktop and on the"'), out);
});

test('a hunk the briefing omits is refused, since the review would hide it', () => {
  const brief = { ...BRIEF, corrections: [] };
  const r = run(fixture(), ['-'], JSON.stringify(brief));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /hunk missing from the briefing: docs\/guide\.md#1/);
  assert.equal(r.stdout, '');
});

test('an unknown kind and an unknown hunk are refused by name', () => {
  const brief = { ...BRIEF, edits: [{ ...BRIEF.edits[0], kind: 'Tweak' }], corrections: ['docs/guide.md#1', 'docs/guide.md#9'] };
  const r = run(fixture(), ['-'], JSON.stringify(brief));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /kind must be one of Fix, Alignment, Addition, Wording/);
  assert.match(r.stderr, /no such hunk: docs\/guide\.md#9/);
});
