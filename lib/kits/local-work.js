// Observations establish file presence and Git relationships, never a backup.
(() => {
  const labels = { 'local-commits': 'Ahead of the checked branch',
    pushed: 'Committed content pushed', unknown: 'Publication unknown' };
  function freshness(snapshot, now = Date.now()) {
    const at = Date.parse(snapshot?.observedAt || '');
    return !Number.isFinite(at) || at > now + 60000 || now - at > 30 * 60000 ? 'Last observation' : 'Recent observation';
  }
  function preservation(row) {
    return labels[row?.publication] || labels.unknown;
  }
  function integration(row) {
    return row?.integration === 'incorporated' ? 'Committed content is in the default branch' : 'Incorporation not established';
  }
  function rows(snapshot, query = '') {
    const words = String(query).toLowerCase().trim().split(/\s+/).filter(Boolean);
    return (Array.isArray(snapshot?.checkouts) ? snapshot.checkouts : []).filter(r =>
      words.every(w => [r.repo, r.path, r.branch, r.scope, ...(r.sessions || []).map(s => s.title)].join(' ').toLowerCase().includes(w)))
      .sort((a, b) => Number(Boolean(b.changed || b.untracked)) - Number(Boolean(a.changed || a.untracked)));
  }
  function sessionUrl(id, path) {
    if (/^sessions\/\d{4}\/\d{2}\/\d{4}-\d{2}-\d{2}-[a-f0-9]+\.json$/.test(path || ''))
      return 'https://mehrlander.github.io/web-tools/pages/session.html#gh=mehrlander/web-tools-private@main:' + path;
    return /^[a-f0-9]{8,64}$/.test(id || '') ? 'https://mehrlander.github.io/web-tools/app/?view=sessions&session=' + id : '';
  }
  window.LocalWork = { freshness, preservation, integration, rows, sessionUrl };
})();
