// traffic.js: the pure read of what a page has pulled over the network, and the
// vocabulary the FAB's Traffic tab renders. Collection lives in gh-boot.js,
// which wraps window.fetch and GH.prototype.get to fill window.__traffic and
// window.__ghFiles. Everything here is a pure function over that ledger plus the
// browser's Resource Timing entries, so it unit-tests against plain objects and
// costs nothing until the tab is opened.
//
// Three questions get called "size" here, and they do not share a unit:
//
//   BOOT      what one page load cost. Fixed, cacheable, measured by Resource
//             Timing. Answers "why is this slow on a phone".
//   API       what browsing has spent since. Grows as you go, measured by the
//             fetch wrapper reading content-length. Answers "what is this
//             pulling", and it is the one a rate limit bounds.
//   RESIDENT  what the app is holding locally. Not traffic, same question.
//
// The honesty rules are most of why this file exists rather than a few inline
// sums in the component:
//
//   - transferSize 0 against a NONZERO body size means served from cache. It is
//     not a free resource, it is a resource you already paid for.
//   - all three sizes 0 on a cross-origin row means the origin sent no
//     Timing-Allow-Origin header, so the size is UNDISCLOSED, not zero. jsDelivr
//     sends it (verified 2026-08-05), api.github.com does not. An undisclosed
//     row must never be summed into a figure that reads as complete, which is
//     why every total here carries its own undisclosed count.
//   - transferSize counts response headers along with the body, so a boot total
//     runs a few hundred bytes per row above the payload it describes.
//   - content-length on an API response is the COMPRESSED body as sent, which is
//     the wire figure we want. It is absent on chunked responses; absent is
//     recorded as null and reported as unknown, never as zero.

