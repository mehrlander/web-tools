// pages/approve.html — the two header controls, and the band that should not be.
//
//   node tools/render/screenshot.mjs pages/approve.html \
//     --hash 'src=mehrlander/web-tools:approvals/2026-09-16-marker-vocabulary.request.json' \
//     --script tools/render/scenarios/approve-header.mjs \
//     --out tools/.preview/approve-header.png --width 390 --height 844
//
// Two things a reader reported on a phone, 2026-09-18.
//
// THE JUMP MOVED INTO THE HEADER. Stepping change to change is the most
// repeated act on this page and its control sat in md-diff's own strip, which
// scrolls away with the prose. The header does not. The reach crosses two
// component boundaries (page -> deck slide -> file-review -> md-diff), so it
// goes by element and event rather than by handle: `.md-diff-doc` is the class
// the kit puts on the rendered document, and `md-diff:jump` is what it listens
// for. Both halves are asserted here, since either one alone is a dead button.
//
// AND THE SUBHEADER BAND. The deck's subheader slot collapses with
// `empty:hidden`, which is `:empty` and therefore false the moment the slot
// holds any child at all. The page passed a wrapper whose alert is `x-show`-ed
// on a verdict, so the slot always had a child, was never `:empty`, and drew an
// empty bordered band under the header for the whole session.
export default async function (page) {
  await page.waitForSelector('.md-diff-doc .md-diff-change', { timeout: 20000 });

  const band = await page.evaluate(() => {
    const sub = document.querySelector('.sd-subheader');
    if (!sub) return { present: false };
    const r = sub.getBoundingClientRect();
    return { present: true, kids: sub.childNodes.length, h: Math.round(r.height) };
  });

  const here = () => page.evaluate(() => {
    const doc = document.querySelector('.md-diff-doc');
    const boxes = [...doc.querySelectorAll('.md-diff-change')];
    return boxes.findIndex((b) => b.hasAttribute('data-md-diff-here'));
  });

  const start = await here();
  const btn = await page.$('.sd-header button[title="Next change"]');
  if (!btn) throw new Error('approve-header: no jump button in the deck header');
  await btn.click();
  await page.waitForTimeout(500);
  const one = await here();
  await btn.click();
  await page.waitForTimeout(500);
  const two = await here();

  const approve = await page.evaluate(() => {
    const b = document.querySelector('.sd-header button[title="Approve"]');
    if (!b) return null;
    return { cls: b.className, text: b.textContent.trim(), icon: !!b.querySelector('i.ph-check') };
  });

  const seen = { band, start, one, two, approve };
  const bad = (m) => { throw new Error(`approve-header: ${m}, got ${JSON.stringify(seen)}`); };

  if (band.present && band.h > 0) bad('the empty subheader still draws a band under the header');
  if (start !== -1) bad('a change was already claimed before the reader touched anything');
  if (one !== 0) bad('the header arrow did not reach the first change');
  if (two !== 1) bad('the header arrow did not step to the next change');
  if (!approve) bad('no Approve button in the deck header');
  if (!approve.icon) bad('Approve lost its check icon');
  if (approve.text) bad('Approve is icon-only, so its label should be gone');
  if (!/btn-circle/.test(approve.cls) || !/btn-success/.test(approve.cls))
    bad('Approve should be a filled green circle');

  console.log('approve-header:', JSON.stringify(seen));
}
