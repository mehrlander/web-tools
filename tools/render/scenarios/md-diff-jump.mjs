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
// Scroll position is the second half. A claim that moves while the page stands
// still is the failure a reader actually reported, and only the browser can
// answer whether anything moved.
//
// WHICH BLOCK, read off the block rather than off the header. The badge used to
// count `1/3` and `2/3` and now reads the total and nothing else: `2/3` did not
// fit on a 16px circle and said what the block's own index badge already says.
// So the assertion moved to `data-md-diff-here`, which is the kit's statement
// of the same fact and is not paint.
export default async function (page) {
  const at = () => page.evaluate(() => {
    const here = document.querySelector('.md-diff-change[data-md-diff-here]');
    return {
      badge: document.getElementById('count').textContent,
      here: here ? Number(here.dataset.mdDiffChange) : -1,
      y: Math.round(window.scrollY),
    };
  });

  const rest = await at();
  if (rest.badge !== '3') throw new Error(`md-diff-jump: the badge counts the changes, got ${rest.badge}`);
  if (rest.here !== -1) throw new Error(`md-diff-jump: nothing is claimed at rest, got ${rest.here}`);

  await page.click('#jump');
  await page.waitForTimeout(900);
  const first = await at();
  if (first.here !== 0) throw new Error(`md-diff-jump: first tap, got ${JSON.stringify(first)}`);

  // The second tap is the one the bug ate: it advanced the claim under a
  // synthetic click and moved nothing under a real one.
  await page.click('#jump');
  await page.waitForTimeout(900);
  const second = await at();
  if (second.here !== 1) throw new Error(`md-diff-jump: second tap, got ${JSON.stringify(second)}`);
  if (second.y <= first.y) throw new Error('md-diff-jump: the second change never scrolled into view');
  // And the count is a constant, which is the whole point of the change.
  if (second.badge !== '3') throw new Error(`md-diff-jump: the badge should not move, got ${second.badge}`);

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
  if (let_go.here !== -1) throw new Error(`md-diff-jump: a tap on prose should release, got ${let_go.here}`);

  console.log('md-diff-jump:', JSON.stringify({ rest, first, second, let_go }));
}
