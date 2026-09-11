// Open the FAB's one-button Take browser and leave its first output card on
// screen. The mobile artifact proves that the former tooltip-only description
// and the explicit output verb are readable before anything runs.

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
  const text = await page.locator('.sd-overlay').innerText();
  if (!/Take outputs/.test(text) || !/Copies to the clipboard/.test(text)) {
    throw new Error('Take browser did not expose the output explanation');
  }
  await page.waitForTimeout(200);
}
