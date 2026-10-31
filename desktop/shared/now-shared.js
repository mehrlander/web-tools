(() => {
  'use strict';
  const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const assistants = {
    codex:{name:'Codex in ChatGPT',url:'https://chatgpt.com/'},
    gemini:{name:'Antigravity',url:'https://antigravity.google.com/'},
    claude:{name:'Claude Code',url:'https://claude.ai/code'}
  };
  function assistantLink(key, {cls = '', tooltip = false} = {}) {
    if (!Object.hasOwn(assistants,key)) return '';
    const {name,url} = assistants[key], label = `Open ${name}`;
    return `<a data-provider-link="${key}" href="${url}" target="_blank" rel="noopener noreferrer" aria-label="${label}" ${tooltip ? 'data-title-tip' : 'title'}="${label}" class="flex size-7 shrink-0 items-center justify-center rounded text-stone-500 hover:bg-stone-200/60 focus-visible:outline-2 focus-visible:outline-emerald-700 ${escape(cls)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" class="size-3.5" aria-hidden="true"><path d="M14 4h6v6M20 4 10 14M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/></svg></a>`;
  }
  const safeLink = value => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password && !url.port
        && (url.hostname === 'mehrlander.github.io' && url.pathname.startsWith('/web-tools/')
          || url.hostname === 'github.com' && /^\/[\w.-]+\/[\w.-]+\/pull\/[1-9]\d*$/.test(url.pathname)) ? url.href : '';
    } catch { return ''; }
  };
  function sessionUrl(value, provider, desktop = false) {
    try {
      const url = new URL(value), uuid = '[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}';
      if (url.username || url.password || url.port || url.hash) return '';
      if (provider === 'codex' && desktop && url.protocol === 'codex:' && url.host === 'threads' && !url.search && new RegExp('^/' + uuid + '$').test(url.pathname)) return url.href;
      if (url.protocol !== 'https:') return '';
      if (provider === 'claude' && url.host === 'claude.ai' && !url.search && /^\/code\/session_[A-Za-z0-9_-]{1,160}$/.test(url.pathname)) return url.href;
      if (provider === 'gemini' && url.host === 'antigravity.google.com' && new RegExp('^/r/' + uuid + '(?:-v[0-9]{1,2})?$').test(url.pathname) && new RegExp('^\\?p=c%2[fF]' + uuid + '$').test(url.search)) return url.href;
    } catch { }
    return '';
  }
  function sessionActions(item, {desktop = false, copied = false} = {}) {
    const key = /gemini/i.test(item.provider) ? 'gemini' : /claude/i.test(item.provider) ? 'claude' : 'codex';
    const errand = item.kind === 'errand' || item.key?.startsWith('errand:');
    const thread = item.key?.startsWith('session:Codex:') ? item.key.slice(14) : item.id;
    const direct = errand ? '' : sessionUrl(item.sessionUrl || item.sourceUrl || (key === 'codex' ? `codex://threads/${thread}` : ''),key,desktop);
    const web = safeLink(item.url)?.startsWith('https://mehrlander.github.io/web-tools/') ? safeLink(item.url) : '';
    const actions = [], owner = escape(item.key), cls = 'inline-flex min-h-9 items-center rounded-md border border-stone-200 bg-white px-2.5 text-xs text-emerald-900 hover:bg-stone-50';
    const link = (url,label,type) => `<a data-${type}="${owner}" href="${escape(url)}" target="_blank" rel="noopener noreferrer" class="${cls}">${label} ↗</a>`;
    if (direct) actions.push(link(direct,`Open in ${{codex:'Codex',gemini:'Antigravity',claude:'Claude'}[key]}`,'session-link'));
    if (web) actions.push(link(web,errand ? ['reply','complete','failed'].includes(item.state) ? 'Open result' : 'Open errand' : 'Web Tools detail','external'));
    if (!direct && !errand) actions.unshift(link(assistants[key].url,`Open ${key === 'codex' ? 'ChatGPT' : assistants[key].name}`,'session-home'));
    if (!errand) actions.push(`<button data-copy-title="${owner}" class="${cls}">${copied ? 'Copied' : 'Copy session title'}</button>`);
    const note = errand && !web ? 'Saved errand destination unavailable.' : !direct && !errand ? key === 'codex' && !desktop ? 'Direct mobile thread link unavailable. Find this conversation in ChatGPT’s Codex tab.' : 'Direct session link unavailable. Use the session title to find the conversation.' : '';
    return `<div class="flex flex-wrap gap-1.5">${actions.join('')}</div>${note ? `<p class="mt-1 text-[10px] leading-4 text-stone-500">${note}</p>` : ''}`;
  }
  const density = (markup, compact) => compact ? markup.replace(/class="([^"]*)"/g, (_, classes) => `class="${classes.split(' ').map(name => ({'text-base':'text-[13px]','leading-7':'leading-5','mt-6':'mt-3','mt-5':'mt-3','mt-4':'mt-2','pt-4':'pt-2','space-y-4':'space-y-2'}[name] || name)).join(' ')}"`) : markup;
  function checkpoint(cp, {stamp, link, compact = false}) {
    if (!cp) return '';
    const turns = (cp.turns || []).slice(0,3);
    const latest = turns[0];
    const facts = latest ? [[latest.files,latest.files === 1 ? 'file edited' : 'files edited'],[latest.pushes,latest.pushes === 1 ? 'branch pushed' : 'branches pushed'],[latest.agents,latest.agents === 1 ? 'agent task' : 'agent tasks']]
      .filter(([n]) => Number.isSafeInteger(n) && n > 0).map(([n,label]) => `<span class="rounded bg-violet-50 px-2 py-1 text-xs text-violet-900">${n} ${label}</span>`).join('') : '';
    return density(`<section class="mt-5 border-t border-stone-200 pt-4"><h3 class="text-sm font-semibold text-violet-900">Published checkpoint</h3><p class="mt-1 text-xs text-stone-500">${escape(stamp(cp.at))}</p>${cp.summary ? `<p class="mt-3 text-pretty text-base leading-7">${escape(cp.summary)}</p>` : ''}${facts ? `<p class="mt-3 text-xs text-stone-500">Latest exchange</p><div class="mt-1 flex flex-wrap gap-2" aria-label="Recorded activity in the latest exchange">${facts}</div>` : ''}${cp.links?.length ? `<div class="mt-3 flex flex-wrap gap-2">${cp.links.map((l,i) => safeLink(l.url) ? link(l,i) : '').join('')}</div>` : ''}${turns.length ? `<ol class="mt-5 space-y-4">${turns.map(t => `<li><h4 class="text-sm font-medium text-stone-700">${escape(t.headline || `Exchange ${t.turn + 1}`)}</h4><p class="mt-1 text-pretty text-base leading-7 text-stone-600">${escape(t.summary)}</p></li>`).join('')}</ol>` : ''}</section>`, compact);
  }
  function turn(value, {stamp, compact = false}) {
    if (!value) return '';
    return density(`<section class="mt-6 border-t border-stone-200 pt-4"><h3 class="text-sm font-semibold text-stone-600">Latest turn</h3><p class="mt-1 text-xs text-stone-500">First observed ${escape(stamp(value.startedAt))}</p>${value.lastTool ? `<p class="mt-2 text-sm text-stone-500">Last tool: ${escape(value.lastTool)}</p>` : ''}${value.prompt ? `<h4 class="mt-4 text-xs font-medium text-stone-500">Prompt preview</h4><p class="mt-1 whitespace-pre-wrap break-words text-base leading-7">${escape(value.prompt)}</p>` : ''}${value.response ? `<h4 class="mt-4 text-xs font-medium text-stone-500">Response preview</h4><p class="mt-1 whitespace-pre-wrap break-words text-base leading-7">${escape(value.response)}</p>` : ''}</section>`, compact);
  }
  window.NowView = {safeLink,checkpoint,turn,assistantLink,sessionUrl,sessionActions};
})();
