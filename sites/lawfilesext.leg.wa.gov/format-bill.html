<!DOCTYPE html>
<html data-theme="light">
<head>
  <title>Bill Viewer</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link href="https://cdn.jsdelivr.net/combine/npm/daisyui@5/themes.css,npm/daisyui@5" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
  <script src="https://cdn.jsdelivr.net/combine/npm/splitting,npm/lodash"></script>
  <script defer src="https://unpkg.com/alpinejs"></script>
</head>
<body class="h-screen">
  <div x-data="billViewer()" x-init="init()" class="drawer drawer-end lg:drawer-open h-full">
    <input id="sidebar" type="checkbox" class="drawer-toggle" checked>
    
    <div class="drawer-content flex flex-col h-full">
      <div class="navbar bg-base-200 lg:hidden sticky top-0 z-10">
        <span class="flex-1 font-bold text-primary" x-text="bill.id || 'Bill Viewer'"></span>
        <label for="sidebar" class="btn btn-ghost btn-sm">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
        </label>
      </div>
      <div id="content" class="flex-1 overflow-y-auto p-4 text-sm"></div>
    </div>
    
    <div class="drawer-side h-full">
      <label for="sidebar" class="drawer-overlay"></label>
      <aside class="bg-base-100 w-80 h-full flex flex-col border-l">
        <div id="meta" class="p-3 border-b border-base-200 space-y-1.5"></div>
        <style>#content a { color: oklch(var(--p)); text-decoration: underline; }</style>
        
        <div class="p-3 border-b border-base-200 space-y-2">
          <div class="text-xs font-semibold opacity-60 uppercase tracking-wide">Controls</div>
          <div class="flex flex-wrap gap-1">
            <button class="btn btn-xs btn-soft" @click="collapseAll()">Collapse All</button>
            <button class="btn btn-xs btn-soft" @click="expandAll()">Expand All</button>
            <button class="btn btn-xs btn-soft" @click="collapseUnchanged()">Collapse Unchanged</button>
          </div>
        </div>
        
        <div class="flex-1 overflow-y-auto p-3">
          <div id="editListHeader" class="text-xs font-semibold opacity-60 uppercase tracking-wide mb-2">Edits</div>
          <div id="editList"></div>
        </div>
      </aside>
    </div>
  </div>

<script>
const $ = (s, ctx = document) => ctx.querySelector(s);
const $$ = (s, ctx = document) => [...ctx.querySelectorAll(s)];
const cls = (el, rm, add) => (rm && el.classList.remove(...rm.split(' ')), add && el.classList.add(...add.split(' ')), el);
const el = (tag, attrs = {}) => Object.entries(attrs).reduce((e, [k, v]) => 
  (k.startsWith('data-') ? e.setAttribute(k, v) : e[k] = v, e), document.createElement(tag));

const wrapRange = (start, end, wrapper) => {
  start.before(wrapper);
  for (let n = start; n;) {
    const next = n.nextSibling;
    wrapper.append(n);
    if (n === end) break;
    n = next;
  }
  return wrapper;
};

const hasOwnDeco = (el, type) => {
  const has = e => (getComputedStyle(e).textDecoration || '').includes(type);
  return has(el) && (!el.parentElement || !has(el.parentElement));
};

const badge = (txt, c) => `<span class="badge badge-xs ${c}">${txt}</span>`;

const nav = delta => {
  const url = opener?.location.href || location.href;
  const newUrl = url.replace(/(\d{4})(?=\.htm)/, (_, n) => String(+n + delta).padStart(4, '0'));
  if (newUrl !== url) opener ? opener.location.href = newUrl : location.href = newUrl;
};

