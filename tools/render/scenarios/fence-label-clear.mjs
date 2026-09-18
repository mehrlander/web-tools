// kits/md-doc.js — a fenced block's language label sits where nothing else is.
//
//   node tools/render/screenshot.mjs lib/kits/demos/md-diff.html \
//     --script tools/render/scenarios/fence-label-clear.mjs \
//     --out tools/.preview/fence-label-clear.png --width 390 --height 700
//
// The label is absolutely positioned inside the pre, so where it lands is a
// question about layout and only a browser can answer it. It has been wrong
// twice, in two different ways, and both were reported from a phone:
//
//   against the CODE   at the top right it ran y4 to y14 while the first line
//                      began at y11, so any line reaching the right edge, which
//                      at 390px is most of them, had the language on top of it.
//   against the HOST'S CHROME   a host may hang its own controls over a block's
//                      top edge, and kits/md-diff.js does. On a change whose
//                      whole content is a fence, the label landed inside the
//                      readings pill: 4px of vertical overlap across its full
//                      width. Top left was no better, ending exactly where the
//                      index badge began.
//
// So the assertions are the three non-collisions rather than a position, which
// is what lets the corner move again without rewriting this file. The demo page
// is the fixture because it puts a fence inside the busiest chrome in the
// estate; a plain guide body is the easy case.
export default async function (page) {
  const out = await page.evaluate(() => {
    const box = [...document.querySelectorAll('.md-diff-change')].find((x) => x.querySelector('pre'));
    if (!box) return { error: 'no change in the fixture carries a fence' };
    // The pre on the ACTIVE slide. The track holds three and the other two are
    // scrolled off, so a bare querySelector reports coordinates for a pre
    // nobody can see, which is a reading that looks fine and means nothing.
    const track = box.querySelector('.sd-track');
    const pre = track.children[Math.round(track.scrollLeft / (track.clientWidth || 1))]
      .querySelector('pre');
    const label = pre && pre.querySelector('.md-fence-lang');
    if (!label) return { error: 'the fence carries no language label' };

    const r = (e) => {
      const b = e.getBoundingClientRect();
      return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), b: Math.round(b.bottom) };
    };
    const hit = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
    const L = r(label);
    return {
      text: label.textContent,
      hitsIndex: hit(L, r(box.children[0])),
      hitsStops: hit(L, r(box.children[1])),
      hitsCode: hit(L, r(pre.querySelector('code'))),
      inside: L.l >= r(pre).l && L.r <= r(pre).r,
    };
  });

  if (out.error) throw new Error('fence-label-clear: ' + out.error);
  for (const k of ['hitsIndex', 'hitsStops', 'hitsCode']) {
    if (out[k]) throw new Error(`fence-label-clear: the label overlaps (${k})`);
  }
  if (!out.inside) throw new Error('fence-label-clear: the label is outside its own block');
  // And it says a word. `sh` was reported as unreadable, which is fair of a
  // two-letter label, so the opaque tokens are spelled out.
  if (out.text.length < 3) throw new Error(`fence-label-clear: the label reads "${out.text}"`);

  console.log('fence-label-clear:', JSON.stringify(out));
}
