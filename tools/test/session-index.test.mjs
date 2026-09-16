// kits/session-index.js — the token index behind the sessions search lane.
//
// The index replaces a grep that opened all 372 records and 156 MB of store, so
// what has to be held here is the property that makes the replacement honest:
// A SEARCH OVER THE INDEX RETURNS WHAT A TEXT SCAN WOULD RETURN. Everything
// below is either that property directly, or one of the three rules it was
// found to depend on, each of which was wrong in a first draft and each of
// which fails silently by UNDER-returning:
//
//   1. A query scans the dictionary for its term as a substring, always. An
//      exact term that happens to exist is not the answer: `search.js` is a
//      term, and stopping there found 1 session where a scan finds 12.
//   2. The tokenizer keeps compounds AND their parts, or a substring spanning a
//      token break is unreachable.
//   3. A run past the length ceiling is cut into overlapping windows rather
//      than dropped, or every substring inside it goes with it.
//
// Pure, so no window beyond the stub the IIFE attaches to.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const window = {};
new Function('window', readFileSync(path.join(repoRoot, 'lib/kits/session-index.js'), 'utf8'))(window);
const X = window.SessionIndex;
const set = (s) => [...s].sort();

test('a compound is a term, and so is every part of it', () => {
  const t = X.tokens('Read lib/kits/estate-search.js and ROW_V today');
  // Whole, so a substring spanning the joiners can reach it.
  assert.ok(t.has('lib/kits/estate-search.js'));
  assert.ok(t.has('row_v'));
  // And split, so the ordinary words answer too.
  for (const w of ['lib', 'kits', 'estate', 'search', 'js', 'row', 'read', 'today']) assert.ok(t.has(w), w);
  // Case folds; a trailing sentence mark is not part of the term.
  assert.ok(X.tokens('GZIP it.').has('gzip'));
  assert.equal(X.tokens('GZIP it.').has('it.'), false);
});

test('one-character tokens are dropped, since they match most of a dictionary', () => {
  const t = X.tokens('a b to be');
  assert.deepEqual(set(t), ['be', 'to']);
});

test('an over-long run is cut into overlapping windows, not dropped', () => {
  // The real case: a GitHub blob URL. At the old 80-character ceiling three
  // sessions mentioning `lib/kits` only inside such a URL were unreachable.
  const url = 'github.com/mehrlander/web-tools/blob/claude/session-tooltip-design-qi8zzt/lib/kits/claude-mark.js';
  assert.ok(url.length > 80 && url.length <= X.TERM_MAX, 'the URL should fit the measured ceiling');
  assert.ok(X.tokens(url).has(url));
  // Past the ceiling the run itself is gone and the windows carry it. Any
  // substring up to half a window still lands wholly inside one of them.
  const long = 'a/' + 'bcdefghij/'.repeat(30);
  const t = X.tokens(long);
  assert.equal(t.has(long), false, 'the whole run is over the ceiling');
  const windows = [...t].filter(w => w.length > 50);
  assert.ok(windows.length > 1, 'it was windowed');
  const needle = long.slice(150, 200);
  assert.ok(windows.some(w => w.includes(needle)), 'a 50-character substring is inside some window');
});

test('a query is normalized the way a run is, or it cannot match at all', () => {
  // No stored term starts with a dot, so `.claude/uploads` typed as-is found 4
  // sessions where a scan found 39. Trimming the joiners off both ends is the
  // same rule applied to the query.
  assert.equal(X.normalize('.claude/uploads'), 'claude/uploads');
  assert.equal(X.normalize('/lib/kits/'), 'lib/kits');
  assert.equal(X.normalize('ROW_V'), 'row_v');
  assert.equal(X.normalize('...'), '');
});

test('a shard is byte-deterministic, whatever order it was built in', () => {
  const a = X.buildShard({ bbb: X.tokens('one two'), aaa: X.tokens('two three') });
  const b = X.buildShard({ aaa: X.tokens('three two'), bbb: X.tokens('two one') });
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.deepEqual([...a.docs], ['aaa', 'bbb']);
  // The commit hook stages what a generator writes, so an order that fell out
  // of insertion would diff on nothing, every crawl.
  assert.deepEqual(Object.keys(a.post), Object.keys(a.post).slice().sort());
});

test('a shard round-trips every term, which the crawl depends on', () => {
  // The crawl reads only the records whose sha moved, so every other entry in
  // a month exists nowhere but the shard it is about to rewrite.
  const src = { aaa: X.tokens('lib/kits/estate-search.js and gzip'), bbb: X.tokens('nothing shared here') };
  const back = X.readShard(X.buildShard(src));
  for (const id of Object.keys(src)) assert.deepEqual(set(back[id]), set(src[id]));
});

