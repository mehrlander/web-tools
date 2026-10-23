// gh-api.test.mjs — unit tests for GH.recentFiles(): the batched-parallel
// walk that feeds the app's sidebar Recent panel. gh-api.js is a plain ES
// module whose window-only paths (console capture, jsDelivr bootstrap) are
// guarded, so Node imports it directly; req() is stubbed with canned data.
import test from 'node:test';
import assert from 'node:assert/strict';

const { default: GH } = await import('../../lib/gh-api.js');

// A fake commit history: commit i (newest first) touches the given files.
// Dates descend with i so per-file dates are distinguishable.
const makeGh = (filesPerCommit, opts = {}) => {
  const gh = new GH({ repo: 'o/r' });
  const calls = { list: 0, details: [], maxInFlight: 0 };
  let inFlight = 0;
  gh.req = async (path) => {
    if (path.startsWith('commits?')) {
      calls.list++;
      return filesPerCommit.map((_, i) => ({
        sha: 's' + i,
        commit: { author: { date: `2026-01-${String(30 - i).padStart(2, '0')}` } },
      }));
    }
    const i = Number(path.replace('commits/s', ''));
    calls.details.push(i);
    inFlight++;
    calls.maxInFlight = Math.max(calls.maxInFlight, inFlight);
    await new Promise(r => setTimeout(r, 5));
    inFlight--;
    if (opts.fail?.includes(i)) throw new Error('detail ' + i + ' failed');
    return { files: filesPerCommit[i].map(f => ({ filename: f })) };
  };
  return { gh, calls };
};

test('collects n distinct paths newest-first with per-commit dates', async () => {
  const { gh } = makeGh([['a', 'b'], ['b', 'c'], ['d'], ['e']]);
  const out = await gh.recentFiles(3);
  assert.deepEqual(out.map(f => f.path), ['a', 'b', 'c']);
  // 'b' keeps the date of the newest commit that touched it (commit 0).
  assert.deepEqual(out.map(f => f.date), ['2026-01-30', '2026-01-30', '2026-01-29']);
  assert.deepEqual(out.map(f => f.sha), ['s0', 's0', 's1']);
});

test('fetches details in parallel batches, not serially', async () => {
  const commits = Array.from({ length: 12 }, (_, i) => ['f' + i]);
  const { gh, calls } = makeGh(commits);
  await gh.recentFiles(8);
  assert.ok(calls.maxInFlight > 1, `expected concurrent detail fetches, saw max ${calls.maxInFlight}`);
});

test('stops fetching once n paths are found', async () => {
  // First batch of 6 commits already yields 8 distinct files.
  const commits = Array.from({ length: 16 }, (_, i) => ['x' + i, 'y' + i]);
  const { gh, calls } = makeGh(commits);
  const out = await gh.recentFiles(8);
  assert.equal(out.length, 8);
  assert.ok(calls.details.length <= 6, `expected one batch of detail calls, saw ${calls.details.length}`);
});

test('a failed detail fetch is skipped, not fatal', async () => {
  const { gh } = makeGh([['a'], ['b'], ['c']], { fail: [1] });
  const out = await gh.recentFiles(3);
  assert.deepEqual(out.map(f => f.path), ['a', 'c']);
});

test('returns fewer than n when commits run out', async () => {
  const { gh } = makeGh([['a'], ['a']]);
  const out = await gh.recentFiles(5);
  assert.deepEqual(out.map(f => f.path), ['a']);
});

test('load() keeps an in-flight tally on the class for the boot guard', async () => {
  // gh-boot's load-race guard reads GH._loading / GH._loadQuietAt to tell a
  // chain still in flight from a page that loads nothing, so the counter has
  // to rise while a load is pending, pool across instances, and stamp the
  // quiet time on completion, success and failure alike.
  const gh = new GH({ repo: 'o/r' });
  let release;
  gh.get = () => new Promise(r => { release = () => r({ text: 'void 0' }); });
  const before = GH._loading || 0;
  const p = gh.load('slow.js');
  await new Promise(r => setTimeout(r, 5));
  assert.equal(GH._loading, before + 1, 'in flight while the fetch is pending');
  release();
  await p;
  assert.equal(GH._loading, before, 'settles back on completion');
  assert.ok(Date.now() - GH._loadQuietAt < 1000, 'quiet time stamped at completion');

  const failing = new GH({ repo: 'o/r' });
  failing.get = async () => { throw new Error('404'); };
  await assert.rejects(() => failing.load('gone.js'));
  assert.equal(GH._loading, before, 'a failed load never leaks the counter');
});

