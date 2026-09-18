// kits/md-diff.js × kits/md-doc.js — a change inside a code fence survives the
// highlighter running over the same page.
//
//   node tools/render/screenshot.mjs lib/kits/demos/md-diff.html \
//     --script tools/render/scenarios/md-diff-fence-marks.mjs \
//     --out tools/.preview/md-diff-fence-marks.png --width 390 --height 700
//
// THE BUG THIS PINS. Prism's highlightElement assigns `element.innerHTML`, so
// it replaces everything inside a `<code>` with its own token spans. md-diff
// lays its <ins>/<del> before mdDoc.contain() runs the highlighter, so on the
// one block in the demo whose edit is the point (a `--biennium` flag added to a
// shell command) the marks were built and then wiped: measured zero marks
// inside the fence, three on the rest of the page.
//
// Only a browser can answer this. The marking is correct in jsdom and stays
// correct there, because jsdom never loads Prism, so the destruction happens in
// the one realm the unit tests do not run in.
//
// It reads both halves, because a fix that simply stopped loading Prism would
// pass a one-sided check. The demo's fence appears three times, once per
// reading of the change, and only the INLINE reading carries marks: the other
// two are the control and must still be coloured.
export default async function (page) {
  const seen = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.md-diff-change pre code')].map((c) => ({
      marks: c.querySelectorAll('ins, del').length,
      tokens: c.querySelectorAll('.token').length,
      lang: c.dataset.mdMarkedLang || (c.className.match(/\blang(?:uage)?-([\w+#-]+)/) || [])[1] || '',
      text: c.textContent.trim(),
    }));
    return {
      fences: rows.length,
      marked: rows.filter((r) => r.marks).length,
      marksInFences: rows.reduce((n, r) => n + r.marks, 0),
      tokensInUnmarked: rows.filter((r) => !r.marks).reduce((n, r) => n + r.tokens, 0),
      langs: rows.map((r) => r.lang).join(','),
      marksText: rows.filter((r) => r.marks).map((r) => r.text).join(' | '),
    };
  });

  const bad = (m) => { throw new Error(`md-diff-fence-marks: ${m}, got ${JSON.stringify(seen)}`); };
  if (seen.fences < 3) bad('the edited fence should appear once per reading');
  if (!seen.marked) bad('no fence inside a change carries marks');
  if (!/biennium/.test(seen.marksText)) bad('the marked fence is not the edited one');
  // The control. Prism is loaded on this page and highlights what it is still
  // allowed to touch, so zero tokens anywhere would mean the check proved only
  // that nothing highlighted.
  if (seen.tokensInUnmarked < 1) bad('nothing highlighted, so the marks prove nothing');
  if (!/sh/.test(seen.langs)) bad('the fence lost the language it declared');

  // AND THE OTHER LAYOUT, which marks by a different route. Side by side runs
  // mark() once per column with the `old` and `new` side modes, so the fix has
  // to hold on a tree the swipe reading never builds.
  await page.click('[data-layout="side"]');
  await page.waitForTimeout(400);
  const paired = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.md-diff-change pre code')].map((c) => ({
      marks: c.querySelectorAll('ins, del').length,
      tokens: c.querySelectorAll('.token').length,
    }));
    return {
      fences: rows.length,
      marksInFences: rows.reduce((n, r) => n + r.marks, 0),
      tokensInUnmarked: rows.filter((r) => !r.marks).reduce((n, r) => n + r.tokens, 0),
    };
  });
  if (!paired.marksInFences) throw new Error(`md-diff-fence-marks: side by side lost its fence marks, got ${JSON.stringify(paired)}`);

  console.log('md-diff-fence-marks:', JSON.stringify({ swipe: seen, side: paired }));
}
