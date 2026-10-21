// screenshot.mjs interaction scenario: the Map view's Docs tab sorted coldest
// first.
//
//   node node/render/screenshot.mjs app/index.html \
//     --script node/render/scenarios/map-docs-cold.mjs \
//     --out node/.preview/map-docs-cold.png --full
//
// The third of the readership scenarios. map-docs.mjs holds a tokenless reader
// and shows the registry with no column; map-docs-reads.mjs holds a token and
// shows the column in registry order; this one shows what makes the column
// answerable rather than merely present: the ordering that puts the unread at
// the top.

export default async function (page) {
  const reg = await page.evaluate(() => fetch('../../docs/docs.csv').then(r => r.text()));

  const ok = await page.evaluate(({ regText }) => {
    if (!window.Alpine || !window.__shell || !window.GH) return 'no shell';

    // The registry is a CSV and is parsed through the app's own kit, the way
    // loadDocsReg does. It was JSON until the table moved out of docs.json.
    const docs = window.Csv.rows(regText).map(d => d.path);
    // Only the top of the folder gets a count, so the sort has a cold tail to
    // lift: a fixture where every row is read cannot show an ordering by reads.
    const busy = docs.filter(p => /^docs\/[^/]+$/.test(p)).slice(0, 8);
    const cache = {
      generatedAt: '2026-08-30T17:43:47Z',
      count: 266,
      docAttention: [
        ...busy.map((path, i) => ({
          path: 'web-tools/' + path,
          sessions: Math.max(1, 16 - i * 2),
          count: Math.max(1, 16 - i * 2) * 2,
          last: '2026-08-29T20:00:16Z',
        })),
      ],
    };

    const origGet = window.GH.prototype.get;
    window.GH.prototype.get = async function (name) {
      if (name === 'docs/docs.csv') return { text: regText };
      if (name === 'state/sessions.json') return { text: JSON.stringify(cache) };
      if (name === '.claude/settings.json' || name === 'CLAUDE.md' || name === '.web-tools.json'
          || name === 'docs/portable.csv' || name === 'state/configs.json' || name === 'state/activity.json'
          || name === 'lists/to-do.json' || name === 'lists/jot.json')
        throw Object.assign(new Error('404'), { status: 404 });
      return origGet.call(this, name);
    };
    window.__shell.hasToken = () => true;

    window.__shell.goMap();
    return true;
  }, { regText: reg });
  if (ok !== true) throw new Error('map-docs-cold scenario: ' + ok);

  await page.evaluate(() => {
    const el = [...document.querySelectorAll('[x-data]')]
      .find(e => (e.getAttribute('x-data') || '').includes('map('));
    const d = window.Alpine.$data(el);
    d.mapTab = 'docs';
    d.loadDocsReg();
  });
  await page.waitForFunction(() => {
    const el = [...document.querySelectorAll('[x-data]')]
      .find(e => (e.getAttribute('x-data') || '').includes('map('));
    const d = el && window.Alpine.$data(el);
    return d && d.docsReg && !d.docsLoading && d.docReads;
  }, { timeout: 20000 });
  // The control cycles registry -> cold -> hot, so one press is the cold view.
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('[x-data]')]
      .find(e => (e.getAttribute('x-data') || '').includes('map('));
    window.Alpine.$data(el).cycleDocSort();
  });
  await page.waitForTimeout(500);
}
