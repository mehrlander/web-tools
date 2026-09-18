// kits/md-diff.js — every reading of a change is the same height.
//
//   node tools/render/screenshot.mjs lib/kits/demos/md-diff.html \
//     --script tools/render/scenarios/md-diff-one-height.mjs \
//     --out tools/.preview/md-diff-one-height.png --width 390 --height 700
//
// This is the fix for the gesture, so it is the thing a regression would undo.
// The container used to size itself to the reading on screen, writing
// `host.style.height` from inside the scroll handler on every frame and easing
// the change over 200ms. On iOS that scroller crossed its middle stop on a
// flick and could come to rest between two stops, which mandatory snapping is
// supposed to forbid.
//
// pages/probe-snap.html settled it by hand on the device: of five tracks
// differing in one thing each, the only one that snapped was the one whose
// slides shared a height. Deferring the write, moving it before the drag, and
// removing swipe-deck's overshoot guard each changed nothing.
//
// So what is asserted is the invariant, not a simulated flick: the host box is
// one fixed height, it is the tallest reading's, and it does not move when the
// track does. A synthetic drag cannot reproduce a thumb's velocity curve, so a
// pass from one would mean nothing.
export default async function (page) {
  const seen = await page.evaluate(async () => {
    const box = document.querySelector('.md-diff-change');
    const track = box && box.querySelector('.sd-track');
    if (!track) return { slides: 0 };
    const host = track.parentElement;
    const heights = [...track.children].map((s) => {
      const c = s.firstElementChild && s.firstElementChild.firstElementChild;
      return c ? c.scrollHeight : null;
    });
    const before = host.style.height;
    // Move the track and let the deck's own scroll handling run.
    track.scrollTo({ left: track.clientWidth * 2, behavior: 'instant' });
    await new Promise((r) => setTimeout(r, 300));
    return {
      slides: track.children.length,
      heights,
      before,
      after: host.style.height,
      transition: getComputedStyle(host).transitionProperty,
      duration: getComputedStyle(host).transitionDuration,
      at: Math.round(track.scrollLeft / (track.clientWidth || 1)),
    };
  });

  const bad = (m) => { throw new Error(`md-diff-one-height: ${m}, got ${JSON.stringify(seen)}`); };
  if (seen.slides !== 3) bad('a changed block should carry three readings');
  if (seen.heights.some((h) => h == null)) bad('a reading was never built, so its height is not in the max');
  if (!seen.before) bad('the host was never given a height');
  if (seen.before !== seen.after) bad('the height still follows the reading on screen');
  if (seen.at !== 2) bad('the track did not move, so the check proved nothing');
  const tall = Math.max(...seen.heights);
  if (parseFloat(seen.before) < tall) bad(`the box is shorter than its tallest reading (${tall}px), so a reading is clipped`);
  // `transitionProperty` reads `all` by default, which covers height the
  // moment a duration exists, so the duration is the honest half of the pair.
  if (/height|all/.test(seen.transition) && parseFloat(seen.duration) > 0)
    bad('the box still animates its height, which is what broke the gesture');

  console.log('md-diff-one-height:', JSON.stringify(seen));
}
