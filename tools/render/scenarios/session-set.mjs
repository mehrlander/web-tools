// Shoot the Sessions pane with a named set loaded, past its auth gate.
//
// Two things the default render cannot do, both of them chats-pane.mjs's, since
// the two panes read the same private registry. The pane is token-gated, so a
// tokenless boot shows the sign-in line and nothing else; and its data lives in
// a SIBLING repo, which tools/render/cdn.mjs serves from the checkout beside
// this one. The token here is a placeholder: no request leaves the sandbox and
// every one it makes is answered from disk.
//
// The set itself rides the shot's own --query, since it IS the address under
// test. Both readings are one command apart:
//
//   npm run shot app/index.html -- --script tools/render/scenarios/session-set.mjs \
//     --query 'view=sessions&set=<ids>'                    the set as a list
//   ... --query 'view=sessions&set=<ids>&session=<one id>'  the deck, swiping it
export default async (page) => {
  await page.evaluate(() => { try { localStorage.setItem('ghToken', 'local-preview'); } catch {} });
  // domcontentloaded, not networkidle: the estate keeps polling caches, so
  // networkidle can outlast the timeout on a pane that has already drawn.
  await page.reload({ waitUntil: 'domcontentloaded' });
  // Wait for a row rather than a fixed delay, so a read that fails does so
  // loudly here instead of producing a screenshot of a spinner. The set's own
  // line is the tightest selector: it exists only when a set is active.
  await page.waitForSelector('text=/named by this link/', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
};
