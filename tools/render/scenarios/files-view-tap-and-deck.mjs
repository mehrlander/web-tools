// The repo Files view (alpineComponents/file-browser.js), driven by taps, 2026-09-24.
//
// Asserts rather than only photographs, and throws on a miss so screenshot.mjs
// exits 1. Written after a tapped file loaded and stayed hidden while a file
// opened from the address rendered, so a shot of the second case passed for
// both. Checks the one position both ways: a tap in the tree moves the swiper,
// and a move in the swiper or the deck moves the tree's selection. Run through
// tools/test/files-view-browser.mjs, against this checkout's own tree (docs/),
// which the renderer serves offline.
export default async (page) => {
  const data = () => page.evaluate(() => {
    const d = Alpine.$data(document.querySelector('[data-file-browser]').parentElement);
    const v = document.querySelector('[data-slide="' + d.at + '"] [data-file-viewer]');
    return { sel: d.sel, at: d.at, picked: d.picker?.picked || '', folder: d.folderFiles.length,
             shown: !!v?.offsetParent, mode: v?.__viewer?.mode || '',
             text: (v?.innerText || '').trim().length };
  });
  const fail = (what, got) => { throw new Error('files-view: ' + what + ' ' + JSON.stringify(got)); };
  const until = (fn, arg) => page.waitForFunction(fn, arg, { timeout: 10000 }).then(() => true, () => false);
  await page.waitForSelector('[data-file-browser] [role=option]', { timeout: 20000 });
  // A folder opens on its first file, not an empty lower half.
  if (!await until(() => {
    const d = Alpine.$data(document.querySelector('[data-file-browser]').parentElement);
    return d.at === 0 && d.sel === d.folderFiles[0];
  })) fail('a folder must open on its first file', await data());
  await page.locator('[data-file-browser] [role=option]', { hasText: 'README.md' }).first().click();
  // Visible is not shown: the reader must have been handed the file (a mode)
  // and drawn something. The frame alone passed while it was empty.
  await until(() => {
    const d = Alpine.$data(document.querySelector('[data-file-browser]').parentElement);
    return !!document.querySelector('[data-slide="' + d.at + '"] [data-file-viewer]')?.__viewer?.mode;
  });
  await page.waitForTimeout(1000);
  let s = await data();
  if (s.sel !== 'docs/README.md' || s.at < 0 || !s.shown || !s.mode || s.text < 20) fail('a tapped file must show below', s);
  if (s.picked !== s.sel) fail('the tapped row must stay selected', s);
  if (s.folder < 2) fail('the folder must list its files for the swiper', s);
  // A move below moves the selection above.
  await page.locator('[data-strip]').hover();
  await page.keyboard.press('ArrowRight');
  if (!await until(() => Alpine.$data(document.querySelector('[data-file-browser]').parentElement).sel !== 'docs/README.md'))
    fail('a swipe below must move the selection', await data());
  await page.waitForTimeout(800);
  s = await data();
  if (s.picked !== s.sel) fail('the tree must follow the swiper', s);
  // One row lit, not two: a tap left the picker's cursor on the tapped row.
  const lit = await page.evaluate(() => [...document.querySelectorAll('[data-file-browser] [role=option]')]
    .filter(r => r.className.includes('bg-primary/10')).map(r => r.getAttribute('title')));
  if (lit.length !== 1) fail('exactly one row must be lit after a swipe', { ...s, lit });
  const before = s.sel;
  // And the full deck moves it too.
  await page.locator('[data-deck-door]').click();
  await page.waitForTimeout(2000);
  await page.keyboard.press('ArrowRight');
  if (!await until((b) => Alpine.$data(document.querySelector('[data-file-browser]').parentElement).sel !== b, before))
    fail('a swipe in the deck must move the selection', await data());
  s = await data();
  if (s.picked !== s.sel) fail('the tree must follow the deck', s);
  console.log('CHECK OK files-view', JSON.stringify(s));
};
