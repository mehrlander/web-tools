// Where the Activity panes state the age of what they are showing, 2026-08-25.
//
// The estate is token-gated and this renderer holds no token, so the panes it
// wants to photograph render their signed-out line instead. The seed below is
// the whole reason this file exists: it flips `authed` and drops a handful of
// session records and branch rows straight into the component, so the chrome
// under test (scope chips, the age pill beside them) draws at real size with
// real counts.
//
// It photographs the SESSIONS pane by default; pass `pane=activity` in the
// query to get Branches instead, and `pill=checking` or `pill=failed` for the
// age pill's other two readings. Nothing here touches the crawls: the rows are
// planted, the pill's age is planted, and the picture is of the layout.
//
//   npm run shot -- app/index.html --query "view=sessions" --width 430 \
//     --script tools/render/scenarios/activity-chrome-probe.mjs --wait 3000

const SESS = (id) => `https://claude.ai/code/session_${id}`;

const RECORDS = [
  { id: '01J37FHY', agent: SESS('01J37FHY'), day: '2026-08-25',
    started: '2026-08-25T06:12:00Z', mins: 19, failures: 0,
    ask: 'Record what drove the volunteer firefighters swing, and what it cost',
    repos: [{ name: 'home', branch: 'claude/budget-bill-missing-swing' }],
    branches: ['claude/budget-bill-missing-swing'] },
  { id: '01J2XKQ4', agent: SESS('01J2XKQ4'), day: '2026-08-25',
    started: '2026-08-25T02:40:00Z', mins: 51, failures: 2,
    ask: 'Stage intake: a guessed extension is drawn as a guess',
    repos: [{ name: 'web-tools', branch: 'claude/stage-intake-guess' }],
    branches: ['claude/stage-intake-guess'] },
  { id: '01J2P8ZM', agent: SESS('01J2P8ZM'), day: '2026-08-24',
    started: '2026-08-24T18:05:00Z', mins: 34, failures: 0,
    ask: 'Sweep the tracker and close what shipped',
    repos: [{ name: 'home', branch: 'claude/tracker-sweep' }],
    branches: ['claude/tracker-sweep'] },
];

const BRANCHES = {
  'mehrlander/home': { defaultBranch: 'main', scan: { branches: [
    { name: 'claude/budget-bill-missing-swing', group: 'active', date: '2026-08-25',
      ahead: 2, behind: 0, sessions: [SESS('01J37FHY')], pr: { number: 505, state: 'open' } },
    { name: 'claude/tracker-sweep', group: 'active', date: '2026-08-24',
      ahead: 4, behind: 1, sessions: [SESS('01J2P8ZM')] },
  ] } },
  'mehrlander/web-tools': { defaultBranch: 'main', scan: { branches: [
    { name: 'claude/stage-intake-guess', group: 'active', date: '2026-08-25',
      ahead: 3, behind: 0, sessions: [SESS('01J2XKQ4')] },
    { name: 'agent/concept-index-work', group: 'stranded', date: '2026-08-02', ahead: 1, behind: 40 },
  ] } },
};

export default async function (page) {
  const q = new URL(page.url()).searchParams;
  const pane = q.get('pane') || 'sessions';
  const pill = q.get('pill') || 'checked';
  await page.waitForSelector('[x-data*="estate"]', { timeout: 15000 });
  await page.waitForTimeout(1200);

  await page.evaluate(async ({ records, branches, pane, pill }) => {
    const data = Alpine.$data(document.querySelector('[x-data*="estate"]'));
    data.authed = true;
    data.sessionRows_ = records;
    data.sessionAttention = [];
    data.sessionsLoading = false;
    data.activity = branches;
    data.activityLoading = false;
    // The file stamps, planted at about twenty hours. The pill read these as
    // "as of 1d" until 2026-10-05; it now reads the shell's freshness record
    // (app/index.html, "Freshness"), planted below.
    const old = new Date(Date.now() - 20 * 3600 * 1000).toISOString();
    data.sessionsGeneratedAt = old;
    data.activityGeneratedAt = old;
    // `pill=` picks one of the pill's three readings: checked (the default,
    // three minutes ago), checking, or failed over a copy checked 23h ago.
    const s = window.__shell, now = Date.now();
    const at = pill === 'failed' ? now - 23 * 3600 * 1000 : now - 3 * 60 * 1000;
    const rec = { at, tried: at, failed: pill === 'failed' ? 'GitHub Error 409' : '' };
    s.cacheCheck = { configs: rec, activity: rec, sessions: rec };
    s.crawlChecking = { configs: false, activity: pill === 'checking', sessions: pill === 'checking' };
    // Through the shell, not by writing `tab`: the pane is a shell view and
    // the component only reads it, so a direct write is dropped on the next
    // render and the shot comes back on whichever pane the URL named.
    if (pane === 'activity') window.__shell.goActivity(); else window.__shell.goSessions();
    data.sessionScope = 'day';
    data.branchScope = 'active';
    await new Promise(r => setTimeout(r, 600));
  }, { records: RECORDS, branches: BRANCHES, pane, pill });

  await page.waitForTimeout(800);
}
