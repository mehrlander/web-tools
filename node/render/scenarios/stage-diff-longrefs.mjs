// Stage two long real refs (same path, two refs) and open the Diff tab without
// running, to check the A/B selects clip long repo@ref:path labels cleanly.
export default async (page) => {
  await page.evaluate(async () => {
    const store = window.Alpine.store('browser');
    const p = '.claude/skills/edit-review/SKILL.md';
    store.stage = [
      { repo: 'mehrlander/web-tools', ref: 'main', path: p },
      { repo: 'mehrlander/web-tools', ref: 'claude/web-tools-diff-review-s0nrq7', path: p },
    ];
    await new Promise(r => setTimeout(r, 300));
    const el = document.querySelector('div[x-data="stager()"]');
    if (el && el.__stager) el.__stager.outTab = 'diff';
    await new Promise(r => setTimeout(r, 200));
  });
  await page.waitForTimeout(300);
};
