// kits/md-track.js: typing over the viewer's rendered markdown, in a browser.
//
//   node node/render/screenshot.mjs pages/data-view.html --hash 'item=README.md' \
//     --script node/render/scenarios/md-track.mjs \
//     --out node/.preview/md-track.png --width 700 --height 700
//
// node/test/md-track.test.mjs holds the edit each input makes to the string.
// What it cannot see is the platform's part: a real key over a real selection
// in the Preview, the redline drawn in its place, the caret put back where the
// typing goes on, a selection deleted, and undo. Each step reads the kit's text,
// the redline's marks and the caret's offset, and the run fails on the first
// that is not what the step expects. MD_TRACK_STOP=<step> stops there for the
// shot.
const word = (w) => `(() => {
  const box = document.querySelector('.prose');
  const tw = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const i = n.data.indexOf(${JSON.stringify(w)});
    if (i < 0) continue;
    const r = document.createRange();
    r.setStart(n, i); r.setEnd(n, i + ${JSON.stringify(w)}.length);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    return true;
  }
  return false;
})()`;

export default async function (page) {
  await page.waitForFunction(() => document.querySelector('.prose h1') && window.mdTrack && document.querySelector('.prose').__mdTrack);
  const read = () => page.evaluate(() => {
    const box = document.querySelector('.prose'), h = box.__mdTrack;
    const s = getSelection();
    let caret = null;
    if (s.rangeCount && window.MdSurface) caret = window.MdSurface.offsetOf(box, s.anchorNode, s.anchorOffset, 'end');
    return {
      text: h.text, tracked: h.tracked, editing: h.editing, editable: box.isContentEditable,
      marks: [...box.querySelectorAll('[data-md-redline]')].map((e) => e.dataset.mdRedline),
      ins: [...box.querySelectorAll('ins')].map((e) => e.textContent),
      del: [...box.querySelectorAll('del')].map((e) => e.textContent),
      bar: document.querySelector('[data-md-track-count]')?.textContent || '', caret,
    };
  });
  const settle = () => page.waitForTimeout(250);
  const stop = process.env.MD_TRACK_STOP || '';
  const steps = [];
  const check = (name, got, ok) => {
    steps.push({ name, ok: !!ok, got });
    if (!ok) throw new Error('md-track: step "' + name + '" failed: ' + JSON.stringify(got));
  };

  // 1. A key over a selected word: the word is replaced, the reading becomes the redline.
  if (!(await page.evaluate(word('Two shapes')))) throw new Error('md-track: no "Two shapes" in the render');
  await page.keyboard.press('F');
  await page.waitForFunction(() => document.querySelector('.prose').__mdTrack.tracked && document.querySelector('.prose ins'));
  await settle();
  let r = await read();
  check('replace', r, r.text.includes('F, one page.') && r.editing && r.editable && r.marks.includes('changed')
        && r.del.some((d) => /Two shapes/.test(d)));

  // 2. Typing goes on at the caret, through the platform's own input events.
  await page.keyboard.type('our forms');
  await settle();
  r = await read();
  check('type on', r, r.text.includes('Four forms, one page.') && r.ins.some((t) => /Four forms/.test(t)));
  if (stop === 'type') return;

  // 3. Done, then a selection deleted with Backspace: tracked, not editing.
  await page.keyboard.press('Escape');
  await page.evaluate(word('The reader tells them apart.'));
  await page.keyboard.press('Backspace');
  await settle();
  r = await read();
  check('delete', r, !r.text.includes('The reader tells them apart.') && r.text.includes('Neither has to be declared.')
        && r.del.some((d) => /reader tells them apart/.test(d)) && /2/.test(r.bar));
  if (stop === 'delete') return;

  // 4. Undo takes the deletion back; the replacement stays.
  await page.evaluate(() => document.querySelector('.prose').__mdTrack.undo());
  await settle();
  r = await read();
  check('undo', r, r.text.includes('The reader tells them apart.') && r.text.includes('Four forms'));

  // 5. The patch is a unified diff of the edit.
  const patch = await page.evaluate(() => document.querySelector('.prose').__mdTrack.patch());
  check('patch', patch, /^diff --git a\/README\.md b\/README\.md/.test(patch) && /^-Two shapes, one page\.$/m.test(patch)
        && /^\+Four forms, one page\.$/m.test(patch));
  console.log('md-track: ' + JSON.stringify(steps.map((s) => s.name + (s.ok ? ' ok' : ' FAIL'))));
}
