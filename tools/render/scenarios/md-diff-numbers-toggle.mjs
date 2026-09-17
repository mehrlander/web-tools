// kits/md-diff.js — the line gutter moves without the page moving.
//
//   node tools/render/screenshot.mjs lib/kits/demos/md-diff.html \
//     --script tools/render/scenarios/md-diff-numbers-toggle.mjs \
//     --out tools/.preview/md-diff-numbers-toggle.png --width 390 --height 700
//
// THE BUG THIS PINS, AND WHY THE OBVIOUS ASSERTION WOULD HAVE MISSED IT. The
// demo's first toggle reloaded the page with a different `?numbers=` query. At
// the page's own URL that works, and a probe that clicked the button and
// counted `.md-numbered` afterwards reported it working, because the reload
// landed on a page with the gutter on.
//
// It is dead in a toss. The framed document's location is a `blob:` URL, so
// assigning `location.search` navigates it to a blob the store has never heard
// of: the frame goes white and `contentDocument` reads as nothing. Measured on
// this branch's own demo, and every branch render is handed over as a toss, so
// the control was broken exactly where a reader meets it and working only where
// nobody does.
//
// So the assertion that separates the two versions is NOT that the gutter
// appears. It is that the document the reader is on does not move: same
// `location.href` before and after, and the same rendered tree around it. That
// is checkable on the plain page, where a scenario can be pinned, while a toss
// run needs a SHA in its address and goes stale the moment the branch does.
//
// The round trip is the second half. Taking the gutter off unwraps the line
// elements rather than re-rendering, so the block keeps whatever Prism gave it;
// a version that restored from source would pass a count and lose every token.
export default async function (page) {
  const at = () => page.evaluate(() => ({
    href: location.href,
    numbered: document.querySelectorAll('pre.md-numbered').length,
    lines: document.querySelectorAll('.md-line').length,
    tokens: document.querySelectorAll('pre .token').length,
    fences: document.querySelectorAll('pre > code').length,
    changes: document.querySelectorAll('.md-diff-change').length,
    marks: document.querySelectorAll('.md-diff-change ins, .md-diff-change del').length,
    active: /btn-active/.test(document.getElementById('numbers').className),
  }));

  const rest = await at();
  const bad = (m, s) => { throw new Error(`md-diff-numbers-toggle: ${m}, got ${JSON.stringify(s)}`); };
  if (rest.numbered) bad('the demo should open with the gutter off', rest);
  if (rest.tokens < 1) bad('nothing highlighted, so the round trip proves nothing', rest);

  await page.click('#numbers');
  await page.waitForTimeout(700);
  const on = await at();
  if (on.href !== rest.href) bad('the toggle navigated, which is what a toss cannot survive', on);
  if (!on.numbered || !on.lines) bad('the gutter did not arrive', on);
  if (!on.active) bad('the button should show its state', on);
  if (on.changes !== rest.changes || on.marks !== rest.marks) bad('the rebuild lost a change or its marks', on);

  await page.click('#numbers');
  await page.waitForTimeout(700);
  const off = await at();
  if (off.href !== rest.href) bad('the toggle navigated on the way back', off);
  if (off.numbered || off.lines) bad('the gutter did not come off', off);
  if (off.fences !== rest.fences) bad('unwrapping lost a fence', off);
  if (off.tokens !== rest.tokens) bad('unwrapping threw away the highlighting', off);
  if (off.marks !== rest.marks) bad('unwrapping lost a mark', off);

  // And back on, because a one-way toggle is the failure a WeakMap that never
  // releases its entry produces, and it looks identical to a working one until
  // the second press.
  await page.click('#numbers');
  await page.waitForTimeout(700);
  const again = await at();
  if (again.lines !== on.lines) bad('the second press did not restore the gutter', again);

  console.log('md-diff-numbers-toggle:', JSON.stringify({ rest, on, off, again }));
}
