// screenshot.mjs interaction scenario: show the FAB's Export controls.
//
//   node tools/render/screenshot.mjs pages/demos/sheet-modal-demo.html \
//     --script tools/render/scenarios/fab-export.mjs --out tools/.preview/fab-export.png
//
// The FAB opens via pointer-based drag/tap detection (onUp) with a 300ms slide,
// which synthetic input doesn't drive reliably and isn't what we're proving — and
// its render-tab content is gated by <template x-if="path">, where `path` is
// inferred from a *.github.io URL (empty on the loopback host). So we put the
// component into the state it has on a real Pages URL — repo+path set, panel open,
// Render tab active — through its own Alpine data, then exercise the real control:
// tick "Fully offline" (x-model="exportOffline") so the proof shows the toggle
// wired and the button label reacting.
export default async function (page) {
  const ok = await page.evaluate(() => {
    const host = [...document.querySelectorAll('[x-data]')]
      .find(el => (el.getAttribute('x-data') || '').includes('fab'));
    if (!host || !window.Alpine) return false;
    const d = window.Alpine.$data(host);
    d.repo = d.repo || 'mehrlander/web-tools';
    d.path = d.path || location.pathname.replace(/^\/+/, '');   // what github.io would infer
    d.open = true;
    d.activeTab = 'render';
    return true;
  });
  if (!ok) throw new Error('FAB host / Alpine not found');
  await page.waitForTimeout(600);                               // x-if instantiate + slide
  await page.check('input[x-model="exportOffline"]', { force: true });
  await page.waitForTimeout(200);
}
