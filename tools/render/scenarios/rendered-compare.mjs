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
      // catch: the routing would still report success.
      drawn: [...boxes].filter((b) => b.getBoundingClientRect().height > 40).length,
      hosted: !!host,
    };
  }, { BEFORE, AFTER });

  console.log('rendered-compare:', JSON.stringify(out));
  if (out.error) throw new Error('rendered-compare: ' + out.error);
  if (!out.containers) throw new Error('rendered-compare: no change containers drawn');
  if (out.drawn !== out.containers) {
    throw new Error(`rendered-compare: ${out.containers - out.drawn} container(s) with no height`);
  }
  await page.waitForTimeout(500);
}
