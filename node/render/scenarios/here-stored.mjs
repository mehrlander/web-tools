// The This browser view on its Stored here tab, with a localStorage value open
// in the detail: the stand-in storage of here-expired-token.mjs, addressed as
// ?view=here&tab=stored&item=ls:wt:tokenMeta. GitHub's /user answers 200 so
// the token tab behind it is quiet. Run with SHOT_NO_LIVE_API=1.
//
//   SHOT_NO_LIVE_API=1 npm run shot -- app/index.html \
//     --script node/render/scenarios/here-stored.mjs
import { seed } from './here-expired-token.mjs';

export default async (page) => {
  await page.route('https://api.github.com/user', r => r.fulfill({ status: 200,
    contentType: 'application/json; charset=utf-8', body: '{"login":"mehrlander"}' }));
  await seed(page);
  const url = new URL(page.url());
  url.search = '?view=here&tab=stored&item=' + encodeURIComponent('ls:wt:tokenMeta');
  await page.goto(url.href, { waitUntil: 'load' });
  await page.waitForTimeout(5000);
};
