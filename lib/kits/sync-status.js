// lib/kits/sync-status.js — how a synchronization state looks, wherever the
// estate shows one. A copy placed somewhere GitHub cannot see (a work computer,
// a phone) is compared against what GitHub publishes, and every view that shows
// the answer draws it with these icons, so one state never looks like two.
//
// Readers: the project Overview (alpineComponents/installation-view.js, the
// PowerShell files), pages/shortcut-log.html and pages/shortcuts.html (the
// phone's shortcuts). Each keeps its own state names and labels, because the
// evidence differs: a file is confirmed by hand, a shortcut reports its own
// build. What they share is the reading a person acts on, which is the tone.
//
//   current   the copy is known to match           filled check
//   assumed   present, not verified                outline check
//   behind    GitHub has a newer version           up arrow
//   new       on GitHub, not yet installed         plus
//   differs   the copy is known to differ          warning
//   none      nothing to install                   minus
(() => {
  const ICON = {
    current: 'ph-fill ph-check-circle text-success',
    assumed: 'ph ph-check-circle text-success',
    behind: 'ph-fill ph-arrow-circle-up text-warning',
    new: 'ph-fill ph-plus-circle text-info',
    differs: 'ph-fill ph-warning-circle text-error',
    none: 'ph ph-minus-circle text-base-content/40',
  };
  window.SyncStatus = { ICON, TONES: Object.keys(ICON) };
})();
