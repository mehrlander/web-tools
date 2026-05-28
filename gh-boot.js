// gh-boot.js — auto-loaded by gh-api.js's bootstrap. The list of scripts
// pulled at startup lives here, not in gh-api.js, so adding new entries
// doesn't require purging gh-api.js from the jsDelivr cache.
//
// gh.load() awaits its loaded script's return value, so we return the
// async IIFE's promise to make the boot chain awaitable.

return (async () => {
  if (!window.gh) throw new Error('gh-boot.js requires window.gh');
  await window.gh.load('gh-auth.js');
  await window.gh.load('gh-fetch.js');
})();
