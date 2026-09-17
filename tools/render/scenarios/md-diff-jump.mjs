// kits/md-diff.js — the jump and the release, driven the way a reader drives
// them.
//
//   node tools/render/screenshot.mjs lib/kits/demos/md-diff.html \
//     --script tools/render/scenarios/md-diff-jump.mjs \
//     --out tools/.preview/md-diff-jump.png --width 390 --height 700
//
// THIS EXISTS BECAUSE OF ONE BUG AND THE TEST THAT COULD NOT SEE IT. The kit
// clears the reader's selection on a pointerdown that lands outside a change.
// Scoped to the whole document, that fired on the host's own jump button: the
// tap's pointerdown cleared the selection and the click that followed computed
// `next` from nothing, so every press went to change 1 and the second press
// appeared to do nothing.
//
// It shipped because the probe that checked the jump called `element.click()`,
// which dispatches a click and no pointer events, so it never met the listener
// it was meant to exercise and reported the badge advancing 1/3, 2/3, 3/3
// while a real tap did not. `page.click()` dispatches the whole pointer
// sequence, which is why every assertion here goes through it.
//
// Scroll position is the second half. A badge that counts up while the page
// stands still is the failure a reader actually reported, and only the browser
// can answer whether anything moved.
export default async function (page) {
  const at = () => page.evaluate(() => ({
    badge: document.getElementById('count').textContent,
    y: Math.round(window.scrollY),
  }));

  const rest = await at();
  if (rest.badge !== '3') throw new Error(`md-diff-jump: at rest the badge should count, got ${rest.badge}`);

  await page.click('#jump');
  await page.waitForTimeout(900);
  const first = await at();
  if (first.badge !== '1/3') throw new Error(`md-diff-jump: first tap, got ${first.badge}`);

  // The second tap is the one the bug ate: it advanced the count in a
  // synthetic click and moved nothing under a real one.
  await page.click('#jump');
  await page.waitForTimeout(900);
  const second = await at();
  if (second.badge !== '2/3') throw new Error(`md-diff-jump: second tap, got ${second.badge}`);
  if (second.y <= first.y) throw new Error('md-diff-jump: the second change never scrolled into view');

  // And the release, which is the behaviour the over-broad version was for.
  await page.evaluate(() => {
    const p = [...document.querySelectorAll('#doc > .guide-body')]
      .find((e) => !e.closest('.md-diff-change'));
    p.scrollIntoView({ block: 'center' });
    p.dataset.probe = '1';
  });
  await page.waitForTimeout(400);
  await page.click('[data-probe="1"]');
  await page.waitForTimeout(400);
  const let_go = await at();
  if (let_go.badge !== '3') throw new Error(`md-diff-jump: a tap on prose should release, got ${let_go.badge}`);

  console.log('md-diff-jump:', JSON.stringify({ rest, first, second, let_go }));
}
