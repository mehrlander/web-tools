// The repo Files view (alpineComponents/file-browser.js), driven by taps, 2026-09-24.
//
// Asserts rather than only photographs, and throws on a miss so screenshot.mjs
// exits 1. Written after a tapped file loaded and stayed hidden while a file
// opened from the address rendered, so a shot of the second case passed for
// both. Run through tools/test/files-view-browser.mjs, against this checkout's
// own tree (docs/), which the renderer serves offline.
export default async (page) => {
  const data = () => page.evaluate(() => {
    const d = Alpine.$data(document.querySelector('[data-file-browser]').parentElement);
    return { file: d.file, busy: d.busy, note: d.note, folder: d.folderFiles.length,
             shown: !!document.querySelector('[data-file-viewer]')?.offsetParent,
             mode: document.querySelector('[data-file-viewer]')?.__viewer?.mode || '',
             text: (document.querySelector('[data-file-viewer]')?.innerText || '').trim().length };
  });
  const fail = (what, got) => { throw new Error('files-view: ' + what + ' ' + JSON.stringify(got)); };
  await page.waitForSelector('[data-file-browser] [role=option]', { timeout: 20000 });
  await page.locator('[data-file-browser] [role=option]', { hasText: 'README.md' }).first().click();
  await page.waitForFunction(() => {
    const d = Alpine.$data(document.querySelector('[data-file-browser]').parentElement);
    return d.file && !d.busy;
  }, null, { timeout: 15000 });
  let s = await data();
  // Visible is not shown: the reader must have been handed the file (a mode)
  // and drawn something. The frame alone passed while it was empty.
  await page.waitForFunction(() => !!document.querySelector('[data-file-viewer]')?.__viewer?.mode, null, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1500);
  s = await data();
  if (s.file !== 'docs/README.md' || !s.shown || s.note || !s.mode || s.text < 20) fail('a tapped file must show in the reader', s);
  if (s.folder < 2) fail('the folder must list its files for the deck', s);
  await page.locator('[data-file-browser] button:has(.ph-cards-three)').click();
  await page.waitForTimeout(2000);
  await page.keyboard.press('ArrowRight');
  const moved = await page.waitForFunction(() =>
    Alpine.$data(document.querySelector('[data-file-browser]').parentElement).file !== 'docs/README.md',
    null, { timeout: 10000 }).then(() => true, () => false);
  s = await data();
  if (!moved) fail('a swipe in the deck must move the pane to the next file', s);
  console.log('CHECK OK files-view', JSON.stringify(s));
};
