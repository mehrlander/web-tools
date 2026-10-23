(() => {
  'use strict';
  const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  class ReviewStore {
    constructor(machine) {
      this.key = `web-tools-now-reviewed:${machine}`;
      this.load();
    }
    load() {
      let value;
      try { value = JSON.parse(localStorage.getItem(this.key)); } catch { }
      this.since = Number.isFinite(value?.since) && value.since <= Date.now() ? value.since : Date.now() - 86400000;
      this.seen = value?.seen && typeof value.seen === 'object' && !Array.isArray(value.seen) ? value.seen : {};
      this.save();
    }
    save() { try { localStorage.setItem(this.key, JSON.stringify({since:this.since,seen:this.seen})); } catch { } }
    pending(changes = []) {
      return (Array.isArray(changes) ? changes : []).filter(c => c.key && c.id && Date.parse(c.at) >= this.since && this.seen[c.key] !== c.id);
    }
    mark(changes) {
      this.load();
      for (const change of changes) this.seen[change.key] = change.id;
      this.seen = Object.fromEntries(Object.entries(this.seen).slice(-300));
      this.save();
    }
  }
  const safeLink = value => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password && !url.port
        && (url.hostname === 'mehrlander.github.io' && url.pathname.startsWith('/web-tools/')
          || url.hostname === 'github.com' && /^\/[\w.-]+\/[\w.-]+\/pull\/[1-9]\d*$/.test(url.pathname)) ? url.href : '';
    } catch { return ''; }
  };
  function checkpoint(cp, {stamp, link}) {
    if (!cp) return '';
    const turns = (cp.turns || []).slice(0,3);
    const latest = turns[0];
    const facts = latest ? [[latest.files,latest.files === 1 ? 'file edited' : 'files edited'],[latest.pushes,latest.pushes === 1 ? 'branch pushed' : 'branches pushed'],[latest.agents,latest.agents === 1 ? 'agent task' : 'agent tasks']]
      .filter(([n]) => Number.isSafeInteger(n) && n > 0).map(([n,label]) => `<span class="rounded bg-violet-50 px-2 py-1 text-xs text-violet-900">${n} ${label}</span>`).join('') : '';
    return `<section class="mt-5 border-t border-stone-200 pt-4"><h3 class="text-sm font-semibold text-violet-900">Published checkpoint</h3><p class="mt-1 text-xs text-stone-500">${escape(stamp(cp.at))}</p>${cp.summary ? `<p class="mt-3 text-pretty text-base leading-7">${escape(cp.summary)}</p>` : ''}${facts ? `<p class="mt-3 text-xs text-stone-500">Latest exchange</p><div class="mt-1 flex flex-wrap gap-2" aria-label="Recorded activity in the latest exchange">${facts}</div>` : ''}${cp.links?.length ? `<div class="mt-3 flex flex-wrap gap-2">${cp.links.map((l,i) => safeLink(l.url) ? link(l,i) : '').join('')}</div>` : ''}${turns.length ? `<ol class="mt-5 space-y-4">${turns.map(t => `<li><h4 class="text-sm font-medium text-stone-700">${escape(t.headline || `Exchange ${t.turn + 1}`)}</h4><p class="mt-1 text-pretty text-base leading-7 text-stone-600">${escape(t.summary)}</p></li>`).join('')}</ol>` : ''}</section>`;
  }
  window.NowView = {ReviewStore,safeLink,checkpoint};
})();
