// screenshot.mjs interaction scenario: the Tending view over three stand-in
// findings, for a shot that may be committed to this public repo.
//
//   npm run shot -- app/index.html --query view=landing \
//     --script tools/render/scenarios/tending-stand-in.mjs
//
// tending-findings.mjs reads the real notes store, which lives in the private
// registry, so its pixels belong nowhere public. This one answers the store's
// one file, notes/notes.jsonl, with three findings in the record shape
// lib/kits/findings.js documents, each about a public file of this repo and
// saying it is a stand-in; their witnesses are checked against this checkout.
// The shot starts on another view because Tending reads its store when it is
// opened, and here that must happen after the token is set.
const REGISTRY = 'mehrlander/web-tools-private';
const at = '2026-10-05T00:00:00Z';
const finding = (id, kind, path, text, choice, contains) => ({
  id, at, author: 'tools/render/scenarios/tending-stand-in.mjs', about: `mehrlander/web-tools:${path}`, text,
  finding: { kind, subjects: [`mehrlander/web-tools:${path}`],
             why: 'A stand-in, written by a render scenario so the view has findings to draw.',
             next: 'Nothing: this note exists only in the scenario.', choice,
             witnesses: [{ ref: `mehrlander/web-tools:${path}`, contains, why: 'the line the stand-in is about' }] },
});
const NOTES = [
  finding('nstandin1', 'answer', 'data/ui-units/dimensions.csv', 'Stand-in: the UI units are coded on five dimensions and computed on a sixth',
          'Keep ring beside the five coded dimensions?', 'ring,Ring'),
  finding('nstandin2', 'unreached', 'data/ui-units/codebook.md', 'Stand-in: the codebook names the dimensions file', '', 'dimensions.csv'),
  finding('nstandin3', 'overlap', 'data/ui-units/codes.csv', 'Stand-in: two body codes name the same kit', '', 'swipe-deck (core)'),
].map(n => JSON.stringify(n)).join('\n') + '\n';

export default async (page) => {
  await page.evaluate(({ REGISTRY, NOTES }) => {
    const Real = window.GH;
    window.TOKEN = 'stand-in-token';
    window.GH = class extends Real {
      async get(p, ...rest) {
        if (this.repo === REGISTRY && p === 'notes/notes.jsonl') return { text: NOTES, sha: 'stand-in' };
        return super.get(p, ...rest);
      }
    };
    window.__shell.goTending({});
  }, { REGISTRY, NOTES });
  await page.waitForFunction(() => {
    const el = document.querySelector('[x-data="tending()"]');
    const d = el && window.Alpine.$data(el);
    return d && !d.loading && d.notes.length > 0 && d.checking === 0;
  }, null, { timeout: 60000 });
  await page.waitForTimeout(800);
};
