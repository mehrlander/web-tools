# Verify a bake

A baked page is only worth handing over if it renders with no network. A quick
headless pass catches the two common failures: a dead inlined Alpine (looks
right, nothing clicks) and a missed icon (empty gap where a glyph should be).

```js
// qa.js  ::  node qa.js path/to/output.html
const { chromium } = require('playwright');
(async () => {
  const file = process.argv[2];
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 480, height: 560 } });
  const calls = [];
  p.on('request', r => { if (!r.url().startsWith('file:')) calls.push(r.url()); });
  await p.goto('file://' + file);
  await p.waitForTimeout(300);
  await p.screenshot({ path: 'shot.png' });
  console.log('network calls (want 0):', calls.length, calls);
  await b.close();
})();
```

What to confirm:

- **Zero non-`file:` requests.** Anything else means a library did not get
  inlined.
- **Interactivity works.** Click a button bound by Alpine and read back the
  state (a counter, a toggled panel). If it does not change, the inlined Alpine
  did not run; check it sits before `</body>`.
- **Icons drawn.** Eyeball the screenshot. A blank where an icon belongs means
  the swapper missed that `<i>` (often an extra attribute the matcher tripped
  on).

If Playwright is not installed: `npm i playwright && npx playwright install
chromium`.
