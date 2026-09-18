// The rendered comparison, in the place a reviewer meets it: a markdown file's
// card, opened in reading mode, with the fourth view picked.
//
//   node tools/render/screenshot.mjs app/index.html \
//     --script tools/render/scenarios/rendered-compare.mjs \
//     --out tools/.preview/rendered-compare.png --width 430 --height 932
//
// jsdom holds the routing (file-review-card.test.mjs: which kinds offer the
// view, which control lights, which resets keep it) and the marking
// (md-diff.test.mjs). What neither can hold is that the pane draws: the
// containers are a snap track whose height is measured from a laid-out slide,
// and jsdom computes no layout, so "the reader sees the change" is a browser
// measurement or it is nothing.
//
// The fixture is a documentation edit of the shape the kit assumes: a few
// scattered changes in a file that is mostly unchanged.
import openList from '/home/user/web-tools/tools/render/scenarios/estate-open.mjs';

const BEFORE = `# Reading fund 600

Fund 600 is reported as one number and read as two. The appropriated lane
carries recordkeeping and the agency's own operations, and it is the lane a
budget bill moves.

The non-appropriated lane carries what the plans pay for directly. It reports
on the same fund number and never nets into the appropriated total.

Three things follow:

- A schedule adding the two lanes produces a figure nobody recognises.
- Carry-forward level is the base a request is measured against.
- The enacted total is a different base again.
`;

const AFTER = `# Reading fund 600

Fund 600 is reported as one number and read as two. The appropriated lane
carries recordkeeping and the agency's own operations, and it is the only lane
a budget bill moves.

The non-appropriated lane carries what the plans pay for directly: contracted
medical review, the actuary's own work, and anything else a plan buys on its
own account. It reports on the same fund number and never nets into the
appropriated total, which is the whole reason the two cannot be added.

Three things follow:

- A schedule adding the two lanes produces a figure nobody in either lane recognises.
- Carry-forward level is the base a request is measured against.
- The enacted total is a different base again.
`;