// ── req(): one retry when the connection drops ───────────────────────────────
// A rejected fetch is not GitHub saying anything, it is the network, and on a
// phone that is weather rather than an error. Measured 2026-08-17: a refresh on
// 5G died at "Activity refresh failed: Load failed" after 300-odd successful
// calls, so one retry is the difference between a dropped packet and a wasted
// crawl. Reads only: a PUT that failed to answer may still have landed.
const withFetch = async (impl, fn) => {
  // req() memoises a GET per URL for a minute across every GH; each fake
  // network starts from an empty table so a prior test's answer cannot stand
  // in for the one this test scripts.
  GH.memoClear();
  const real = globalThis.fetch;
  globalThis.fetch = impl;
  try { return await fn(); } finally { globalThis.fetch = real; }
};
const ok = (body = {}) => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => body });

test('a dropped read is retried once and then succeeds', async () => {
  const gh = new GH({ repo: 'o/r' });
  let tries = 0;
  const out = await withFetch(async () => {
    if (++tries === 1) throw new TypeError('Load failed');
    return ok({ ok: 1 });
  }, () => gh.req('branches?per_page=100'));
  assert.equal(tries, 2);
  assert.deepEqual(out, { ok: 1 });
});

test('the shared read memo never crosses authenticated identities', async () => {
  const seen = [];
  const [left, right] = await withFetch(async (_url, options) => {
    const authorization = options.headers.Authorization;
    seen.push(authorization);
    return ok({ authorization });
  }, async () => {
    const a = new GH({ token: 'account-a', repo: 'o/private' });
    const b = new GH({ token: 'account-b', repo: 'o/private' });
    return Promise.all([a.req('contents/private.json'), b.req('contents/private.json')]);
  });
  assert.equal(seen.length, 2, 'each credential reaches the network once');
  assert.equal(left.authorization, 'Bearer account-a');
  assert.equal(right.authorization, 'Bearer account-b');
});

test('tuple-form Authorization stays out of the shared memo key', async () => {
  const secret = 'Bearer tuple-account-secret';
  const gh = new GH({ repo: 'o/private' });
  await withFetch(async (_url, options) => {
    assert.deepEqual(options.headers, [['Authorization', secret], ['Accept', 'application/json']]);
    return ok({ ok: true });
  }, () => gh.req('contents/private.json', {
    headers: [['Authorization', secret], ['Accept', 'application/json']],
  }));
  const keys = [...GH._memo.keys()];
  assert.equal(keys.length, 1);
  assert.ok(!keys[0].includes(secret), 'a valid HeadersInit tuple must use the opaque auth scope');
});

test('a read that keeps dropping throws, naming the call', async () => {
  const gh = new GH({ repo: 'o/r' });
  let tries = 0;
  await withFetch(async () => { tries++; throw new TypeError('Load failed'); },
    () => assert.rejects(() => gh.req('branches?per_page=100'),
      // "Load failed" alone is a toast nobody can act on.
      /Network error on GET branches\?per_page=100: Load failed/));
  assert.equal(tries, 2, 'one retry, not a loop');
});

test('a write is not retried, since it may have landed', async () => {
  const gh = new GH({ repo: 'o/r' });
  let tries = 0;
  await withFetch(async () => { tries++; throw new TypeError('Load failed'); },
    () => assert.rejects(() => gh.req('contents/x.json', { method: 'PUT', body: '{}' }),
                         /Network error on PUT/));
  assert.equal(tries, 1);
});

test('an HTTP error is not a dropped connection and is not retried', async () => {
  const gh = new GH({ repo: 'o/r' });
  let tries = 0;
  await withFetch(async () => {
    tries++;
    return { ok: false, status: 409, headers: { get: () => '4986' },
             json: async () => ({ message: 'x does not match abc' }) };
  }, () => assert.rejects(() => gh.req('contents/x.json'), /GitHub Error 409/));
  assert.equal(tries, 1, 'GitHub answered; the answer will not change in 600ms');
});

