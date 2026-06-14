// kits/selfsim.js — self-similarity analysis for arbitrary text.
//
// Three independent engines behind one namespace, no third-party deps:
//
//  • A suffix automaton (linear-time, online) over the full text. Answers
//    exact-repeat questions: how many distinct substrings, the longest
//    repeated substring, the top repeats ranked by length × count, and
//    occurrence counts/positions for any pattern.
//  • Minimizer-sampled k-mer matching, the technique genome browsers use
//    for dot plots. Samples a stable subset of k-mers (one minimum-hash
//    k-mer per window), buckets them by hash, verifies matches by direct
//    comparison, and emits (i, j) point pairs for canvas rendering.
//    Scales to multi-megabyte inputs where all-pairs matching cannot.
//  • A sliding-window Shannon entropy profile, for a compressibility
//    track along the document axis.
//
// Loadable as a plain script (no ES modules):
//
//   const ss = window.selfsim;
//   ss.stats(text)                          // length, distinct, longest repeat, entropy
//   ss.topRepeats(text, { limit: 30 })      // [{ text, len, count, positions, score }]
//   ss.occurrences(text, 'needle')          // { count, positions }
//   ss.matchPoints(text, { k: 12, w: 8 })   // { xs, ys, count, ... } dot-plot pairs
//   ss.entropyProfile(text, { bins: 512 })  // Float32Array, bits per char code
//
// All functions are synchronous and pure. The suffix automaton uses flat
// typed arrays with adjacency-list transitions, so a ~1 MB input costs
// tens of MB, not hundreds; minimizer matching is typed arrays throughout.

