// Inject fake activity data into the estate component so the token-gated
// Activity view renders with content for a headless screenshot. Not committed
// as a fixture; a scratch harness for tuning the Activity view layout.
export default async (page) => {
  await page.evaluate(() => {
    window.TOKEN = 'FAKE';
    window.__shell.estateSeen = true;   // mount the estate; the ?view query drives which panel shows
  });
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    const el = document.querySelector('[x-data="estate()"]');
    const d = window.Alpine.$data(el);
    d.authed = true; d.loading = false;
    // Repo cards, so the Repos view renders too (grouped like the real estate).
    const card = (repo, group, note) => ({ repo, icon: 'ph-bookmark-simple', note, group, order: 0,
      pins: [], hasLanding: false, meta: { desc: note, priv: repo.includes('private'), ago: '2h ago', ref: 'main' }, err: false, child: null, showChild: false });
    d.entries = [
      card('mehrlander/web-tools', 'core', 'Browser tools and kits'),
      card('mehrlander/web-tools-private', 'core', 'The private registry'),
      card('mehrlander/home', 'core', 'Knowledge base and agent memory'),
      card('mehrlander/chat-histories', 'archives', 'The chat archive'),
      card('mehrlander/wa-bills', 'data', 'Washington bill structure'),
      card('mehrlander/fn-data', 'data', 'Fiscal-note data pulls'),
    ];
    const now = Date.now();
    const iso = (h) => new Date(now - h * 3600e3).toISOString();
    const msgs = [
      'Fix the branch survey pool concurrency',
      'Add activity cache builders and their unit tests',
      'Refactor the header nav into a closed app-owned set',
      'Tighten the mobile layout and drop the hard borders',
      'Wire refreshActivityCache into the estate crawl path',
    ];
    const commit = (repo, i) => ({ sha: repo.split('/')[1] + i, msg: msgs[i % msgs.length], date: iso(i * 3 + 1), author: 'mehrlander', repo });
    const repos = ['mehrlander/web-tools', 'mehrlander/web-tools-private', 'mehrlander/home', 'mehrlander/chat-histories', 'mehrlander/wa-bills'];
    const activity = {};
    repos.forEach((r, ri) => {
      activity[r] = {
        pushedAt: iso(ri * 5), defaultBranch: 'main',
        counts: { branches: 20 + ri * 7, active: 2 + ri, landed: 5 + ri, stranded: ri, surveyed: 8 + ri, older: 12 + ri, openPRs: ri % 3 },
        recentCommits: Array.from({ length: 8 }, (_, i) => commit(r, i)),
        openPRs: Array.from({ length: ri % 3 }, (_, i) => ({ number: 200 + i, title: 'Some open pull request with a fairly long descriptive title', head: 'feature/thing', draft: i === 0, updatedAt: iso(i) })),
        survey: { surveyedAt: iso(4), cap: 30, surveyed: 8 + ri, older: 12 + ri, truncated: ri === 4, branches: Array.from({ length: ri }, (_, i) => ({ name: 'feature/stranded-branch-' + i, sha: 'x' + i, group: 'stranded' })) },
      };
    });
    d.authed = true; d.activityLoading = false;
    d.activityGeneratedAt = iso(1);
    d.activity = activity;
    d.activityStream = repos.flatMap(r => activity[r].recentCommits).sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 30);
  });
  await page.waitForTimeout(400);
};
