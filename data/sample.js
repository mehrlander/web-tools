// data/sample.js — repo form of a read() data file.
//
// read('data/sample.js') runs this with `gh` injected (like load) and hands
// back what it returns. The local twin of this file — produced by the demo's
// "Save local copy" — carries the same payload as
//   document.currentScript.value = { ... };
// so that, placed beside a page, it resolves before this repo copy.
return {
  title: 'web-tools sample dataset',
  note: 'Edit me in the repo, or freeze me to a local file from the demo page.',
  items: [
    { id: 1, name: 'alpha', tags: ['x', 'y'] },
    { id: 2, name: 'beta',  tags: ['z'] },
    { id: 3, name: 'gamma', tags: [] }
  ]
};
