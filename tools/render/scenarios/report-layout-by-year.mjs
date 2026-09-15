// The report-layout demo on its SECOND committed layout, which is the half of
// the demo a default shot cannot show: the same rows banded on fiscal year
// instead of on budget version, with every figure unmoved.
//
//   npm run shot -- lib/kits/demos/report-layout.html --width 1280 \
//     --script tools/render/scenarios/report-layout-by-year.mjs

export default async (page) => {
  await page.selectOption('select', 'compare-by-year.json');
  await page.waitForFunction(() => document.body.innerText.includes('banded on fiscal year'));
  await page.waitForTimeout(200);
};