function billViewer() {
  return {
    initialized: false,
    bill: {},
    edits: [],
    toggles: new WeakMap(),

    async init() {
      if (this.initialized) return;
      this.initialized = true;

      const url = opener?.location.href || location.href;
      const [xml, htm] = await Promise.all([
        fetch(url.replace(/Htm(.*)\.htm$/, 'Xml$1.xml')).then(r => r.text()),
        fetch(url).then(r => r.text())
      ]);
      const doc = new DOMParser().parseFromString(xml, 'application/xml');
      const htmDoc = new DOMParser().parseFromString(htm, 'text/html');
      const q = s => $(s, doc)?.textContent?.trim();
      const qa = s => $$(s, doc).map(el => el.textContent?.trim());
      const xmlSections = $$('BillSection', doc).map(s => ({ 
        type: s.getAttribute('type'), 
        cite: $('SectionCite', s)?.textContent?.trim() 
      }));

      this.bill = {
        id: q('ShortBillId'), long: q('LongBillId'), req: q('RequestNumber'),
        sponsors: q('Sponsors'), brief: q('BriefDescription'), committee: q('ReferredCommittee'),
        cites: [...new Set(qa('SectionCite'))], dollars: qa('DollarAmount'),
        newCount: xmlSections.filter(s => s.type === 'new').length,
        amendCount: xmlSections.filter(s => s.type !== 'new').length
      };

      const links = [...new Set($$('a[href]', htmDoc).map(a => a.textContent?.trim()).filter(Boolean))];
      document.title = this.bill.id || 'Bill Viewer';

      $('#meta').innerHTML = `
        <div class="flex items-baseline gap-2 flex-wrap">
          <button class="btn btn-xs btn-ghost px-1" onclick="nav(-1)">←</button>
          <h1 class="text-lg font-bold text-primary">${this.bill.id}</h1>
          <button class="btn btn-xs btn-ghost px-1" onclick="nav(1)">→</button>
          <span class="text-xs opacity-50">${this.bill.long} • ${this.bill.req}</span>
        </div>
        <p class="text-sm font-medium">${this.bill.brief}</p>
        ${this.bill.committee ? `<p class="text-xs opacity-60">→ ${this.bill.committee}</p>` : ''}
        <p class="text-xs opacity-60">${this.bill.sponsors}</p>
        <div class="flex flex-wrap gap-1 pt-1">
          ${this.bill.cites.map(c => badge(c, 'badge-warning badge-outline')).join('')}
          ${this.bill.dollars.map(d => badge(d, 'badge-success badge-outline')).join('')}
        </div>
        <details class="text-xs pt-1">
          <summary class="cursor-pointer opacity-50">Links</summary>
          <div class="pt-1 flex flex-wrap gap-x-2 gap-y-0.5">
            ${links.map(l => `<span class="text-primary">${l}</span>`).join('')}
          </div>
        </details>`;

      $('#content').innerHTML = htmDoc.body.innerHTML;
      await new Promise(r => setTimeout(r, 300));
      this.processContent();
    },

    processContent() {
      const content = $('#content');
      const secRe = /^Sec\.\s+(\d+)\./;
      let groupId = 0;

      const grabSibling = (el, dir, re) => {
        const sib = dir === 'prev' ? el.previousSibling : el.nextSibling;
        if (!sib || sib.nodeType !== 3) return el;
        const txt = sib.textContent;
        const match = txt.match(re);
        if (!match) return el;
        const splitIdx = dir === 'prev' ? match.index : match[0].length;
        const hasMore = dir === 'prev' ? match.index > 0 : txt.length > match[0].length;
        if (hasMore) {
          const [keep, take] = dir === 'prev' 
            ? [txt.slice(0, splitIdx), txt.slice(splitIdx)]
            : [txt.slice(splitIdx), match[0]];
          sib.textContent = keep;
          const node = document.createTextNode(take);
          dir === 'prev' ? sib.after(node) : sib.before(node);
          return node;
        }
        return sib;
      };

      const grabOpenParen = el => grabSibling(el, 'prev', /\(\([\s]*$/);
      const grabCloseParen = el => grabSibling(el, 'next', /^[\s]*\)\)/);

      const findNextSrc = (el, attr) => {
        for (let n = el.nextSibling; n; n = n.nextSibling) {
          if (n.nodeType === 3 && /^\s*$/.test(n.textContent)) continue;
          if (n.nodeType === 3) return null;
          if (n.nodeType === 1) return n.hasAttribute(attr) ? n : null;
        }
        const parentNext = el.parentElement?.nextElementSibling;
        if (parentNext) {
          const first = $(`[${attr}]`, parentNext);
          if (first && /^\s*$/.test(parentNext.textContent.slice(0, parentNext.innerHTML.indexOf(first.outerHTML))))
            return first;
        }
        return null;
      };

      const findNextIns = el => {
        for (let n = el.nextSibling; n; n = n.nextSibling) {
          if (n.nodeType === 3 && !/^[\s\)\(]*$/.test(n.textContent)) return null;
          if (n.nodeType === 1) {
            if (n.hasAttribute('data-src-ins')) return n;
            if (n.hasAttribute('data-src-del')) return null;
          }
        }
        return null;
      };

      // Section detection
      $$('span[style*="font-weight:bold"]', content)
        .filter(s => secRe.test(s.textContent.trim()) && !s.closest('[data-section]'))
        .forEach(sec => {
          const container = sec.closest('div');
          if (!container || container.closest('[data-section]')) return;
          
          const num = sec.textContent.match(secRe)?.[1] || '?';
          const isNew = /NEW SECTION/.test(container.textContent.slice(0, 100));
          
          const siblings = [];
          for (let el = container.nextElementSibling; el; el = el.nextElementSibling) {
            if (el.textContent.includes('--- END ---')) break;
            if ($$('span[style*="font-weight:bold"]', el).some(s => secRe.test(s.textContent.trim()))) break;
            siblings.push(el);
          }

          const wrapper = el('div', { 
            'data-section': num,
            ...(isNew && { 'data-new-section': 'true' }),
            style: `border-left: 4px solid ${isNew ? '#22c55e' : '#9ca3af'}; margin: 12px 0; padding-left: 12px;`
          });
          container.before(wrapper);
          wrapper.append(container, ...siblings);
        });

      // Mark deletions and insertions
      const all = $$('*', content).filter(el => 
        !['SCRIPT', 'STYLE'].includes(el.tagName) && el.offsetParent && el.textContent.trim()
      );

      all.filter(el => !el.closest('a') && hasOwnDeco(el, 'line-through'))
        .forEach(el => (el.setAttribute('data-src-del', ''), cls(el, null, 'text-red-600 bg-red-50')));
      all.filter(el => !el.closest('a') && hasOwnDeco(el, 'underline'))
        .forEach(el => (el.setAttribute('data-src-ins', ''), cls(el, null, 'text-green-600 bg-green-50')));

      // Build chains
      const processed = new Set();
      const chains = [];

      $$('[data-src-del]', content).forEach(del => {
        if (processed.has(del)) return;
        const ins = findNextIns(del);
        if (ins) {
          processed.add(del); processed.add(ins);
          chains.push({ type: 'sub', elements: [del], insElements: [ins] });
          return;
        }
        const chain = [del];
        processed.add(del);
        for (let next = findNextSrc(del, 'data-src-del'); next && !processed.has(next) && !findNextIns(next); next = findNextSrc(next, 'data-src-del')) {
          chain.push(next);
          processed.add(next);
        }
        chains.push({ type: 'del', elements: chain });
      });

      $$('[data-src-ins]', content).forEach(ins => {
        if (processed.has(ins)) return;
        const chain = [ins];
        processed.add(ins);
        for (let next = findNextSrc(ins, 'data-src-ins'); next && !processed.has(next); next = findNextSrc(next, 'data-src-ins')) {
          chain.push(next);
          processed.add(next);
        }
        chains.push({ type: 'ins', elements: chain });
      });

      // Wrap edits
      const editGroups = chains.map(chain => {
        const gid = groupId++;
        const wrappers = [];
        const mkWrapper = type => el('span', { 
          'data-edit': type, 'data-group-id': gid,
          className: type === 'sub' ? 'bg-yellow-100 text-yellow-800 rounded px-0.5' : ''
        });

        if (chain.type === 'sub') {
          const [del, ins] = [chain.elements[0], chain.insElements[0]];
          if (del.parentElement === ins.parentElement) {
            const w = wrapRange(grabOpenParen(del), ins, mkWrapper('sub'));
            cls(del, 'bg-red-50', 'bg-yellow-200/50');
            cls(ins, 'bg-green-50', 'bg-yellow-200/50');
            wrappers.push(w);
          } else {
            [del, ins].forEach(e => {
              const w = mkWrapper('sub');
              e.before(w); w.append(e);
              cls(e, 'bg-red-50 bg-green-50', 'bg-yellow-200/50');
              wrappers.push(w);
            });
          }
        } else {
          chain.elements.forEach((e, i) => {
            const start = i === 0 ? grabOpenParen(e) : e;
            const end = i === chain.elements.length - 1 ? grabCloseParen(e) : e;
            wrappers.push(wrapRange(start, end, mkWrapper(chain.type)));
          });
        }
        return { type: chain.type, groupId: gid, wrappers };
      });

      // Collapsibles
      const parenEls = all.filter(e => /^\s*\(/.test(e.textContent));
      const left = _.chain(parenEls).countBy(e => Math.round(e.getBoundingClientRect().left)).toPairs().maxBy(1).head().toNumber().value();
      parenEls.filter(e => Math.round(e.getBoundingClientRect().left) === left).forEach(el => this.createCollapsible(el));

      this.buildEditList(editGroups);
    },

    buildEditList(editGroups) {
      this.edits = editGroups.map(g => {
        const section = g.wrappers[0].closest('[data-section]');
        const getText = (w, attr) => {
          const el = w.querySelector(`[${attr}]`) || (w.hasAttribute(attr) ? w : null);
          return el?.textContent || '';
        };
        const delText = g.wrappers.map(w => getText(w, 'data-src-del')).join(' ').replace(/\s+/g, ' ').trim();
        const insText = g.wrappers.map(w => getText(w, 'data-src-ins')).join(' ').replace(/\s+/g, ' ').trim();
        const fullText = g.wrappers.map(w => w.textContent).join(' ').replace(/\s+/g, ' ').trim().replace(/\(\(|\)\)/g, '');
        const wordCount = t => t.split(/\s+/).filter(Boolean).length;
        return {
          type: g.type,
          text: fullText.slice(0, 80),
          delText: delText.replace(/\(\(|\)\)/g, '').slice(0, 40),
          insText: insText.replace(/\(\(|\)\)/g, '').slice(0, 40),
          delWords: g.type === 'del' || g.type === 'sub' ? wordCount(delText || fullText) : 0,
          insWords: g.type === 'ins' || g.type === 'sub' ? wordCount(insText || fullText) : 0,
          lines: g.wrappers.length,
          secNum: section?.getAttribute('data-section') || '?',
          isNewSec: section?.hasAttribute('data-new-section') || false,
          wrappers: g.wrappers
        };
      }).sort((a, b) => (a.secNum === '?' ? 999 : +a.secNum) - (b.secNum === '?' ? 999 : +b.secNum));

      $('#editListHeader').textContent = `Edits (${this.edits.length})`;
      
      const editList = $('#editList');
      editList.innerHTML = '';
      
      this.edits.forEach(e => {
        const wordStats = e.type === 'sub' 
          ? `<span class="bg-yellow-100 rounded px-1"><span class="text-red-600">-${e.delWords}</span> <span class="text-green-600">+${e.insWords}</span></span>`
          : e.type === 'del' 
            ? `<span class="text-red-600">-${e.delWords}</span>`
            : `<span class="text-green-600">+${e.insWords}</span>`;
        const content = e.type === 'sub'
          ? `<span class="text-red-600 line-through">${e.delText}</span> <span class="text-green-600 underline">${e.insText}</span>`
          : e.type === 'del'
            ? `<span class="text-red-600 line-through">${e.text}</span>`
            : `<span class="text-green-600 underline">${e.text}</span>`;
        const row = el('div', { className: `py-1.5 px-2 rounded text-xs cursor-pointer hover:bg-base-200 ${e.isNewSec ? 'bg-green-50 border-l-2 border-green-400' : ''}` });
        row.innerHTML = `
          <div class="flex items-center gap-2">
            <span class="opacity-50 text-[10px]">sec. ${e.secNum}</span>
            <span class="text-[10px]">${wordStats}</span>
          </div>
          <div class="truncate pl-1 mt-0.5">${content || '(empty)'}</div>`;
        row.onclick = () => {
          e.wrappers[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
          e.wrappers.forEach(w => cls(w, null, 'ring-2 ring-primary'));
          setTimeout(() => e.wrappers.forEach(w => cls(w, 'ring-2 ring-primary', null)), 2000);
        };
        editList.append(row);
      });
    },

    createCollapsible(target) {
      if (target.closest('[data-edit]')) return;
      const box = el('div', { className: 'w-full cursor-pointer transition-all hover:bg-base-200', 'data-collapsed': 'false' });
      target.before(box);
      box.append(target);

      const toggle = set => {
        if (String(set) === box.getAttribute('data-collapsed')) return;
        box.setAttribute('data-collapsed', set);
        $$('.meta', box).forEach(m => m.remove());
        if (set) {
          if (!$('[data-word]', target)) 
            (Splitting({ target, by: 'words' })[0]?.words || []).forEach(w => w.setAttribute('data-word', ''));
          $$('[data-word]', target).forEach((w, i) => w.classList.toggle('hidden', i >= 5));
          cls(box, null, 'bg-base-300 hover:bg-base-200');
          if ($$('[data-word].hidden', target).length) {
            const meta = el('span', { className: 'meta text-sm opacity-60' });
            meta.innerHTML = `... ${this.counts(target)}`;
            target.append(meta);
          }
        } else {
          $$('[data-word]', target).forEach(w => w.classList.remove('hidden'));
          cls(box, 'bg-base-300 hover:bg-base-200', null);
        }
      };

      this.toggles.set(box, toggle);
      box.onclick = e => { e.stopPropagation(); toggle(box.getAttribute('data-collapsed') !== 'true'); };
    },

    counts(el) {
      const c = _.countBy($$('[data-edit]', el), e => e.getAttribute('data-edit'));
      const words = el.textContent.trim().split(/\s+/).length;
      return `[${words}w${c.ins ? `|<span class="text-success">+${c.ins}</span>` : ''}${c.del ? `|<span class="text-error">-${c.del}</span>` : ''}${c.sub ? `|<span class="text-warning">~${c.sub}</span>` : ''}]`;
    },

    collapseAll() { $$('[data-collapsed]').forEach(el => this.toggles.get(el)?.(true)); },
    expandAll() { $$('[data-collapsed]').forEach(el => this.toggles.get(el)?.(false)); },
    collapseUnchanged() {
      $$('[data-collapsed]').forEach(el => {
        if (!el.closest('[data-new-section="true"]') && !$('[data-edit]', el)) this.toggles.get(el)?.(true);
      });
    }
  };
}
</script>
</body>
</html>