// ── req(): a cached answer in another reader's shape ─────────────────────────
// GitHub tags every representation of a contents URL with one strong ETag, the
// blob sha. After toss-render read skills/session-review/SKILL.md?ref=main with
// the raw media type, Chromium revalidated the app's JSON read of that URL with
// the raw copy's ETag, took GitHub's 304, and handed back the markdown, which
// JSON.parse refused at its second hyphen (2026-09-28). The double below plays
// that cache: any read it may answer from storage gets the raw copy, and only
// a read that bypasses it reaches the JSON GitHub would send.
const MD = '---\nname: session-review\n---\n# Session review\n';
const typed = (type, body) => ({
  ok: true, status: 200,
  headers: { get: k => (k.toLowerCase() === 'content-type' ? type : null) },
  text: async () => body,
});
const RAW = () => typed('application/vnd.github.raw+json; charset=utf-8', MD);
const META = () => typed('application/json; charset=utf-8', JSON.stringify({
  sha: 'bbfb', size: MD.length, html_url: 'u', encoding: 'base64',
  content: Buffer.from(MD).toString('base64'),
}));

test('a raw copy served from the cache is re-read past it, and the file comes back', async () => {
  const gh = new GH({ repo: 'mehrlander/web-tools' });
  const modes = [];
  const file = await withFetch(async (_url, init) => {
    modes.push(init.cache ?? 'default');
    return init.cache === 'reload' ? META() : RAW();
  }, () => gh.get('skills/session-review/SKILL.md'));
  assert.equal(file.text, MD);
  assert.equal(file.sha, 'bbfb');
  // 'no-cache' would revalidate with the stale ETag and earn the same 304.
  assert.deepEqual(modes, ['default', 'reload'], 'one extra read, and it skips the validator');
});

test('a JSON answer costs no second read', async () => {
  const gh = new GH({ repo: 'o/r' });
  let tries = 0;
  const file = await withFetch(async () => { tries++; return META(); }, () => gh.get('SKILL.md'));
  assert.equal(file.text, MD);
  assert.equal(tries, 1);
});

test('a non-JSON answer that survives the reload names its type', async () => {
  const gh = new GH({ repo: 'o/r' });
  let tries = 0;
  await withFetch(async () => { tries++; return RAW(); },
    () => assert.rejects(() => gh.req('contents/SKILL.md?ref=main'),
      // Not "No number after minus sign in JSON at position 1".
      /GitHub answered GET contents\/SKILL\.md\?ref=main as application\/vnd\.github\.raw\+json, not JSON/));
  assert.equal(tries, 2, 'one reload, not a loop');
});

test('a FRESH read already skipped the cache, so it is not repeated', async () => {
  const gh = new GH({ repo: 'o/r' });
  let tries = 0;
  await withFetch(async () => { tries++; return RAW(); },
    () => assert.rejects(() => gh.req('contents/SKILL.md', GH.FRESH), /not JSON/));
  assert.equal(tries, 1);
});

test('a JSON answer under another vnd.github label still parses', async () => {
  // Only the file-body types trigger the re-read; a search's text-match JSON
  // must not start throwing if GitHub ever labels it with its own name.
  const gh = new GH({ repo: 'o/r' });
  let tries = 0;
  const out = await withFetch(async () => { tries++; return typed('application/vnd.github.text-match+json', '{"total_count":0}'); },
    () => gh.req('/search/code?q=x'));
  assert.deepEqual(out, { total_count: 0 });
  assert.equal(tries, 1);
});

test('GH.decode and GH.decodeBytes read the contents API base64, line wraps and all', () => {
  // The contents API wraps its base64 at 60 columns with '\n'. Six places
  // outside gh-api.js decoded it themselves until 2026-10-20; these statics
  // are what they read now, so a kit with no client decodes as a client does.
  const text = 'héllo 🌳 '.repeat(20);
  const wrapped = Buffer.from(text).toString('base64').replace(/(.{60})/g, '$1\n');
  assert.equal(GH.decode(wrapped), text);
  assert.deepEqual([...GH.decodeBytes(wrapped)], [...Buffer.from(text)]);
  assert.equal(new GH({ repo: 'o/r' }).decode(wrapped), text, 'the instance method is the static');
  assert.equal(GH.decode(''), '');
  assert.equal(GH.decodeBytes(null).length, 0);
});

