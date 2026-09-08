// THE FAB FILES AN UNFINISHED TAP FROM ANY PAGE, TAGGED WITH ITS CASE.
//
//   npm run shot -- pages/peek.html --width 430 --touch \
//     --script tools/render/scenarios/fab-reports-anywhere.mjs
//
// The crash report used to live in pages/audit-render.html, so every control
// had to be run on that one page. The moment a test needed a different page or
// a different delivery, its result came back as a sentence in chat rather than
// a file, which is how several variables went uncontrolled for a whole evening.
// The trail belongs to the fab, so the reporting does too.
//
// peek.html is the point: it has no health readout and no reporting of its own.
// If the fab files from here, it files from anywhere.

export default async function (page) {
  await page.waitForSelector('[aria-label="Web-tools panel"]', { timeout: 20000 });

  const sent = await page.evaluate(async () => {
    const d = Alpine.$data(document.querySelector('[x-data*="fab"]') || document.body);
    // Stand in for the commit, and keep what it was handed.
    const seen = [];
    const load = d._selfLoad.bind(d);
    d._selfLoad = async (p, ready) => {
      const ok = await load(p, ready);
      if (window.PageReport) window.PageReport.send = async (extra) => { seen.push(extra); return { ok: true, path: 'stub.json' }; };
      return ok;
    };
    // A tap that died mid-toggle, stamped where it happened. The stamp is the
    // point: a matrix is run link by link, so the page that FILES a trail is
    // the next one opened, never the one that crashed.
    localStorage.setItem('fab:step', JSON.stringify({
      start: Date.now() - 900, at: Date.now(),
      where: { case: 'THE-CELL-THAT-CRASHED', use: 'abc1234', url: 'https://x/y?case=THE-CELL-THAT-CRASHED' },
      steps: [{ stage: 'open', ms: 3 }, { stage: 'd:end', ms: 61 }],
    }));
    await d._reportUnfinished();
    return { seen, left: localStorage.getItem('fab:step') };
  });

  if (!sent.seen.length) throw new Error('an unfinished tap filed nothing from a page with no reporter of its own');
  const r = sent.seen[0];
  if (r.crumb?.stage !== 'd:end') throw new Error(`the trail's last stage did not ride: ${JSON.stringify(r.crumb)}`);
  if (r.crumb.steps?.length !== 2) throw new Error('the steps did not ride');
  if (!('use' in r) || !('viaToss' in r) || !('case' in r))
    throw new Error('the delivery variables are not in the report, which is what the matrix reads');
  if (r.case !== 'THE-CELL-THAT-CRASHED')
    throw new Error(`the report wears the filing page's tag, not the crashing one's: ${r.case}`);
  if (r.use !== 'abc1234')
    throw new Error(`the ?use= came from the filing page, not the crashing one: ${r.use}`);
  if (sent.left) throw new Error('the crumb was reported and not cleared, so it will file forever');

  // A clean load files nothing at all.
  const clean = await page.evaluate(async () => {
    const d = Alpine.$data(document.querySelector('[x-data*="fab"]') || document.body);
    const before = window.__fabCrumb;
    await d._reportUnfinished();
    return { changed: window.__fabCrumb !== before };
  });
  if (clean.changed) throw new Error('a load with no crumb still did something');

  console.log('filed from peek with no reporter of its own · case/use/viaToss ride · cleared after · clean load silent');
}
