// LEGACY path: renamed to title-tip.js on 2026-09-26. Kept so a page that still
// loads kits/note.js keeps working; delete once none does.
return gh.load('kits/title-tip.js').then(() => {
  window.Note = window.TitleTip;
});