(function () {
  const KB = 1024;

  // ── Formatting ────────────────────────────────────────────────────────────
  // Binary units, one decimal from KB up, because the readings that matter here
  // (417 KB, 1.4 MB) lose their shape when rounded to whole units.
  function fmtBytes(n) {
    if (n == null || !isFinite(n)) return '?';
    if (n < 0) return '?';
    if (n < KB) return n + ' B';
    if (n < KB * KB) return (n / KB).toFixed(n < 10 * KB ? 1 : 0) + ' KB';
    return (n / KB / KB).toFixed(2) + ' MB';
  }

  // Compact, for a header chip where a digit of precision is worth less than
  // the space it takes: 417 KB stays 417 KB, 1,433,600 becomes 1.4 MB.
  function fmtBytesShort(n) {
    if (n == null || !isFinite(n) || n < 0) return '?';
    if (n < KB) return n + ' B';
    if (n < KB * KB) return Math.round(n / KB) + ' KB';
    return (n / KB / KB).toFixed(1) + ' MB';
  }

  function fmtMs(ms) {
    if (ms == null || !isFinite(ms)) return '';
    if (ms < 1000) return Math.round(ms) + 'ms';
    return (ms / 1000).toFixed(ms < 10000 ? 1 : 0) + 's';
  }

  function fmtCount(n) {
    if (n == null || !isFinite(n)) return '?';
    if (n < 1000) return String(n);
    if (n < 100000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return Math.round(n / 1000) + 'k';
  }

  // ── Classification ────────────────────────────────────────────────────────
  // Grouping by endpoint SHAPE, and it is worth being exact about what that
  // does and does not tell you, because the obvious reading is wrong.
  //
  // What it gives: a mechanical, unfalsifiable statement of WHAT KIND of call
  // was made. A URL cannot lie about which endpoint it hit.
  //
  // What it does NOT give: who made it. The endpoints are shared, heavily.
  // `contents/` is hit by gh.get (so every load() and read()), gh-fetch,
  // gh-store's WRITES, gh-transfer, and the config crawl. `commits` is hit by
  // branch-status's crawl, recentFiles, gh-fetch's history reads, and
  // the app's per-file sidebar lookup. So "forty calls to commits" does not
  // identify the crawl, and an earlier version of this comment claimed it did.
  //
  // Caller attribution needs the callers to tag themselves, and since
  // 2026-10-15 the work a page starts on its own does: it runs inside
  // window.__job (gh-boot.js), and a row that job made carries its id (jobRows
  // below). What is still NOT possible is inferring a caller from nothing: the
  // scripts registry refused stack sniffing because gh-api.js runs loaded files
  // as anonymous Function bodies, where a stack names nobody, and a row no job
  // claims is reported by the view it went out under, not by a guessed owner.
  //
  // The method column is the axis that does separate something real, and it
  // separates the thing that matters most: a write from a read.
  const API_SHAPES = [
    [/\/graphql\b/, 'graphql', 'GraphQL'],
    [/\/repos\/[^/]+\/[^/]+\/(contents|readme)\b/, 'contents', 'file contents'],
    [/\/repos\/[^/]+\/[^/]+\/git\/blobs\b/, 'contents', 'file contents'],
    [/\/repos\/[^/]+\/[^/]+\/git\/trees\b/, 'trees', 'file trees'],
    [/\/repos\/[^/]+\/[^/]+\/commits\b/, 'commits', 'commits'],
    [/\/repos\/[^/]+\/[^/]+\/(branches|git\/refs|git\/matching-refs)\b/, 'branches', 'branches'],
    [/\/repos\/[^/]+\/[^/]+\/(pulls|issues)\b/, 'pulls', 'pulls & issues'],
    [/\/repos\/[^/]+\/[^/]+\/(compare|contributors|languages|topics)\b/, 'repometa', 'repo metadata'],
    [/\/search\//, 'search', 'search'],
    [/\/rate_limit\b/, 'meta', 'rate limit'],
    [/\/(user|users)\b/, 'meta', 'user'],
  ];

  const HOSTS = [
    ['api.github.com', 'api', 'GitHub API'],
    ['raw.githubusercontent.com', 'raw', 'raw.githubusercontent'],
    ['cdn.jsdelivr.net', 'cdn', 'jsDelivr'],
    ['unpkg.com', 'cdn', 'unpkg'],
    ['esm.sh', 'cdn', 'esm.sh'],
  ];

  function hostOf(url) {
    const s = String(url || '');
    const m = s.match(/^[a-z]+:\/\/([^/?#]+)/i);
    return m ? m[1].toLowerCase() : '';
  }

  // { host, group, label } for one URL. `group` is the roll-up key, `label` its
  // human name. Anything unrecognized groups under its own hostname rather than
  // a catch-all, so a page pulling from somewhere unexpected says where.
  // The repo a call was aimed at, pulled straight out of the URL. Free, and it
  // is the axis that separates a crawl from browsing: an estate crawl touches
  // many repos, browsing touches one. Null where the URL carries no repo, which
  // is honest rather than awkward: a GraphQL POST names its repo in the body,
  // and the ledger does not read bodies.
  function repoOf(url) {
    const s = String(url || '');
    let m = s.match(/api\.github\.com\/repos\/([^/?#]+)\/([^/?#]+)/);
    if (m) return m[1] + '/' + m[2];
    m = s.match(/raw\.githubusercontent\.com\/([^/?#]+)\/([^/?#]+)/);
    if (m) return m[1] + '/' + m[2];
    m = s.match(/\/\/([^./?#]+)\.github\.io\/([^/?#]+)/);
    if (m) return m[1] + '/' + m[2];
    return null;
  }

  function classify(url, entry) {
    // A call carrying `via` was the loader fetching own code or data through
    // gh.load()/read(). It hits the same contents/ endpoint as everything else,
    // so nothing in the URL could tell you, and the difference is the one a
    // reader actually wants: the library pulling itself in, versus the page
    // reading something.
    if (entry && entry.via) return { host: 'api.github.com', group: 'load', label: 'code & data loads' };
    const s = String(url || '');
    const host = hostOf(s);
    if (host === 'api.github.com') {
      for (const [re, group, label] of API_SHAPES) if (re.test(s)) return { host, group, label };
      return { host, group: 'api', label: 'GitHub API' };
    }
    for (const [h, group, label] of HOSTS) if (host === h) return { host, group, label };
    if (!host) return { host: '', group: 'page', label: 'this page' };
    return { host, group: host, label: host };
  }

  // A readable name for a URL row. jsDelivr's /combine/ URLs carry every
  // package in the path and are the widest rows on the boot table, so they
  // collapse to "first +N" rather than wrapping over four lines.
  function label(url) {
    const s = String(url || '');
    try {
      const u = new URL(s, 'https://x.invalid');
      if (/\/combine\//.test(u.pathname)) {
        const parts = u.pathname.replace(/^\/combine\//, '').split(',');
        const first = (parts[0] || '').replace(/^npm\//, '').replace(/^gh\//, '');
        return parts.length > 1 ? first + ' +' + (parts.length - 1) : first;
      }
      const segs = u.pathname.split('/').filter(Boolean);
      if (!segs.length) return u.hostname || s;
      const last = segs[segs.length - 1];
      // A generic filename names nothing on its own, and a list of eight rows
      // all reading "style.css" is worse than no list: borrow the folder. Seen
      // for real on the first render of the Boot band, where daisyUI's
      // per-component stylesheets collapsed into one repeated word.
      if (segs.length > 1 && /^(index|main|style|styles|bundle)\.[a-z]+$/i.test(last)) return segs.slice(-2).join('/');
      return last;
    } catch (e) { return s; }
  }

  // ── Boot: the Resource Timing read ────────────────────────────────────────
  // One row per resource the browser fetched declaratively or otherwise, with
  // its state resolved to one of three words. `state` is the whole point: a
  // number without it is a claim the data does not support.
  //
  //   network      real bytes crossed the wire
  //   cached       served locally; the body size is known, the transfer was 0
  //   undisclosed  cross-origin with no Timing-Allow-Origin; size unknowable
  function bootRow(e) {
    const wire = num(e.transferSize);
    const enc = num(e.encodedBodySize);
    const dec = num(e.decodedBodySize);
    const undisclosed = wire === 0 && enc === 0 && dec === 0;
    const cached = !undisclosed && wire === 0 && dec > 0;
    const c = classify(e.name);
    return {
      name: String(e.name || ''),
      short: label(e.name),
      group: e.entryType === 'navigation' ? 'document' : bootGroup(e, c),
      host: c.host,
      kind: e.initiatorType || e.entryType || '',
      wire: undisclosed ? null : wire,
      decoded: undisclosed ? null : dec,
      ms: num(e.duration),
      start: num(e.startTime),
      state: undisclosed ? 'undisclosed' : (cached ? 'cached' : 'network'),
    };
  }

  // Boot rows group by ROLE, not by host, because the question the band answers
  // is "what did this page spend its weight on": the app's own code, the
  // third-party CSS and JS it stands on, the fonts, the document itself.
  function bootGroup(e, c) {
    const n = String(e.name || '');
    if (/\.(woff2?|ttf|otf|eot)(\?|$)/i.test(n)) return 'font';
    if (c.group === 'cdn') return 'cdn';
    if (c.group === 'api' || c.group === 'raw') return 'api';
    if (/\.(png|jpe?g|gif|svg|webp|avif)(\?|$)/i.test(n)) return 'image';
    if (/\.css(\?|$)/i.test(n)) return 'css';
    if (/\.(m?js)(\?|$)/i.test(n) || e.initiatorType === 'script') return 'code';
    return 'other';
  }

  const GROUP_LABEL = {
    document: 'document', code: 'own code', css: 'stylesheet', cdn: 'CDN library',
    font: 'font', image: 'image', api: 'API', other: 'other',
  };

  function num(v) { return typeof v === 'number' && isFinite(v) ? v : 0; }

  // The whole boot read: rows heaviest first, plus the totals and the two
  // counts that qualify them. `ms` is the wall clock to the last resource's
  // end, not the sum of durations, since the loads overlap.
  function boot(entries, navEntry) {
    const src = [];
    if (navEntry) src.push({ ...navEntry, entryType: 'navigation', name: navEntry.name || 'document' });
    for (const e of entries || []) src.push(e);
    const rows = src.map(bootRow);
    const known = rows.filter(r => r.state !== 'undisclosed');
    return {
      rows: rows.sort((a, b) => (b.wire ?? -1) - (a.wire ?? -1)),
      wire: known.reduce((s, r) => s + (r.wire || 0), 0),
      decoded: known.reduce((s, r) => s + (r.decoded || 0), 0),
      ms: rows.reduce((m, r) => Math.max(m, r.start + r.ms), 0),
      count: rows.length,
      cached: rows.filter(r => r.state === 'cached').length,
      undisclosed: rows.filter(r => r.state === 'undisclosed').length,
    };
  }

  // Roll boot rows up by group for the summary line above the table.
  function bootGroups(rows) {
    const by = new Map();
    for (const r of rows || []) {
      const g = by.get(r.group) || { group: r.group, label: GROUP_LABEL[r.group] || r.group, count: 0, wire: 0, decoded: 0, undisclosed: 0 };
      g.count++;
      if (r.state === 'undisclosed') g.undisclosed++;
      else { g.wire += r.wire || 0; g.decoded += r.decoded || 0; }
      by.set(r.group, g);
    }
    return [...by.values()].sort((a, b) => b.wire - a.wire);
  }

  // ── API: the ledger read ──────────────────────────────────────────────────
  // Entries are what gh-boot's fetch wrapper recorded: { url, t, ms, status,
  // wire, error }. `wire` is null when the response carried no content-length,
  // and that stays null all the way to the display rather than becoming a zero
  // that quietly deflates a total.
  // A call that changes something on the other end, which is a different kind
  // of event from a read and has to be countable as one. Anything that is not
  // plainly GET or HEAD counts, including an absent method: the ledger records
  // what it saw, and "unknown" is nearer to a write than to a read for the
  // purpose of deciding whether to look.
  function isWrite(e) {
    const m = String((e && e.method) || 'GET').toUpperCase();
    return m !== 'GET' && m !== 'HEAD';
  }

  function apiGroups(entries) {
    const by = new Map();
    for (const e of entries || []) {
      const c = classify(e.url, e);
      const g = by.get(c.group) || { group: c.group, label: c.label, host: c.host, calls: 0, wire: 0, unknown: 0, ms: 0, errors: 0, cached: 0, writes: 0 };
      g.calls++;
      if (isWrite(e)) g.writes++;
      g.ms += num(e.ms);
      if (e.error || (e.status && e.status >= 400)) g.errors++;
      if (e.status === 304) g.cached++;
      if (typeof e.wire === 'number') g.wire += e.wire; else g.unknown++;
      by.set(c.group, g);
    }
    return [...by.values()].sort((a, b) => b.calls - a.calls);
  }

  // The same ledger cut the other way. Endpoint shape says WHAT was called;
  // this says WHERE it landed, and the two answer different halves of "what is
  // this pulling". Rows with no repo in the URL are collected under one bucket
  // rather than dropped, so the counts still add up to the total.
  function repoGroups(entries) {
    const by = new Map();
    for (const e of entries || []) {
      const repo = repoOf(e.url);
      const key = repo || '(no repo in the URL)';
      const g = by.get(key) || { repo: key, named: !!repo, calls: 0, wire: 0, unknown: 0, writes: 0, errors: 0 };
      g.calls++;
      if (isWrite(e)) g.writes++;
      if (e.error || (e.status && e.status >= 400)) g.errors++;
      if (typeof e.wire === 'number') g.wire += e.wire; else g.unknown++;
      by.set(key, g);
    }
    // Named repos first, heaviest first; the unattributable bucket last, since
    // it is a caveat rather than a finding.
    return [...by.values()].sort((a, b) =>
      (a.named === b.named) ? b.calls - a.calls : (a.named ? -1 : 1));
  }

  function apiTotals(entries) {
    const list = entries || [];
    const known = list.filter(e => typeof e.wire === 'number');
    return {
      calls: list.length,
      wire: known.reduce((s, e) => s + e.wire, 0),
      unknown: list.length - known.length,
      ms: list.reduce((s, e) => s + num(e.ms), 0),
      errors: list.filter(e => e.error || (e.status && e.status >= 400)).length,
      writes: list.filter(isWrite).length,
      slowest: list.reduce((m, e) => Math.max(m, num(e.ms)), 0),
    };
  }

  // ── The header readout ────────────────────────────────────────────────────
  // One line, three facts, in the order they go wrong: what the load cost, what
  // browsing has added, and how much quota is left. The rate figure is omitted
  // rather than guessed when no response has carried the header.
  function summary({ boot: b, api: a, rate }) {
    const bits = [];
    // A load whose every row withheld its size has no weight to report. Saying
    // "0 B" there would be the strip's most confident wrong number, so it says
    // nothing and leaves the explanation to the band.
    if (b && b.count && b.undisclosed === b.count) bits.push('size undisclosed');
    else if (b && b.count) bits.push(fmtBytesShort(b.wire));
    if (a && a.calls) bits.push(a.calls + (a.calls === 1 ? ' call' : ' calls'));
    if (rate != null) bits.push(fmtCount(rate) + ' left');
    return bits.join(' · ');
  }

  // ── Resident: what is held locally ────────────────────────────────────────
  // Not traffic. Included because it is the same question ("how big is this
  // thing") and has no other home. Web Storage counts UTF-16 code units, so the
  // byte cost is twice the character count; keys count too.
  function storageRows(storage, name) {
    if (!storage) return null;
    let bytes = 0, keys = 0;
    const top = [];
    try {
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        const v = storage.getItem(k) || '';
        const b = (k.length + v.length) * 2;
        bytes += b; keys++;
        top.push({ key: k, bytes: b });
      }
    } catch (e) { return null; }
    top.sort((x, y) => y.bytes - x.bytes);
    return { name, keys, bytes, top: top.slice(0, 6) };
  }

  // ── Jobs: why the calls went out ──────────────────────────────────────────
  // gh-boot's job ledger (window.__jobs) names the work a page started on its
  // own and stamps every ledger row it can attribute with that job's id. These
  // read the two together, for the app's Traffic pane.

  // How a job ended, in a few words, from the primitives the collector kept.
  // The crawls' own conventions: { error } is a failure they reported rather
  // than threw, { skipped } a decline, { committed } a write or its absence.
  function jobOutcome(j) {
    if (!j) return '';
    if (j.state === 'running') return 'running';
    if (j.error) return 'failed: ' + j.error;
    const r = j.result || {};
    if (r.error) return 'failed: ' + r.error;
    if (r.skipped) return r.reason ? 'skipped: ' + r.reason : 'skipped';
    if (r.committed === true) return 'committed';
    if (r.committed === false) return 'no change';
    return 'done';
  }

  function addCall(g, e) {
    g.calls++;
    if (isWrite(e)) g.writes++;
    if (e.hidden) g.hiddenCalls++;
    if (e.error || (e.status && e.status >= 400)) g.errors++;
    if (typeof e.wire === 'number') { g.wire += e.wire; if (e.hidden) g.hiddenWire += e.wire; } else g.unknown++;
  }

  // The page's own files: the document and what its tags and styles pulled
  // (scripts, stylesheets, fonts, images), whenever they arrived. A call made
  // with fetch or XMLHttpRequest is left out, since the traffic ledger counts
  // it, and counting it here as well would weigh it twice.
  function pageFiles(entries, navEntry) {
    const own = (entries || []).filter(e => e.initiatorType !== 'fetch' && e.initiatorType !== 'xmlhttprequest');
    return boot(own, navEntry);
  }

  // The pane's two lists. `jobs` is every job in the ledger, newest first, its
  // counts taken from the job itself, which outlive the traffic ledger's cap.
  // `free` is the calls no job claimed, one row per view that was on screen
  // when they went out, so the two lists together account for every row the
  // ledger still holds. Free counts come from those rows and shrink with them,
  // which is why the pane reports the trimmed count beside them.
  function jobRows(jobs, entries, now) {
    const at = now || Date.now();
    const list = (jobs || []).map(j => ({
      key: 'job:' + j.id, kind: 'job', id: j.id, name: j.name, cause: j.cause || '',
      t: j.t, last: j.end || at, ms: (j.end || at) - j.t,
      running: j.state === 'running', failed: j.state === 'failed', outcome: jobOutcome(j),
      hidden: !!j.hidden, calls: j.calls || 0, wire: j.wire || 0, unknown: j.unknown || 0,
      errors: j.errors || 0, writes: j.writes || 0, hiddenCalls: j.hiddenCalls || 0, hiddenWire: j.hiddenWire || 0,
    })).sort((a, b) => (b.t - a.t) || (b.id - a.id));
    const by = new Map();
    for (const e of entries || []) {
      if (e.job != null) continue;
      const where = e.where || '';
      let g = by.get(where);
      if (!g) {
        g = { key: 'free:' + where, kind: 'free', where, t: e.t, last: e.t,
              calls: 0, wire: 0, unknown: 0, errors: 0, writes: 0, hiddenCalls: 0, hiddenWire: 0 };
        by.set(where, g);
      }
      g.t = Math.min(g.t, e.t);
      g.last = Math.max(g.last, e.t);
      addCall(g, e);
    }
    return { jobs: list, free: [...by.values()].sort((a, b) => b.last - a.last) };
  }

  // The page's own load, as one row beside the jobs: the files it loaded
  // (pageFiles) and the calls it made before the app had a view on screen
  // (`where` empty), so what opening the page cost compares on the same bars
  // with everything the page did after. `fileCalls` turns the files into rows
  // the calls table and the timeline can take: a file's time is the page's
  // start plus its own offset, a cached file transferred nothing, and a file
  // whose server disclosed no size has none, never zero.
  function fileCalls(files, origin) {
    return ((files && files.rows) || []).map((r, i) => ({
      n: 'file:' + i, file: true, url: r.name, method: 'GET', kind: r.group,
      t: (origin || 0) + (r.start || 0), ms: Math.round(r.ms || 0),
      wire: r.state === 'undisclosed' ? null : r.wire, cached: r.state === 'cached',
      status: 0, error: null, job: null, where: '', hidden: false,
    }));
  }
  function loadRow(files, entries, origin) {
    const f = files || {};
    const g = { key: 'load', kind: 'load', name: 'Page load', t: origin || 0, last: origin || 0,
                ms: f.ms || 0, files: f.count || 0, cached: f.cached || 0,
                calls: 0, wire: 0, unknown: 0, errors: 0, writes: 0, hiddenCalls: 0, hiddenWire: 0 };
    const early = (entries || []).filter(e => e.job == null && !e.where);
    for (const e of fileCalls(f, origin).concat(early)) {
      addCall(g, e);
      g.last = Math.max(g.last, e.t || 0);
    }
    return g;
  }

  // The timeline's time, cut on the clock. Bins and gridlines both fall on
  // round clock times (`offset` is minutes behind UTC, as getTimezoneOffset
  // gives it, so a 3:00 edge falls at 3:00 where the reader is), which is what
  // lets the pane redraw every second without anything jumping: a bin keeps
  // its edges while the scale squeezes, and only the newest bin grows. The
  // span always runs from load to now, so as the page ages the bins widen in
  // steps and the gridlines fade from fine to coarse.
  //
  // BIN_STEPS is fine-grained so the bin count stays within a factor of about
  // 2.5 at each widening; GRID_STEPS nest, each dividing the next, so a coarse
  // line always falls on a fine one and a level can fade out without any line
  // moving.
  const BIN_STEPS = [1e3, 2e3, 5e3, 10e3, 15e3, 30e3, 60e3, 2 * 60e3, 5 * 60e3, 10 * 60e3, 15 * 60e3, 30 * 60e3,
                     3600e3, 2 * 3600e3, 3 * 3600e3, 6 * 3600e3, 12 * 3600e3, 24 * 3600e3];
  const GRID_STEPS = [1e3, 5e3, 15e3, 60e3, 5 * 60e3, 15 * 60e3, 3600e3, 3 * 3600e3, 6 * 3600e3, 12 * 3600e3, 24 * 3600e3];
  // The finest bin that keeps a span to at most `most` bins.
  function binStep(span, most = 60) {
    return BIN_STEPS.find(st => span / st <= most) || BIN_STEPS[BIN_STEPS.length - 1];
  }

  // The page's life from `start` to `end` in bins of `step`, edges on the
  // clock, the first and last cut at `start` and `end`. Each bin counts the
  // calls that went out in it, how many a job made and how many went out
  // hidden, and carries its place as `left` and `width`, shares of the span;
  // beside them the stretches the tab spent in the background (gh-boot's
  // visibility rows, a row per change). Calls the ledger has trimmed are gone
  // from the bins, so `from` is the earliest call still held and the pane can
  // say where its record begins.
  function timeline(entries, visibility, start, end, step, offset = 0) {
    const span = Math.max(1, end - start), off = offset * 60000;
    const first = Math.floor((start - off) / step) * step + off;
    const slices = [];
    for (let a = first; a < end; a += step) {
      const t0 = Math.max(a, start), t1 = Math.min(a + step, end);
      slices.push({ t0, t1, left: (t0 - start) / span, width: (t1 - t0) / span, calls: 0, jobCalls: 0, hidden: 0, wire: 0 });
    }
    let from = null;
    for (const e of entries || []) {
      if (!slices.length || !(e.t >= start && e.t <= end)) continue;
      const sl = slices[Math.min(slices.length - 1, Math.floor((e.t - first) / step))];
      sl.calls++;
      if (e.job != null) sl.jobCalls++;
      if (e.hidden) sl.hidden++;
      if (typeof e.wire === 'number') sl.wire += e.wire;
      if (from == null || e.t < from) from = e.t;
    }
    // A stretch opens at a row that went hidden and closes at the next row that
    // came back; one still open runs to `end`.
    const hidden = [];
    let open = null;
    for (const v of visibility || []) {
      if (v.hidden && open == null) open = v.t;
      else if (!v.hidden && open != null) { hidden.push([open, v.t]); open = null; }
    }
    if (open != null) hidden.push([open, end]);
    const stretches = hidden
      .map(([a, b]) => [Math.max(start, a), Math.min(end, b)])
      .filter(([a, b]) => b > a)
      .map(([a, b]) => ({ t0: a, t1: b, left: (a - start) / span, width: (b - a) / span }));
    return { slices, hidden: stretches, max: slices.reduce((m, sl) => Math.max(m, sl.calls), 0), from, start, end, step };
  }

  // The gridlines for a lane `px` wide. A line's level is the coarsest
  // GRID_STEP it falls on, and its level's spacing on screen sets how it
  // shows: `alpha` fades a level in from 8 to 32 pixels apart, so as the span
  // grows fine levels wash out continuously, and `label` is 1 for a level
  // 100 pixels apart or more, the room a clock time needs. Labels switch
  // rather than fade: a half-faded clock time is ghost text, and a level can
  // sit mid-fade for most of an hour.
  function timeGrid(start, end, px, offset = 0) {
    const span = Math.max(1, end - start), off = offset * 60000, per = px / span;
    const ramp = (v, a, b) => Math.max(0, Math.min(1, (v - a) / (b - a)));
    const finest = GRID_STEPS.find(st => st * per >= 8);
    const ticks = [];
    if (!finest) return ticks;
    for (let t = Math.ceil((start - off) / finest) * finest + off; t <= end; t += finest) {
      let level = finest;
      for (const st of GRID_STEPS) if (st > level && (t - off) % st === 0) level = st;
      const gap = level * per;
      ticks.push({ t, level, left: (t - start) / span, alpha: ramp(gap, 8, 32), label: gap >= 100 ? 1 : 0 });
    }
    return ticks;
  }

  // What the traffic log files (lib/kits/traffic-log.js): out of the calls one
  // window of a page's life held, only the patterns worth a reader's time. A
  // finding carries `sig`, its identity across windows, so the log can leave
  // out one it filed within the hour. The kinds:
  //   repeat  one method and URL called `repeat` times or more
  //   hidden  calls made while the tab was hidden, by owner
  //   failed  calls that failed (isFailed), by method and URL
  //   large   one response of `large` bytes or more
  //   heavy   the window's bytes reaching `heavy`
  //   burn    the token's remaining calls falling by `burn` or more; the token
  //           is shared by every tab and device on it, so `mine` says how many
  //           of those calls this page made
  // `o.owner(e)` names who made a call, `o.rate` is { from, to } remaining.
  const FINDING = { repeat: 4, large: 256 * KB, heavy: 2 * KB * KB, burn: 250 };
  function trafficFindings(rows, o = {}) {
    const lim = { ...FINDING, ...(o.limits || {}) };
    const owner = o.owner || (e => e.job != null ? 'job ' + e.job : e.where ? 'view ' + e.where : 'page load');
    const list = rows || [];
    const key = (e) => e.method + ' ' + e.url;
    const group = (es, by) => es.reduce((m, e) => m.set(by(e), [...(m.get(by(e)) || []), e]), new Map());
    const known = (es) => es.reduce((n, e) => n + (typeof e.wire === 'number' ? e.wire : 0), 0);
    const owners = (es) => [...new Set(es.map(owner))];
    const statuses = (es) => es.reduce((m, e) => {
      const s = e.error ? 'error' : e.status ? String(e.status) : 'pending';
      m[s] = (m[s] || 0) + 1;
      return m;
    }, {});
    const out = [];
    for (const [k, es] of group(list, key)) {
      if (es.length < lim.repeat) continue;
      const ts = es.map(e => e.t).sort((a, b) => a - b);
      const gap = ts.slice(1).reduce((g, t, i) => Math.min(g, t - ts[i]), Infinity);
      out.push({ kind: 'repeat', sig: 'repeat ' + k, method: es[0].method, url: es[0].url, calls: es.length,
                 hidden: es.filter(e => e.hidden).length, wire: known(es), unknown: es.filter(e => typeof e.wire !== 'number').length,
                 statuses: statuses(es), by: owners(es), gapMs: isFinite(gap) ? gap : null });
    }
    for (const [who, es] of group(list.filter(e => e.hidden), owner)) {
      const urls = [...group(es, key)].sort((a, b) => b[1].length - a[1].length).slice(0, 3).map(([k, v]) => ({ call: k, calls: v.length }));
      out.push({ kind: 'hidden', sig: 'hidden ' + who, by: who, calls: es.length, wire: known(es), urls });
    }
    for (const [k, es] of group(list.filter(isFailed), key)) {
      const last = es[es.length - 1];
      out.push({ kind: 'failed', sig: 'failed ' + k, method: last.method, url: last.url, calls: es.length,
                 status: last.error ? 'error' : last.status, msg: last.error || last.msg || '', by: owners(es) });
    }
    for (const e of list) {
      if (typeof e.wire === 'number' && e.wire >= lim.large) {
        out.push({ kind: 'large', sig: 'large ' + key(e), method: e.method, url: e.url, wire: e.wire, by: owner(e) });
      }
    }
    const wire = known(list);
    if (wire >= lim.heavy) {
      const top = [...group(list, key)].map(([k, v]) => ({ call: k, wire: known(v) })).sort((a, b) => b.wire - a.wire).slice(0, 3);
      out.push({ kind: 'heavy', sig: 'heavy', calls: list.length, wire, top });
    }
    const r = o.rate || {};
    if (r.from != null && r.to != null && r.from - r.to >= lim.burn) {
      out.push({ kind: 'burn', sig: 'burn', spent: r.from - r.to, remaining: r.to,
                 mine: list.filter(e => /^https:\/\/api\.github\.com\//.test(e.url)).length });
    }
    return out;
  }
  // The ledger rows behind one of jobRows' rows, newest first.
  function rowCalls(entries, row) {
    if (!row) return [];
    const mine = row.kind === 'job'
      ? (e => e.job === row.id)
      : (e => e.job == null && (e.where || '') === row.where);
    return (entries || []).filter(mine).sort((a, b) => b.t - a.t);
  }

  // The header's figures for the whole tab: every call since the page loaded,
  // how many of them went out while it was hidden, and how many a job claimed.
  // Calls and bytes come from the running totals; the hidden and claimed
  // shares can only be read off rows still in the ledger, so they say so.
  // `errors` (the running total) splits, over the rows held, into `notFound`,
  // a 404, which is usually the app checking for a file a repo does not keep,
  // and `failed`, everything else: another status of 400 or more, or no answer.
  function isNotFound(e) { return !e.error && e.status === 404; }
  function isFailed(e) { return !!e.error || (e.status >= 400 && e.status !== 404); }
  function tabTotals(totals, entries, jobs) {
    const t = totals || {};
    const rows = entries || [];
    return {
      calls: t.calls || 0, wire: t.wire || 0, unknown: t.unknown || 0, errors: t.errors || 0,
      writes: t.writes || 0, trimmed: t.trimmed || 0,
      held: rows.length,
      notFound: rows.filter(isNotFound).length,
      failed: rows.filter(isFailed).length,
      hidden: rows.filter(e => e.hidden).length,
      claimed: rows.filter(e => e.job != null).length,
      jobs: (jobs || []).length,
      running: (jobs || []).filter(j => j.state === 'running').length,
    };
  }

  // The live read, for a browser: this page's Resource Timing entries and its
  // navigation entry, folded by `fold` (boot or pageFiles). Kept apart from the
  // pure functions above so the analysis tests without a performance object.
  function readLive(fold) {
    try {
      const nav = performance.getEntriesByType('navigation')[0];
      const res = performance.getEntriesByType('resource');
      return fold(res, nav ? {
        name: nav.name, transferSize: nav.transferSize, encodedBodySize: nav.encodedBodySize,
        decodedBodySize: nav.decodedBodySize, duration: nav.duration, startTime: 0,
        initiatorType: 'navigation',
      } : null);
    } catch (e) { return fold([], null); }
  }

  window.Traffic = {
    fmtBytes, fmtBytesShort, fmtMs, fmtCount,
    classify, label, hostOf, isWrite, repoOf, repoGroups,
    boot, bootGroups, bootRow, GROUP_LABEL,
    apiGroups, apiTotals,
    summary, storageRows,
    jobOutcome, jobRows, rowCalls, tabTotals, pageFiles, timeline, isNotFound, isFailed, fileCalls, loadRow,
    trafficFindings, binStep, timeGrid,

    // Live reads (readLive above).
    readBoot() { return readLive(boot); },
    readFiles() { return readLive(pageFiles); },
  };
})();
