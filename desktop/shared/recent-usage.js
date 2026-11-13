/* Recent session activity and its separately dated input-context readings. */
(() => {
  'use strict';
  const LIMIT = 24, HOUR = 3600000;
  const names = {claude:'Claude'};
  const counters = ['cacheReadTokens','cacheWriteTokens','inputTokens','outputTokens','measuredSteps','reloads'];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
  const INFO = 'Claude sessions updated within the past hour, largest recorded input context first. Context includes cached input tokens and can predate the latest activity. Recent activity does not confirm that a cache remains available. Select a session to find it in Now.';

  function instant(value) {
    if (typeof value === 'string') {
      const match = /^(\d{4})-(\d{2})-(\d{2})T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-](?:[01]\d|2[0-3]):?[0-5]\d)$/i.exec(value);
      if (!match) return null;
      const calendar = new Date(0);
      calendar.setUTCFullYear(+match[1],+match[2]-1,+match[3]);
      if (calendar.toISOString().slice(0,10) !== value.slice(0,10)) return null;
      value = Date.parse(value);
    }
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && Number.isFinite(+new Date(value)) ? value : null;
  }
  const past = (value,now) => { const at = instant(value); return at !== null && at <= now ? at : null; };
  function agentId(value) {
    if (typeof value !== 'string') return '';
    const text = value.trim();
    if (/^[A-Za-z0-9._-]{1,512}$/.test(text)) return text;
    try {
      const url = new URL(text);
      const match = /^\/code\/(session_[A-Za-z0-9_-]+)\/?$/.exec(url.pathname);
      return url.protocol === 'https:' && url.hostname === 'claude.ai' && !url.username && !url.password && match ? match[1] : '';
    } catch { return ''; }
  }
  const textId = value => typeof value === 'string' && value.trim() ? value.trim() : '';
  function usageRow(row,now) {
    const provider = typeof row?.provider === 'string' ? row.provider.toLowerCase() : '';
    const usageAt = past(row?.usageAt,now);
    if (!names[provider] || usageAt === null) return null;
    return {id:textId(row.id),agentSessionId:agentId(row.agentSessionId),provider,usageAt,
      title:typeof row.title === 'string' ? row.title : '',sessionUrl:typeof row.sessionUrl === 'string' ? row.sessionUrl : '',
      contextTokens:count(row.contextTokens),...Object.fromEntries(counters.map(key => [key,count(row[key])]))};
  }
  function select(items,metadata,options = {}) {
    const now = instant(options.now ?? Date.now());
    if (now === null) return [];
    const cutoff = now - HOUR, byRecord = new Map(), byAgent = new Map();
    const keep = (map,key,row) => {
      if (key && (!map.has(key) || map.get(key).usageAt < row.usageAt)) map.set(key,row);
    };
    for (const source of Array.isArray(metadata?.sessions) ? metadata.sessions : []) {
      const row = usageRow(source,now);
      if (!row) continue;
      keep(byRecord,row.id ? row.provider + ':' + row.id : '',row);
      keep(byAgent,row.agentSessionId ? row.provider + ':' + row.agentSessionId : '',row);
    }
    const found = new Map();
    for (const item of Array.isArray(items) ? items : []) {
      if (!item || !names[item.key] || !['session','cloud'].includes(item.kind)) continue;
      const id = textId(item.id), identity = textId(item.identity) || id;
      if (!identity) continue;
      let usage = id ? byRecord.get(item.key + ':' + id) : null;
      if (!usage) {
        const candidates = [item.id,item.sessionUrl,item.url].map(agentId).filter(Boolean)
          .map(key => byAgent.get(item.key + ':' + key)).filter(Boolean);
        usage = candidates.sort((a,b) => b.usageAt-a.usageAt)[0] || null;
      }
      const itemAt = past(item.at,now), usageAt = usage?.usageAt ?? null;
      const activityAt = itemAt === null ? usageAt : usageAt === null ? itemAt : Math.max(itemAt,usageAt);
      if (activityAt === null || activityAt < cutoff) continue;
      const place = String(item.place || (item.kind === 'cloud' ? 'cloud' : 'laptop')).toLowerCase();
      const row = {...item,id,identity,place,at:activityAt,itemAt,activityAt,usageAt,
        contextTokens:usage?.contextTokens ?? null,usage:usage || null,
        metadataObservedAt:past(metadata?.observedAt,now)};
      const key = [item.key,item.kind,place,identity].join('\0'), old = found.get(key);
      if (!old || activityAt > old.activityAt || activityAt === old.activityAt && (itemAt ?? -1) > (old.itemAt ?? -1)) found.set(key,row);
    }
    // The activity feed is bounded independently of usage metadata. Keep
    // recent measured cloud sessions even when they fell outside that feed.
    const selected = [], cloudRecords = new Set(), cloudAgents = new Set();
    const aliases = row => ({
      records:[row.id,row.usage?.id].map(textId).filter(Boolean),
      agents:[row.id,row.sessionUrl,row.usage?.agentSessionId,row.usage?.sessionUrl].map(agentId).filter(Boolean)
    });
    const cloud = row => {
      const keys = aliases(row), duplicate = keys.records.some(id => cloudRecords.has(row.key + ':' + id))
        || keys.agents.some(id => cloudAgents.has(row.key + ':' + id));
      for (const id of keys.records) cloudRecords.add(row.key + ':' + id);
      for (const id of keys.agents) cloudAgents.add(row.key + ':' + id);
      return duplicate;
    };
    for (const row of [...found.values()].sort((a,b) => b.activityAt-a.activityAt || (b.itemAt ?? -1)-(a.itemAt ?? -1))) {
      if (row.kind !== 'cloud' || !cloud(row)) selected.push(row);
    }
    for (const usage of [...byRecord.values()].sort((a,b) => b.usageAt-a.usageAt)) {
      if (usage.provider !== 'claude' || usage.contextTokens === null || usage.usageAt < cutoff) continue;
      const row = {key:'claude',id:usage.id,identity:'cloud:' + usage.id,kind:'cloud',place:'cloud',
        title:usage.title || 'Claude session',state:'recorded',at:usage.usageAt,itemAt:null,activityAt:usage.usageAt,
        usageAt:usage.usageAt,contextTokens:usage.contextTokens,usage,sessionUrl:usage.sessionUrl,
        url:'https://mehrlander.github.io/web-tools/app/?view=sessions&session=' + encodeURIComponent(usage.id),
        metadataObservedAt:past(metadata?.observedAt,now)};
      if (!cloud(row)) selected.push(row);
    }
    return selected.sort((a,b) => {
      const knownA = a.contextTokens !== null, knownB = b.contextTokens !== null;
      return Number(knownB)-Number(knownA) || (knownA ? b.contextTokens-a.contextTokens : 0)
        || b.activityAt-a.activityAt || a.identity.localeCompare(b.identity);
    }).slice(0,LIMIT);
  }

  const compact = value => new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(value).toLowerCase();
  function destination(row) {
    return '#view=now&session=' + encodeURIComponent(String(row.identity || row.id || ''));
  }
  function styles() {
    if (typeof document === 'undefined' || document.getElementById('now-recent-usage-style')) return;
    const style = document.createElement('style');
    style.id = 'now-recent-usage-style';
    style.textContent = `
.nru{border-top:1px solid #e7e5e4;margin-top:8px;color:#292524;font-family:inherit}
.nru *{box-sizing:border-box}
.nru-head{display:flex;align-items:center;gap:10px;padding:8px 12px 5px}
.nru-head h2{font-size:12px;font-weight:600;line-height:18px;margin:0;flex:1;min-width:0;color:#a36342}
.nru-column{font-size:10px;color:#746f66;white-space:nowrap}
.nru-list{list-style:none;margin:0;padding:0}
.nru-row{display:grid;grid-template-columns:minmax(0,1fr) max-content;gap:12px;align-items:center;padding:6px 12px;min-height:34px;border-top:1px solid #eae7e2;text-decoration:none;color:inherit}
.nru-row:hover{background:#eeece7}.nru-row:focus-visible{outline:2px solid #047857;outline-offset:-2px}
.nru-title{min-width:0;font-size:13px;line-height:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nru-value{font-size:13px;line-height:20px;font-weight:550;font-variant-numeric:tabular-nums;white-space:nowrap;color:#736b60}
.nru-value[data-unknown]{color:#a8a29e}
.nru-empty{padding:6px 12px 9px;color:#746f66;font-size:12px;line-height:18px;margin:0}
`;
    document.head.append(style);
  }
  function render(rows,options = {}) {
    styles();
    const now = instant(options.now ?? Date.now()) ?? Date.now();
    const list = (Array.isArray(rows) ? rows : []).filter(row => row?.key === 'claude' && past(row.activityAt,now) !== null && now-row.activityAt <= HOUR).slice(0,LIMIT);
    return `<section class="nru" aria-label="Claude one-hour cache window"><header class="nru-head" title="${esc(INFO)}"><h2>Claude · 1h cache window</h2><span class="nru-column" title="Last recorded input context, including cached tokens">Context</span></header>${list.length ? `<ul class="nru-list">${list.map(row => {
      const title = String(row.title || 'Claude session'), context = count(row.contextTokens), usageAt = past(row.usageAt,now);
      const label = context === null ? 'Context size not reported' : context.toLocaleString('en-US') + ' context tokens' + (usageAt === null ? '' : ', measured ' + new Date(usageAt).toLocaleString());
      return `<li><a class="nru-row" data-recent-session="${esc(row.identity)}" href="${esc(destination(row))}" title="${esc(title + '. ' + label)}" aria-label="${esc(title + '. ' + label + '. Show session in Now')}"><span class="nru-title">${esc(title)}</span><span class="nru-value"${context === null ? ' data-unknown' : ''}>${context === null ? '&#8211;' : compact(context)}</span></a></li>`;
    }).join('')}</ul>` : '<p class="nru-empty">No Claude sessions updated in the past hour.</p>'}</section>`;
  }
  window.NowRecentUsage = {select,render,INFO,LIMIT};
})();
