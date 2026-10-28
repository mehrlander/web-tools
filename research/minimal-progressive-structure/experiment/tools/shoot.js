// Screenshots and mechanical measures for every page in experiment/pages.
// Usage: node shoot.js <pages-dir> <out-dir>
// Writes <out-dir>/<name>.desktop.png (1440x900 first screen), .phone.png
// (390x844 first screen), .full.png (desktop full page, capped), and
// <out-dir>/measures.json.
// The global Playwright matches the browser installed at /opt/pw-browsers; a
// checkout's own pinned copy may not, so prefer the global one when present.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const fs = require('fs'), path = require('path');
const [pagesDir, outDir] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });

const measure = () => {
  const vis = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const inFold = el => { const r = el.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0 && r.left < innerWidth; };
  const textNodes = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) { const n = w.currentNode; if (n.textContent.trim() && n.parentElement && vis(n.parentElement)) textNodes.push(n); }
  const words = ns => ns.reduce((a, n) => a + n.textContent.trim().split(/\s+/).length, 0);
  const foldNodes = textNodes.filter(n => inFold(n.parentElement));
  const clickable = el => [...el.attributes].some(a => a.name === '@click' || a.name.startsWith('@click.') || a.name.startsWith('x-on:click'));
  const controls = [...document.querySelectorAll('body *')].filter(el => el.matches('button, a[href], summary, [role=tab], input, select') || clickable(el)).filter(vis);
  return {
    words_visible: words(textNodes),
    words_first_screen: words(foldNodes),
    controls_visible: controls.length,
    stat_classes: document.querySelectorAll('.stat, .stats, .stat-value').length,
    details_elements: document.querySelectorAll('details').length,
    tables: document.querySelectorAll('table').length,
    dialogs: document.querySelectorAll('dialog, .modal').length,
    scroll_height: document.documentElement.scrollHeight,
    h_overflow: document.documentElement.scrollWidth > innerWidth + 1,
  };
};

(async () => {
  const browser = await chromium.launch();
  const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.html')).sort();
  const out = {};
  for (const f of files) {
    const name = f.replace(/\.html$/, ''), url = 'file://' + path.resolve(pagesDir, f);
    out[name] = {};
    for (const [vp, size] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
      const page = await browser.newPage({ viewport: size, deviceScaleFactor: vp === 'phone' ? 2 : 1 });
      const errors = []; page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(e => errors.push('goto: ' + e.message.slice(0, 120)));
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(outDir, `${name}.${vp}.png`) });
      if (vp === 'desktop') {
        const h = await page.evaluate(() => document.documentElement.scrollHeight);
        await page.screenshot({ path: path.join(outDir, `${name}.full.png`), fullPage: true, clip: h > 9000 ? { x: 0, y: 0, width: 1440, height: 9000 } : undefined });
      }
      out[name][vp] = { ...(await page.evaluate(measure)), errors };
      await page.close();
    }
  }
  fs.writeFileSync(path.join(outDir, 'measures.json'), JSON.stringify(out, null, 1));
  await browser.close();
  console.log(`shot ${files.length} pages to ${outDir}`);
})();
