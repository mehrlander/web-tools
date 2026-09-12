// The FAB Take browser with small raw HTML loaded on arrival, then swiped to
// raw Capture JSON. The mobile artifact proves that the header follows the
// active output and ready content fills the slide without a card.

export default async function (page) {
  const ok = await page.evaluate(() => {
    const host = [...document.querySelectorAll('[x-data]')]
      .find(el => (el.getAttribute('x-data') || '').includes('fab'));
    if (!host || !window.Alpine) return false;
    const d = window.Alpine.$data(host);
    d.open = true;
    d.activeTab = 'render';
    return true;
  });
  if (!ok) throw new Error('FAB host / Alpine not found');
  await page.waitForTimeout(900);
  const door = page.locator('[data-fab-take-browser]');
  if (await door.count() !== 1) throw new Error('Take browser door not found exactly once');
  await door.click();
  await page.locator('.sd-overlay').waitFor({ state: 'visible' });
  const estimate = await page.evaluate(() => {
    const host = [...document.querySelectorAll('[x-data]')]
      .find(el => (el.getAttribute('x-data') || '').includes('fab'));
    return window.Alpine.$data(host)._takeHtmlEstimate();
  });
  if (estimate > 1024 * 1024) {
    throw new Error(`Take browser fixture is not a small HTML closure (${estimate} bytes)`);
  }
  await page.locator('.sd-overlay pre').waitFor({ state: 'visible' });
  await page.locator('.sd-overlay [title="Copy HTML"]').waitFor({ state: 'visible' });
  const loadHtml = page.getByRole('button', { name: 'Load HTML' });
  const initial = await page.locator('.sd-overlay').innerText();
  if (!/HTML/.test(initial) || /Made when chosen|Copies to the clipboard/.test(initial)
      || await loadHtml.isVisible().catch(() => false)) {
    throw new Error('Take browser did not load small HTML as its first output');
  }
  await page.evaluate(() => window.swipeDeck.top().deck.go(2));
  await page.waitForFunction(() => window.swipeDeck.top()?.title === 'Capture');
  await page.locator('.sd-overlay [title="Copy capture"]').waitFor({ state: 'visible' });
  const capture = await page.locator('.sd-overlay').innerText();
  if (!/Capture/.test(capture) || !/"capture": "fab\/1"/.test(capture) || /Available now/.test(capture)) {
    throw new Error('Capture did not update the header and expose its live JSON');
  }
  const width = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  if (width.scroll > width.client) throw new Error('Take browser overflows the phone viewport');
  await page.waitForTimeout(300);
}
