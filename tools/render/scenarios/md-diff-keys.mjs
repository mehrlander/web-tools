// kits/md-diff.js — the arrow keys, and how fast a reading swaps.
//
//   node tools/render/screenshot.mjs lib/kits/demos/md-diff.html \
//     --script tools/render/scenarios/md-diff-keys.mjs \
//     --out tools/.preview/md-diff-keys.png --width 1100 --height 600
//
// Two behaviours that only a browser can answer, and that a screenshot cannot.
//
// THE KEYS. They appeared to work before they were wired, and only by
// accident: with focus inside a snap track the browser's own horizontal scroll
// nudges it and `snap-mandatory` settles on the next slide. So "the arrow keys
// work" was true and worth nothing, and the assertions here are about the
// wiring: the claimed block moves, the walk is by STOP rather than by scroll
// increment, and it clamps at each end instead of cycling.
//
// THE SPEED. A reader on a wide screen reported the swap as slow while the
// same code felt right on a phone, because Chrome scales a smooth scroll's
// duration with the distance. The fix asks the INPUT rather than the width, so
// there are two paths and each needs driving. `quick()` is read when a
// container is built, so the touch path can only be reached by stubbing
// matchMedia and rendering again, which is what the second half does.
export default async function (page) {
  // ── The keys, on the claimed block ────────────────────────────────────────
  const lit = () => page.evaluate(() => {
    const stops = [...document.querySelectorAll('.md-diff-change')[0].children[1].children];
    return stops.find((x) => x.className.includes('font-medium'))?.textContent || '(none)';
  });
  await page.evaluate(() => {
    document.querySelectorAll('.md-diff-change')[0].dataset.probe = 'c1';
  });
  await page.click('[data-probe="c1"]');
  await page.waitForTimeout(400);

  const walk = [await lit()];
  for (const k of ['ArrowRight', 'ArrowRight', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft']) {
    await page.keyboard.press(k);
    await page.waitForTimeout(300);
    walk.push(await lit());
  }
  // inline, then right to new, then held at new, then back to inline, to old,
  // then held at old.
  const want = ['inline', 'new', 'new', 'inline', 'old', 'old'];
  if (walk.join(',') !== want.join(',')) {
    throw new Error(`md-diff-keys: walked ${walk.join(',')}, wanted ${want.join(',')}`);
  }

  // ── The speed, both ways ─────────────────────────────────────────────────
  const speed = await page.evaluate(async () => {
    const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
    const jump = async (box) => {
      const track = box.querySelector('.sd-track');
      [...box.children[1].children][2].click();       // two stops along
      await frame(); await frame();
      return { at: Math.round(track.scrollLeft), target: Math.round(2 * (track.clientWidth || 1)),
               dur: getComputedStyle(box.children[2]).transitionDuration };
    };

    const fine = matchMedia('(pointer: fine)').matches;
    const now = await jump(document.querySelectorAll('.md-diff-change')[0]);

    // And the touch path, on a container built while matchMedia says coarse.
    const real = window.matchMedia;
    window.matchMedia = (q) => (/pointer: fine|reduced-motion/.test(q)
      ? { matches: false, media: q, addEventListener() {}, removeEventListener() {} }
      : real.call(window, q));
    const host = document.createElement('div');
    document.querySelector('main').append(host);
    await window.mdDiff.render(host, 'One plain sentence here.', 'One plainer sentence here.',
      { strip: false });
    window.matchMedia = real;
    await frame();
    const later = await jump(host.querySelector('.md-diff-change'));
    host.remove();
    return { fine, now, later };
  });

  if (!speed.fine) throw new Error('md-diff-keys: this runner is not a fine pointer, so the split is untested');
  if (speed.now.at !== speed.now.target) {
    throw new Error(`md-diff-keys: a click should land instantly, got ${speed.now.at} of ${speed.now.target}`);
  }
  if (speed.now.dur !== '0s') {
    throw new Error(`md-diff-keys: an instant swap should not ease its height, got ${speed.now.dur}`);
  }
  if (speed.later.at >= speed.later.target) {
    throw new Error('md-diff-keys: the touch path should still animate, and did not');
  }

  console.log('md-diff-keys:', JSON.stringify({ walk, speed }));
}