export default async function (page, ctx) {
  await openList(page, ctx);
  await page.waitForTimeout(600);

  const out = await page.evaluate(async ({ BEFORE, AFTER }) => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const FILE = 'docs/fund-600.md';

    window.GH.prototype.compare = async (b, head) => ({
      ahead_by: 1, behind_by: 0, total_commits: 1,
      commits: [{ sha: 'a1', commit: { message: head, committer: { date: '2026-09-17T09:00:00Z' } } }],
      files: [{ filename: FILE, status: 'modified', additions: 6, deletions: 3 }],
    });
    const origReq = window.GH.prototype.req;
    window.GH.prototype.req = async function (p) {
      if (p === '') return { default_branch: 'main' };
      if (/^pulls\?/.test(p)) return [];
      return origReq.call(this, p);
    };
    // Only this path is answered from the fixture: gh.load() pulls the shell's
    // own kits through the same client, and a get() that answers everything
    // hands the loader prose where it expected JavaScript.
    const origGet = window.GH.prototype.get;
    window.GH.prototype.get = async function (p) {
      if (p !== FILE) return origGet.call(this, p);
      return { text: this.ref === 'main' ? BEFORE : AFTER, size: 900, sha: 'deadbeef' };
    };

    const es = window.Alpine.$data(document.querySelector('[x-data^="estate"]'));
    es.openBranchDetail(es.openRows[0]);
    for (let i = 0; i < 120 && !es._deck; i++) await wait(50);
    await wait(1200);

    const branchDeck = window.swipeDeck.top();
    const slide = branchDeck.deck.track.children[branchDeck.deck.active()];
    const bb = window.Alpine.$data(slide.querySelector('[x-data^="branchBrief"]'));
    bb.pane = 'files';
    await bb.ensureCompare();
    await wait(400);
    await bb.openFileDeck(0);
    await wait(1200);

    const card = () => {
      const d = window.swipeDeck.top();
      return window.Alpine.$data(
        d.deck.track.children[d.deck.active()].querySelector('[x-data^="fileReview"]'));
    };
    const c = card();
    const modes = c.viewModes.map((m) => m.key);
    const rendered = c.viewModes.find((m) => m.key === 'rendered');
    if (!rendered) return { error: 'no rendered view offered', modes, kind: c.kind };
    c.pickView(rendered);
    await wait(2000);

    const host = document.querySelector('[x-ref="mdDiffHost"], [x-data^="fileReview"] [class*="md-diff"]');
    const boxes = document.querySelectorAll('.md-diff-change');
    return {
      modes, tab: c.tab, kind: c.kind,
      containers: boxes.length,
      marked: document.querySelectorAll('ins.md-diff-ins, del.md-diff-del').length,
      // A container with no height is the failure this scenario exists to
      // catch: the routing would still report success. The floor is low on
      // purpose, since a change is now a block of prose and its label rather
      // than a card, and a one-line change is a short thing legitimately.
      drawn: [...boxes].filter((b) => b.getBoundingClientRect().height > 24).length,
      hosted: !!host,
      // AND THE OTHER ROUTE IN, which is the one that was broken. Everything
      // above got here through pickView, so through setTab, which draws. A host
      // that asks the card to LAND on this pane goes through load() instead,
      // and load set the tab without ever calling the renderer: the card opened
      // on an empty box. pages/approve.html is the only host that asks, so the
      // app looked fine and the approval surface looked as though the view had
      // been dropped. Re-opening the same card is enough to separate the two.
      // AND IT CARRIES WHAT THE APPROVAL SURFACE CARRIES. Everything
      // pages/approve.html gained over 2026-09-17 and -18 was built in shared
      // code, on the reasoning that the two views differ only in the verdict
      // button. That is a claim about this surface, so it is checked on this
      // surface: a one-off measurement saying so is not a check, and the two
      // could drift the moment either kit grows a caller-specific branch.
      parity: await (async () => {
        const doc = document.querySelector('.md-diff-doc');
        if (!doc) return { error: 'no rendered document' };
        const top = window.swipeDeck.top();
        const header = top.el.querySelector('.sd-header');
        const strip = doc.querySelector('.sticky');
        const box = doc.querySelector('.md-diff-change');
        const sdSlide = box.closest('.sd-slide');
        const r = box.getBoundingClientRect();
        // The floating strip must not resize as its readout changes, since it
        // is anchored on its right edge.
        const w = () => Math.round(strip.getBoundingClientRect().width);
        const step = () => doc.querySelector('button[title="Next change"]').click();
        const widths = [w()];
        step(); await wait(350); widths.push(w());
        step(); await wait(350); widths.push(w());
        const lit = () => doc.querySelectorAll('.md-diff-change[class*="warning"]').length;
        const spot = doc.querySelector('button[title="Highlight every change"]');
        const litBefore = lit();
        if (spot) { spot.click(); await wait(250); }
        const litAfter = lit();
        if (spot) { spot.click(); await wait(200); }
        const track = box.querySelector('.sd-track');
        return {
          strip: !!strip, sticky: strip && getComputedStyle(strip).position === 'sticky',
          jump: !!doc.querySelector('button[title="Next change"]'),
          spot: !!spot, litBefore, litAfter,
          total: doc.querySelectorAll('.md-diff-change').length,
          widths,
          viewIcons: header.querySelectorAll('button[title^="Compare"]').length,
          ghMark: !!header.querySelector('.ph-github-logo'),
          // `hosted` means the slide is the document and the card draws no row.
          cardRows: [...top.el.querySelectorAll('.flex.items-center.gap-1')]
            .filter((e) => e.offsetParent && e.querySelector('[x-text="namePart"], .ph-github-logo')).length,
          padLeft: sdSlide && getComputedStyle(sdSlide).paddingLeft,
          ringL: Math.round(r.left), ringR: Math.round(innerWidth - r.right),
          heights: track ? [...track.children].map((sl) => {
            const cc = sl.firstElementChild && sl.firstElementChild.firstElementChild;
            return cc ? cc.scrollHeight : null;
          }) : [],
        };
      })(),
      openedOn: await (async () => {
        c.openOn = 'mddiff';
        c.loaded = false; c._picked = false; c.tab = 'read';
        if (c.$refs && c.$refs.mdDiffHost) c.$refs.mdDiffHost.textContent = '';
        await c.load();
        await wait(1800);
        return { tab: c.tab, containers: document.querySelectorAll('.md-diff-change').length };
      })(),
    };
  }, { BEFORE, AFTER });

  console.log('rendered-compare:', JSON.stringify(out));
  if (out.error) throw new Error('rendered-compare: ' + out.error);
  if (!out.containers) throw new Error('rendered-compare: no change containers drawn');
  if (out.drawn !== out.containers) {
    throw new Error(`rendered-compare: ${out.containers - out.drawn} container(s) with no height`);
  }
  if (out.openedOn.tab !== 'mddiff') {
    throw new Error(`rendered-compare: openOn did not land, got ${out.openedOn.tab}`);
  }
  if (!out.openedOn.containers) {
    throw new Error('rendered-compare: it landed on the rendered comparison and drew nothing');
  }

  const p = out.parity;
  const gone = (m) => { throw new Error(`rendered-compare: ${m}, got ${JSON.stringify(p)}`); };
  if (p.error) gone(p.error);
  if (!p.strip || !p.sticky) gone('the comparison draws no floating strip here');
  if (!p.jump) gone('no change-to-change arrow on this surface');
  if (!p.spot) gone('no highlight-every-change toggle on this surface');
  if (p.litAfter !== p.total) gone(`the toggle lit ${p.litAfter} of ${p.total}`);
  if (p.litBefore >= p.total) gone('every change was already washed, so the toggle proved nothing');
  if (new Set(p.widths).size !== 1) gone(`the strip resizes with its readout (${p.widths.join(', ')})`);
  if (p.viewIcons < 2) gone('the view icons are not in this deck header');
  if (!p.ghMark) gone('the github mark is not beside the file name');
  if (p.cardRows) gone('a card draws its own control row inside a hosted slide');
  if (parseFloat(p.padLeft) > 12) gone(`the slide still carries the reading measure (${p.padLeft})`);
  if (p.ringL < 2) gone("a changed block's ring runs off the left edge");
  if (p.ringL !== p.ringR) gone('the document sits off-centre in its scroller');
  if (new Set(p.heights.filter((h) => h != null)).size > 1) {
    gone(`a change container's readings are not all one height (${p.heights.join(', ')})`);
  }
  await page.waitForTimeout(500);
}
