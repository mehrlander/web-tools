// THE PROBE BUILDS ONE CELL AT A TIME ON AN ORDINARY PAGE.
//
//   npm run shot -- pages/peek.html --width 430 --touch \
//     --script tools/render/scenarios/fab-probe.mjs
//
// Every cell tested on the device so far has been a toss, so toss-render.html
// was in all of them and could be neither ruled in nor out. ?probe= assembles
// the pieces on a page that is already a confirmed survivor, one at a time, so
// the thing that kills the tab is the thing that was added rather than the
// thing everything happened to share.
//
// This gates the probe itself, not the crash: that each piece is built, marks
// the trail, and does nothing at all when the address does not ask.

export default async function (page) {
  await page.waitForSelector('[aria-label="Web-tools panel"]', { timeout: 20000 });

  const off = await page.evaluate(async () => {
    const d = Alpine.$data(document.querySelector('[x-data*="fab"]'));
    const before = document.querySelectorAll('iframe,div').length;
    await d._probe();
    return document.querySelectorAll('iframe,div').length - before;
  });
  if (off !== 0) throw new Error(`a page that asked for no probe built ${off} elements`);

  const built = await page.evaluate(async () => {
    const d = Alpine.$data(document.querySelector('[x-data*="fab"]'));
    history.replaceState(null, '', location.pathname + '?probe=frame,nodes:500');
    const marks = [];
    const orig = d._crumb.bind(d);
    d._crumb = (s, soft) => { marks.push(s); orig(s, soft); };
    await d._probe();
    return { marks, frames: document.querySelectorAll('iframe').length,
             nodes: document.querySelectorAll('div').length };
  });
  if (!built.frames) throw new Error('the frame piece built no frame');
  if (built.nodes < 500) throw new Error(`the nodes piece built ${built.nodes}`);
  if (!built.marks.includes('probe:frame')) throw new Error(`the frame is not in the trail: ${built.marks}`);
  if (!built.marks.includes('probe:nodes:500')) throw new Error(`the nodes are not in the trail: ${built.marks}`);

  console.log('no probe builds nothing · frame and nodes both build and mark the trail');
}
