// screenshot.mjs interaction scenario: the Lists view on a created list
// (kits/lists.js), every list's tab above it.
//
//   npm run shot -- app/index.html --query "view=lists" \
//     --script node/render/scenarios/estate-lists.mjs --width 1280 --height 1100
//
// The Lists view is token-gated and this renderer holds no token, so the seed
// flips `authed` and plants every list straight into the component, as
// ping.mjs does. What the pixels prove: the tab row, the created lists after
// its hairline, each tab carrying the list's own icon, title and count, the +
// pill, the jump-over and settings glyphs for the list on screen, and rows of
// text with a note under them.
//
// Query switches, read from the page's own query string:
//   pick=words        put Useful words and phrases on screen (default Aphorisms)
//   form=new          open the new-list form
//   form=settings     open the settings form for the list on screen
//   done=1            turn on check-off for Aphorisms and check one item
const h = (n) => new Date(Date.now() - n * 36e5).toISOString();

export default async function (page) {
  await page.waitForSelector('[x-data*="estate"]', { timeout: 15000 });
  await page.waitForTimeout(1200);
  await page.evaluate(async (seed) => {
    if (!window.Lists && window.gh?.load) await window.gh.load('kits/lists.js');
    const q = new URLSearchParams(location.search);
    const data = Alpine.$data(document.querySelector('[x-data*="estate"]'));
    data.authed = true;
    data.hasToken = () => true;
    data.armPingPoll = () => {};
    data.todoLoading = data.jotLoading = data.pinLoading = data.createdLoading = data.pingLoading = false;
    data.pinItems = seed.pins;
    data.todoItems = seed.todos;
    data.jotItems = seed.jots;
    data.pingItems = [];
    const lists = seed.lists.map(l => ({ ...window.Lists.describe(l.path, l.header), header: l.header, items: l.items }));
    if (q.get('done')) {
      const a = lists.find(l => l.path === 'lists/aphorisms.json');
      a.header = { ...a.header, capabilities: ['done'] };
      Object.assign(a, window.Lists.describe(a.path, a.header));
      a.items[0] = { ...a.items[0], done: true, done_at: new Date().toISOString() };
    }
    data.createdLists = lists;
    window.__shell.goListsTab(q.get('pick') === 'words' ? 'useful-words-and-phrases' : 'aphorisms');
    await new Promise(r => setTimeout(r, 0));
    if (q.get('form') === 'new') { data.openCreatedNew(); data.createdNewTitle = 'Groceries'; data.createdNewIcon = 'shopping-cart'; }
    if (q.get('form') === 'settings') data.toggleCreatedSettings();
    await new Promise(r => setTimeout(r, 500));
  }, {
    pins: [
      { id: 'p1', target: 'mehrlander/home:chron/2026/08/2026-08-07-merge-methods-and-ancestry.md',
        title: 'Merge methods and ancestry',
        note: 'Which merges keep the tip as a main ancestor, and where landing evidence lives.', group: 'Git', created_at: h(2) },
      { id: 'p2', target: 'mehrlander/web-tools:docs/loader.md', title: 'The loader contract', group: 'Git', created_at: h(30) },
    ],
    todos: [
      { id: 't1', text: 'Reply to Adam', done: false, created_at: h(50) },
      { id: 't2', text: 'Refresh the app thumbnail', done: false, created_at: h(20) },
    ],
    jots: [
      { id: 'j1', text: 'A "critical juncture": maybe that is where you want a hook', created_at: h(26) },
      { id: 'j2', text: 'AI gives overwhelming amounts of information to consider.', created_at: h(3) },
    ],
    lists: [
      { path: 'lists/useful-words-and-phrases.json',
        header: { title: 'Useful words and phrases', icon: 'book-open-text' },
        items: [
          { id: 'l1', text: 'appurtenance', note: 'Something that belongs to a larger thing as an accessory. In property law, a right or structure attached to land that passes with it.', created_at: h(40) },
          { id: 'l2', text: 'elegant variation', note: 'Replacing a word with a synonym to avoid repeating it, which leads the reader to ask whether a second thing is meant. H. W. Fowler (1926).', created_at: h(30) },
          { id: 'l3', text: 'no-negation', note: 'Negation carried by "no" inside a noun phrase rather than by "not" on the verb. Gunnel Tottie (1991).', created_at: h(20) },
        ] },
      { path: 'lists/aphorisms.json',
        header: { title: 'Aphorisms', icon: 'quotes' },
        items: [
          { id: 'l4', text: 'Testing beats guessing.', note: 'When a question can be settled by running a check, run it instead of reasoning toward the likely answer.', created_at: h(10) },
          { id: 'l5', text: 'Reducing documentation is a virtue.', created_at: h(5) },
        ] },
    ],
  });
  await page.waitForTimeout(600);
}
