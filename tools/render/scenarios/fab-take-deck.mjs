// Open the FAB's one-button Take browser, then move to Capture. The mobile
// artifact proves that the header follows the active output and that an output
// already held by the page appears as content rather than as a placeholder.

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
  await page.getByRole('button', { name: 'Copy HTML' }).waitFor({ state: 'visible' });
  const initial = await page.locator('.sd-overlay').innerText();
  if (!/HTML/.test(initial) || !/Made when chosen/.test(initial)) {
    throw new Error('Take browser did not expose the deferred HTML output');
  }
  await page.evaluate(() => window.swipeDeck.top().deck.go(2));
  await page.waitForFunction(() => window.swipeDeck.top()?.title === 'Capture');
  await page.getByText('Available now', { exact: true }).waitFor({ state: 'visible' });
  const capture = await page.locator('.sd-overlay').innerText();
  if (!/Capture/.test(capture) || !/"capture": "fab\/1"/.test(capture)) {
    throw new Error('Capture did not update the header and expose its live JSON');
  }
  const width = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  if (width.scroll > width.client) throw new Error('Take browser overflows the phone viewport');
  await page.waitForTimeout(300);
}
