/* Account allowances. Context capacity and token totals are deliberately separate. */
(() => {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const names = {codex:'Codex',gemini:'Gemini',claude:'Claude'};
  const colours = {codex:'text-emerald-700',gemini:'text-blue-700',claude:'text-orange-700'};
  const fills = {codex:'bg-emerald-500',gemini:'bg-blue-500',claude:'bg-orange-400'};
  const pages = {codex:'https://chatgpt.com/settings/usage',gemini:'https://antigravity.google.com/',claude:'https://claude.ai/settings/usage'};
  const openIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" class="size-3.5" aria-hidden="true"><path d="M14 4h6v6M20 4 10 14M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/></svg>';
  const valid = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
  const duration = minutes => !Number.isFinite(minutes) || minutes <= 0 ? '' : minutes < 60 ? `${minutes}m` : minutes < 1440 ? `${+(minutes / 60).toFixed(1)}h` : `${+(minutes / 1440).toFixed(1)}d`;
  const date = value => new Date(value).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  const percent = value => `${+value.toFixed(1)}%`;
  function pace(row, now, stale) {
    const reset = Date.parse(row.resetsAt), minutes = row.durationMinutes;
    if (stale || reset <= now || !Number.isFinite(minutes) || minutes <= 0) return null;
    const elapsed = Math.max(0, Math.min(100, (now - (reset - minutes * 60000)) / (minutes * 60000) * 100));
    const delta = row.usedPercent - elapsed, points = Math.round(Math.abs(delta));
    return {elapsed, over:Math.max(0,delta), text:points ? `${points} percentage points ${delta > 0 ? 'over' : 'under'} even pace` : 'On even pace'};
  }
  function paceMark(value, compact = false) {
    if (!value) return '';
    const position = value.elapsed.toFixed(1);
    return `${value.over > 0 ? `<span data-over-pace aria-hidden="true" class="absolute inset-y-0 rounded-r-full bg-amber-500" style="left:${position}%;width:${value.over.toFixed(1)}%"></span>` : ''}<span data-elapsed="${position}" class="absolute -top-0.5 ${compact ? 'h-2' : 'h-3'} w-px bg-stone-800" style="left:calc(${position}% - 1px)" aria-hidden="true"></span>`;
  }
  function countdown(reset, now) {
    const minutes = Math.ceil((Date.parse(reset) - now) / 60000);
    if (minutes <= 0) return 'Reset due';
    if (minutes < 60) return `Resets in ${minutes}m`;
    if (minutes < 1440) return `Resets in ${Math.floor(minutes / 60)}h ${minutes % 60}m`;
    return `Resets in ${Math.floor(minutes / 1440)}d ${Math.floor(minutes % 1440 / 60)}h`;
  }
  function grouped(provider) {
    const groups = [];
    for (const row of provider.windows || []) {
      if (!valid(row.usedPercent) || !Number.isFinite(Date.parse(row.resetsAt))) continue;
      const family = provider.provider === 'gemini' ? row.label.replace(/\s*\((Low|Medium|High)\)$/i, '') : row.label;
      const existing = provider.provider === 'gemini' && groups.find(w => w.label === family && w.usedPercent === row.usedPercent && w.resetsAt === row.resetsAt && w.durationMinutes === row.durationMinutes && JSON.stringify(w.history || []) === JSON.stringify(row.history || []));
      if (existing) existing.models.push(...(row.models || [row.label]));
      else groups.push({...row,label:family,models:[...(row.models || [])]});
    }
    return groups;
  }
  function trend(row, now) {
    const start = row.durationMinutes ? Date.parse(row.resetsAt) - row.durationMinutes * 60000 : -Infinity;
    const points = (row.history || []).filter(p => valid(p.usedPercent) && Date.parse(p.resetsAt) === Date.parse(row.resetsAt) && Date.parse(p.at) >= start && Date.parse(p.at) <= now).sort((a,b) => Date.parse(a.at) - Date.parse(b.at));
    if (points.length < 2 || Date.parse(points.at(-1).at) <= Date.parse(points[0].at)) return '';
    const first = Date.parse(points[0].at), span = Date.parse(points.at(-1).at) - first;
    const path = points.map((p,i) => `${i ? 'L' : 'M'}${((Date.parse(p.at) - first) / span * 300).toFixed(1)},${(22 - p.usedPercent / 100 * 20).toFixed(1)}`).join(' ');
    return `<div class="mt-1 flex items-center gap-2"><svg data-usage-trend viewBox="0 0 300 24" preserveAspectRatio="none" role="img" aria-label="Observed usage from ${escape(date(points[0].at))} to ${escape(date(points.at(-1).at))}" class="h-5 min-w-0 flex-1"><path d="M0 23H300" stroke="currentColor" stroke-opacity=".12"/><path d="${path}" fill="none" stroke="currentColor" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg><span class="shrink-0 text-[10px] text-stone-500">${percent(points[0].usedPercent)} → ${percent(points.at(-1).usedPercent)}</span></div>`;
  }
  function allowance(row, provider, stale, now) {
    const reset = Date.parse(row.resetsAt), expired = reset <= now;
    const period = duration(row.durationMinutes);
    const budget = pace(row,now,stale), elapsed = budget?.elapsed ?? null;
    const used = row.usedPercent;
    const title = `${row.label}${row.models?.length > 1 ? ': ' + row.models.join(', ') : ''}. Reset ${date(row.resetsAt)}${budget ? `. ${Math.round(elapsed)}% of window elapsed. ${budget.text}.` : !period ? '. Window length not reported.' : ''}`;
    const heading = period ? `${period}${row.label.toLowerCase() !== provider && row.label !== 'All models' ? ' · ' + row.label : ''}` : row.label;
    return `<div data-usage-window="${escape(row.id)}" class="py-2" title="${escape(title)}"><div class="flex items-baseline justify-between gap-2 text-xs"><span class="min-w-0 break-words font-medium">${escape(heading)}</span><span class="shrink-0 tabular-nums ${used >= 90 && !expired ? 'text-rose-700' : 'text-stone-600'}">${expired ? 'Awaiting reset reading' : `${percent(used)} used${stale ? ' · last reading' : ''}`}</span></div><div ${expired ? 'aria-hidden="true"' : `role="progressbar" aria-label="${escape(names[provider] + ' ' + heading + ' allowance used' + (budget ? '. ' + budget.text : ''))}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${used}"`} class="relative mt-1.5 h-2 rounded-full bg-stone-200"><span class="absolute inset-y-0 left-0 rounded-full ${expired || stale ? 'bg-stone-400' : used >= 90 ? 'bg-rose-500' : fills[provider]}" style="width:${used}%"></span>${paceMark(budget)}</div><div class="mt-1 flex flex-wrap justify-between gap-x-2 gap-y-0.5 text-[10px] text-stone-500"><span>${escape(countdown(row.resetsAt,now))} · ${escape(date(row.resetsAt))}</span><span data-pace-status class="${budget?.over >= 0.5 ? 'text-amber-800' : ''}">${budget ? escape(budget.text) : !period ? 'Window length not reported' : 'Pace unavailable'}</span></div>${!expired ? trend(row,now) : ''}</div>`;
  }
  function compact(provider, options = {}) {
    const now = options.now ?? Date.now(), key = provider?.provider;
    const tip = options.tooltip ? 'data-title-tip' : 'title';
    const rows = grouped(provider || {}), periods = new Map();
    const observed = Date.parse(provider?.observedAt), age = now - observed;
    const stale = provider?.status !== 'available' || !Number.isFinite(observed) || age > 600000 || age < -60000;
    for (const row of rows) {
      const period = duration(row.durationMinutes) || 'Quota';
      const existing = periods.get(period);
      // Prefer the account-wide allowance; otherwise expose the most used model/bucket.
      const account = row.label === 'All models' || row.label.toLowerCase() === key;
      const existingAccount = existing && (existing.label === 'All models' || existing.label.toLowerCase() === key);
      if (!existing || account && !existingAccount || account === existingAccount && row.usedPercent > existing.usedPercent) periods.set(period,row);
    }
    const selected = [...periods].sort((a,b) => (a[1].durationMinutes || Infinity) - (b[1].durationMinutes || Infinity)).slice(0,2);
    if (!selected.length) return `<span data-compact-usage class="block text-[9px] leading-3 text-stone-400" ${tip}="${escape(provider?.notice || 'No usage reading available. See Usage for connection details.')}">Usage unavailable</span>`;
    const deadline = (selected.find(([,r]) => r.durationMinutes === 10080) || selected.at(-1))[1];
    const expiredDeadline = Date.parse(deadline.resetsAt) <= now;
    const resetLabel = new Date(deadline.resetsAt).toLocaleString([], {weekday:'short',hour:'numeric',minute:'2-digit'});
    const resetTip = `${deadline.durationMinutes === 10080 ? 'Week' : 'Quota'} resets ${date(deadline.resetsAt)}`;
    return `<span data-compact-usage class="block space-y-0.5">${selected.map(([period,row]) => {
      const expired = Date.parse(row.resetsAt) <= now;
      const name = period === '7d' ? 'Week' : period;
      const budget = pace(row,now,stale);
      const title = `${names[key] || 'Account'} · ${name} · ${row.label}: ${expired ? 'awaiting reset reading' : `${percent(row.usedPercent)} used${stale ? ' (last reading)' : ''}`}. ${countdown(row.resetsAt,now)} · ${date(row.resetsAt)}.${budget ? ` ${Math.round(budget.elapsed)}% of time elapsed. ${budget.text}.` : ''}${periods.size > 2 || rows.length > selected.length ? ' More limits in Usage.' : ''}`;
      return `<span data-compact-window="${escape(row.id)}" ${tip}="${escape(title)}" class="flex items-center gap-1 text-[9px] leading-[11px] text-stone-500"><span class="w-6 shrink-0 text-left">${escape(name)}</span><span ${expired ? 'aria-hidden="true"' : `role="progressbar" aria-label="${escape(title)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${row.usedPercent}"`} class="relative h-1 min-w-0 flex-1 rounded-full bg-stone-200"><span class="absolute inset-y-0 left-0 rounded-full ${stale || expired ? 'bg-stone-400' : row.usedPercent >= 90 ? 'bg-rose-500' : fills[key]}" style="width:${expired ? 0 : row.usedPercent}%"></span>${paceMark(budget,true)}</span><span class="w-8 shrink-0 text-right tabular-nums ${stale && !expired ? 'text-amber-800' : ''}">${expired ? '—' : `${Math.round(row.usedPercent)}%${stale ? '*' : ''}`}</span></span>`;
    }).join('')}<span data-compact-reset class="block truncate text-left text-[9px] leading-3 text-stone-500" ${tip}="${escape(resetTip)}">${expiredDeadline ? 'Reset due' : `Reset ${escape(resetLabel)}`}</span></span>`;
  }
  function render(providers = [], options = {}) {
    const now = options.now ?? Date.now();
    return `<section aria-label="Usage limits" class="divide-y divide-stone-200 bg-white">${Object.keys(names).filter(key => !options.provider || options.provider === key).map(key => {
      const provider = providers.find(p => p.provider === key);
      const observed = Date.parse(provider?.observedAt), age = now - observed;
      const stale = provider?.status !== 'available' || !Number.isFinite(observed) || age > 600000 || age < -60000;
      const rows = grouped(provider || {});
      const updated = !Number.isFinite(observed) ? '' : age < 60000 ? 'Read just now' : `Read ${Math.floor(Math.max(0,age) / 60000)}m ago`;
      const mark = window.assistantMark?.svg(key,{cls:'size-4 shrink-0'}) || '';
      const linkName = key === 'gemini' ? 'Open Antigravity' : `Open ${names[key]} usage page`;
      return `<section data-usage-provider="${key}" class="px-3 py-2"><div class="flex items-center justify-between gap-2"><div class="flex items-center gap-1"><h2 class="flex items-center gap-1.5 text-[13px] font-semibold ${colours[key]}">${mark}${names[key]}</h2><a data-usage-link="${key}" href="${pages[key]}" target="_blank" rel="noopener noreferrer" aria-label="${linkName}" title="${linkName}${key === 'gemini' ? ' · Model quotas are in Antigravity Settings' : ''}" class="flex size-7 items-center justify-center rounded text-stone-500 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-emerald-700">${openIcon}</a></div><span class="text-[10px] ${stale && rows.length ? 'text-amber-800' : 'text-stone-500'}">${rows.length ? escape(stale ? 'Last reading · ' + updated.toLowerCase() : updated) : provider?.status === 'available' ? 'No limits reported' : 'Not connected'}</span></div>${rows.length ? rows.map(row => allowance(row,key,stale,now)).join('') + (stale && provider.notice ? `<p class="pb-1 text-[11px] text-amber-800">${escape(provider.notice)}</p>` : '') : `<p class="py-2 text-xs text-stone-500">${escape(provider?.notice || (key === 'claude' ? 'Claude usage is not connected yet.' : 'Waiting for an account reading.'))}</p>`}<p class="text-[10px] text-stone-400">${escape(provider?.source || (key === 'claude' ? 'Claude account' : key === 'gemini' ? 'Antigravity account' : 'Codex account'))}${rows.some(r => r.models?.length > 1) ? ' · Identical model readings grouped' : ''}</p></section>`;
    }).join('')}<p class="px-3 py-2 text-[10px] leading-4 text-stone-500">Fill shows allowance used; the tick marks an even budget pace through the period. Amber shows usage above that pace. This comparison assumes even use, not a forecast. Unknown periods and stale readings have no pace marker. Trends begin with collected readings; resets never imply 0%.</p></section>`;
  }
  const workspaceStyle = document.createElement('style');
  workspaceStyle.textContent = `
    .usage-workspace{display:flex;flex-direction:column;gap:6px;min-width:0;padding-bottom:8px}
    .usage-workspace>section{min-width:0}
    .usage-workspace .usage-workspace-timeline{border-top:1px solid #e4e2de}
    .usage-workspace .usage-workspace-daily{min-height:0;border-top:1px solid #e4e2de}
#usage .usage{border:0}
.usage-provider-heading{grid-template-rows:26px;min-height:26px}
.usage-provider-heading .provider-name>span{display:flex;align-items:center;gap:5px}
.usage-provider-heading .provider-actions{grid-row:1}
.now-provider-strip{padding-block:7px 6px;border-bottom:1px solid #e4e2de}
.now-provider-strip .provider-heading{grid-template-rows:22px 17px}
.usage-workspace-overview .provider-strip{padding-block:8px 10px}
.usage-workspace-timeline .row-chart{padding-top:0;padding-bottom:6px}
.usage-workspace-timeline .history-grid{--identity-width:88px}
.usage-workspace-timeline .history-rail-tools{height:28px;gap:9px;padding:0}
.history-rail-tools h2{margin:0;font-size:13px;font-weight:600;color:#57534e}
.history-date-spacer{height:28px}
.usage-workspace-timeline .history-grid{--reset-lane-height:40px}
.usage-workspace-timeline .history-fixed-row{min-height:var(--reset-lane-height);display:flex;align-items:center}
.timeline-provider{display:flex;align-items:center;gap:5px;font-size:13px;font-weight:550;white-space:nowrap}
.timeline-provider .brand{height:16px;width:16px}
.usage-workspace-timeline .history-baseline{top:calc(var(--reset-lane-height)/2 - 7px)}
.usage-workspace-timeline .history-usage-marker{height:calc(var(--reset-lane-height) - 1px)}
.usage-workspace-timeline .history-usage-point{top:calc(var(--reset-lane-height)/2 - 11px)}
.usage-workspace-timeline .history-usage-value{top:calc(var(--reset-lane-height)/2 + 1px);font-size:12px}
.usage-workspace-daily .daily-allowance{padding-top:6px}
.usage-workspace-daily .daily-date-axis{display:grid;grid-template-columns:86px minmax(0,1fr);gap:10px;color:#8a8175;font-size:11px;line-height:14px}
.daily-date-axis>div{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;text-align:center}
.daily-date-axis b{display:block;font-weight:400;color:#6b665f}
.usage-workspace-daily .daily-allowance-grid{grid-template-columns:minmax(0,1fr);gap:0}
.usage-workspace-daily .daily-series{display:grid;grid-template-columns:86px minmax(0,1fr);gap:10px;align-items:center;padding:6px 0;border-bottom:1px solid #e7e3dc}
.usage-workspace-daily .daily-provider{padding:0;min-width:0}
.usage-workspace-daily .daily-bars{height:clamp(40px,calc((100dvh - 650px)/3 + 40px),56px);gap:4px}
.usage-workspace-daily .daily-bar{height:100%;gap:0}
.usage-workspace-daily .daily-bar-track{height:100%}
.usage-workspace-daily .daily-bar small{display:none}
.usage-workspace-daily .daily-footer{padding-top:3px;min-height:22px;font-size:11px;color:#746f66}
@media(max-width:350px){.usage-workspace-timeline .history-grid{--identity-width:76px}.timeline-provider{font-size:11px;gap:4px}.timeline-provider .brand{width:14px;height:14px}.usage-workspace-timeline .history-rail-tools{gap:7px}.usage-workspace-daily .daily-date-axis,.usage-workspace-daily .daily-series{grid-template-columns:76px minmax(0,1fr);gap:8px}.usage-workspace-daily .daily-provider{font-size:13px}}


    .daily-caption{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:26px;margin-bottom:3px}
    .daily-caption h2{margin:0;font-size:12px;font-weight:500;color:#6b665f}
    .daily-caption button{display:grid;place-items:center;width:27px;height:27px;color:#837b6f;padding:4px}
    .daily-caption svg{width:14px;height:14px}
    .daily-patterns{display:flex;justify-content:flex-end;gap:12px;min-height:19px;color:#746f66;font-size:11px}
    .daily-patterns span{display:flex;align-items:center;gap:4px}
    .daily-patterns i{display:block;width:12px;height:7px;border:1px solid #b3ada4}
    .daily-partial-key{background:repeating-linear-gradient(135deg,transparent,transparent 2px,#a5a096 2px,#a5a096 3px),#dad5cb}
    .daily-missing-key{background:repeating-linear-gradient(135deg,transparent,transparent 2px,#bcb6ab 2px,#bcb6ab 3px)}
  `;
  document.head.append(workspaceStyle);
  function workspace({overview='',timeline='',daily=''} = {}) {
    return `<div class="usage-workspace">${overview?`<section class="usage-workspace-overview" aria-label="Current account allowances">${overview}</section>`:''}${timeline?`<section class="usage-workspace-timeline" aria-label="Reset timeline">${timeline}</section>`:''}${daily?`<section class="usage-workspace-daily" aria-label="Daily allowance history">${daily}</section>`:''}</div>`;
  }
  window.NowUsage = {render,compact,workspace};
})();
