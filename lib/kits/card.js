// LEGACY path: renamed to panel-tip.js on 2026-09-26. Kept so a page that still
// loads kits/card.js keeps working; delete once none does.
return gh.load('kits/panel-tip.js').then(() => {
  window.Card = window.PanelTip;
});