test('a merge replaces what changed, keeps what did not, and drops what left', () => {
  const prev = X.buildShard({ aaa: X.tokens('alpha'), bbb: X.tokens('beta'), ccc: X.tokens('gamma') });
  // bbb was re-read; aaa and ccc were not fetched at all and must survive.
  const next = X.mergeShard(prev, { bbb: X.tokens('delta') }, new Set(['aaa', 'bbb', 'ccc']));
  const back = X.readShard(next);
  assert.deepEqual(set(back.aaa), ['alpha']);
  assert.deepEqual(set(back.bbb), ['delta']);
  assert.deepEqual(set(back.ccc), ['gamma']);
  // A record gone from the store leaves the index with it.
  const pruned = X.readShard(X.mergeShard(prev, {}, new Set(['aaa'])));
  assert.deepEqual(Object.keys(pruned), ['aaa']);
  // NULL keeps everything, which is what an incomplete pass needs: the crawl
  // caps how many records it reads, and dropping the ones it did not reach
  // would empty the index a month at a time while reporting success.
  const capped = X.readShard(X.mergeShard(prev, { bbb: X.tokens('delta') }, null));
  assert.deepEqual(Object.keys(capped).sort(), ['aaa', 'bbb', 'ccc']);
});

test('search ANDs across terms and scans inside them', () => {
  const shard = X.buildShard({
    aaa: X.tokens('touched lib/kits/estate-search.js today'),
    bbb: X.tokens('wrote about gzip and nothing else'),
  });
  // Rule 1: `search.js` is not a whole term here, it is inside the path.
  assert.deepEqual(set(X.search([shard], 'search.js')), ['aaa']);
  assert.deepEqual(set(X.search([shard], 'estate-search')), ['aaa']);
  assert.deepEqual(set(X.search([shard], 'ESTATE')), ['aaa']);
  // AND, not OR.
  assert.deepEqual(set(X.search([shard], 'touched today')), ['aaa']);
  assert.deepEqual(set(X.search([shard], 'touched gzip')), []);
  assert.deepEqual(set(X.search([shard], 'nothing else')), ['bbb']);
  // An empty query is not a search, and a miss is a miss.
  assert.deepEqual(set(X.search([shard], '')), []);
  assert.deepEqual(set(X.search([shard], '   ')), []);
  assert.deepEqual(set(X.search([shard], 'xyzzy')), []);
});

test('shards are independent, so one month can be replaced alone', () => {
  const jul = X.buildShard({ aaa: X.tokens('wayback urls') });
  const aug = X.buildShard({ bbb: X.tokens('wayback again') });
  assert.deepEqual(set(X.search([aug, jul], 'wayback')), ['aaa', 'bbb']);
  // Doc positions are per shard and ids are the session's own, so nothing
  // renumbers when a shard is swapped.
  const aug2 = X.buildShard({ bbb: X.tokens('nothing'), ccc: X.tokens('wayback again') });
  assert.deepEqual(set(X.search([aug2, jul], 'wayback')), ['aaa', 'ccc']);
});

test('the index returns what a text scan returns', () => {
  // The whole property, over a corpus written to carry every shape that broke
  // a draft: a path, an identifier with underscores, a long URL, a word inside
  // a longer word, and mixed case.
  const corpus = {
    aaa: 'Touched lib/kits/estate-search.js and bumped ROW_V for the crawl.',
    bbb: 'The GZIP envelope rides in the fragment; see gzipped output.',
    ccc: 'See github.com/mehrlander/web-tools/blob/claude/session-tooltip-design-qi8zzt/lib/kits/claude-mark.js',
    ddd: 'Allotment schedule by fund, and the submittals are due.',
    eee: 'Nothing in common with any of the others at all.',
  };
  const shard = X.buildShard(Object.fromEntries(
    Object.entries(corpus).map(([id, t]) => [id, X.tokens(t)])));
  const scan = (q) => Object.keys(corpus).filter(id => {
    const t = corpus[id].toLowerCase();
    return q.split(/\s+/).map(w => X.normalize(w)).filter(Boolean).every(w => t.includes(w));
  }).sort();

  const queries = [
    'gzip', 'gzipped', 'zip', 'search.js', 'estate-search', 'lib/kits', 'row_v', 'ROW_V',
    'claude-mark', 'blob/claude', 'lob/c', 'submittal', 'submittals', 'allotment fund',
    'allotment gzip', 'nothing', 'xyzzy', 'web-tools/blob',
  ];
  for (const q of queries) {
    assert.deepEqual(set(X.search([shard], q)), scan(q), `index and scan disagree on ${JSON.stringify(q)}`);
  }
});

test('the shard path is the month the record filed under', () => {
  assert.equal(X.monthOf({ day: '2026-09-11' }), '2026-09');
  assert.equal(X.monthOf({ started: '2026-07-29T13:00:00Z' }), '2026-07');
  assert.equal(X.monthOf({}), '');
  assert.equal(X.shardPath('2026-09'), 'state/sessions-index/2026-09.json');
});

test('docText is the prose and nothing else', () => {
  const rec = {
    opening_ask: 'the ask', prompts: [{ text: 'a prompt' }], replies: [{ text: 'a reply' }],
    calls: [{ body: 'a tool result nobody said' }], last_message: 'ignored too',
  };
  const t = X.docText(rec);
  assert.match(t, /the ask/); assert.match(t, /a prompt/); assert.match(t, /a reply/);
  assert.doesNotMatch(t, /tool result/, 'a result is what the world returned, not what was said');
  assert.equal(X.docText(null), '');
});
