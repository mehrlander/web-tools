// kits/md-diff.js — the redline, laid out in a browser.
//
//   node node/render/screenshot.mjs pages/data-view.html \
//     --script node/render/scenarios/md-redline.mjs \
//     --out node/.preview/md-redline.png --width 500 --height 880 --touch
//
// node/test/md-redline.test.mjs holds which blocks are marked and how. What it
// cannot see is where anything sits. A bar and a band are `::after` boxes
// that have to reach the host's edges whatever they sit beside, a marked
// list item's included though its reach is measured; they follow the host's
// padding when it changes; a band covers its whole stretch; and no mark may
// widen the page.
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
- Plot five is new this season.
- Plot six is new this season as well.

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
    const px = (v) => Math.round(parseFloat(v) * 10) / 10;
    // Where each mark's ::after box sits, in the page's coordinates.
    const read = () => {
      const hr = host.getBoundingClientRect();
      return [...host.querySelectorAll('[data-md-redline-mark]')].map((m) => {
        const r = m.getBoundingClientRect(), a = getComputedStyle(m, '::after');
        const left = r.left + px(a.left), width = px(a.width);
        return { kind: m.dataset.mdRedline, shape: m.dataset.mdRedlineMark, tag: m.tagName,
                 left: px(left - hr.left), right: px(hr.right - (left + width)), width,
                 bar: m.dataset.mdRedlineMark === 'band' ? px(a.borderLeftWidth) : width,
                 top: px(a.top), tall: px(a.height), own: Math.round(r.height),
                 run: (() => { let n = 1, e = m; while ((e = e.nextElementSibling) && e.hasAttribute('data-md-redline-run')) n++; return n; })(),
                 paint: m.dataset.mdRedlineMark === 'band' ? a.borderLeftColor : a.backgroundColor, wash: a.backgroundColor };
      });
    };
    const wide = read(), textWide = Math.round(host.querySelector('p').getBoundingClientRect().left);
    // A phone under a flush host: 10px of padding, and the marks follow.
    host.style.paddingLeft = host.style.paddingRight = '10px';
    await new Promise((r) => setTimeout(r, 300));
    return {
      counts: handle.counts, count: handle.count, at: handle.at,
      wide, textWide, tight: read(), textTight: Math.round(host.querySelector('p').getBoundingClientRect().left),
      rows: [...host.querySelectorAll('tr[data-md-redline-row]')].map((r) => r.dataset.mdRedlineRow),
      numbers: [...host.querySelectorAll('ol > li')].map((li) => li.getAttribute('value')),
      struck: [...host.querySelectorAll('[data-md-redline="removed"]')].map((e) => getComputedStyle(e).opacity + ' ' + getComputedStyle(e).textDecorationLine),
      overflow: pane.scrollWidth - pane.clientWidth,
    };
  }, { OLD, NEW, at: process.env.MD_REDLINE_AT ? +process.env.MD_REDLINE_AT : -1 });
  console.log('md-redline: ' + JSON.stringify(out));

  const fail = (m) => { throw new Error('md-redline: ' + m + ' ' + JSON.stringify(out)); };
  if (!out.count) fail('nothing was marked');
  if (out.textWide !== 24 || out.textTight !== 10) fail('the text did not follow the host\'s padding');
  for (const marks of [out.wide, out.tight]) {
    // Every mark starts on the host's left edge with a 6px bar, a list
    // item's included.
    if (marks.some((m) => m.left !== 0 || m.bar !== 6)) fail('a bar is off the host\'s left edge, or is not 6px');
    if (!marks.some((m) => m.tag === 'LI' && m.shape === 'bar') || !marks.some((m) => m.tag === 'LI' && m.shape === 'band')) fail('a changed list marks its items');
    if (!marks.some((m) => m.tag === 'LI' && m.run === 2)) fail('two items added together are one stretch');
    // A band runs to the host's right edge and covers its stretch. A bar is
    // its block's height less the 2px it stands in at each end.
    for (const m of marks) {
      if (m.shape === 'band' && (m.right !== 0 || m.top !== 0 || (m.run === 1 && m.tall !== m.own) || (m.run > 1 && m.tall <= m.own))) fail('a band does not cover its stretch');
      if (m.shape === 'bar' && (m.width !== 6 || m.tall !== m.own - 4)) fail('a bar is not its block tall');
      if (!/\/ 0\.5\)$/.test(m.paint)) fail('a resting mark is at half strength');
      if (m.shape === 'band' && !/\/ 0\.1\)$/.test(m.wash)) fail('a band carries a light wash');
    }
  }
  if (out.struck.some((v) => v !== '1 line-through')) fail('removed text is struck at full strength');
  if (out.overflow > 0) fail('the marks widened the page');
  if (out.rows.join() !== 'changed,removed,added') fail('a changed table is read by its rows');
  if (out.numbers.join() !== '1,2,2') fail('a removed item keeps its old number and the next takes the new one');
}
