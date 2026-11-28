// dock-split.js — the drag-splitter's former path. The engine is now
// kits/drag-splitter.js, as window.dragSplitter. This file stays only so the
// pages in mehrlander/budget-drs that load kits/dock-split.js keep working until
// they load the new path; delete it then, with drag-splitter.js's LEGACY class
// names.
return (window.dragSplitter ? Promise.resolve() : gh.load('kits/drag-splitter.js'))
  .then(() => {
    window.dockSplit = window.dragSplitter;
  });
