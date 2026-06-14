// kits/selfsim.js — suffix automaton, minimizer matching, entropy profile.
// The automaton results are cross-validated against naive O(n²) reference
// implementations over hundreds of seeded-random strings; the minimizer
// layer is checked against its formal guarantees (window coverage, exact
// verified matches, planted-repeat detection).

import test from 'node:test';
import assert from 'node:assert/strict';
import { loadKit } from './bootstrap.mjs';

const { selfsim } = loadKit('selfsim');

// Deterministic PRNG so failures reproduce.
const mulberry32 = (a) => () => {
  a |= 0; a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const randString = (rnd, n, alphabet) =>
  Array.from({ length: n }, () => alphabet[Math.floor(rnd() * alphabet.length)]).join('');

// ---- naive references --------------------------------------------------

const naiveDistinct = (s) => {
  const set = new Set();
  for (let i = 0; i < s.length; i++)
    for (let j = i + 1; j <= s.length; j++) set.add(s.slice(i, j));
  return set.size;
};

const naiveCount = (s, p) => {
  if (!p) return 0;
  let c = 0, i = s.indexOf(p);
  while (i !== -1) { c++; i = s.indexOf(p, i + 1); }
  return c;
};

const naiveLrsLen = (s) => {
  for (let L = s.length - 1; L >= 1; L--) {
    const seen = new Set();
    for (let i = 0; i + L <= s.length; i++) {
      const sub = s.slice(i, i + L);
      if (seen.has(sub)) return L;
      seen.add(sub);
    }
  }
  return 0;
};

const ALPHABETS = ['ab', 'abcd', 'abcdefghijklmnop XYZ.,\n'];

// ---- suffix automaton vs brute force ------------------------------------

test('distinct substring count matches brute force on random strings', () => {
  const rnd = mulberry32(1);
  for (let trial = 0; trial < 150; trial++) {
    const alpha = ALPHABETS[trial % ALPHABETS.length];
    const s = randString(rnd, 1 + Math.floor(rnd() * 120), alpha);
    assert.equal(selfsim.distinct(s), naiveDistinct(s), `failed on ${JSON.stringify(s)}`);
  }
});

test('longest repeat matches brute-force length, and its count is exact', () => {
  const rnd = mulberry32(2);
  for (let trial = 0; trial < 150; trial++) {
    const alpha = ALPHABETS[trial % ALPHABETS.length];
    const s = randString(rnd, 2 + Math.floor(rnd() * 120), alpha);
    const lr = selfsim.longestRepeat(s);
    const want = naiveLrsLen(s);
    if (want === 0) {
      assert.equal(lr, null, `expected no repeat in ${JSON.stringify(s)}`);
    } else {
      assert.equal(lr.len, want, `LRS length on ${JSON.stringify(s)}`);
      assert.equal(lr.count, naiveCount(s, lr.text), `LRS count on ${JSON.stringify(s)}`);
      assert.deepEqual(lr.positions[0], s.indexOf(lr.text));
    }
  }
});

test('occurrences agrees with naive scan, for substrings and non-substrings', () => {
  const rnd = mulberry32(3);
  for (let trial = 0; trial < 100; trial++) {
    const s = randString(rnd, 20 + Math.floor(rnd() * 100), ALPHABETS[trial % 3]);
    const sam = selfsim.build(s);
    // real substrings
    for (let q = 0; q < 5; q++) {
      const i = Math.floor(rnd() * s.length);
      const j = i + 1 + Math.floor(rnd() * (s.length - i));
      const p = s.slice(i, j);
      const got = selfsim.occurrences(sam, p);
      assert.equal(got.count, naiveCount(s, p), `count of ${JSON.stringify(p)} in ${JSON.stringify(s)}`);
      assert.deepEqual(got.positions, allPositions(s, p));
    }
    // probably-absent strings
    const absent = randString(rnd, 6, 'QRSTUV');
    assert.equal(selfsim.occurrences(sam, absent).count, naiveCount(s, absent));
  }
});

const allPositions = (s, p) => {
  const out = [];
  let i = s.indexOf(p);
  while (i !== -1) { out.push(i); i = s.indexOf(p, i + 1); }
  return out;
};

test('topRepeats entries are truthful: counts exact, no shadowed duplicates', () => {
  const rnd = mulberry32(4);
  for (let trial = 0; trial < 60; trial++) {
    const s = randString(rnd, 40 + Math.floor(rnd() * 160), ALPHABETS[trial % 3]);
    const reps = selfsim.topRepeats(s, { minLen: 2, limit: 25 });
    const seen = new Set();
    for (const r of reps) {
      assert.ok(r.count >= 2, 'repeat means count >= 2');
      assert.ok(r.len >= 2, 'respects minLen');
      assert.equal(r.count, naiveCount(s, r.text), `count of ${JSON.stringify(r.text)}`);
      assert.equal(r.len, r.text.length);
      assert.equal(r.score, r.len * r.count);
      assert.ok(!seen.has(r.text), 'no duplicate strings');
      seen.add(r.text);
      assert.deepEqual(r.positions, allPositions(s, r.text));
    }
    // no accepted repeat is a same-count substring of an earlier one
    for (let a = 0; a < reps.length; a++) {
      for (let b = 0; b < a; b++) {
        assert.ok(!(reps[b].count === reps[a].count && reps[b].text.includes(reps[a].text)),
          `repeat ${a} shadowed by ${b}`);
      }
    }
  }
});

test('edge cases: empty, single char, uniform run', () => {
  assert.equal(selfsim.distinct(''), 0);
  assert.equal(selfsim.longestRepeat('x'), null);
  assert.equal(selfsim.longestRepeat('abc'), null);
  const s = 'a'.repeat(50);
  assert.equal(selfsim.distinct(s), 50);
  const lr = selfsim.longestRepeat(s);
  assert.equal(lr.len, 49);
  assert.equal(lr.count, 2);
  assert.equal(selfsim.occurrences(s, '').count, 0);
});

test('100 KB stress: builds and stays self-consistent', () => {
  const rnd = mulberry32(5);
  // Repetitive-ish corpus: random base with re-pasted chunks, like real text.
  let s = randString(rnd, 4096, ALPHABETS[2]);
  while (s.length < 100_000) {
    const i = Math.floor(rnd() * s.length * 0.8);
    s += s.slice(i, i + 1024) + randString(rnd, 256, ALPHABETS[2]);
  }
  const sam = selfsim.build(s);
  assert.ok(sam.size < 2 * s.length + 5);
  const lr = selfsim.longestRepeat(sam);
  assert.ok(lr.len >= 1024, 'pasted 1 KB chunks must surface');
  assert.equal(lr.count, naiveCount(s, lr.text));
  const reps = selfsim.topRepeats(sam, { limit: 10 });
  assert.ok(reps.length > 0);
  assert.equal(reps[0].count, naiveCount(s, reps[0].text));
});

// ---- minimizers ----------------------------------------------------------

test('minimizers: hashes are correct and every window is covered', () => {
  const rnd = mulberry32(6);
  for (let trial = 0; trial < 40; trial++) {
    const s = randString(rnd, 50 + Math.floor(rnd() * 400), ALPHABETS[trial % 3]);
    const k = 4 + (trial % 5), w = 2 + (trial % 6);
    const { pos, hash } = selfsim.minimizers(s, { k, w });
    const all = selfsim.kmerHashes(s, k);
    const selected = new Set(pos);
    for (let i = 0; i < pos.length; i++) {
      assert.equal(hash[i], all[pos[i]], 'reported hash matches direct hash');
      assert.ok(i === 0 || pos[i] > pos[i - 1], 'positions strictly increasing');
    }
    // formal guarantee: every window of w consecutive k-mers has a pick
    for (let start = 0; start + w <= all.length; start++) {
      let covered = false;
      for (let i = start; i < start + w; i++) if (selected.has(i)) { covered = true; break; }
      assert.ok(covered, `window at ${start} uncovered (k=${k}, w=${w})`);
    }
  }
});

test('matchPoints: every pair is a verified exact k-mer match with i < j', () => {
  const rnd = mulberry32(7);
  const s = randString(rnd, 3000, 'abcdef ');
  const { xs, ys, k } = selfsim.matchPoints(s, { k: 8, w: 4 });
  assert.equal(xs.length, ys.length);
  for (let i = 0; i < xs.length; i++) {
    assert.ok(xs[i] < ys[i]);
    assert.equal(s.substr(xs[i], k), s.substr(ys[i], k));
  }
});

test('matchPoints: a planted repeat of length >= k+w-1 is always detected', () => {
  const rnd = mulberry32(8);
  for (let trial = 0; trial < 25; trial++) {
    const R = randString(rnd, 60, 'abcdefgh');
    const a = randString(rnd, 200 + Math.floor(rnd() * 200), 'mnopqrst');
    const b = randString(rnd, 200 + Math.floor(rnd() * 200), 'mnopqrst');
    const c = randString(rnd, 100, 'mnopqrst');
    const s = a + R + b + R + c;
    const lo1 = a.length, lo2 = a.length + R.length + b.length;
    const { xs, ys, k } = selfsim.matchPoints(s, { k: 8, w: 4 });
    let found = false;
    for (let i = 0; i < xs.length; i++) {
      const inFirst = xs[i] >= lo1 && xs[i] + k <= lo1 + R.length;
      const inSecond = ys[i] >= lo2 && ys[i] + k <= lo2 + R.length;
      if (inFirst && inSecond && xs[i] - lo1 === ys[i] - lo2) { found = true; break; }
    }
    assert.ok(found, `trial ${trial}: planted 60-char repeat produced no cross pair`);
  }
});

test('matchPointsExact: complete within a slice, coordinates in text space', () => {
  const s = 'xxxx' + 'hello-world!hello-world!' + 'yyyy';
  const lo = 4, hi = 4 + 24;
  const { xs, ys, k } = selfsim.matchPointsExact(s, lo, hi, { k: 6 });
  assert.ok(xs.length > 0);
  for (let i = 0; i < xs.length; i++) {
    assert.ok(xs[i] >= lo && ys[i] + k <= hi);
    assert.equal(s.substr(xs[i], k), s.substr(ys[i], k));
  }
  // the 12-char period must appear as the pair (lo, lo+12) at offset 0
  assert.ok(Array.from(xs).some((x, i) => x === lo && ys[i] === lo + 12));
});

// ---- draw (display helper) ------------------------------------------------

test('draw: one stroked diagonal + one (mirrored) rect per match point', () => {
  // A recording 2D-context stub: draw() must work against any canvas.
  const ops = [];
  const ctx = new Proxy({ fillStyle: '', strokeStyle: '', lineWidth: 0 }, {
    get: (t, p) => (p in t ? t[p] : (...a) => ops.push([p, ...a])),
    set: (t, p, v) => (t[p] = v, true),
  });
  const canvas = { width: 200, height: 200, getContext: () => ctx };
  const text = 'abcabcabc abcabcabc xyz xyz xyz';
  const pts = selfsim.draw(canvas, text, { size: 200, k: 4, w: 2 });

  const strokes = ops.filter(o => o[0] === 'stroke').length;
  const rects = ops.filter(o => o[0] === 'fillRect').length;
  assert.equal(strokes, 1, 'the identity diagonal is stroked once');
  assert.equal(rects, pts.count * 2, 'mirrored: two rects per match point');
  assert.ok(ops.some(o => o[0] === 'clearRect'), 'clears when no background given');
});

test('draw: mirror:false halves the marks; background fills instead of clears', () => {
  const ops = [];
  const ctx = new Proxy({}, {
    get: (t, p) => (p in t ? t[p] : (...a) => ops.push([p, ...a])),
    set: (t, p, v) => (t[p] = v, true),
  });
  const canvas = { width: 120, height: 120, getContext: () => ctx };
  const pts = selfsim.draw(canvas, 'la la la la la', { size: 120, k: 2, w: 1, mirror: false, background: '#fff' });
  assert.equal(ops.filter(o => o[0] === 'fillRect').length, pts.count + 1, 'one rect per point, plus the background fill');
  assert.ok(!ops.some(o => o[0] === 'clearRect'), 'background path does not clear');
});

// ---- entropy --------------------------------------------------------------

test('entropy profile: zero on constant text, high on random bytes, sized to bins', () => {
  const flat = selfsim.entropyProfile('a'.repeat(5000), { bins: 64 });
  assert.equal(flat.length, 64);
  for (const v of flat) assert.equal(v, 0);

  const rnd = mulberry32(9);
  let noisy = '';
  for (let i = 0; i < 5000; i++) noisy += String.fromCharCode(Math.floor(rnd() * 256));
  const prof = selfsim.entropyProfile(noisy, { window: 512, bins: 64 });
  for (const v of prof) assert.ok(v > 6.5, `random bytes should be near 8 bits, got ${v}`);

  assert.equal(selfsim.entropyProfile('', { bins: 16 }).length, 16);
});
