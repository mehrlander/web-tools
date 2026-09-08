// The Sessions pane's Table lens, seeded so the token-gated pane renders and
// the columns take realistic widths.
//
//   node tools/render/screenshot.mjs app/index.html --query view=sessions \
//     --script tools/render/scenarios/session-table.mjs
//
// GRAIN and COLS ride the environment, so one scenario shoots every case:
//   GRAIN=session|branch|edge   COLS=<comma-separated extra column keys>
//
// TWO SOURCES, AND THE FALLBACK IS THE COMMITTED ONE. Where a sibling
// web-tools-private checkout is on disk, the seed is folded from its real
// caches, which is the only way to see what an eleven-word session title and a
// 45-character branch name do to a column. Nothing from that read is written
// down: session asks and titles are the private registry's content, and this
// repo is public, so a committed copy of them would move them across that line
// for the sake of a screenshot. Without the sibling, the invented rows below
// carry the same SHAPE (a session across three repos, a one-repo session, a
// branch the crawl reached and one it did not) at a fraction of the width.
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
// Four levels up, not three: this file sits at tools/render/scenarios, so
// three lands on the repo root and the sibling checkout is one further out.
const privateRoot = path.resolve(here, '..', '..', '..', '..', 'web-tools-private');

const KEEP = ['id', 'day', 'started', 'ended', 'mins', 'ask', 'state', 'repos',
              'branches', 'exchanges', 'calls', 'failures', 'filesTotal', 'title', 'v'];

// The invented set: small, and shaped like the cases the lens has to draw.
const INVENTED = {
  rows: [
    { id: 'aaa11111', day: '2026-09-07', started: '2026-09-07T09:00:00Z', ended: '2026-09-07T11:30:00Z',
      mins: 150, state: 'merged', title: 'deck-swipe-and-the-phone-floor',
      ask: 'teach the file deck to swipe, and give it a floor on a phone',
      calls: 210, failures: 0, filesTotal: 14, exchanges: 22,
      repos: [{ name: 'web-tools', branch: 'claude/deck-swipe-hh21x', lines: 154 },
              { name: 'home', branch: 'claude/deck-swipe-hh21x', lines: 20 },
              { name: 'web-tools-private', branch: 'claude/deck-swipe-hh21x', lines: 6 }],
      branches: ['claude/deck-swipe-hh21x'] },
    { id: 'bbb22222', day: '2026-09-06', started: '2026-09-06T14:00:00Z', ended: '2026-09-06T14:40:00Z',
      mins: 40, state: 'clean', title: 'pdf-lattice-open-perimeter',
      ask: 'close the open perimeters in the pdf kit lattice',
      calls: 38, failures: 2, filesTotal: 3, exchanges: 6,
      repos: [{ name: 'home', branch: 'claude/pdf-lattice-4m2q', lines: 61 }],
      branches: ['claude/pdf-lattice-4m2q'] },
    { id: 'ccc33333', day: '2026-09-05', started: '2026-09-05T08:10:00Z', ended: '2026-09-05T08:19:00Z',
      mins: 9, state: 'short', title: '', ask: 'what does the snagged scope mean',
      calls: 4, failures: 0, filesTotal: 0, exchanges: 2, repos: [], branches: [] },
  ],
  activity: {
    'mehrlander/web-tools': {
      defaultBranch: 'main', prReach: 'full',
      openPRs: [{ number: 612, head: 'claude/deck-swipe-hh21x', title: 'Deck swipe', draft: true,
                  updatedAt: '2026-09-07T11:30:00Z', aheadBy: 9, behindBy: 0 }],
      branchPRs: [], scan: { branches: [
        { name: 'claude/deck-swipe-hh21x', sha: 'a1b2c3d', group: 'active',
          date: '2026-09-07T11:28:00Z', subject: 'Give the deck a phone floor',
          aheadBy: 9, firstDate: '2026-09-07T09:12:00Z', sessions: [] },
      ] },
    },
    'mehrlander/home': {
      defaultBranch: 'main', prReach: 'full', openPRs: [], branchPRs: [],
      scan: { branches: [
        { name: 'claude/deck-swipe-hh21x', sha: 'd4e5f60', group: 'landed',
          date: '2026-09-07T11:02:00Z', subject: 'Record the deck floor',
          aheadBy: 1, firstDate: '2026-09-07T10:40:00Z', sessions: [] },
      ] },
    },
  },
};

function fromPrivate() {
  const sPath = path.join(privateRoot, 'state', 'sessions.json');
  const aPath = path.join(privateRoot, 'state', 'activity.json');
  if (!existsSync(sPath) || !existsSync(aPath)) return null;
  const rows = JSON.parse(readFileSync(sPath, 'utf8')).rows.slice(0, 40)
    .map(r => Object.fromEntries(KEEP.filter(k => k in r).map(k => [k, r[k]])));
  const src = JSON.parse(readFileSync(aPath, 'utf8'));
  const repos = src.repos || src;
  const activity = {};
  for (const [name, e] of Object.entries(repos).slice(0, 6)) {
    activity[name] = {
      defaultBranch: e.defaultBranch || 'main',
      prReach: e.prReach || '',
      openPRs: (e.openPRs || []).slice(0, 8),
      branchPRs: (e.branchPRs || []).slice(0, 25),
      scan: { branches: ((e.scan || {}).branches || []).slice(0, 25) },
    };
  }
  return { rows, activity };
}

export default async (page) => {
  const grain = process.env.GRAIN || 'session';
  const cols = (process.env.COLS || '').split(',').filter(Boolean);
  const seed = fromPrivate() || INVENTED;

  await page.evaluate(() => {
    window.TOKEN = 'FAKE';
    window.__shell.estateSeen = true;
  });
  await page.waitForTimeout(600);
  await page.evaluate(({ seed, grain, cols }) => {
    const el = document.querySelector('[x-data="estate()"]');
    const d = window.Alpine.$data(el);
    d.authed = true; d.loading = false;
    d.sessionRows_ = seed.rows;
    d.activity = seed.activity;
    d._activityRev = (d._activityRev || 0) + 1;
    d.sessionsLoading = false;
    d.tab = 'sessions';
    d.sessionLens = 'table';
    d.sessionScope = 'all';
    d.sessionGrain = grain;
    for (const c of cols) d.toggleCol(c);
  }, { seed, grain, cols });
  await page.waitForTimeout(900);
};
