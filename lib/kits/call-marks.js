// call-marks.js — the marks for the parts of anything put to the reader for a
// call: the background that gives rise to it, the proposal itself, the
// commentary on it, and the conclusion drawn. A book, a bulb, a speech bubble
// and a stamp, drawn alike: a 24 box, a 1.9 stroke in currentColor, round caps
// and joins, and a secondary stroke at reduced opacity where one helps.
//
// Where the parts sit is the form's business, not this file's. On an idea
// board the background and conclusion belong to the board (its Brief and
// Selection) and each idea carries a proposal and a commentary; on a
// documentation call each edit carries a background and a proposal.
// alpineComponents/user-call-form.js still draws its book and bulb from a copy
// of the first two paths.
//
//   CallMarks.KINDS                  ['background', 'proposal', 'commentary', 'conclusion']
//   CallMarks.LABEL[kind], .GLOSS[kind]   the part's name, and one line on what it holds
//   CallMarks.svg(kind, { size = 16, cls = '' })   inline SVG markup, '' for an unknown kind
//
// Attaches to window.CallMarks, loaded via gh.load('kits/call-marks.js').
(() => {
  if (window.CallMarks) return;

  const PATHS = {
    background: '<path d="M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5zM12 6.5v13"/>',
    proposal: '<path d="M9 17.5h6M10 20.5h4"/><path d="M9 17.5c0-2-3-3.6-3-7.5a6 6 0 0112 0c0 3.9-3 5.5-3 7.5"/><path d="M12 7v4" opacity=".55"/>',
    commentary: '<path d="M5 4.5h14a1.5 1.5 0 011.5 1.5v9a1.5 1.5 0 01-1.5 1.5h-7.5L7 20v-3.5H5A1.5 1.5 0 013.5 15V6A1.5 1.5 0 015 4.5z"/><path d="M7.5 9h9M7.5 12.5h6" opacity=".55"/>',
    conclusion: '<circle cx="12" cy="5.5" r="2.5"/><path d="M10.5 8v3.5h3V8"/><path d="M5 14a2.5 2.5 0 012.5-2.5h9A2.5 2.5 0 0119 14v2.5H5z"/><path d="M6.5 20h11" opacity=".55"/>',
  };
  const LABEL = { background: 'Background', proposal: 'Proposal', commentary: 'Commentary', conclusion: 'Conclusion' };
  const GLOSS = {
    background: 'the situation that gives rise to the proposal, apart from the proposal itself',
    proposal: 'what is put forward, reduced to what a call can be made on',
    commentary: 'a short, qualified discussion of what the proposal brings',
    conclusion: 'the call made across the proposals, and what it rests on',
  };
  const svg = (kind, { size = 16, cls = '' } = {}) => PATHS[kind]
    ? `<svg viewBox="0 0 24 24" width="${size}" height="${size}"${cls ? ` class="${cls}"` : ''} fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[kind]}</svg>`
    : '';

  window.CallMarks = { KINDS: Object.keys(PATHS), LABEL, GLOSS, svg };
})();
