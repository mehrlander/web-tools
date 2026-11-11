// kits/md-diff.js — the redline, laid out in a browser.
//
//   node node/render/screenshot.mjs pages/data-view.html \
//     --script node/render/scenarios/md-redline.mjs \
//     --out node/.preview/md-redline.png --width 500 --height 880 --touch
//
// node/test/md-redline.test.mjs holds which blocks are marked and how. What it
// cannot see is where anything sits, and two of the redline's claims are about
// that: a marked list item's bar is placed by measurement and has to land in
// the same margin as a marked paragraph's, and no mark may widen the page.
//
// Drawn in the viewer's own column (`prose prose-sm`, the classes the Changes
// mode gives its host) on the data view's page, so the typography measured is
// the typography a reader gets. MD_REDLINE_AT=<n> steps to that change before
// the shot, for looking at one.
const OLD = `# Field notes

An opening paragraph that stays exactly as it was.

The second paragraph has one word that will be swapped for another word.

## Scope of the first survey

The first survey covered the northern plots only, because the southern access road was closed for the whole of that season.

- Plot one was sampled twice.
- Plot two was sampled once, in the spring.
- Plot three was skipped.
  - Its gate was locked.

1. Collect the samples.
2. Label every bag.
3. Ship them the same day.

| Plot | Samples |
|---|---|
| One | 2 |
| Two | 1 |
| Three | 0 |

\`\`\`sh
ship --plots north
\`\`\`

A closing paragraph that is going to be removed entirely.

The last paragraph stays.
`;
const NEW = `# Field notes

An opening paragraph that stays exactly as it was.

The second paragraph has one word that will be traded for another word.

## What the second survey reached

Both halves of the site were reached this time, and every plot was visited at least once before the weather turned.

- Plot one was sampled twice.
- Plot two was sampled once, in the autumn.
- Plot four was added to the route.
  - Its gate was locked.

1. Collect the samples.
2. Ship them the same day.

| Plot | Samples |
|---|---|
| One | 2 |
| Two | 3 |
| Four | 1 |

\`\`\`sh
ship --plots all
\`\`\`

The last paragraph stays.

A paragraph added at the end.
`;

export default async function (page) {
  await page.waitForFunction(() => window.ViewRegistry && document.getElementById('dv-viewer')?.__viewer);
  const out = await page.evaluate(async ({ OLD, NEW, at }) => {
    await window.ViewRegistry.prepare('changes');          // marked and DOMPurify, as the mode loads them
    await window.gh.load('kits/src-doc.js');
    await window.gh.load('kits/md-doc.js');
    await window.gh.load('kits/md-diff.js');
    const pane = document.createElement('div');
    pane.className = 'fixed inset-0 z-50 overflow-auto bg-base-100';
    const host = document.createElement('div');
    host.className = 'prose prose-sm !max-w-none px-6 py-4';
    pane.append(host);
    document.body.append(pane);
    const handle = await window.mdDiff.redline(host, OLD, NEW, {
      html: (md) => window.DOMPurify.sanitize(window.marked.parse(md)),
    });
    await new Promise((r) => setTimeout(r, 400));
    for (let k = 0; k <= at; k++) handle.next();
    await new Promise((r) => setTimeout(r, 300));
    const x = (e) => Math.round(e.getBoundingClientRect().left * 10) / 10;
    const bars = [...host.querySelectorAll('.md-redline-bar')];
    return {
      counts: handle.counts, count: handle.count, at: handle.at,
      barX: [...new Set(bars.map(x))],
      liBars: host.querySelectorAll('li[data-md-redline] > .md-redline-bar').length,
      textX: x(host.querySelector('p')),
      rows: [...host.querySelectorAll('tr[data-md-redline-row]')].map((r) => r.dataset.mdRedlineRow),
      numbers: [...host.querySelectorAll('ol > li')].map((li) => li.getAttribute('value')),
      barH: [...host.querySelectorAll('li[data-md-redline]')].map((li) => Math.round(li.getBoundingClientRect().height - li.querySelector(':scope > .md-redline-bar').getBoundingClientRect().height)),
      wide: pane.scrollWidth - pane.clientWidth,
      here: host.querySelectorAll('[data-md-redline-here]').length,
    };
  }, { OLD, NEW, at: process.env.MD_REDLINE_AT ? +process.env.MD_REDLINE_AT : -1 });
  console.log('md-redline: ' + JSON.stringify(out));

  const fail = (m) => { throw new Error('md-redline: ' + m + ' ' + JSON.stringify(out)); };
  if (!out.count) fail('nothing was marked');
  if (out.liBars < 2) fail('a changed list should mark its items one by one');
  // One margin for every bar, whatever it sits beside.
  if (out.barX.length !== 1) fail('the bars do not share one margin');
  if (out.textX - out.barX[0] !== 14) fail('a bar sits 14px outside the text');
  // top-0.5 and bottom-0.5: a bar is its item's height less 4px, whatever
  // margin the host's stylesheet gives an item's last child.
  if (out.barH.some((h) => h !== 4)) fail('a list item bar is not its item tall');
  if (out.wide > 0) fail('the marks widened the page');
  if (out.rows.join() !== 'changed,removed,added') fail('a changed table is read by its rows');
  if (out.numbers.join() !== '1,2,2') fail('a removed item keeps its old number and the next takes the new one');
}
