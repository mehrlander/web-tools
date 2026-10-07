// Real-browser verification pass: drive pages/console-playground.html through
// Chromium and exercise everything jsdom's inert layout can't — visible,
// census geoReg, style-grow discrimination, harvest on true virtualization,
// tap.walk offline pagination, veins, geometric join, lasso via synthetic
// pointer events. Prints a JSON result; nonzero exit on any failure.
import { chromium } from 'playwright';
import path from 'node:path';

const page_url = 'file://' + path.resolve('pages/console-playground.html');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
await page.goto(page_url);
await page.waitForSelector('#feed .feed-row');

const results = await page.evaluate(async () => {
  const out = {};
  const assert = (name, cond, detail) => { out[name] = { pass: !!cond, detail }; };

  // 1. visible engine (always empty under jsdom)
  const vis = q('#bills tbody tr >> visible').length;
  assert('visible', vis === 8, `${vis} visible rows`);

  // 2. census: real geoReg on a real layout
  const groups = census(20, { min: 3, mark: true });
  const feedGrp = groups.find(g => g.path.endsWith('feed-row')) ?? groups.find(g => g.path.includes('div') && g.count >= 10);
  const anyGeo = groups.filter(g => g.geoReg > 0.5).length;
  assert('census-geoReg', anyGeo >= 2, `${anyGeo} groups with geoReg > .5; top: ${groups[0].path} (${groups[0].count}, ${groups[0].geoReg})`);

  // 3. templates: hashy card classes become slots
  glom.clear();
  glom(q('#cards div'));
  const tmpl = glom.templates();
  const slotted = tmpl.find(t => /hash-\$\{0\}/.test(t.template));
  assert('templates-slots', slotted && slotted.count === 7, slotted?.template);

  // 4. style-grow discriminates in real layout (soup rows vs cards, both divs)
  glom.clear();
  glom([document.querySelectorAll('#soup > div')[0]]);
  const grown = glom.grow({ by: 'style' });
  assert('style-grow', grown.length === 10 && [...grown].every(n => n.parentElement.id === 'soup'),
    `${grown.length} matched (want exactly the 10 soup rows, not cards)`);

  // 5. harvest a truly virtualized feed
  glom.clear();
  const feed = document.getElementById('feed');
  const records = await glom.harvest({ selector: '#feed .feed-row', scroll: () => feed.scrollBy(0, 150), settle: 90, dry: 4 });
  assert('harvest-virtualized', records.length === 60, `${records.length}/60 records`);

  // 6. tap.walk: the whole dataset off one captured request
  tap(/fake-api/);
  await fetch('/fake-api/bills?page=1');
  await new Promise(r => setTimeout(r, 30));
  const pages = await tap.walk(0, { param: 'page', from: 1, to: 9, delay: 10, until: d => !d?.rows?.length });
  const total = pages.reduce((a, p) => a + p.data.rows.length, 0);
  assert('tap-walk', pages.length === 5 && total === 60, `${pages.length} pages, ${total} rows`);

  // 7. veins: rendered page-1 rows join back to the payload
  document.getElementById('load').click();
  await new Promise(r => setTimeout(r, 50));
  glom.clear();
  const fields = glom.veins(pages[0].data);
  const bill = fields.find(f => f.field === 'rows[].bill');
  assert('veins', bill && bill.count >= 12, `${bill?.field} coverage ${bill?.coverage}, ${bill?.count} els`);

  // 8. geometric join: bill link left of its status cell, same row
  glom(q('#bills tbody a')); glom.save('links');
  glom(q('#bills tbody td:nth-child(2)')); glom.save('statuses');
  const pairs = glom.join('links', 'statuses', 'left-of');
  const rowsAligned = pairs.length === 8 && pairs.every(p => p.a.closest('tr') === p.b.closest('tr'));
  assert('join-geometry', rowsAligned, `${pairs.length} pairs, row-aligned: ${rowsAligned}`);

  // 9. lasso via synthetic pointer events around #soup
  glom.clear();
  const soup = document.getElementById('soup').getBoundingClientRect();
  const lassoP = glom.lasso();
  const veil = document.getElementById('glom-lasso-veil');
  const fire = (type, x, y) => veil.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }));
  fire('pointerdown', soup.left - 4, soup.top - 4);
  fire('pointermove', soup.right + 4, soup.top + 90);
  fire('pointerup', soup.right + 4, soup.top + 92);   // rectangle over the first ~3 rows
  const picked = await lassoP;
  assert('lasso-geometry', picked.length >= 2 && picked.length <= 4 && [...picked].every(n => n.parentElement.id === 'soup'),
    `${picked.length} rows lassoed`);

  // 10. recipe survived the whole session
  const script = glom.recipe();
  assert('recipe', script.includes('glom.grow') && script.includes('glom.join'), `${glom.recipe.trail.length} entries`);

  // 11. scan: durable poll-scroll of the virtualized feed into IndexedDB
  glom.clear();
  const feedEl = document.getElementById('feed');
  feedEl.scrollTop = 0;
  try {
    glom.scan.db('pass-scan');
    await glom.scan.clear();                                  // start from empty store
    await glom.scan.define('feed', { selector: '#feed .feed-row', format: el => ({ key: el.textContent, text: el.textContent }) });
    const captured = await glom.scan.sweep({ scroll: () => feedEl.scrollBy(0, 150), settle: 90, dry: 4 });
    const persisted = glom.scan.data('feed').length;
    const grabbed = glom.scan.grab('feed').length;            // only the ~12 rows still in the DOM
    await glom.scan.clear();                                  // leave the store clean
    assert('scan-idb', captured === 60 && persisted === 60 && grabbed > 0 && grabbed < 60,
      `${captured} captured, ${persisted} persisted, grab re-selected ${grabbed} live rows`);
  } catch (e) {
    assert('scan-idb', false, `threw: ${e.message}`);
  }

  return out;
});

// Re-mark census groups for the screenshot, then capture.
await page.evaluate(() => { glom.clear(); glom.templates.clear(); census(8, { min: 4 }); });
await page.screenshot({ path: process.env.SHOT_PATH || 'playground-census.png', fullPage: true });
await browser.close();

let failed = 0;
for (const [name, r] of Object.entries(results)) {
  console.log(`${r.pass ? 'ok  ' : 'FAIL'} ${name}${r.detail ? ` — ${r.detail}` : ''}`);
  if (!r.pass) failed++;
}
process.exit(failed ? 1 : 0);
