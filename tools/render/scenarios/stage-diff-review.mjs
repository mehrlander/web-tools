// Drive show-repo's Stage → Diff lens into a rendered state for a pixel check:
// stage two local text items (a before/after edit, no token needed), switch to
// the Diff tab, run the diff. Shows the diff table plus the review-prompts panel.
export default async (page) => {
  await page.evaluate(async () => {
    const store = window.Alpine.store('browser');
    store.stage = [
      { local: true, id: 1, name: 'budget-note-before.md', path: 'budget-note-before.md', size: 0, isText: true,
        text: '# Q3 Budget Note\n\nThe agency requests $4.2M in maintenance funding.\nThis covers 12 FTE and ongoing system costs.\nThe request is consistent with prior biennia.\nNo policy change is implied.\n' },
      { local: true, id: 2, name: 'budget-note-after.md', path: 'budget-note-after.md', size: 0, isText: true,
        text: '# Q3 Budget Note\n\nThe agency requests $4.2M in maintenance funding.\nThis covers 12.0 FTE and recurring system costs.\nThe request is consistent with prior biennia.\nIt carries no policy change.\nFund split: 70% state, 30% local.\n' },
    ];
    await new Promise(r => setTimeout(r, 300));  // let auto-pair + watchers settle
    const el = document.querySelector('div[x-data="stager()"]');
    const stager = el && el.__stager;
    if (stager) {
      // Bespoke asks as an opened #stage=…&prompts= link would carry them.
      stager.linkPrompts = [
        { label: 'FTE count', ask: 'Did the FTE figure stay consistent between A and B?' },
        { label: 'Fund split', ask: 'The after adds a 70/30 fund split; is that supported?' },
      ];
      stager.outTab = 'diff';
      await stager.runDiff();
    }
    await new Promise(r => setTimeout(r, 200));
  });
  await page.waitForTimeout(400);
};
