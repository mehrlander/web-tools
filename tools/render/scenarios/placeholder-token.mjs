// A placeholder token, so a page that reads the private registry renders
// against the sibling checkout instead of stopping at its sign-in line. Used
// by tools/build/ui-shots.mjs for the shortcut pages; the app shell itself
// makes an identity call no local answer exists for, so it is not shot this way.
export default async (page) => {
  await page.evaluate(() => { try { localStorage.setItem('ghToken', 'local-preview'); } catch {} });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
};
