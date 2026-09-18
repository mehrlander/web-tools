// kits/swipe-deck.js — the one-stop guard, which exists because the property
// was not enough.
//
//   node tools/render/screenshot.mjs lib/kits/demos/md-diff.html \
//     --script tools/render/scenarios/md-diff-one-stop-guard.mjs \
//     --out tools/.preview/md-diff-one-stop-guard.png --width 390 --height 700
//
// `scroll-snap-stop: always` is set, computes as `always` on every slide, and a
// fling on iOS still crossed the middle of a three-stop track. Its sibling
// scenario asserts the property; this one asserts the behaviour that does not
// depend on it: a gesture that ends more than one slide from where it began is
// stepped back to one.
//
// The fling itself is not simulated. A synthetic drag in a headless browser
// does not reproduce a thumb's velocity curve, and a pass or a fail from one
// would mean nothing. What is driven instead is exactly what a fling produces:
// a gesture start, a scroll that lands two slides away, and the settle. If the
// guard is right that lands on one; without it, on two.
export default async function (page) {
  const seen = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const track = document.querySelector('.md-diff-change .sd-track');
    if (!track) return { error: 'no change track' };
    const at = () => Math.round(track.scrollLeft / track.clientWidth);

    track.scrollLeft = 0;
    await wait(300);
    const start = at();

    // A gesture begins, then the scroll lands two stops away, which is what a
    // fling across the middle looks like by the time it settles.
    track.dispatchEvent(new Event('touchstart', { bubbles: true }));
    track.scrollLeft = track.clientWidth * 2;
    await wait(1400);

    return { start, landed: at(), slides: track.children.length };
  });

  const bad = (m) => { throw new Error(`md-diff-one-stop-guard: ${m}, got ${JSON.stringify(seen)}`); };
  if (seen.error) bad(seen.error);
  if (seen.slides !== 3) bad('a changed block should carry three readings');
  if (seen.start !== 0) bad('the track did not start at the first reading');
  if (seen.landed !== 1) bad('a gesture crossed two readings');

  console.log('md-diff-one-stop-guard:', JSON.stringify(seen));
}
