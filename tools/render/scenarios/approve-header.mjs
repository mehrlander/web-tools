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
// ONE ROW OF CHROME, NOT TWO. md-diff draws a readout and a swipe/side toggle,
// and left to itself it puts them in a sticky strip inside the document. On a
// reading card that was a second row directly under the card's own, the two of
// them saying different halves of one thing. The kit hands its controls to a
// host that asks, so file-review asks and places them beside its view icons.
// Asserted as the absence of the kit's own strip AND the presence of its text
// in the card's row, since either alone would pass on a card that simply lost
// the controls.
//
// AND THE FILE'S LINKS SIT BESIDE THE FILE'S NAME, which is the estate's
// convention for a filename pointing at GitHub. The name is the deck's title
// now, so the menu is the deck's title MARK, built by the page from the
// addresses the request already carries. The card stands its own copy down
// under `bare`, whose meaning widened to cover it.
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
  // The jump moved out of the deck header on 2026-09-18 and into md-diff's own
  // floating strip, which is where the readout that names the change already
  // is. The header is for controls about the FILE.
  const btn = await page.$('.md-diff-doc button[title="Next change"]');
  if (!btn) throw new Error('approve-header: no jump button on the comparison');
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
    const t = document.querySelector('.sd-track');
    const slide = t && t.children[Math.round(t.scrollLeft / (t.clientWidth || 1))];
    return slide ? slide.textContent.replace(/\s+/g, ' ') : '';
  });

  const approve = await page.evaluate(() => {
    const b = document.querySelector('.sd-header button[title="Approve"]');
    if (!b) return null;
    return { cls: b.className, text: b.textContent.trim(), icon: !!b.querySelector('i.ph-check') };
  });

  // THE DOCUMENT SITS EVENLY IN ITS SCROLLER. A changed block bleeds past the
  // text with -mx-2 so its tinted ring is visible, and the slide is the
  // scroller, so a CLASSIC scrollbar takes its width out of the right side of
  // the content box and the ring lands 4px from the left and 4 plus a scrollbar
  // from the right. Reported 2026-09-18 from a desktop browser. This runs at
  // 390 where scrollbars overlay and the gutter is not reserved, so what it
  // pins is the phone's 4 and 4; the desktop half is the `sm:` gutter and is
  // asserted as a declaration rather than a measurement.
  //
  // BEFORE THE SWIPE, deliberately. Measured after it, a bare querySelector
  // answers with slide one's block, which is then a screen-width to the LEFT
  // of the viewport: it read -386 and failed a check that was right about the
  // page. Scoping to the active slide is the other repair and a worse one,
  // since slide two's comparison may not have drawn yet.
  const gaps = await page.evaluate(() => {
    const box = document.querySelector('.md-diff-change');
    // `.sd-slide` BY NAME, not the nearest <section>. The rendered document
    // contains sections of its own, so `closest('section')` answered with one
    // of those and reported the slide's scrollbar as `auto` while the slide
    // itself computed `thin`. The class is the deck's own and is what the
    // gutter rule keys on.
    const sec = box.closest('.sd-slide');
    const r = box.getBoundingClientRect();
    return { left: Math.round(r.left), right: Math.round(window.innerWidth - r.right),
             gutter: Math.round(sec.offsetWidth - sec.clientWidth),
             sbWidth: getComputedStyle(sec).scrollbarWidth,
             // The rule lives in kits/swipe-deck.js's own stylesheet now, not
             // in a class on the element, so the element is asked what it
             // COMPUTED rather than what it was labelled.
             declares: !!sec.closest('.sd-slide') || /sd-slide/.test(sec.className) };
  });

  // BEFORE THE SWIPE, for the same reason the gaps are: slide two's card is
  // still loading 600ms after it arrives, and a card with no bytes offers no
  // view modes, so the header has no view icons to count and a correct page
  // fails the check.
  const chrome = await page.evaluate(() => {
    // VISIBLE, not merely present. `hosted` hides the card's row with x-show,
    // which is display:none: the element is still in the tree and a bare
    // querySelector reports a row that nobody can see.
    const rows = [...document.querySelectorAll('.sd-track .flex.items-center.gap-1')];
    const row = rows.find((e) => e.offsetParent) || null;
    const own = document.querySelector('.md-diff-doc > .sticky');
    const menus = document.querySelectorAll('.sd-track details.dropdown');
    let visible = 0;
    for (const m of menus) if (m.querySelector('.ph-github-logo') && m.offsetParent) visible++;
    return {
      rowText: row ? row.textContent.replace(/\s+/g, ' ') : null,
      ownStrip: !!own,
      markInHeader: !!document.querySelector('.sd-header .ph-github-logo'),
      viewIcons: document.querySelectorAll('.sd-header button[title^="Compare"]').length,
      menusOnSlide: visible,
    };
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
    const b = document.querySelector('.md-diff-doc button[title="Next change"]');
    if (!b) return null;
    const strip = b.closest('.sticky');
    return { floats: !!strip, pos: strip ? getComputedStyle(strip).position : '',
             right: strip ? Math.round(innerWidth - strip.getBoundingClientRect().right) : -1 };
  });

  const seen = { band, start, one, two, approve, head, next, chrome, gaps, jumpEdge, prose: prose.slice(0, 120) };
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
  // THE SLIDE IS THE DOCUMENT AND THE HEADER IS THE FILE'S. Under `hosted` the
  // card draws no row at all, so the readout and the layout toggle have nowhere
  // in the slide to go and the kit floats its own strip instead. Both halves
  // are asserted, since a slide with neither would pass a check for either.
  if (!chrome.ownStrip) bad('the comparison draws no floating strip, so nothing carries the layout toggle');
  if (chrome.rowText !== null) bad('the card still draws a control row inside the slide');
  if (!chrome.markInHeader) bad('the github menu is not beside the file name in the header');
  if (chrome.viewIcons < 2) bad('the view icons are not in the deck header');
  if (chrome.menusOnSlide) bad('the card still draws its own github menu, so there are two');
  if (!/web-tools/.test(head)) bad('the header does not name the repository');
  if (gaps.left < 2) bad("a changed block's ring runs off the left edge");
  if (gaps.left !== gaps.right) bad('the document sits off-centre in its scroller');
  if (gaps.gutter) bad('a gutter is reserved at phone width, where scrollbars overlay and take none');
  if (gaps.sbWidth !== 'thin') bad('the slide draws a full-width scrollbar');
  if (!gaps.declares) bad('the slide is not the deck\'s own, so it carries no gutter rule');
  if (!jumpEdge) bad('no jump button to measure');
  if (!jumpEdge.floats) bad('the jump is not in the comparison\'s own strip');
  if (jumpEdge.pos !== 'sticky') bad('the strip does not stay with the reader as they scroll');

  console.log('approve-header:', JSON.stringify(seen));
}
