// kits/md-doc.js — the line gutter, its threshold, and the two things it has to
// survive.
//
//   node tools/render/screenshot.mjs lib/kits/demos/md-diff.html \
//     --query numbers=8 --script tools/render/scenarios/md-diff-line-numbers.mjs \
//     --out tools/.preview/md-diff-line-numbers.png --width 390 --height 700
//
// Three things only a browser can answer, and each has a way of being wrong
// that reads as working:
//
//   THE COUNT      the numbers come from a CSS counter over one element per
//                  line, so a splitter that dropped or doubled a line still
//                  renders a tidy column of numbers. The assertion is the
//                  element count against the source's own line count.
//   THE ORDER      Prism assigns innerHTML, so a gutter built before the
//                  highlighter is thrown away by it, and a highlighter that ran
//                  second would also read a textContent with the newlines
//                  already removed and paint the block as one line. Both halves
//                  have to be present on the same block at the same time.
//   REGISTER       the number sits at the top left of its line's own block, so
//                  a line that wraps to two visual rows keeps one number. A
//                  fixed-row gutter cannot do this, which is why Prism's own
//                  line-numbers plugin is not what draws it. The assertion is
//                  that a wrapped line is taller than an unwrapped one while
//                  the numbers still descend in order.
export default async function (page) {
  const seen = await page.evaluate(() => {
    const pres = [...document.querySelectorAll('pre')];
    const rows = pres.map((pre) => {
      const code = pre.querySelector('code');
      const lines = [...pre.querySelectorAll('.md-line')];
      const hs = lines.map((l) => Math.round(l.getBoundingClientRect().height));
      return {
        heights: hs,
        // A line that takes two visual rows is twice the height of one that
        // takes one, which is the only evidence that wrapping happened at all.
        wrapped: hs.filter((h) => h > Math.min(...hs, Infinity) * 1.5).length,
        // An empty line still has to occupy one row, or the block loses the
        // blank lines the source had and the numbers stop matching it.
        empty: lines.filter((l) => !l.textContent).length,
        emptyTall: lines.filter((l) => !l.textContent && l.getBoundingClientRect().height > 4).length,
        numbered: pre.classList.contains('md-numbered'),
        lines: lines.length,
        declared: Number(code && code.dataset.mdLines) || 0,
        tokens: pre.querySelectorAll('.token').length,
        gutter: pre.style.getPropertyValue('--md-gutter'),
        firstWords: (code ? code.textContent : '').trim().slice(0, 24),
      };
    });
    return { pres: pres.length, rows };
  });

  const bad = (m) => { throw new Error(`md-diff-line-numbers: ${m}, got ${JSON.stringify(seen)}`); };
  const numbered = seen.rows.filter((r) => r.numbered);
  const plain = seen.rows.filter((r) => !r.numbered);

  if (!numbered.length) bad('nothing got a gutter');
  if (!plain.length) bad('the threshold numbered every fence, so it is not gating');

  for (const r of numbered) {
    // The fixture's long fence is thirteen lines, three of them blank.
    // Anything else means the splitter lost a line or invented one, which a
    // tidy column of numbers hides rather than shows.
    if (r.lines !== 13) bad(`a numbered fence should carry its own line count, saw ${r.lines}`);
    if (r.empty !== 3) bad(`the blank lines should survive, saw ${r.empty}`);
    if (r.emptyTall !== r.empty) bad('a blank line collapsed to nothing, so the numbers no longer match the source');
    if (r.declared !== r.lines) bad('the block and its line elements disagree');
    if (r.tokens < 1) bad('a numbered fence lost its highlighting, so the two passes are fighting');
    if (r.wrapped < 1) bad('no line wrapped at this width, so register is untested');
    if (r.gutter !== '2ch') bad(`the gutter should be sized to the widest number, saw ${r.gutter}`);
  }
  // And the short fence, the one the edit is in, stays plain: at one line a
  // gutter is a column of nothing beside a column of nothing.
  if (!plain.some((r) => /allotment/.test(r.firstWords))) bad('the one-line command should be below the minimum');

  console.log('md-diff-line-numbers:', JSON.stringify(seen));
}
