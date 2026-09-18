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
// THE HEADER NAMES THE DOCUMENT, and follows the reader to the next one. It
// carried the request's `manifest.name`, which is one string for the whole set,
// so it read identically on every slide and named nothing in front of the
// reader. A request has one name and a slide has one file; the header is for
// the file.
//
// AND THE SLIDE IS THE DOCUMENT. Four fields of the envelope used to draw above
// it (the item title and status, `commentary`, `deferred_because`, and the
// `related` links under "Answers to"), all of them the request talking about
// the change rather than the change itself. The envelope still carries them;
// the page stops drawing them. So the assertion is textual: none of the
// envelope's commentary appears anywhere on the slide.
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

  const head = await page.evaluate(() => {
    const h = document.querySelector('.sd-header');
    return h ? h.textContent.replace(/\s+/g, ' ').trim() : '';
  });
  const prose = await page.evaluate(() => {
    const slide = document.querySelector('[data-slide]');
    return slide ? slide.textContent.replace(/\s+/g, ' ') : '';
  });

  const approve = await page.evaluate(() => {
    const b = document.querySelector('.sd-header button[title="Approve"]');
    if (!b) return null;
    return { cls: b.className, text: b.textContent.trim(), icon: !!b.querySelector('i.ph-check') };
  });

  // And it follows the reader. One slide along is a different file, so a header
  // that did not move would still be naming the first one.
  const next = await page.evaluate(async () => {
    const t = document.querySelector('.sd-track');
    t.scrollTo({ left: t.clientWidth, behavior: 'instant' });
    await new Promise((r) => setTimeout(r, 600));
    const h = document.querySelector('.sd-header');
    return h ? h.textContent.replace(/\s+/g, ' ').trim() : '';
  });

  const jumpEdge = await page.evaluate(() => {
    const b = document.querySelector('.sd-header button[title="Next change"]');
    if (!b) return null;
    const cs = getComputedStyle(b);
    return { w: cs.borderTopWidth, mr: cs.marginRight };
  });

  const seen = { band, start, one, two, approve, head, next, jumpEdge, prose: prose.slice(0, 120) };
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
  if (!/SKILL\.md/.test(head)) bad('the header does not name the file on screen');
  if (/fourth flavor/.test(head)) bad('the header still carries the request name rather than the file');
  if (/Adds a fourth marker flavor/.test(prose)) bad("the item's commentary is still drawn above the document");
  if (/Answers to/.test(prose)) bad('the related links are still drawn above the document');
  if (!/README\.md/.test(next)) bad('the header did not follow the reader to the next file');
  if (!jumpEdge) bad('no jump button to measure');
  if (parseFloat(jumpEdge.w) <= 0) bad('the jump button has no visible edge beside the green check');
  if (parseFloat(jumpEdge.mr) <= 0) bad('the jump button sits flush against the green check');

  console.log('approve-header:', JSON.stringify(seen));
}
