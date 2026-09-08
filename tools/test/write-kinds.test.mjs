// kits/write-kinds.js — what wrote a commit, read off the commit.
//
// The classifier's job is to keep two things apart that GitHub does not:
// development history and application state. Three writers in this estate share
// one account identity, so most of these assertions are about the SUBJECT LINE
// conventions the repo writes on purpose, and about the order they are read in,
// since several patterns can match one message and only the first answer ships.
//
// The last test runs the classifier over the shapes actually observed in the
// registry repo on 2026-09-08, so a convention that changes without this file
// changing fails here rather than quietly reclassifying a year of commits.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const window = {};
new Function('window', readFileSync(path.join(repoRoot, 'lib/kits/write-kinds.js'), 'utf8'))(window);
const K = window.WriteKinds;
const kind = (msg, author = 'mehrlander') => K.classify({ msg, author }).key;

test('the four cache refreshes are the crawl, by the subject the app writes', () => {
  for (const m of ['Update config cache (state/configs.json)',
                   'Update activity cache (state/activity.json)',
                   'Update sessions cache (state/sessions.json)',
                   'Log config crawl calls (state/calls.json)']) {
    assert.equal(kind(m), 'crawl', m);
  }
});

test('the trailer means a person tapped, under either name the app has had', () => {
  assert.equal(kind('Jot "try the lightbulb" via Web Tools'), 'tap');
  assert.equal(kind('Add 3 files to me/dest:pkg via show-repo'), 'tap',
    'the old trailer still reads, since 608 commits carry it');
});

test('a trailer only counts at the end, or a message quoting one reclassifies', () => {
  assert.equal(kind('Explain what via Web Tools used to mean in the docs'), 'authored');
});

test('a Claude session is known by the author the platform sets, not the subject', () => {
  assert.equal(kind('sessions: 2026-09-06-e4654c9e', 'Claude'), 'session');
  assert.equal(kind('anything at all', 'Claude'), 'session');
});

test('both merge shapes land as a merge', () => {
  assert.equal(kind('Merge pull request #607 from mehrlander/claude/x'), 'merge');
  assert.equal(kind('Merge branch main into topic'), 'merge');
  assert.equal(kind('sessions: capture the fan-out half (#49)'), 'merge', 'the squash shape');
});

test('a bot is CI, whatever it says', () => {
  assert.equal(kind('WSL data snapshot 2026-09-01T09:22Z', 'github-actions[bot]'), 'ci');
});

test('the phone reads as a device, and says it is a guess', () => {
  assert.equal(kind('page report: peek.html'), 'device');
  assert.equal(kind('probe-unattended: js'), 'device');
  assert.equal(K.classify({ msg: 'page report: peek.html', author: 'x' }).sure, false,
    'an observed vocabulary is not a contract, and the pane may say so');
});

test('every other kind is sure, so an unsure row means exactly one thing', () => {
  for (const k of K.KINDS) {
    assert.equal(k.sure, k.key !== 'device', k.key);
  }
});

test('the app signals beat the author, since a tap and a crawl are also committed by a person', () => {
  assert.equal(kind('Update activity cache (state/activity.json)', 'Claude'), 'crawl',
    'a subject the app writes settles it outright');
  assert.equal(kind('Pin "x" via Web Tools', 'Claude'), 'tap');
});

test('a session beats a merge, or every squash-merged session commit reads as a merge', () => {
  assert.equal(kind('sessions: capture the fan-out half (#49)', 'Claude'), 'session');
});

test('what claims nothing is named as claiming nothing', () => {
  assert.equal(kind('Initial commit'), 'authored');
  assert.equal(kind('sectors: backfill the 165 confirmed skeptic notes'), 'authored',
    'session work pushed from a local CLI is indistinguishable, and is not guessed at');
});

test('the state split is the accent, and only three kinds carry it', () => {
  const state = K.KINDS.filter(k => k.state).map(k => k.key);
  assert.deepEqual(state, ['crawl', 'tap', 'device']);
});

test('a malformed row is classified rather than thrown on', () => {
  assert.equal(K.classify(null).key, 'authored');
  assert.equal(K.classify({}).key, 'authored');
  assert.equal(K.classify({ msg: 42 }).key, 'authored');
});

test('only the first line is read, so a body cannot reclassify a commit', () => {
  assert.equal(kind('Add 2 files to me/x via Web Tools\n\n- a.txt\n- b.txt'), 'tap');
  assert.equal(kind('Fix the parser\n\nMerge pull request #1 is quoted here'), 'authored');
});

test('tally keeps every kind, in KINDS order, zeros included', () => {
  const t = K.tally([{ msg: 'Initial commit', author: 'x' }]);
  assert.deepEqual(Object.keys(t), K.KINDS.map(k => k.key));
  assert.equal(t.authored, 1);
  assert.equal(t.crawl, 0, 'an absent category and an empty one read differently');
});

test('stateShare is the share of application state, and an empty set is zero not NaN', () => {
  assert.equal(K.stateShare([]), 0);
  assert.equal(K.stateShare([
    { msg: 'Update activity cache (state/activity.json)', author: 'x' },
    { msg: 'Initial commit', author: 'x' },
  ]), 0.5);
});
