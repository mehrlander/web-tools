// Diagnostic for vanilla-bundle.js load issue
// Run this in the browser console and share the output

console.log('=== VANILLA-BUNDLE DIAGNOSTICS ===\n');

// 1. Check registry state
console.log('1. Current __loadedScripts:');
const vbEntry = window.__loadedScripts?.find(e => e.path === 'vanilla-bundle.js');
if (vbEntry) {
  console.log(JSON.stringify({
    path: vbEntry.path,
    status: vbEntry.status,
    auto: vbEntry.auto,
    by: Array.from(vbEntry.by || []),
    error: vbEntry.error,
    elapsed: vbEntry.endT ? vbEntry.endT - vbEntry.t : null
  }, null, 2));
} else {
  console.log('vanilla-bundle.js not found in registry');
}

// 2. Check if window.copy exists
console.log('\n2. window.copy availability:');
console.log('typeof window.copy:', typeof window.copy);
if (typeof window.copy === 'function') {
  console.log('✓ window.copy is defined');
  try {
    const result = window.copy('test');
    console.log('✓ window.copy("test") executed:', result);
  } catch (e) {
    console.log('✗ window.copy("test") threw:', e.message);
  }
} else {
  console.log('✗ window.copy is NOT defined');
}

// 3. Check if other vanilla-bundle functions exist
console.log('\n3. vanilla-bundle utilities:');
const checks = [
  'ea', 'el', 'ids', 'ui', 'grab', 'html', 'fill',
  'attr', 'cls', 'listen', 'data', 'tpl', 'on', 'route'
];
const available = checks.filter(name => typeof window[name] !== 'undefined');
const missing = checks.filter(name => typeof window[name] === 'undefined');
console.log('Available:', available.length, '/', checks.length);
if (missing.length > 0) {
  console.log('Missing:', missing);
}

// 4. Check for load cache and promises
console.log('\n4. Internal state (if accessible):');
console.log('window.__vanilla_bundle_loaded:', window.__vanilla_bundle_loaded);

// 5. Check console for errors during page load
console.log('\n5. Raw __loadedScripts (all):');
if (window.__loadedScripts) {
  window.__loadedScripts.forEach((e, i) => {
    const status = e.status === 'ok' ? '✓' : e.status === 'pending' ? '⏳' : '✗';
    const by = Array.from(e.by || []).join(', ') || 'none';
    console.log(`${i}. ${status} ${e.path} (${e.status}, by: ${by})`);
  });
} else {
  console.log('__loadedScripts does not exist');
}

// 6. Try to find any error messages in the page
console.log('\n6. Page console errors (if any captured):');
if (window.__consoleLogs && window.__consoleLogs.length > 0) {
  const errors = window.__consoleLogs.filter(e => e.level === 'error');
  if (errors.length > 0) {
    errors.forEach(e => {
      console.log(`ERROR: ${e.msg}`);
    });
  } else {
    console.log('No errors in __consoleLogs');
  }
}

console.log('\n=== END DIAGNOSTICS ===');
