/* Recent session activity and its separately dated input-context readings. */
(() => {
  'use strict';
  const LIMIT = 24, HOUR = 3600000;
  const names = {claude:'Claude',codex:'Codex',gemini:'Gemini'};
  const counters = ['cacheReadTokens','cacheWriteTokens','inputTokens','outputTokens','measuredSteps','reloads'];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
  const scope = value => typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.min(24,value) : 1;
  const INFO = 'Sessions with activity in the selected time window, largest observed input context first. Context readings can predate the latest activity. A recent response does not confirm that a prompt cache remains available. Token details cover all recorded calls, rather than only the selected time window.';

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
    const cutoff = now - scope(options.hours) * HOUR, byRecord = new Map(), byAgent = new Map();
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

  function age(at,now) {
    const minutes = Math.floor((now-at)/60000);
    return minutes < 1 ? 'just now' : minutes < 60 ? minutes + 'm ago' : minutes < 1440 ? Math.floor(minutes/60) + 'h ago' : Math.floor(minutes/1440) + 'd ago';
  }
  const compact = value => new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(value).toLowerCase();
  const stamp = at => new Date(at).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  const mark = provider => window.assistantMark?.svg(provider,{cls:'nru-mark'}) || `<span class="nru-monogram" aria-hidden="true">${names[provider][0]}</span>`;
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${name === 'more' ? 3 : 1.7}" stroke-linecap="round" aria-hidden="true"><path d="${name === 'more' ? 'M12 5h.01M12 12h.01M12 19h.01' : 'M12 8h.01M12 11v6M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0'}"/></svg>`;
  function styles() {
    if (typeof document === 'undefined' || document.getElementById('now-recent-usage-style')) return;
    const style = document.createElement('style');
    style.id = 'now-recent-usage-style';
    style.textContent = `
.nru{border-top:1px solid #e7e5e4;margin-top:10px;color:#292524;font-family:inherit}
.nru *{box-sizing:border-box}.nru button{font:inherit;color:inherit;cursor:pointer;border:0;background:none}
.nru button:focus-visible{outline:2px solid #047857;outline-offset:2px}
.nru-head{display:flex;align-items:center;gap:8px;padding:10px 12px 7px}.nru-head h2{font-size:12px;font-weight:600;line-height:18px;margin:0;flex:1;min-width:0}
.nru-range{display:inline-flex;gap:2px;padding:2px;border-radius:6px;background:#e9e7e3;flex-shrink:0}
.nru-range button{min-width:31px;padding:2px 7px;font-size:10px;line-height:15px;border-radius:4px;color:#78716c}
.nru-range button[aria-pressed=true]{background:#fff;color:#44403c;box-shadow:0 1px 3px #29252416}
.nru-info{width:26px;height:26px;display:grid;place-items:center;color:#8a837b!important;flex-shrink:0}.nru-info svg{width:14px;height:14px}
.nru-list{list-style:none;margin:0;padding:0}.nru-row{display:grid;grid-template-columns:18px minmax(0,1fr) 65px 28px;gap:8px;align-items:start;padding:9px 12px;border-top:1px solid #eae7e2;min-height:62px}
.nru-provider{padding-top:2px}.nru-mark{display:block;width:17px;height:17px}.nru-monogram{font-size:12px;font-weight:600}
.nru-provider[data-provider=claude]{color:#cb7852}.nru-provider[data-provider=codex]{color:#119c80}.nru-provider[data-provider=gemini]{color:#3478df}
.nru-copy{min-width:0}.nru-title{font-size:13px;font-weight:500;line-height:18px;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.nru-meta{font-size:11px;color:#746f66;line-height:16px;margin-top:3px;overflow-wrap:anywhere}
.nru-metric{text-align:right;padding:0;min-height:40px;font-variant-numeric:tabular-nums;display:flex;flex-direction:column;align-items:flex-end;justify-content:flex-start}
.nru-value{font-size:15px;line-height:20px;font-weight:550}.nru-unit{font-size:10px;line-height:14px;color:#746f66}.nru-metric[data-unknown] .nru-value{color:#a8a29e}
.nru-more{width:28px;height:36px;display:grid;place-items:center;color:#8a837b!important;padding:0}.nru-more svg{width:17px;height:17px}
.nru-empty{padding:12px;color:#8a837b;font-size:12px;line-height:18px;margin:0}.nru-cap{padding:6px 12px;color:#8a837b;font-size:10px;margin:0}
.nru-detail p{font-size:12px;line-height:18px;margin:6px 0}.nru-detail dl{margin:9px 0;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:5px 16px;font-size:12px}.nru-detail dt,.nru-detail dd{margin:0}.nru-detail dd{font-variant-numeric:tabular-nums;text-align:right}.nru-detail small{display:block;font-size:11px;line-height:17px;color:#78716c}
`;
    document.head.append(style);
  }
  function render(rows,options = {}) {
    styles();
    const now = instant(options.now ?? Date.now()) ?? Date.now(), hours = scope(options.hours);
    const list = (Array.isArray(rows) ? rows : []).filter(row => row && names[row.key]).slice(0,LIMIT);
    return `<section class="nru" aria-label="Recent sessions"><header class="nru-head"><h2>Recent sessions</h2><div class="nru-range" role="group" aria-label="Recent session time window">${[1,24].map(value => `<button type="button" data-recent-hours="${value}" aria-label="Past ${value === 1 ? 'hour' : '24 hours'}" aria-pressed="${hours === value}">${value}h</button>`).join('')}</div><button type="button" class="nru-info" data-recent-usage-info aria-label="About recent session context">${icon('info')}</button></header>${list.length ? `<ul class="nru-list">${list.map(row => {
      const title = String(row.title || names[row.key] + ' session'), identity = esc(row.identity), context = count(row.contextTokens);
      const activityAt = past(row.activityAt,now), usageAt = past(row.usageAt,now);
      const activity = activityAt === null ? 'Activity time unavailable' : 'Updated ' + age(activityAt,now);
      const contextAge = usageAt !== null && (activityAt === null || age(usageAt,now) !== age(activityAt,now)) ? ' · Context ' + age(usageAt,now) : '';
      const place = row.place === 'cloud' ? 'Cloud' : row.place === 'laptop' ? 'Laptop' : '';
      const label = context === null ? 'Context not recorded' : context.toLocaleString('en-US') + ' input context tokens' + (usageAt === null ? '' : ', recorded ' + stamp(usageAt));
      return `<li class="nru-row" data-recent-session="${identity}"><span class="nru-provider" data-provider="${row.key}" role="img" aria-label="${names[row.key]}">${mark(row.key)}</span><div class="nru-copy"><div class="nru-title">${esc(title)}</div><div class="nru-meta">${esc((place ? place + ' · ' : '') + activity + contextAge)}</div></div><button type="button" class="nru-metric" data-recent-usage-detail="${identity}"${context === null ? ' data-unknown' : ''} aria-label="${esc(label + ' for ' + title)}"><span class="nru-value">${context === null ? '&#8211;' : compact(context)}</span><span class="nru-unit">context</span></button><button type="button" class="nru-more" data-recent-session-actions="${identity}" aria-label="${esc('Actions for ' + title)}" aria-haspopup="menu" aria-expanded="false">${icon('more')}</button></li>`;
    }).join('')}</ul>` : `<p class="nru-empty">No sessions active in the past ${hours === 1 ? 'hour' : hours + ' hours'}.</p>`}${Number.isSafeInteger(options.total) && options.total > list.length ? `<p class="nru-cap">Showing ${list.length} of ${options.total} recent sessions.</p>` : ''}</section>`;
  }
  function detail(row,options = {}) {
    styles();
    const now = instant(options.now ?? Date.now()) ?? Date.now(), usageAt = past(row?.usageAt,now), context = count(row?.contextTokens);
    const value = key => { const n = count(row?.usage?.[key]); return n === null ? 'Not recorded' : n.toLocaleString('en-US'); };
    return `<div class="nru-detail"><p>${context === null ? 'Context has not been recorded for this session.' : `${context.toLocaleString('en-US')} input context tokens${usageAt === null ? '.' : ', recorded ' + esc(stamp(usageAt)) + ' (' + esc(age(usageAt,now)) + ').'}`}</p><small>Context is the input read by the last observed model call, including cache reads and writes. Output is separate. A recent response does not confirm that a prompt cache remains available.</small><p><strong>All recorded calls</strong></p><dl>${[['Fresh input','inputTokens'],['Cache read','cacheReadTokens'],['Cache write','cacheWriteTokens'],['Output','outputTokens'],['Model calls','measuredSteps'],['Large rewrites','reloads']].map(([name,key]) => `<dt>${name}</dt><dd>${value(key)}</dd>`).join('')}</dl><small>Token sums cover the recorded session, rather than only the selected time window. Large rewrites follow the recorded cache-write heuristic; the signals do not identify the cause of a rewrite.</small></div>`;
  }
  window.NowRecentUsage = {select,render,detail,INFO,LIMIT};
})();
