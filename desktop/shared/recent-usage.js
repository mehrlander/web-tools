/* Recent session activity and its separately dated input-context readings. */
(() => {
  'use strict';
  const LIMIT = 24, HOUR = 3600000;
  const names = {claude:'Claude'};
  const counters = ['cacheReadTokens','cacheWriteTokens','inputTokens','outputTokens','measuredSteps','reloads'];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
  const INFO = 'Claude sessions updated within the past hour, largest recorded input context first. Shading and minutes show time left in that activity window. Context includes cached input tokens and can predate the latest activity. Recent activity does not confirm that a cache remains available. Select a session to find it in Now.';

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
      return url.protocol === 'https:' && url.hostname === 'claude.ai' && !url.username && !url.password && !url.port && !url.search && !url.hash && match ? match[1] : '';
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
  function matchUsage(item,metadata,options = {}) {
    const now = instant(options.now ?? Date.now());
    if (now === null || item?.key !== 'claude' || item.kind !== 'cloud' || item.place && item.place !== 'cloud') return null;
    const readings = (Array.isArray(metadata?.sessions) ? metadata.sessions : []).map(row=>usageRow(row,now))
      .filter(row=>row&&row.provider==='claude'&&now-row.usageAt<=24*HOUR).sort((a,b)=>b.usageAt-a.usageAt);
    const exact = readings.find(row=>row.id&&row.id===item.id);
    const alias = typeof item.sessionUrl==='string' && /^https:\/\//i.test(item.sessionUrl) ? agentId(item.sessionUrl) : '';
    const reading = exact || readings.find(row=>!!alias&&/^session_[A-Za-z0-9_-]+$/.test(alias)&&alias===row.agentSessionId);
    if (!reading) return null;
    const values = ['inputTokens','cacheReadTokens','cacheWriteTokens','outputTokens'].map(key=>reading[key]);
    const sum = values.every(value=>value!==null) ? values.reduce((a,b)=>a+b,0) : null;
    return {...reading,totalTokens:count(sum),saved:metadata?.available===false};
  }
  function tokenBadge(item,metadata,options = {}) {
    const reading=matchUsage(item,metadata,options);
    if(!reading||reading.outputTokens===null)return '';
    styles();
    const label=reading.outputTokens.toLocaleString('en-US')+' output tokens across recorded main-conversation calls'+(reading.saved?' (saved reading)':'')+'. Tap for input and cache counts.';
    const coin='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v5c0 1.7 2.7 3 6 3 1.2 0 2.3-.2 3.2-.5M15 7v3M3 11c0 1.7 2.7 3 6 3M12 13c0-1.7 2-3 4.5-3s4.5 1.3 4.5 3-2 3-4.5 3-4.5-1.3-4.5-3Zm0 0v5c0 1.7 2 3 4.5 3s4.5-1.3 4.5-3v-5"/></svg>';
    return `<button type="button" class="session-token-badge" data-session-tokens="${esc(item.identity||item.id)}" title="${esc(label)}" aria-label="${esc(label)}">${coin}<span>${compact(reading.outputTokens).replace(/[mbt]$/,value=>value.toUpperCase())}</span></button>`;
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
.nru-head,.nru-row{display:grid;grid-template-columns:minmax(0,1fr) 54px 32px;gap:10px;align-items:center}
.nru-head{padding:8px 12px 5px}
.nru-head h2{font-size:12px;font-weight:600;line-height:18px;margin:0;flex:1;min-width:0;color:#a36342}
.nru-column{font-size:10px;color:#746f66;white-space:nowrap;text-align:right}
.nru-list{list-style:none;margin:0;padding:0}
.nru-row{position:relative;isolation:isolate;padding:6px 12px;min-height:34px;border-top:1px solid #eae7e2;text-decoration:none;color:inherit}
.nru-row::before{content:"";position:absolute;inset:0 auto 0 0;width:var(--nru-remaining,0%);background:rgba(192,126,87,.12);pointer-events:none;z-index:-1}
.nru-row:hover{background:#eeece7}.nru-row:focus-visible{outline:2px solid #047857;outline-offset:-2px}
.nru-title{min-width:0;font-size:13px;line-height:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nru-value{font-size:13px;line-height:20px;font-weight:550;font-variant-numeric:tabular-nums;white-space:nowrap;color:#736b60;text-align:right}
.nru-value[data-unknown]{color:#a8a29e}
.nru-time{font-size:12px;line-height:20px;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap;text-align:right;color:#945f40}
.nru-empty{padding:6px 12px 9px;color:#746f66;font-size:12px;line-height:18px;margin:0}
#now .feed-meta{font-size:12px;line-height:20px;min-height:20px;gap:5px;align-items:center}
#now .feed-meta>svg{width:14px;height:14px}
#now .feed-meta .session-status{width:20px;height:20px}
#now .feed-meta .session-status svg{width:16px;height:16px}
.session-token-badge{display:inline-flex;align-items:center;gap:3px;min-height:20px;padding:0 2px;border:0;background:none;color:#746f66;font:inherit;font-weight:550;font-variant-numeric:tabular-nums;white-space:nowrap;cursor:pointer}
.session-token-badge svg{width:14px;height:14px;flex:none}.session-token-badge:hover{background:#e9e7e1;border-radius:3px}.session-token-badge:focus-visible{outline:2px solid #047857;outline-offset:2px}
.session-token-breakdown{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:5px 12px;margin:10px 0;font-size:12px;line-height:18px}.session-token-breakdown dt,.session-token-breakdown dd{margin:0}.session-token-breakdown dd{text-align:right;font-variant-numeric:tabular-nums}
`;
    document.head.append(style);
  }
  function render(rows,options = {}) {
    styles();
    const now = instant(options.now ?? Date.now()) ?? Date.now();
    const list = (Array.isArray(rows) ? rows : []).filter(row => row?.key === 'claude' && past(row.activityAt,now) !== null && now-past(row.activityAt,now) <= HOUR).slice(0,LIMIT);
    return `<section class="nru" aria-label="Claude one-hour cache window"><header class="nru-head" title="${esc(INFO)}"><h2>Claude · 1h cache window</h2><span class="nru-column" title="Last recorded input context, including cached tokens">Context</span><span class="nru-column" title="Time left in the one-hour activity window">Left</span></header>${list.length ? `<ul class="nru-list">${list.map(row => {
      const title = String(row.title || 'Claude session'), context = count(row.contextTokens), usageAt = past(row.usageAt,now);
      const label = context === null ? 'Context size not reported' : context.toLocaleString('en-US') + ' context tokens' + (usageAt === null ? '' : ', measured ' + new Date(usageAt).toLocaleString());
      const remaining = Math.max(0,Math.min(HOUR,HOUR-(now-past(row.activityAt,now))));
      const minutes = Math.ceil(remaining/60000), timeLabel = minutes + (minutes === 1 ? ' minute' : ' minutes') + ' left in the one-hour activity window since last observed activity';
      return `<li><a class="nru-row" style="--nru-remaining:${(remaining/HOUR*100).toFixed(3)}%" data-recent-session="${esc(row.identity)}" href="${esc(destination(row))}" title="${esc(title + '. ' + label + '. ' + timeLabel)}" aria-label="${esc(title + '. ' + label + '. ' + timeLabel + '. Show session in Now')}"><span class="nru-title">${esc(title)}</span><span class="nru-value"${context === null ? ' data-unknown' : ''}>${context === null ? '&#8211;' : compact(context)}</span><span class="nru-time">${minutes}m</span></a></li>`;
    }).join('')}</ul>` : '<p class="nru-empty">No Claude sessions updated in the past hour.</p>'}</section>`;
  }
  window.NowRecentUsage = {select,render,matchUsage,tokenBadge,INFO,LIMIT};
})();
