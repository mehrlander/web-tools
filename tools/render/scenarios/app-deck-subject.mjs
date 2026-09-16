// The app's branch deck saying which document is being read, and the sidebar
// hearing it two levels down.
//
//   npm run shot -- app/index.html \
//     --script tools/render/scenarios/app-deck-subject.mjs --width 390 --height 844
//
// A branch slide presents its readable files in a strip, and which panel is
// showing is chosen inside the slide. The sidebar cannot derive it: it builds
// its layer strip by walking live frames, and a markdown panel is a div in this
// document rather than a frame, so the walk names app/index.html and stops two
// levels short of the reader. Measured before the fix: subject null, drawer at
// app/index.html, base empty, two reading cards subscribing to the compare pair
// that a hidden bar would have published.
//
// jsdom holds the deck's bookkeeping (estate-deck-subject) and the slide's
// reporting (branch-brief-subject). What only a browser holds is the three
// meeting: a real fab adopting a real announcement from a slide inside a real
// deck, and the file deck drilled over it taking the subject and handing it
// back. Those are the two rows below.
//
// SHOT=drawer opens the sidebar for the pixels.
import openList from '/home/user/web-tools/tools/render/scenarios/estate-open.mjs';

export default async function (page, ctx) {
  await openList(page, ctx);
  await page.waitForTimeout(600);
  await page.evaluate((v) => { window.__shot = v; }, process.env.SHOT || '');

  const out = await page.evaluate(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    // Two readable documents and one file that stays in the list, so the strip
    // has a position to be in and moving it is a real move.
    const files = ['lib/kits/swipe-deck.js', 'docs/show-repo.md', 'docs/loader.md'];
    const patch = '@@ -1,3 +1,4 @@\n c\n-old\n+new\n+add\n';
    window.GH.prototype.compare = async (b, head) => ({
      ahead_by: 4, behind_by: 0, total_commits: 1,
      commits: [{ sha: 'a1', commit: { message: head, committer: { date: '2026-09-08T09:00:00Z' } } }],
      files: files.map((f, i) => ({ filename: f, status: 'modified', additions: 12 + i, deletions: 3, patch })),
    });
    const origReq = window.GH.prototype.req;
    window.GH.prototype.req = async function (p) {
      if (p === '') return { default_branch: 'main' };
      if (/^pulls\?/.test(p)) return [{ number: 411, title: 'A guide', state: 'open', draft: true,
        body: 'Judgment about the branch.', updated_at: '2026-09-08T09:00:00Z' }];
      return origReq.call(this, p);
    };
    const origGet = window.GH.prototype.get;
    window.GH.prototype.get = async function (p) {
      if (p === 'data/design/content.csv') throw Object.assign(new Error('404'), { status: 404 });
      return origGet.call(this, p);
    };

    const es = window.Alpine.$data(document.querySelector('[x-data^="estate"]'));
    es.openBranchDetail(es.openRows[0]);
    for (let i = 0; i < 120 && !es._deck; i++) await wait(50);
    await wait(1500);
    const bdeck = window.swipeDeck.top();
    bdeck.deck.go(1);
    await wait(1400);

    const slide = bdeck.deck.track.children[bdeck.deck.active()];
    const bb = window.Alpine.$data(slide.querySelector('[x-data^="branchBrief"]'));
    bb.pane = 'files';
    await bb.ensureCompare();
    await wait(1000);

    const f = window.Alpine.$data(document.querySelector('[x-data^="fab"]'));
    const say = (s) => s ? (s.repo + '@' + s.ref + ':' + s.path + ' route=' + (s.route || '-')) : null;
    const listening = () => [...slide.querySelectorAll('[x-data^="fileReview"]')]
      .map(el => window.Alpine.$data(el)).filter(c => c.read).length;

    const onStrip = { docs: bb.reviewableFiles.map(x => x.path), listening: listening(),
                      subject: say(window.__tossSubject),
                      fabPath: f.path, fabBase: f.subjectBase };

    // The strip moves, and the drawer follows without being touched.
    bb.goRev(1);
    await wait(700);
    const moved = { subject: say(window.__tossSubject), fabPath: f.path };

    // Drilling puts a deck over this one. It owns the subject while it is up
    // and hands it back on the way out, which is the whole reason the branch
    // deck holds ONE channel rather than every slide holding its own.
    await bb.openFileDeck(0);
    await wait(1200);
    const drilled = { depth: window.swipeDeck.stack.length,
                      subject: say(window.__tossSubject), fabPath: f.path };
    history.back();
    await wait(900);
    const back = { depth: window.swipeDeck.stack.length,
                   subject: say(window.__tossSubject), fabPath: f.path };

    if (window.__shot === 'drawer') { f.open = true; f.activeTab = 'render'; await wait(700); }
    const box = (el) => { const r = el?.getBoundingClientRect?.();
      return (!r || !r.width) ? 'absent'
        : Math.round(r.x) + ',' + Math.round(r.y) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height); };
    const barEl = [...document.querySelectorAll('.ph-git-diff')]
      .map(i => i.closest('div.relative')).find(el => el && /\bvs\b/.test(el.textContent || ''));

    return { onStrip, moved, drilled, back, bar: box(barEl), width: document.documentElement.clientWidth };
  });

  const p = (k, v) => console.log('   ' + k.padEnd(16) + ': ' + v);
  console.log('\n── the app branch deck, two levels down ' + '─'.repeat(20));
  p('strip holds', out.onStrip.docs.join(', ') + '   (' + out.onStrip.listening + ' cards listening)');
  p('announced', out.onStrip.subject);
  p('drawer at', out.onStrip.fabPath + '   base=' + out.onStrip.fabBase);
  p('after a swipe', out.moved.subject);
  p('drilled', 'depth ' + out.drilled.depth + '  ' + out.drilled.subject);
  p('back out', 'depth ' + out.back.depth + '  ' + out.back.subject);
  if (process.env.SHOT === 'drawer') p('compare bar', out.bar + '   (viewport ' + out.width + 'px)');
  console.log('─'.repeat(60) + '\n');
  await page.waitForTimeout(300);
}
