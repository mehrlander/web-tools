(() => {
  'use strict';
  const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const cache = new Map();
  const parser = window.marked?.Marked ? new window.marked.Marked({gfm:true,renderer:{
    html:({text}) => escape(text),
    image:({text}) => escape(text),
    checkbox:({checked}) => `<span aria-label="${checked ? 'Complete' : 'Not complete'}">${checked ? '☑' : '☐'}</span> `
  }}) : null;
  const classes = {
    p:'my-2 first:mt-0 last:mb-0',
    ul:'my-2 list-disc space-y-1 pl-4', ol:'my-2 list-decimal space-y-1 pl-4',
    h1:'mt-3 mb-1 text-sm font-semibold text-stone-900', h2:'mt-3 mb-1 text-[13px] font-semibold text-stone-900',
    h3:'mt-3 mb-1 font-semibold text-stone-900', h4:'mt-3 mb-1 font-semibold text-stone-900',
    h5:'mt-3 mb-1 font-semibold text-stone-900', h6:'mt-3 mb-1 font-semibold text-stone-900',
    pre:'my-2 max-w-full overflow-x-auto rounded-md bg-stone-100 p-2 text-[11px] leading-4',
    code:'rounded bg-stone-100 px-1 py-0.5 font-mono text-[11px]',
    blockquote:'my-2 border-l-2 border-stone-300 pl-3 text-stone-500',
    hr:'my-3 border-stone-200', table:'w-full border-collapse text-left text-xs',
    th:'border-b border-stone-300 px-2 py-1 font-medium', td:'border-b border-stone-200 px-2 py-1 align-top',
    a:'text-emerald-800 underline decoration-emerald-300 underline-offset-2'
  };
  function notification(value) {
    const source = String(value ?? '').slice(0,20000);
    const start = /^\s*<task-notification\b[^>]*>/i.exec(source);
    if (!start) return null;
    const body = source.slice(start[0].length).split(/<\/task-notification\s*>/i)[0];
    const field = name => {
      const match = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)(?:<\\/${name}\\s*>|$)`,'i').exec(body);
      if (!match) return '';
      const decoder = document.createElement('textarea');
      decoder.innerHTML = match[1].replace(/<[^>]*>/g,'');
      return decoder.value.trim();
    };
    const states = {completed:'Completed',complete:'Completed',done:'Completed',failed:'Failed',error:'Failed',running:'Running',in_progress:'Running',cancelled:'Stopped',canceled:'Stopped'};
    const rawStatus = field('status').toLowerCase();
    const status = Object.hasOwn(states,rawStatus) ? states[rawStatus] : 'Update';
    return {summary:field('summary') || field('message') || 'Background task update',status};
  }
  function markdown(value) {
    const source = String(value ?? '').slice(0,20000);
    if (cache.has(source)) return cache.get(source);
    const notice = notification(source), text = notice?.summary || source;
    const tone = notice?.status === 'Completed' ? 'bg-emerald-50 text-emerald-800' : notice?.status === 'Failed' ? 'bg-rose-50 text-rose-800' : 'bg-stone-100 text-stone-600';
    const prefix = notice ? `<p data-notification class="mb-1 text-[10px] text-stone-500">Background task <span class="ml-1 rounded px-1.5 py-0.5 ${tone}">${notice.status}</span></p>` : '';
    if (!parser || !window.DOMPurify) return prefix + `<p class="whitespace-pre-wrap">${escape(text)}</p>`;
    const host = document.createElement('div');
    host.append(window.DOMPurify.sanitize(parser.parse(text),{RETURN_DOM_FRAGMENT:true,
      ALLOWED_TAGS:['p','br','strong','em','del','a','code','pre','blockquote','ul','ol','li','h1','h2','h3','h4','h5','h6','table','thead','tbody','tr','td','th','hr','span'],
      ALLOWED_ATTR:['href','title','start','colspan','rowspan','aria-label']}));
    host.querySelectorAll('a').forEach(link => {
      let url;
      try { url = new URL(link.getAttribute('href')); } catch { }
      if (!url || url.protocol !== 'https:' || url.username || url.password) { link.replaceWith(document.createTextNode(link.textContent)); return; }
      link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer';
    });
    host.querySelectorAll('*').forEach(node => { if (classes[node.localName]) node.className = classes[node.localName]; });
    host.querySelectorAll('pre code').forEach(node => { node.className = 'font-mono'; });
    host.querySelectorAll('table').forEach(table => {
      const wrap = document.createElement('div'); wrap.className = 'my-2 max-w-full overflow-x-auto';
      table.replaceWith(wrap); wrap.append(table);
    });
    const result = prefix + host.innerHTML;
    cache.set(source,result);
    if (cache.size > 40) cache.delete(cache.keys().next().value);
    return result;
  }
  window.NowReading = {markdown,notification};
})();