(() => {
  // ── Suffix automaton ──────────────────────────────────────────────────
  //
  // States in flat Int32Arrays; transitions in a shared adjacency list
  // (label/target/next-edge triples) rather than a Map per state, which
  // keeps memory linear and GC-quiet at large n. `firstPos[v]` records the
  // end index of the first occurrence of state v's longest string, so any
  // state's string is recoverable as a slice of the original text.

  const build = (s) => {
    const n = s.length;
    const maxStates = 2 * n + 5;
    const len = new Int32Array(maxStates);
    const link = new Int32Array(maxStates);
    const firstPos = new Int32Array(maxStates);
    const isClone = new Uint8Array(maxStates);
    const head = new Int32Array(maxStates).fill(-1);

    let edgeCap = Math.max(16, 3 * n);
    let elab = new Int32Array(edgeCap);
    let eto = new Int32Array(edgeCap);
    let enext = new Int32Array(edgeCap);
    let edges = 0;

    const growEdges = () => {
      edgeCap *= 2;
      const grow = (a) => { const b = new Int32Array(edgeCap); b.set(a); return b; };
      elab = grow(elab); eto = grow(eto); enext = grow(enext);
    };

    const getTrans = (p, c) => {
      for (let e = head[p]; e !== -1; e = enext[e]) if (elab[e] === c) return eto[e];
      return -1;
    };
    const setTrans = (p, c, t) => {
      for (let e = head[p]; e !== -1; e = enext[e]) {
        if (elab[e] === c) { eto[e] = t; return; }
      }
      if (edges === edgeCap) growEdges();
      elab[edges] = c; eto[edges] = t; enext[edges] = head[p];
      head[p] = edges++;
    };

    let size = 1, last = 0;
    link[0] = -1;

    for (let i = 0; i < n; i++) {
      const c = s.charCodeAt(i);
      const cur = size++;
      len[cur] = len[last] + 1;
      link[cur] = -1;
      firstPos[cur] = i;
      let p = last;
      while (p !== -1 && getTrans(p, c) === -1) { setTrans(p, c, cur); p = link[p]; }
      if (p === -1) {
        link[cur] = 0;
      } else {
        const q = getTrans(p, c);
        if (len[p] + 1 === len[q]) {
          link[cur] = q;
        } else {
          const clone = size++;
          len[clone] = len[p] + 1;
          link[clone] = link[q];
          firstPos[clone] = firstPos[q];
          isClone[clone] = 1;
          for (let e = head[q]; e !== -1; e = enext[e]) setTrans(clone, elab[e], eto[e]);
          while (p !== -1 && getTrans(p, c) === q) { setTrans(p, c, clone); p = link[p]; }
          link[q] = clone;
          link[cur] = clone;
        }
      }
      last = cur;
    }

    // Occurrence counts: each non-clone state marks one prefix endpoint;
    // summing up the suffix-link tree (states in decreasing len order via
    // counting sort) gives |endpos| per state.
    const cnt = new Int32Array(size);
    for (let v = 1; v < size; v++) if (!isClone[v]) cnt[v] = 1;
    const bucket = new Int32Array(n + 2);
    for (let v = 1; v < size; v++) bucket[len[v]]++;
    for (let l = 1; l <= n; l++) bucket[l] += bucket[l - 1];
    const order = new Int32Array(size); // states sorted by len ascending
    for (let v = 1; v < size; v++) order[--bucket[len[v]]] = v;
    for (let idx = size - 2; idx >= 0; idx--) {
      const v = order[idx];
      if (link[v] > 0) cnt[link[v]] += cnt[v];
    }

    return { n, size, len, link, firstPos, cnt, getTrans, text: s };
  };

  const asSam = (x) => (typeof x === 'string' ? build(x) : x);

  // Number of distinct non-empty substrings: Σ len[v] − len[link[v]].
  const distinct = (textOrSam) => {
    const sam = asSam(textOrSam);
    let total = 0;
    for (let v = 1; v < sam.size; v++) total += sam.len[v] - sam.len[sam.link[v]];
    return total;
  };

  // The string a state represents (its longest member), via firstPos.
  const stateString = (sam, v) =>
    sam.text.slice(sam.firstPos[v] - sam.len[v] + 1, sam.firstPos[v] + 1);

  // All (possibly overlapping) occurrence start positions, by direct scan.
  // Used for the handful of strings surfaced to the UI, not in bulk.
  const scanPositions = (text, pattern, cap = Infinity) => {
    const out = [];
    if (!pattern) return out;
    let i = text.indexOf(pattern);
    while (i !== -1 && out.length < cap) { out.push(i); i = text.indexOf(pattern, i + 1); }
    return out;
  };

  const longestRepeat = (textOrSam, { maxPositions = 5000 } = {}) => {
    const sam = asSam(textOrSam);
    let best = -1;
    for (let v = 1; v < sam.size; v++) {
      if (sam.cnt[v] >= 2 && (best === -1 || sam.len[v] > sam.len[best])) best = v;
    }
    if (best === -1) return null;
    const str = stateString(sam, best);
    return {
      text: str,
      len: str.length,
      count: sam.cnt[best],
      positions: scanPositions(sam.text, str, maxPositions),
    };
  };

  // Top repeated substrings, ranked by len × count (a coverage proxy).
  // Each suffix-automaton state contributes its longest member once; a
  // candidate that is a substring of an already-accepted repeat *with the
  // same count* is skipped — it names the same occurrences, just shorter.
  const topRepeats = (textOrSam, opts = {}) => {
    const { minLen = 2, minCount = 2, limit = 40, maxPositions = 2000 } = opts;
    const sam = asSam(textOrSam);
    const cand = [];
    for (let v = 1; v < sam.size; v++) {
      if (sam.cnt[v] >= minCount && sam.len[v] >= minLen) cand.push(v);
    }
    cand.sort((a, b) =>
      (sam.len[b] * sam.cnt[b]) - (sam.len[a] * sam.cnt[a]) || sam.len[b] - sam.len[a]);
    const out = [];
    for (const v of cand) {
      if (out.length >= limit) break;
      const str = stateString(sam, v);
      let shadowed = false;
      for (const r of out) {
        if (r.count === sam.cnt[v] && r.text.includes(str)) { shadowed = true; break; }
      }
      if (shadowed) continue;
      out.push({
        text: str,
        len: str.length,
        count: sam.cnt[v],
        score: str.length * sam.cnt[v],
        positions: scanPositions(sam.text, str, maxPositions),
      });
    }
    return out;
  };

  // Exact occurrence count + positions for an arbitrary pattern.
  const occurrences = (textOrSam, pattern, { maxPositions = 5000 } = {}) => {
    const sam = asSam(textOrSam);
    let v = 0;
    for (let i = 0; i < pattern.length; i++) {
      v = sam.getTrans(v, pattern.charCodeAt(i));
      if (v === -1) return { count: 0, positions: [] };
    }
    return {
      count: pattern.length ? sam.cnt[v] : 0,
      positions: scanPositions(sam.text, pattern, maxPositions),
    };
  };

  // ── Minimizer k-mer matching (dot-plot points) ────────────────────────
  //
  // Rolling 32-bit polynomial hash over char codes, finalized with an
  // avalanche mix so minimizer selection isn't biased by low-order chars.

  const BASE = 0x01000193; // FNV prime; any odd multiplier works
  const mix32 = (h) => {
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    return (h ^ (h >>> 16)) >>> 0;
  };

  const kmerHashes = (s, k) => {
    const n = s.length;
    if (n < k || k < 1) return new Uint32Array(0);
    const out = new Uint32Array(n - k + 1);
    let powK = 1; // BASE^(k-1) mod 2^32
    for (let i = 0; i < k - 1; i++) powK = Math.imul(powK, BASE);
    let h = 0;
    for (let i = 0; i < k; i++) h = (Math.imul(h, BASE) + s.charCodeAt(i)) | 0;
    out[0] = mix32(h);
    for (let i = 1; i + k <= n; i++) {
      h = (h - Math.imul(s.charCodeAt(i - 1), powK)) | 0;
      h = (Math.imul(h, BASE) + s.charCodeAt(i + k - 1)) | 0;
      out[i] = mix32(h);
    }
    return out;
  };

  // One minimum-hash k-mer per window of w consecutive k-mers (monotonic
  // deque). Guarantees: every window of w k-mers contains a selected
  // position, so no repeat of length ≥ k + w − 1 is ever missed entirely.
  const minimizers = (s, { k = 12, w = 8 } = {}) => {
    const hashes = kmerHashes(s, k);
    const m = hashes.length;
    if (m === 0) return { pos: new Int32Array(0), hash: new Uint32Array(0), k, w };
    const deque = new Int32Array(m);
    let dHead = 0, dTail = 0; // [dHead, dTail) holds candidate indices
    const posOut = [];
    const hashOut = [];
    let lastPicked = -1;
    for (let i = 0; i < m; i++) {
      while (dTail > dHead && hashes[deque[dTail - 1]] >= hashes[i]) dTail--;
      deque[dTail++] = i;
      if (deque[dHead] <= i - w) dHead++;
      if (i >= w - 1) {
        const picked = deque[dHead];
        if (picked !== lastPicked) {
          posOut.push(picked);
          hashOut.push(hashes[picked]);
          lastPicked = picked;
        }
      }
    }
    return { pos: Int32Array.from(posOut), hash: Uint32Array.from(hashOut), k, w };
  };

  // Dot-plot point pairs: bucket minimizers by hash, verify each pair by
  // direct string comparison (collision-proof), emit (i, j) with i < j.
  // Oversized buckets (whitespace runs, boilerplate floods) are skipped
  // and reported; if the verified pairs still exceed maxPoints they are
  // uniformly thinned, and `sampled` reports the kept fraction.
  const matchPoints = (s, opts = {}) => {
    const { k = 12, w = 8, maxBucket = 64, maxPoints = 250000 } = opts;
    const { pos, hash } = minimizers(s, { k, w });
    const buckets = new Map();
    for (let i = 0; i < pos.length; i++) {
      const h = hash[i];
      let b = buckets.get(h);
      if (!b) buckets.set(h, b = []);
      b.push(pos[i]);
    }
    let xs = [], ys = [], skippedBuckets = 0, rawPairs = 0;
    for (const b of buckets.values()) {
      if (b.length < 2) continue;
      if (b.length > maxBucket) { skippedBuckets++; continue; }
      for (let a = 0; a < b.length; a++) {
        const sa = s.substr(b[a], k);
        for (let c = a + 1; c < b.length; c++) {
          if (sa === s.substr(b[c], k)) {
            rawPairs++;
            xs.push(b[a]); ys.push(b[c]);
          }
        }
      }
    }
    let sampled = 1;
    if (xs.length > maxPoints) {
      sampled = maxPoints / xs.length;
      const tx = [], ty = [];
      // Deterministic thinning: keep every (1/sampled)-th pair.
      const stride = xs.length / maxPoints;
      for (let f = 0; f < maxPoints; f++) {
        const i = Math.floor(f * stride);
        tx.push(xs[i]); ty.push(ys[i]);
      }
      xs = tx; ys = ty;
    }
    return {
      xs: Int32Array.from(xs),
      ys: Int32Array.from(ys),
      count: xs.length,
      rawPairs,
      sampled,
      nMinimizers: pos.length,
      skippedBuckets,
      k, w,
    };
  };

  // All exact k-mer match pairs within a slice [lo, hi) — the zoom path.
  // No minimizer sampling (w = 1 equivalent): every k-mer participates.
  const matchPointsExact = (s, lo, hi, opts = {}) => {
    const { k = 8, maxBucket = 256, maxPoints = 250000 } = opts;
    const slice = s.slice(lo, hi);
    const hashes = kmerHashes(slice, k);
    const buckets = new Map();
    for (let i = 0; i < hashes.length; i++) {
      const h = hashes[i];
      let b = buckets.get(h);
      if (!b) buckets.set(h, b = []);
      b.push(i);
    }
    let xs = [], ys = [], skippedBuckets = 0;
    outer:
    for (const b of buckets.values()) {
      if (b.length < 2) continue;
      if (b.length > maxBucket) { skippedBuckets++; continue; }
      for (let a = 0; a < b.length; a++) {
        const sa = slice.substr(b[a], k);
        for (let c = a + 1; c < b.length; c++) {
          if (sa === slice.substr(b[c], k)) {
            xs.push(lo + b[a]); ys.push(lo + b[c]);
            if (xs.length >= maxPoints) break outer;
          }
        }
      }
    }
    return {
      xs: Int32Array.from(xs), ys: Int32Array.from(ys),
      count: xs.length, skippedBuckets, k,
    };
  };

  // ── Entropy profile ───────────────────────────────────────────────────
  //
  // Shannon entropy (bits per symbol) of char codes folded to one byte,
  // over a window centered at each of `bins` evenly spaced sample points.

  const entropyProfile = (s, { window = 256, bins = 512 } = {}) => {
    const n = s.length;
    const out = new Float32Array(bins);
    if (n === 0) return out;
    const win = Math.min(window, n);
    const counts = new Int32Array(256);
    for (let b = 0; b < bins; b++) {
      const center = Math.floor(((b + 0.5) / bins) * n);
      const lo = Math.max(0, Math.min(n - win, center - (win >> 1)));
      counts.fill(0);
      for (let i = lo; i < lo + win; i++) counts[s.charCodeAt(i) & 0xff]++;
      let H = 0;
      for (let c = 0; c < 256; c++) {
        if (counts[c]) {
          const p = counts[c] / win;
          H -= p * Math.log2(p);
        }
      }
      out[b] = H;
    }
    return out;
  };

  // ── Display ───────────────────────────────────────────────────────────
  //
  // Render a self-similarity dot plot of `text` into a 2D canvas: the
  // identity diagonal plus one (mirrored) mark per matching position pair.
  // A function, not a component — display is a one-liner the caller drops
  // wherever it wants, sizing the canvas itself. Returns the match points
  // so the caller can reuse them (e.g. to trace one repeat in an overlay).

  const draw = (canvas, text, opts = {}) => {
    const {
      size = canvas.width || 320,
      k = 8, w = 4,
      point = 'rgba(15,23,42,0.6)',
      diagonal = 'rgba(99,102,241,0.28)',
      background = null,
      mirror = true,
    } = opts;
    const ctx = canvas.getContext('2d');
    if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, size, size); }
    else ctx.clearRect(0, 0, size, size);
    ctx.strokeStyle = diagonal;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(size, size); ctx.stroke();
    const pts = matchPoints(text, { k, w });
    const n = Math.max(1, text.length);
    const sx = (p) => (p / n) * size;
    const sz = Math.max(1, Math.min(2.5, size / n));
    ctx.fillStyle = point;
    for (let i = 0; i < pts.xs.length; i++) {
      const px = sx(pts.xs[i]), py = sx(pts.ys[i]);
      ctx.fillRect(px, py, sz, sz);
      if (mirror) ctx.fillRect(py, px, sz, sz);
    }
    return pts;
  };

  // ── One-call summary ──────────────────────────────────────────────────

  const stats = (text, opts = {}) => {
    const sam = build(text);
    const lr = longestRepeat(sam, opts);
    const profile = entropyProfile(text, opts);
    let mean = 0;
    for (let i = 0; i < profile.length; i++) mean += profile[i];
    mean = profile.length ? mean / profile.length : 0;
    return {
      length: text.length,
      states: sam.size,
      distinct: distinct(sam),
      longestRepeat: lr,
      entropyMean: mean,
    };
  };

  window.selfsim = {
    build,
    distinct,
    longestRepeat,
    topRepeats,
    occurrences,
    kmerHashes,
    minimizers,
    matchPoints,
    matchPointsExact,
    entropyProfile,
    draw,
    stats,
  };
})();