test('decodeBytes takes the platform decoder where there is one, URL-safe and unpadded alike', () => {
  // Uint8Array.fromBase64 (Chrome 140, Safari 18.2, Firefox 133) replaced a
  // callback per byte that took 5.6s on a 57.5 MB record. Node 22 has none,
  // so the test above covers the loop and this stands one in.
  const real = Uint8Array.fromBase64;
  const seen = [];
  Uint8Array.fromBase64 = (s, o) => { seen.push([s, o]); return new Uint8Array(Buffer.from(s, 'base64')); };
  try {
    const bytes = Buffer.from([0xfb, 0xff, 0xbf, 0x01]);
    const url = bytes.toString('base64url');            // '-' and '_', no pad
    assert.deepEqual([...GH.decodeBytes(url)], [...bytes]);
    assert.equal(seen[0][0], bytes.toString('base64').replace(/=+$/, ''), 'handed the standard alphabet');
    assert.equal(seen[0][1].lastChunkHandling, 'loose', 'which takes the missing pad itself');
  } finally {
    if (real) Uint8Array.fromBase64 = real; else delete Uint8Array.fromBase64;
  }
});

// ── bytes(): a file over the contents cap, read raw ─────────────────────────
// The contents API withholds a file over 1 MB and names its blob. The blob's
// JSON shape is base64 in an envelope (21.0 MB gzipped for the largest session
// record, against 10.0 MB raw), so the read asks for the raw media type.
const BIG = 'x'.repeat(40) + 'é🌳';
const bigMeta = () => typed('application/json; charset=utf-8',
  JSON.stringify({ sha: 'b1g', size: 2_000_000, html_url: 'u', content: '', encoding: 'none' }));
const rawBody = (type, body) => ({ ...typed(type, body), arrayBuffer: async () => new TextEncoder().encode(body).buffer });

test('a file over the contents cap comes back through its blob, raw', async () => {
  const gh = new GH({ repo: 'o/r' });
  const asked = [];
  const file = await withFetch(async (url, init) => {
    asked.push([url.replace('https://api.github.com/repos/o/r/', ''), init.headers.Accept]);
    return url.includes('git/blobs/') ? rawBody('application/vnd.github.raw+json; charset=utf-8', BIG) : bigMeta();
  }, () => gh.get('sessions/big.json'));
  assert.equal(file.text, BIG);
  assert.equal(file.sha, 'b1g');
  assert.deepEqual(asked[1], ['git/blobs/b1g?media=raw', 'application/vnd.github.raw+json'],
    'the raw media type, by sha, at a URL of its own so the JSON readers of this blob never share its cache entry');
  assert.equal(asked.length, 2);
});

test('a blob answered from a cached JSON copy is decoded from its envelope', async () => {
  const gh = new GH({ repo: 'o/r' });
  const env = JSON.stringify({ sha: 'b1g', size: 2_000_000, encoding: 'base64',
                               content: Buffer.from(BIG).toString('base64').replace(/(.{60})/g, '$1\n') });
  const file = await withFetch(async (url) => url.includes('git/blobs/')
    ? rawBody('application/json; charset=utf-8', env) : bigMeta(), () => gh.get('sessions/big.json'));
  assert.equal(file.text, BIG);
});

test('a raw file that is itself JSON is the answer, not an envelope', async () => {
  const gh = new GH({ repo: 'o/r' });
  const own = JSON.stringify({ sha: 'not-this-blob', encoding: 'base64', content: 'QUJD' });
  const file = await withFetch(async (url) => url.includes('git/blobs/')
    ? rawBody('application/json; charset=utf-8', own) : bigMeta(), () => gh.get('sessions/big.json'));
  assert.equal(file.text, own, 'an envelope names this blob\'s sha; a file that happens to look like one does not');
});

test('a raw blob read that fails goes back through req, so its error reads as before', async () => {
  const gh = new GH({ repo: 'o/r' });
  let blobTries = 0;
  await withFetch(async (url) => {
    if (!url.includes('git/blobs/')) return bigMeta();
    blobTries++;
    return { ok: false, status: 403, headers: { get: k => (k === 'x-ratelimit-remaining' ? '0' : null) },
             json: async () => ({ message: 'API rate limit exceeded' }) };
  }, () => assert.rejects(() => gh.get('sessions/big.json'), /GitHub Error 403: API rate limit exceeded/));
  assert.equal(blobTries, 2, 'the raw read, then the one req() makes');
});
