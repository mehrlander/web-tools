// screenshot.mjs interaction scenario: the Map's UI > Views tab, every address
// the app can be sent to, read with a token the harness does not check.
//
//   npm run shot -- app/index.html --query "view=map&tab=views" \
//     --script tools/render/scenarios/map-views.mjs
//
// The tab reads docs/app-routes.csv and dates each route's files by their last
// commit, both through the API. SHOT_GIT_API (tools/render/cdn.mjs) answers the
// commit reads from this checkout and the contents read from the working tree,
// so the rows and their dates are this checkout's own; the open pull requests
// the tab lists against a route are not answered, and none are shown.
process.env.SHOT_GIT_API = '1';

export default async (page) => {
  await page.evaluate(async () => {
    window.TOKEN = 'stand-in-token';
    const el = [...document.querySelectorAll('[x-data]')].find(e => window.Alpine?.$data(e)?.loadAppViews);
    const d = el && window.Alpine.$data(el);
    if (!d) return;
    d.viewsTried = false;
    await d.loadAppViews(true);
  });
  await page.waitForFunction(() => {
    const el = [...document.querySelectorAll('[x-data]')].find(e => window.Alpine?.$data(e)?.loadAppViews);
    const d = el && window.Alpine.$data(el);
    return d && !d.viewsBusy && (d.viewsLoadedAt || d.viewsError);
  }, null, { timeout: 60000 });
  await page.waitForTimeout(800);
};
