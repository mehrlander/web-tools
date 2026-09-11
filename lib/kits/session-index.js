// kits/session-index.js — a token index over what sessions SAID, so the
// exhaustive pass stops costing the whole store.
//
// EstateSearch.sessions greps the captured records by opening every one of
// them. Measured 2026-09-11: 372 records, 156 MB, which is a first search
// nobody pays twice on a phone. What that grep actually reads is the prose:
// every prompt and every reply, 22 MB of the 156. An index over those 22 MB is
// 3.3 MB on disk and 0.96 MB over the wire, so the same question is answered
// from a file smaller than the sessions cache beside it.
//
// WHAT IT IS. One shard per month, inverted INSIDE the shard: a term maps to
// the positions of the sessions that used it, delta-encoded. Nothing is
// inverted at load time and no global dictionary exists, which is what keeps
// both halves cheap:
//
//   loading      read and JSON.parse, and that is all of it. Measured over the
//                real shards: 89 ms and 20 MB of heap for the whole store. An
//                earlier shape stored a forward index and inverted it in the
//                browser, which cost 166 ms and 49 MB for the same answer.
//   a crawl      rewrites one month. The newest shard is 0.88 MB, against the
//                3.3 MB a single global index would rewrite every pass.
//   doc ids      are the session's own short id, carried in `docs`, so a shard
//                can be replaced without touching any other shard and nothing
//                renumbers when a record lands.
//
// WHAT IT ANSWERS, and the two rules that make the answer EXACT. Both were
// found by measuring against a full text scan over the real store, and both
// were wrong in the first draft.
//
//   1. A QUERY ALWAYS SCANS THE DICTIONARY for its term as a substring. It
//      must never stop at an exact term that happens to exist: `search.js` is
//      a term, and stopping there returned 1 session where the text scan finds
//      12, because it skipped `lib/kits/estate-search.js`. Whole-token
//      matching alone is worse still (`gzip` found 17 against 34).
//   2. THE TOKENIZER KEEPS COMPOUNDS AND THEIR PARTS. `estate-search.js` is
//      indexed whole AND as `estate`, `search`, `js`. Splitting alone makes
//      `search.js` unreachable, since the substring spans a token break. It
//      doubles the vocabulary and the index, from 1.8 MB to 3.3 MB, and that
//      is the whole price of paths and identifiers being findable at all.
//
// With both, the index agreed with a full text scan on every query tested:
// submittal 130, corepam 4, gzip 34, lib/kits 135, search.js 12, row_v 12.
//
// WHAT IT LOSES, and this is not fixable at this size. PHRASE ORDER: `merge
// guide` returns the 278 sessions that used both strings, where only 40 hold
// the phrase. Positions would fix it and would roughly triple the file. The
// useful queries here are rare terms (corepam 4, bakenhus 3), common-word
// pairs are broad in any index, and the pane's chips narrow what the box
// leaves. It also carries no text, so a hit has no quotable fragment; the
// consumer renders the session's own row and the record is opened to read it.
//
// Pure: no network, no DOM, no Alpine. The shell crawls and writes; this
// builds, merges, decodes and searches. Attaches to window.SessionIndex,
// loaded via gh.load('kits/session-index.js').
(() => {
  const SHARD_DIR = 'state/sessions-index';
  const SHARD_V = 1;

  // Two characters is the floor because a one-character token matches most of
  // the dictionary and answers nothing. The ceiling exists because the real
  // store holds a 6,526-character "term" (a base64 blob in a reply) and one
  // record like it would bloat a shard's dictionary on its own.
  //
  // 120, AND THE NUMBER WAS MEASURED RATHER THAN PICKED. At 80 the index
  // missed 3 of the 135 sessions that mention `lib/kits`, because each of
  // those three mentions it only inside a 97-character GitHub blob URL
  // (`github.com/mehrlander/web-tools/blob/claude/<branch>/lib/kits/<file>`),
  // and a run dropped for length takes every substring of itself with it. Blob
  // URLs run to 114 characters in this corpus, so the ceiling has to clear
  // them; 120 reaches all 135 and still costs only 5% more vocabulary than 80.
  const TERM_MIN = 2;
  const TERM_MAX = 120;

  // A run of word characters that MAY carry the joiners a path or an
  // identifier uses, so `lib/kits/estate-search.js` and `ROW_V` survive whole.
  // It must begin and end on a word character, which is what keeps a trailing
  // sentence period out of the term.
  const RUN = /[a-z0-9][a-z0-9_.\-/]*[a-z0-9]/g;
  const JOINER = /[_.\-/]+/;

  // A RUN PAST THE CEILING IS CUT, NOT DROPPED, and this is the difference
  // between an index that under-returns and one that does not. A run dropped
  // for length takes every substring of itself with it: measured over 600
  // random queries drawn from the corpus, 12 came back short, and every one
  // was a substring living only inside an over-long run (`lob/c`, inside
  // `blob/claude/…`). Overlapping windows at half the ceiling mean any
  // substring up to 60 characters still lands wholly inside one window, which
  // covers everything a person types.
  //
  // It is nearly free. Of 3,115,164 runs in the real store, 1,014 are over the
  // ceiling (0.033%), and windowing them adds 2,116 terms and 2,198 postings,
  // under half a percent of either.
  const WINDOW_STEP = TERM_MAX / 2;
  function windowsOf(run) {
    const out = [];
    for (let i = 0; i < run.length - WINDOW_STEP; i += WINDOW_STEP) {
      out.push(run.slice(i, i + TERM_MAX));
    }
    return out;
  }

  const keep = (w) => w.length >= TERM_MIN && w.length <= TERM_MAX;

  // A QUERY HAS TO BE NORMALIZED THE WAY A RUN IS, or it cannot match at all.
  // RUN begins and ends on a word character, so no stored term starts with a
  // dot or a slash, and `.claude/uploads` typed as-is found 4 sessions where a
  // text scan finds 39. Trimming the joiners off each end is the same rule
  // applied to the other side. It WIDENS two cases and narrows none: `.js`
  // searches as `js`, so it matches any term holding those letters rather than
  // only an extension. Over-returning is the safe direction for a filter; a
  // silent miss is not.
  const EDGE = /^[_.\-/]+|[_.\-/]+$/g;
  const normalize = (term) => String(term || '').toLowerCase().replace(EDGE, '');

  /**
   * Every term in a piece of text, as a Set. Compounds are kept whole AND
   * split, which rule 2 above is the argument for.
   */
  function tokens(text) {
    const out = new Set();
    for (const run of String(text || '').toLowerCase().match(RUN) || []) {
      if (keep(run)) out.add(run);
      else if (run.length > TERM_MAX) for (const w of windowsOf(run)) out.add(w);
      if (!JOINER.test(run)) continue;
      for (const part of run.split(JOINER)) if (keep(part)) out.add(part);
    }
    return out;
  }

  // What a record contributes: the prose and nothing else. Tool results are
  // deliberately absent, which is the same line record.py draws between what
  // was said and what the world returned, and it is why 22 MB of the 156 is
  // the whole corpus here. `opening_ask` rides along because a schema-1 record
  // has it and has no `prompts`.
  function docText(record) {
    const r = record || {};
    return [r.opening_ask || '',
            ...(r.prompts || []).map(p => p && p.text),
            ...(r.replies || []).map(p => p && p.text)]
      .filter(Boolean).join('\n');
  }

  // The shard a record belongs to, read off the same day the store's path is
  // built from, so a shard holds exactly the records under one YYYY/MM folder.
  function monthOf(row) {
    const day = String((row && (row.day || row.started)) || '');
    return day.slice(0, 7);
  }
  const shardPath = (month) => SHARD_DIR + '/' + month + '.json';

  // ── The encoding ───────────────────────────────────────────────────────────
  // A posting list is ascending positions into `docs`, stored as differences.
  // Positions are small and a term's sessions cluster, so the differences are
  // mostly 1 and gzip has almost nothing left to do afterwards.
  function encode(list) {
    const out = [];
    let prev = 0;
    for (const n of list) { out.push(n - prev); prev = n; }
    return out;
  }
  function decode(deltas, into) {
    let cur = 0;
    for (const d of deltas || []) { cur += d; into(cur); }
  }

  /**
   * A shard from { <session id>: <Set or Array of terms> }.
   *
   * Ids are sorted so the file is byte-deterministic: the commit hook's whole
   * refresh model rests on a generator producing identical bytes from identical
   * input, and an order that fell out of insertion would diff on nothing.
   */
  function buildShard(byId) {
    const docs = Object.keys(byId || {}).sort();
    const at = new Map(docs.map((id, i) => [id, i]));
    const post = new Map();
    for (const id of docs) {
      for (const term of byId[id] || []) {
        let list = post.get(term);
        if (!list) post.set(term, list = []);
        list.push(at.get(id));
      }
    }
    const out = {};
    for (const term of [...post.keys()].sort()) out[term] = encode(post.get(term));
    return { v: SHARD_V, docs, post: out };
  }

  /**
   * A shard back to { <session id>: Set of terms }. The crawl needs this: it
   * fetches only the records whose blob sha moved, so rewriting a month means
   * replacing those entries and keeping every other one, and the only place
   * the others exist is the shard itself.
   */
  function readShard(shard) {
    const byId = {};
    const docs = (shard && shard.docs) || [];
    for (const id of docs) byId[id] = new Set();
    for (const [term, deltas] of Object.entries((shard && shard.post) || {})) {
      decode(deltas, (i) => { const id = docs[i]; if (id) byId[id].add(term); });
    }
    return byId;
  }

  /**
   * The next shard: what it held, with `changed` replacing those entries, and
   * anything outside `keepIds` dropped.
   *
   * `keepIds` is how a session that left the store leaves the index. Pass null
   * to keep every prior entry, which is what an incomplete pass wants: the
   * crawl caps how many records it reads, so a month it has not finished
   * reading must not lose the entries it already had.
   */
  function mergeShard(prev, changed, keepIds) {
    const byId = readShard(prev);
    for (const [id, terms] of Object.entries(changed || {})) byId[id] = terms;
    if (keepIds) {
      const keepSet = keepIds instanceof Set ? keepIds : new Set(keepIds);
      for (const id of Object.keys(byId)) if (!keepSet.has(id)) delete byId[id];
    }
    return buildShard(byId);
  }

  // Substance, for the crawl's no-op gate. The shard IS its content, so this is
  // the whole thing minus nothing; it exists so a caller reads one name rather
  // than deep-comparing by hand.
  function shardChanged(a, b) {
    return JSON.stringify(a || null) !== JSON.stringify(b || null);
  }

  // ── Searching ──────────────────────────────────────────────────────────────
  // `terms` is cached per shard object, because the scan below walks it on
  // every keystroke and Object.keys over 27,000 entries is the one cost that
  // would otherwise repeat. Keyed on the shard object itself, so a replaced
  // shard drops its list with it.
  const TERMS = new WeakMap();
  function terms(shard) {
    let list = TERMS.get(shard);
    if (!list) TERMS.set(shard, list = Object.keys((shard && shard.post) || {}));
    return list;
  }

  /**
   * The sessions matching one term, as a Set of ids.
   *
   * IT SCANS, ALWAYS, and rule 1 above is why: an exact hit on `search.js` is
   * not the answer, it is one twelfth of it. The exact term is found by the
   * scan like any other, so there is no fast path to take and no second
   * behaviour to keep straight.
   */
  function hitsFor(shards, term) {
    const out = new Set();
    const needle = normalize(term);
    if (!needle) return out;
    for (const shard of shards || []) {
      const docs = (shard && shard.docs) || [];
      for (const w of terms(shard)) {
        if (!w.includes(needle)) continue;
        decode(shard.post[w], (i) => { const id = docs[i]; if (id) out.add(id); });
      }
    }
    return out;
  }

  /**
   * Every term present, as a Set of session ids. AND across terms, which is
   * what a person types: "merge guide" means both words are about this
   * session, not that the phrase appears in it (see the note on phrase order
   * in the header).
   */
  function search(shards, query) {
    const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return new Set();
    let acc = null;
    for (const w of words) {
      const hits = hitsFor(shards, w);
      if (!hits.size) return new Set();
      acc = acc === null ? hits : new Set([...acc].filter(id => hits.has(id)));
      if (!acc.size) return acc;
    }
    return acc || new Set();
  }

  window.SessionIndex = {
    SHARD_DIR, SHARD_V, TERM_MIN, TERM_MAX,
    tokens, docText, monthOf, shardPath, normalize, windowsOf,
    encode, decode, buildShard, readShard, mergeShard, shardChanged,
    terms, hitsFor, search,
  };
})();
