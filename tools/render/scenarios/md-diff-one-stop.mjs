// kits/md-diff.js — a flick moves one reading, not two.
//
//   node tools/render/screenshot.mjs lib/kits/demos/md-diff.html \
//     --script tools/render/scenarios/md-diff-one-stop.mjs \
//     --out tools/.preview/md-diff-one-stop.png --width 390 --height 700
//
// `snap-mandatory` says where a scroll may come to REST, not how far one
// gesture may carry it: momentum crosses as many snap points as it has speed
// for. On a three-stop track that skips the middle reading, which is the marked
// one and the one a reader is usually going to, and lands on the far side. A
// reader reported exactly that.
//
// AND THE PROPERTY DID NOT FIX IT. Measured by hand on iOS through
// pages/probe-snap.html: `scroll-snap-stop: always` is applied, computes as
// `always`, and a flick still crossed the middle. What fixed it was giving
// every reading one height, which md-diff-one-height.mjs asserts. The property
// stays because it is correct where an engine honours it and free where it is
// not, so this scenario pins a declaration rather than a cure.
//
// What is asserted is the property, not a simulated flick. `scroll-snap-stop`
// is a guarantee the engine makes about momentum, and a synthetic drag in a
// headless browser does not reproduce a thumb's velocity curve well enough for
// a pass or a fail to mean anything. The honest check is that every slide of a
// change carries the rule, and that a deck which does NOT ask for it is
// unchanged, since the cost lands on a deck that is flicked through rather than
// stepped.
export default async function (page) {
  const seen = await page.evaluate(() => {
    const track = document.querySelector('.md-diff-change .sd-track');
    const slides = track ? [...track.children] : [];
    const other = [...document.querySelectorAll('.sd-track')].filter((t) => !t.closest('.md-diff-change'));
    return {
      slides: slides.length,
      stop: slides.map((s) => getComputedStyle(s).scrollSnapStop),
      align: slides.map((s) => getComputedStyle(s).scrollSnapAlign),
      trackType: track ? getComputedStyle(track).scrollSnapType : '',
      otherDecks: other.length,
      otherStop: other.flatMap((t) => [...t.children].map((s) => getComputedStyle(s).scrollSnapStop)),
    };
  });

  const bad = (m) => { throw new Error(`md-diff-one-stop: ${m}, got ${JSON.stringify(seen)}`); };
  if (seen.slides !== 3) bad('a changed block should carry three readings');
  if (!seen.stop.every((v) => v === 'always')) bad('a flick can still cross two readings');
  if (!seen.align.every((v) => /center/.test(v))) bad('the slides stopped snapping at all');
  if (!/mandatory/.test(seen.trackType)) bad('the track stopped snapping at all');
  if (seen.otherStop.some((v) => v === 'always')) bad('a deck that did not ask for it got it anyway');

  console.log('md-diff-one-stop:', JSON.stringify(seen));
}
