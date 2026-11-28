// An inspection's picture opened full size: taps the first picture on the
// card, which opens every run's pictures as a deck at that one. Needs a
// payload whose outputs carry a sketch or an image, such as
// pages/demos/inspection-versions.json carried in #gz=.
//
//   npm run shot -- pages/inspection.html --hash "gz=<payload>" --query run=timeline \
//     --script node/render/scenarios/inspection-picture.mjs

export default async function (page) {
  await page.waitForSelector('[data-picture]', { timeout: 15000 });
  await page.click('[data-picture]');
  await page.waitForTimeout(1200);
}
