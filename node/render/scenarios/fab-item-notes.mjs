import assert from 'node:assert/strict';

export default async function (page) {
  page.setDefaultTimeout(20000);
  const about = id => 'mehrlander/web-tools:skills/peeves/peeves.csv#' + id;
  let stored = [{ id: 'npreview1', at: '2026-10-28T01:00:00Z', author: 'mehrlander',
    about: about('P18'), text: 'A valid justification can still leave the choice wrong.' }];
  let fail = false, writes = 0;
  // Exercise the real browser writer against a local fixture, never the private repo.
  await page.route('**/repos/mehrlander/web-tools-private/contents/notes/notes.jsonl*', async route => {
    if (route.request().method() === 'PUT') {
      writes++;
      if (fail) return route.fulfill({ status: 503, json: { message: 'Preview offline' } });
      stored = Buffer.from(route.request().postDataJSON().content, 'base64').toString('utf8').trim().split('\n').map(JSON.parse);
      return route.fulfill({ json: { content: { sha: 'preview-' + writes } } });
    }
    return route.fulfill({ json: { sha: 'preview-' + writes, encoding: 'base64',
      content: Buffer.from(stored.map(n => JSON.stringify(n)).join('\n') + '\n').toString('base64') } });
  });
  await page.route('https://api.github.com/user', route => route.fulfill({ json: { login: 'mehrlander' } }));
  await page.waitForFunction(() => document.querySelector('[data-peeve-card] .sd-track'));
  await page.locator('[data-peeve-list] [data-row="P18"]').click();
  await page.getByRole('button', { name: 'Web-tools panel', exact: true }).click();
  const panel = page.locator('[data-fab-about]');
  const form = panel.locator('[data-fab-note-form]');
  const input = form.getByRole('textbox', { name: 'Note', exact: true });
  const save = form.getByRole('button', { name: 'Save note', exact: true });
  await panel.waitFor({ state: 'visible' });
  assert.equal(await page.getByRole('tab', { name: 'Note', exact: true }).count(), 0);
  assert.equal(await panel.locator('details, summary').count(), 0);
  await page.waitForFunction(() => document.querySelector('[data-fab-note-subject]')?.textContent === 'P18 · Shallow defense');
  await input.fill('A second thought about shallow defense.');
  await save.click();
  await form.getByRole('status').filter({ hasText: 'Not saved:' }).waitFor();
  assert.equal(await input.inputValue(), 'A second thought about shallow defense.', 'a missing token keeps the draft');
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('[x-data]')].find(e => /^fab\(/.test(e.getAttribute('x-data')));
    const d = window.Alpine.$data(el);
    d._savedToken = () => 'preview-only-token';
    d.hasToken = true;
    return d.loadNoteItems();
  });
  await panel.getByText(stored[0].text, { exact: true }).waitFor();
  await save.click();
  await form.getByRole('status').filter({ hasText: 'Saved' }).waitFor();
  assert.equal(stored.at(-1).about, about('P18'));
  assert.equal(await input.inputValue(), '');
  assert.equal(await panel.getByRole('button', { name: /Delete.*note/ }).count(), 0);
  await form.getByRole('button', { name: 'Page', exact: true }).click();
  assert.equal(await form.locator('[data-fab-note-subject]').innerText(), 'Peeves');
  await input.fill('Keep this list compact.');
  fail = true;
  await save.click();
  await form.getByRole('status').filter({ hasText: 'Not saved:' }).waitFor();
  assert.equal(await input.inputValue(), 'Keep this list compact.');
  fail = false;
  await save.click();
  await form.getByRole('status').filter({ hasText: 'Saved' }).waitFor();
  assert.equal(stored.at(-1).about, 'mehrlander/web-tools:docs/map-tabs.csv#peeves');
  assert.equal(await panel.getByText(stored[0].text, { exact: true }).count(), 0, 'item notes stay out of the page thread');
  await form.getByRole('button', { name: 'Item', exact: true }).click();
  await panel.getByText(stored[0].text, { exact: true }).waitFor();

  for (const viewport of [{ width: 390, height: 620 }, { width: 1280, height: 800 }, { width: 390, height: 760 }]) {
    await page.setViewportSize(viewport);
    const rect = await form.evaluate(el => {
      const r = el.getBoundingClientRect(), ta = el.querySelector('textarea').getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, input: ta.height, width: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth, height: window.innerHeight };
    });
    assert.ok(rect.top >= 0 && rect.bottom <= rect.height && rect.input >= 50 && rect.scroll <= rect.width + 1, JSON.stringify(rect));
  }
  await input.fill('Consider examples where the defense is justified but the choice is still poor.');
  await page.waitForFunction(() => {
    const el = [...document.querySelectorAll('[x-data]')].find(e => /^fab\(/.test(e.getAttribute('x-data')));
    return window.Alpine.$data(el).noteText.startsWith('Consider examples');
  });
  assert.equal(await save.isEnabled(), true);
  const keyboard = await page.evaluate(async () => {
    const native = window.visualViewport;
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: { height: 420, offsetTop: 0 } });
    const el = [...document.querySelectorAll('[x-data]')].find(e => /^fab\(/.test(e.getAttribute('x-data')));
    const d = window.Alpine.$data(el);
    d.noteViewportFit(); await window.Alpine.nextTick();
    const bottom = document.querySelector('[data-fab-note-form] button[type="submit"]').getBoundingClientRect().bottom;
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: native });
    d.noteViewportFit(); await window.Alpine.nextTick();
    return bottom;
  });
  assert.ok(keyboard <= 420, 'the save control stays above a simulated phone keyboard: ' + keyboard);
}
