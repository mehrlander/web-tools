// screenshot.mjs interaction scenario: a unit marked removed, and one noted.
//
//   node tools/render/screenshot.mjs pages/audit-render.html \
//     --script tools/render/scenarios/audit-verdict.mjs \
//     --out tools/.preview/audit-verdict.png
//
// What the pixels have to prove: a removed unit is struck through over its
// label's tint, so the one edit the tools carry out reads without a switch,
// and a noted unit is otherwise unchanged. It decides both through the same
// operations the panel's Remove toggle and note field push.
//
// It picks its own targets by position rather than by uid, so it does not go
// stale the first time the grain moves under it.
export default async function (page) {
  await page.waitForSelector('[x-ref="doc"] span');
  await page.evaluate(() => {
    const d = Alpine.$data(document.body);
    const prose = d.units.filter(u => u.kind === 'sent');
    d.push({ op: 'verdict', uid: prose[2].uid, verdict: 'DROP' });
    d.push({ op: 'note', uid: prose[5].uid, text: 'say this in one sentence' });
    d.sel = null;
    d.paint();
  });
  await page.waitForTimeout(600);
}
