// screenshot.mjs interaction scenario: the PROJECT VIEW's Board pill reading
// the TYPED board, board.csv, which is the read the pane declares a List
// (data/ui-units/codebook.md, "Declaring a pattern in markup").
//
//   node tools/render/screenshot.mjs app/index.html \
//     --script tools/render/scenarios/project-board-typed.mjs \
//     --out tools/.preview/project-board-typed.png
//
// project-board.mjs serves only a board.md, so the pane falls back to the
// rendered markdown and declares nothing. This one stubs a manifest with one
// stand-in workspace, `board`, and answers its tracker/board.md and board.csv
// with web-tools' own root tracker from the working tree the harness serves,
// so the rows are this repo's real tasks at this checkout and nothing private
// reaches a public shot.
export default async function (page) {
  const ok = await page.evaluate(async () => {
    if (!window.Alpine || !window.__shell || !window.GH) return 'no shell';
    window.TOKEN = 'stand-in-token';
    const shell = window.__shell;
    const store = window.Alpine.store('browser');
    const MANIFEST = { projects: ['board'] };
    const served = async (p) => {
      const r = await fetch('/' + p.replace(/^board\//, ''));
      if (!r.ok) { const e = new Error(String(r.status)); e.status = r.status; throw e; }
      return { text: await r.text() };
    };
    store.gh = {
      repo: 'mehrlander/web-tools', ref: 'main',
      async get(p) { return p === '.web-tools.json' ? { text: JSON.stringify(MANIFEST) } : served(p); },
      async req() { const e = new Error('404'); e.status = 404; throw e; },
      ago: () => 'just now',
    };
    store.defaultRef = 'main';
    store.ref = 'main';
    store.repo = 'mehrlander/web-tools';
    await new Promise(r => setTimeout(r, 300));
    shell.goProject('board', 'board');
    return true;
  });
  if (ok !== true) throw new Error('project-board-typed scenario: ' + ok);
  await page.waitForFunction(
    () => [...document.querySelectorAll('[data-pattern="list"] [data-part="item"]')].some(e => e.getClientRects().length),
    { timeout: 20000 });
  await page.waitForTimeout(400);
}
