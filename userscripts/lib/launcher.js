// The Web Tools launcher, carried onto pages that have none of their own.
//
// WHAT IT IS. The launcher alpineComponents/fab.js mounts, plus a drawer of the
// same shape, holding what a page that is not ours can honestly answer for.
// Tap opens the drawer, a held finger opens the short menu, a drag moves it:
// the fab's three gestures, in the fab's order.
//
// WHAT THE DRAWER IS NOT is the fab's. Two of that drawer's four tabs cannot
// mean anything off our origin: Render reads the GitHub API through a token
// held in localStorage on the web-tools origin, which a foreign origin does not
// have and must not be given, and Inspect lists the modules gh.load() fetched,
// of which a foreign page has none. What a foreign page DOES hold is its own
// content, so the three panes here are the three answers it can give: what this
// page is, what it links to, what it says.
//
// TWO ROUTES OUT, because one payload shape cannot carry both. Send hands the
// capture to the Log-Repo shortcut and it lands in the repo, but it rides
// inside a shortcuts:// URL, and a URL has a ceiling nobody has measured
// exactly (14,190 characters is known to work; the failure past it would be a
// truncated payload that arrives looking complete). So Send is capped well
// under that and says so, and Copy takes anything, since the clipboard has no
// such limit. The cap is on the delivery, never on the selection: a capture too
// big to send is still one you can copy.
//
// SO IT YIELDS. On a page that already carries a fab this must not mount, or
// every web-tools page grows a second launcher beside the real one, which is
// how it read on 2026-09-05 before this rule existed. The fab may not have
// mounted yet at document-end, so the decision is made twice: the synchronous
// tells below, then an observer that removes this one if the real launcher
// appears within a few seconds.
//
// WHY IT IS HAND-STYLED. The house style (skills/daisy-alpine) governs pages
// built here; this is markup injected into someone else's document, where
// Tailwind has nothing to compile against and every CDN tag is the first thing
// a Content-Security-Policy refuses. So the winter theme's tokens are written
// out below as literals and the opacity steps go through color-mix, which is
// how Tailwind 4 renders `/10` anyway. Everything sits in a SHADOW ROOT behind
// a CONSTRUCTED stylesheet: a <style> element answers to the page's style-src
// and a constructed sheet is CSSOM, which does not. Measured against
// `script-src 'self'; style-src 'self'`, where the bookmarklet route is refused
// outright and this one mounts intact.
// The build stamp, written here by scripts/userscript-stub.py from a hash of
// this file's own contents. It lives in the body rather than the stub because
// the stub is pinned to a BRANCH and never changes again: that is what removes
// the reinstall, and it costs the one thing a SHA pin gave for free, namely
// knowing which copy ran. The stamp buys that back, and the drawer shows it.
const BUILD = 'c9fa5d3';
const BUILT = '2026-09-26T05:11:09Z';
const REF = 'main';

// Where the current build id is published. The launcher compares its own stamp
// against this and says so when they differ, which is the only way a reader
// learns that the copy they got is behind: any cache between a push and the
// device (GitHub Pages holds the bookmarklet's copy ten minutes) can serve the
// previous body for a while after a push.
//
// It is read from raw.githubusercontent with a cache-buster rather than from
// the CDN, because a manifest served from the same cache as the thing it
// describes can be stale in exactly the case it exists to detect. And it stays
// SILENT on failure: a strict connect-src refuses this fetch, and an
// unlooked-up answer reading as a good one is worse than no verdict, which is
// the rule the shortcut library already runs on its own build manifest.
const MANIFEST = `https://raw.githubusercontent.com/mehrlander/web-tools/${REF}/userscripts/builds.json`;
const STAGE = 'https://mehrlander.github.io/web-tools/app/';
const GZ_MAX = 24 * 1024;

window.wtLauncher = ({ app = 'https://mehrlander.github.io/web-tools/app/' } = {}) => {
  if (typeof window === 'undefined' || window.top !== window.self) return;

  const ID = 'wt-launcher';
  if (document.getElementById(ID) || window.__wtLauncherMounting || window.__wtLauncherMounted) return;
  window.__wtLauncherMounting = true;

  // Detect Web Tools app origin or pages
  const isWebToolsOrigin = () => {
    try {
      const u = new URL(app);
      if (location.origin === u.origin && location.pathname.startsWith(u.pathname.replace(/\/app\/?$/, ''))) return true;
    } catch {}
    if (location.hostname === 'mehrlander.github.io' && location.pathname.startsWith('/web-tools')) return true;
    return false;
  };

  // Detect real Web Tools FAB or scripts in DOM (which cross the Isolated World barrier)
  const realFab = () => document.querySelector('[aria-label="Web-tools panel"], [x-data*="fab"][data-fab-root], [x-data*="fab"].fab-root');
  const hasWebToolsScript = () => !!document.querySelector(
    'script[src*="alpineComponents/fab.js"], ' +
    'script[src*="mehrlander.github.io/web-tools"], ' +
    'script[src*="/web-tools/app/"], ' +
    'script[src*="lib/gh-api.js"], ' +
    'link[href*="mehrlander.github.io/web-tools"]'
  );

  // A page that carries the loader will mount its own fab, and one that has
  // refused a fab has refused this too: data-no-fab is an answer to the
  // question this file is asking, not a web-tools-only setting.
  if (isWebToolsOrigin() || realFab() || hasWebToolsScript() || window.gh || window.__fabHosted ||
      document.documentElement.hasAttribute('data-no-fab') ||
      document.body?.hasAttribute('data-no-fab')) {
    window.__wtLauncherMounting = false;
    return;
  }

  // Under this many characters the whole shortcuts:// URL is sent; over it,
  // Send stands down and names Copy. See the two-routes note above.
  const SEND_MAX = 8000;

  // ---- What the page can answer for -------------------------------------
  //
  // Read once, when the drawer first opens, rather than at mount: the launcher
  // is on every page and the drawer on few of them, which is the same reason
  // the fab builds its own body on first open.

  const clean = s => String(s || '').replace(/\s+/g, ' ').trim();

  // "3h ago" is readable without a second number to compare it to, which a hash
  // is not. It is the always-available half of the freshness answer; the
  // manifest below is the definitive half, where the page allows the fetch.
  const age = iso => {
    const mins = Math.floor((Date.now() - Date.parse(iso)) / 60000);
    if (!isFinite(mins)) return '';
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    if (mins < 48 * 60) return Math.floor(mins / 60) + 'h ago';
    return Math.floor(mins / 1440) + 'd ago';
  };

  // Links, deduped by address. A page repeats its own navigation in a header
  // and a footer, and a list of forty links where fifteen are the same six
  // destinations is a list nobody reads. Anchors with no visible text are kept
  // and labelled by their address, since an image link is still a link; ones
  // that go nowhere a reader could follow are dropped.
  //
  // Shadow DOM Discovery: recursively finds all open shadow roots across the
  // the launcher's own host root.
  const findShadowRoots = () => {
    const list = [];
    const seen = new Set();
    const walk = node => {
      if (!node || seen.has(node) || node.id === ID || node.closest?.('#' + ID)) return;
      seen.add(node);
      if (node.shadowRoot && node !== host) {
        list.push({
          tag: node.tagName ? node.tagName.toLowerCase() : 'element',
          mode: node.shadowRoot.mode || 'open',
          host: node,
          root: node.shadowRoot,
        });
        for (const child of node.shadowRoot.querySelectorAll?.('*') || []) {
          walk(child);
        }
      }
      for (const child of node.children || []) {
        walk(child);
      }
    };
    for (const el of document.querySelectorAll('*')) {
      walk(el);
    }
    return list;
  };

  // Frame Discovery: inspects all browsing contexts (iframes and frames) on the
  // page, including those inside open shadow roots. Distinguishes accessible
  // same-origin frames from sealed cross-origin frames blocked by the browser SOP.
  const findFrames = () => {
    const list = [];
    const elements = [];
    for (const f of document.querySelectorAll('iframe, frame')) {
      if (f.id === ID || f.closest?.('#' + ID)) continue;
      elements.push(f);
    }
    for (const s of findShadowRoots()) {
      for (const f of s.root.querySelectorAll('iframe, frame')) {
        if (f.id === ID || f.closest?.('#' + ID)) continue;
        elements.push(f);
      }
    }

    elements.forEach((f, idx) => {
      let accessible = false;
      let doc = null;
      let title = '';
      let href = '';
      let textLen = 0;
      let linksCount = 0;
      let error = '';

      try {
        doc = f.contentDocument || f.contentWindow?.document;
        if (doc) {
          title = doc.title || '';
          href = doc.location?.href || f.src || '';
          accessible = true;
          textLen = (doc.body?.innerText || '').trim().length;
          linksCount = doc.querySelectorAll?.('a[href]')?.length || 0;
        }
      } catch (err) {
        accessible = false;
        error = 'Cross-origin (Same-Origin Policy)';
      }

      if (!href) {
        try { href = f.getAttribute('src') || f.src || '(no src)'; } catch { href = '(inaccessible)'; }
      }

      let label = f.getAttribute('title') || f.getAttribute('name') || f.getAttribute('id') || '';
      if (!label && href && href !== '(no src)') {
        try {
          const u = new URL(href, location.href);
          label = u.pathname.split('/').filter(Boolean).pop() || u.hostname;
        } catch {
          label = href.slice(0, 30);
        }
      }
      if (!label) label = `Frame #${idx + 1}`;

      list.push({
        index: idx,
        el: f,
        accessible,
        doc: accessible ? doc : null,
        title: title || label,
        label,
        href,
        textLen,
        linksCount,
        error,
        name: f.name || f.id || '',
      });
    });

    return list;
  };

  const getActiveDoc = () => {
    if (state.activeFrameIndex >= 0 && state.frames && state.frames[state.activeFrameIndex]?.accessible) {
      const f = state.frames[state.activeFrameIndex];
      if (f.doc) return f.doc;
    }
    return document;
  };

  const getActiveDocTitle = () => {
    if (state.activeFrameIndex >= 0 && state.frames && state.frames[state.activeFrameIndex]?.accessible) {
      return state.frames[state.activeFrameIndex].title || 'Frame';
    }
    return page.title;
  };

  const getActiveDocHref = () => {
    if (state.activeFrameIndex >= 0 && state.frames && state.frames[state.activeFrameIndex]?.accessible) {
      return state.frames[state.activeFrameIndex].href || page.href;
    }
    return page.href;
  };

  // Links, deduped by address. A page repeats its own navigation in a header
  // and a footer, and a list of forty links where fifteen are the same six
  // destinations is a list nobody reads. Anchors with no visible text are kept
  // and labelled by their address, since an image link is still a link; ones
  // that go nowhere a reader could follow are dropped.
  //
  // It MERGES rather than replaces, and that is not an optimisation. A read
  // returns what is in the DOM now, so on a recycling feed a second read would
  // drop everything the first one found, ticks included; the first pass over
  // this returned five links after forty-five had gone by.
  const readLinks = () => {
    const targetDoc = getActiveDoc();
    const processLink = a => {
      const href = a.href;
      if (!/^https?:/.test(href) || href === location.href) return;
      if (state.seenLinks.has(href)) return;
      const text = clean(a.innerText) || clean(a.getAttribute('aria-label')) ||
                   clean(a.querySelector('img')?.alt) || href.replace(/^https?:\/\//, '');
      state.seenLinks.set(href, text.slice(0, 120));
    };
    for (const a of targetDoc.querySelectorAll('a[href]')) processLink(a);
    if (targetDoc === document) {
      for (const s of findShadowRoots()) {
        for (const a of s.root.querySelectorAll('a[href]')) processLink(a);
      }
    }
    const before = state.links.length;
    state.links = [...state.seenLinks].map(([href, text]) => ({ href, text }));
    return state.links.length - before;
  };

  // The page's own text. The container is asked for by name first, because a
  // page that marks up an <article> has already answered the question better
  // than any heuristic could; the fallback picks the densest block rather than
  // the biggest, so a nav column of eighty short links does not beat the prose.
  const readText = () => {
    const targetDoc = getActiveDoc();
    let named = targetDoc.querySelector('article, main, [role="main"]');
    let best = named;
    if (!best) {
      let score = 0;
      for (const el of targetDoc.querySelectorAll('body *')) {
        if (/^(SCRIPT|STYLE|NAV|HEADER|FOOTER|ASIDE|SVG)$/.test(el.tagName)) continue;
        const t = el.innerText || '';
        if (t.length < 400) continue;
        const s = t.length / (1 + el.querySelectorAll('a').length * 40);
        if (s > score) { score = s; best = el; }
      }
    }
    // Backup: Same-origin iframe harvester if main text is minimal (when reading top document)
    if (targetDoc === document && (!best || (best.innerText || '').trim().length < 200)) {
      for (const frame of (state.frames || []).filter(f => f.accessible && f.doc)) {
        const doc = frame.doc;
        if (doc && doc.body && (doc.body.innerText || '').trim().length > 200) {
          best = doc.querySelector('article, main, [role="main"]') || doc.body;
          break;
        }
      }
    }
    // clean() is wrong here: innerText already marks block boundaries with
    // newlines, and collapsing those runs every paragraph and heading into one
    // line. Horizontal runs collapse, vertical ones survive as a blank line.
    return String((best || targetDoc.body || targetDoc.documentElement).innerText || '')
      .replace(/[^\S\n]+/g, ' ')
      .replace(/ ?\n ?/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, 100000);
  };

  // Paragraph-level collection, which is what a VIRTUAL SCROLL needs and the
  // extractor above cannot give. readText picks one container and reads it
  // whole; a feed that recycles its rows has already thrown away what you
  // scrolled past, so reading at the end returns the last screen and nothing
  // else. Collecting reads the blocks currently present and keeps the ones it
  // has not seen, so scrolling accumulates rather than replaces.
  const BLOCKS = 'p, li, h1, h2, h3, h4, blockquote, dd, figcaption, td';
  const collectBlocks = () => {
    let added = 0;
    const targetDoc = getActiveDoc();
    const process = el => {
      if (el.closest?.('nav, header, footer, aside') || el.closest?.('#' + ID)) return;
      const t = clean(el.innerText);
      // 25 characters is a paragraph rather than a label, and the cap keeps an
      // infinite feed from becoming an infinite capture.
      if (t.length < 25 || state.seen.has(t)) return;
      if (state.blockChars > 200000) return;
      state.seen.add(t);
      state.blocks.push(t);
      state.blockChars += t.length;
      added++;
    };
    for (const el of targetDoc.querySelectorAll(BLOCKS)) process(el);
    if (targetDoc === document) {
      for (const s of findShadowRoots()) {
        for (const el of s.root.querySelectorAll(BLOCKS)) process(el);
      }
    }
    return added;
  };

  const page = {
    title: document.title || location.hostname,
    href: location.href,
    description: clean(document.querySelector('meta[name="description"]')?.content ||
                       document.querySelector('meta[property="og:description"]')?.content),
  };

  // The selection is read when the drawer OPENS, not when the launcher mounts:
  // a page load has no selection, and the one the reader made a moment ago is
  const ALL_SLIDES = [
    { id: 'md', label: 'Markdown', ext: 'md', icon: 'note' },
    { id: 'sel', label: 'Selection', ext: 'txt', icon: 'cursor' },
    { id: 'text', label: 'Text', ext: 'txt', icon: 'textT' },
    { id: 'links', label: 'Links', ext: 'md', icon: 'link' },
    { id: 'html', label: 'HTML', ext: 'html', icon: 'code' },
    { id: 'json', label: 'JSON', ext: 'json', icon: 'tree' },
  ];

  const getSlides = () => {
    const hasSel = !!(state.sel && state.sel.trim());
    return hasSel ? ALL_SLIDES : ALL_SLIDES.filter(s => s.id !== 'sel');
  };

  const getPref = key => {
    try {
      const v = localStorage.getItem('wt_' + key);
      if (v !== null) return v === 'true';
    } catch {}
    return true; // Default to true
  };
  const getPrefVal = (key, fallback = '') => {
    try {
      const v = localStorage.getItem('wt_' + key);
      if (v !== null) return v;
    } catch {}
    return fallback;
  };
  const setPref = (key, val) => {
    try { localStorage.setItem('wt_' + key, String(val)); } catch {}
    const setGm = (typeof GM !== 'undefined' && GM.setValue) ? GM.setValue.bind(GM)
      : (typeof GM_setValue !== 'undefined' ? (k, v) => Promise.resolve(GM_setValue(k, v)) : null);
    if (setGm) setGm('wt_' + key, val).catch(() => {});
  };

  const state = { slide: 0, links: [], text: '', picked: new Set(),
                  sel: '', selHtml: '', appendMode: false, seen: new Set(),
                  blocks: [], blockChars: 0, seenLinks: new Map(),
                  localMd: null, jinaMd: null, mdEngine: 'local', mdView: 'preview',
                  formattedHtml: null, htmlLines: 0,
                  shadowRoots: [], frames: [], activeFrameIndex: -1,
                  fullscreen: false, metaOpen: false, autoCheck: getPref('autocheck_updates') };

  // DOM-to-Markdown extractor: converts article/main or content dense tree into
  // clean, structured Markdown, preserving headings, quotes, code blocks, lists,
  // bold/italics, links, and images.
  const domToMarkdown = () => {
    const targetDoc = getActiveDoc();
    const docTitle = getActiveDocTitle();
    const docHref = getActiveDocHref();
    const named = targetDoc.querySelector('article, main, [role="main"]');
    let target = named;
    if (!target) {
      let score = 0;
      for (const el of targetDoc.querySelectorAll('body *')) {
        if (/^(SCRIPT|STYLE|NAV|HEADER|FOOTER|ASIDE|SVG|NOSCRIPT|IFRAME|FORM)$/.test(el.tagName)) continue;
        const t = el.innerText || '';
        if (t.length < 400) continue;
        const s = t.length / (1 + el.querySelectorAll('a').length * 40);
        if (s > score) { score = s; target = el; }
      }
    }
    // Backup: Same-origin iframe fallback if main text is minimal (when reading top document)
    if (targetDoc === document && (!target || (target.innerText || '').trim().length < 200)) {
      for (const frame of (state.frames || []).filter(f => f.accessible && f.doc)) {
        const doc = frame.doc;
        if (doc && doc.body && (doc.body.innerText || '').trim().length > 200) {
          target = doc.querySelector('article, main, [role="main"]') || doc.body;
          break;
        }
      }
    }
    target = target || targetDoc.body || targetDoc.documentElement;

    const walk = (node, depth = 0) => {
      if (depth > 40 || !node) return '';
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent.replace(/[^\S\n]+/g, ' ');
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return '';
      const tag = node.tagName.toUpperCase();
      if (/^(SCRIPT|STYLE|NAV|HEADER|FOOTER|ASIDE|SVG|NOSCRIPT|IFRAME|FORM|BUTTON)$/.test(tag)) return '';
      if (node.id === ID || node.closest?.('#' + ID)) return '';

      const kids = () => {
        const childs = Array.from(node.childNodes);
        if (node.shadowRoot) childs.push(...Array.from(node.shadowRoot.childNodes));
        return childs.map(c => walk(c, depth + 1)).join('');
      };
      const text = () => clean(node.innerText || '');

      switch (tag) {
        case 'H1': return `\n\n# ${text()}\n\n`;
        case 'H2': return `\n\n## ${text()}\n\n`;
        case 'H3': return `\n\n### ${text()}\n\n`;
        case 'H4': return `\n\n#### ${text()}\n\n`;
        case 'H5': return `\n\n##### ${text()}\n\n`;
        case 'H6': return `\n\n###### ${text()}\n\n`;
        case 'P': {
          const inner = kids().trim();
          return inner ? `\n\n${inner}\n\n` : '';
        }
        case 'BLOCKQUOTE': {
          const inner = clean(node.innerText);
          return inner ? `\n\n> ${inner.replace(/\n+/g, '\n> ')}\n\n` : '';
        }
        case 'PRE': {
          const code = node.innerText.trim();
          return code ? `\n\n\`\`\`\n${code}\n\`\`\`\n\n` : '';
        }
        case 'CODE': {
          if (node.closest('pre')) return node.innerText;
          const code = node.textContent.trim();
          return code ? `\`${code}\`` : '';
        }
        case 'UL':
        case 'OL': {
          const items = Array.from(node.children)
            .filter(c => c.tagName === 'LI')
            .map((li, idx) => {
              const liText = Array.from(li.childNodes).map(c => walk(c, depth + 1)).join('').trim();
              return tag === 'OL' ? `${idx + 1}. ${liText}` : `- ${liText}`;
            })
            .filter(Boolean)
            .join('\n');
          return items ? `\n\n${items}\n\n` : '';
        }
        case 'LI': {
          const inner = kids().trim();
          return inner ? `- ${inner}\n` : '';
        }
        case 'A': {
          const href = node.href;
          const inner = kids().trim() || text() || href;
          if (!href || /^javascript:/i.test(href)) return inner;
          return `[${inner}](${href})`;
        }
        case 'STRONG':
        case 'B': {
          const inner = kids().trim();
          return inner ? `**${inner}**` : '';
        }
        case 'EM':
        case 'I': {
          const inner = kids().trim();
          return inner ? `*${inner}*` : '';
        }
        case 'HR':
          return '\n\n---\n\n';
        case 'BR':
          return '\n';
        case 'IMG': {
          const src = node.src;
          const alt = clean(node.alt || node.title || '');
          return src ? `![${alt}](${src})` : '';
        }
        default:
          return kids();
      }
    };

    const out = [`# ${getActiveDocTitle()}`, '', getActiveDocHref()];
    if (page.description && state.activeFrameIndex < 0) out.push('', page.description);
    if (state.sel) out.push('', '> ' + state.sel.replace(/\n+/g, '\n> '));

    const bodyContent = state.blocks.length
      ? state.blocks.join('\n\n')
      : walk(target).replace(/[^\S\n]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

    if (bodyContent) out.push('', '---', '', bodyContent);

    if (state.picked.size) {
      out.push('', '## Links', '');
      for (const { href, text } of state.links) {
        if (state.picked.has(href)) out.push(`- [${text}](${href})`);
      }
    }
    return out.join('\n');
  };

  const compose = () => domToMarkdown();

  // Markdown Preview Renderer: converts Markdown to styled prose HTML
  const renderMarkdownToHtml = md => {
    if (!md) return '<p class="none">No markdown content.</p>';
    let raw = esc(md);
    const blocks = [];
    raw = raw.replace(/```([\s\S]*?)```/g, (_, code) => {
      blocks.push(`<pre class="md-pre"><code class="md-code">${code.trim()}</code></pre>`);
      return `\n%%BLOCK_${blocks.length - 1}%%\n`;
    });
    raw = raw.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>');
    raw = raw.replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g, '<a class="md-link" href="$2" target="_blank" rel="noopener">$1</a>');
    raw = raw.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    raw = raw.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    const lines = raw.split('\n');
    const out = [];
    let inList = false;
    let inQuote = false;
    let quoteLines = [];

    const flushQuote = () => {
      if (inQuote) {
        out.push(`<blockquote class="md-quote">${quoteLines.join('<br>')}</blockquote>`);
        quoteLines = [];
        inQuote = false;
      }
    };
    const flushList = () => {
      if (inList) {
        out.push('</ul>');
        inList = false;
      }
    };

    for (let line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        flushQuote();
        flushList();
        continue;
      }
      if (trimmed.startsWith('%%BLOCK_') && trimmed.endsWith('%%')) {
        flushQuote();
        flushList();
        const idx = parseInt(trimmed.replace(/\D/g, ''), 10);
        out.push(blocks[idx] || '');
        continue;
      }
      if (/^#{1,6}\s/.test(trimmed)) {
        flushQuote();
        flushList();
        const level = trimmed.match(/^#+/)[0].length;
        const text = trimmed.replace(/^#+\s*/, '');
        out.push(`<h${level} class="md-h md-h${level}">${text}</h${level}>`);
        continue;
      }
      if (trimmed === '---') {
        flushQuote();
        flushList();
        out.push('<hr class="md-hr">');
        continue;
      }
      if (trimmed.startsWith('&gt; ')) {
        flushList();
        inQuote = true;
        quoteLines.push(trimmed.slice(5));
        continue;
      } else {
        flushQuote();
      }
      if (/^[-*]\s/.test(trimmed)) {
        flushQuote();
        if (!inList) {
          out.push('<ul class="md-ul">');
          inList = true;
        }
        out.push(`<li class="md-li">${trimmed.replace(/^[-*]\s+/, '')}</li>`);
        continue;
      } else {
        flushList();
      }

      out.push(`<p class="md-p">${trimmed}</p>`);
    }
    flushQuote();
    flushList();
    return out.join('');
  };

  // DOM HTML Formatter & Syntax Highlighter: formats and indents the live document
  // tree into clean, 2-space indented HTML with syntax coloring tokens for tags,
  // attributes, strings, comments, and doctypes.
  const formatAndHighlightDom = (rootNode = null) => {
    const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
    const targetDoc = getActiveDoc();
    if (!rootNode) rootNode = targetDoc.documentElement;
    const parts = [];
    let lines = 0;
    const MAX_LINES = 1800;

    if (rootNode === targetDoc.documentElement) {
      parts.push('<span class="tok-doc">&lt;!DOCTYPE html&gt;</span>\n');
      lines++;
    }

    const walk = (node, indent = 0) => {
      if (lines >= MAX_LINES || !node) return;
      if (node.id === ID || node.closest?.('#' + ID)) return;

      const pad = '  '.repeat(indent);

      if (node.nodeType === Node.COMMENT_NODE) {
        const text = esc((node.textContent || '').trim());
        if (text) {
          parts.push(`${pad}<span class="tok-com">&lt;!-- ${text} --&gt;</span>\n`);
          lines++;
        }
        return;
      }

      if (node.nodeType === Node.TEXT_NODE) {
        const text = (node.textContent || '').trim();
        if (text) {
          parts.push(`${pad}<span class="tok-txt">${esc(text)}</span>\n`);
          lines++;
        }
        return;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) return;

      const tag = node.tagName.toLowerCase();
      let open = `${pad}<span class="tok-tag">&lt;${tag}</span>`;

      if (node.hasAttributes()) {
        for (const attr of node.attributes) {
          const name = esc(attr.name);
          const val = esc(attr.value);
          open += ` <span class="tok-attr">${name}</span>=<span class="tok-val">"${val}"</span>`;
        }
      }

      if (VOID.has(tag)) {
        open += `<span class="tok-tag">&gt;</span>\n`;
        parts.push(open);
        lines++;
        return;
      }

      // Filter children
      const kids = Array.from(node.childNodes).filter(c => {
        if (c.id === ID || c.closest?.('#' + ID)) return false;
        if (c.nodeType === Node.TEXT_NODE) return (c.textContent || '').trim().length > 0;
        return true;
      });

      // Inline compact elements with single short text node
      if (!node.shadowRoot && kids.length === 1 && kids[0].nodeType === Node.TEXT_NODE && (kids[0].textContent || '').trim().length < 80) {
        const text = esc((kids[0].textContent || '').trim());
        parts.push(`${open}<span class="tok-tag">&gt;</span><span class="tok-txt">${text}</span><span class="tok-tag">&lt;/${tag}&gt;</span>\n`);
        lines++;
        return;
      }

      // Inline script or style with bounded preview
      if (tag === 'script' || tag === 'style') {
        const raw = (node.textContent || '').trim();
        if (raw) {
          open += `<span class="tok-tag">&gt;</span>\n`;
          parts.push(open);
          lines++;
          const preview = raw.length > 500 ? raw.slice(0, 500) : raw;
          const snippet = preview.split('\n').slice(0, 8);
          for (const l of snippet) {
            if (lines >= MAX_LINES) break;
            parts.push(`${pad}  <span class="tok-inner">${esc(l)}</span>\n`);
            lines++;
          }
          if (raw.length > 500 || raw.split('\n').length > 8) {
            parts.push(`${pad}  <span class="tok-com">/* … truncated script/style preview … */</span>\n`);
            lines++;
          }
          parts.push(`${pad}<span class="tok-tag">&lt;/${tag}&gt;</span>\n`);
          lines++;
          return;
        }
      }

      if (kids.length === 0 && !node.shadowRoot) {
        open += `<span class="tok-tag">&gt;&lt;/${tag}&gt;</span>\n`;
        parts.push(open);
        lines++;
        return;
      }

      open += `<span class="tok-tag">&gt;</span>\n`;
      parts.push(open);
      lines++;

      if (tag === 'iframe') {
        let frameStatus = 'sealed';
        try {
          if (node.contentDocument) frameStatus = 'accessible (same-origin)';
        } catch {}
        parts.push(`${pad}  <span class="tok-com">&lt;!-- ⛶ frame [${frameStatus}] --&gt;</span>\n`);
        lines++;
      }

      // Traverse shadow root as declarative template if present
      if (node.shadowRoot && node !== host) {
        const mode = esc(node.shadowRoot.mode || 'open');
        parts.push(`${pad}  <span class="tok-com">&lt;!-- ⛶ shadow root (${mode}) --&gt;</span>\n`);
        lines++;
        parts.push(`${pad}  <span class="tok-tag">&lt;template</span> <span class="tok-attr">shadowrootmode</span>=<span class="tok-val">"${mode}"</span><span class="tok-tag">&gt;</span>\n`);
        lines++;
        for (const sKid of node.shadowRoot.childNodes) {
          walk(sKid, indent + 2);
          if (lines >= MAX_LINES) break;
        }
        parts.push(`${pad}  <span class="tok-tag">&lt;/template&gt;</span>\n`);
        lines++;
      }

      for (const kid of kids) {
        walk(kid, indent + 1);
        if (lines >= MAX_LINES) break;
      }

      parts.push(`${pad}<span class="tok-tag">&lt;/${tag}&gt;</span>\n`);
      lines++;
    };

    if (rootNode === targetDoc.documentElement) {
      walk(rootNode, 0);
    } else {
      for (const kid of rootNode.childNodes) {
        walk(kid, 0);
        if (lines >= MAX_LINES) break;
      }
    }

    if (lines >= MAX_LINES) {
      parts.push(`\n<span class="tok-com">&lt;!-- [Preview capped at ${MAX_LINES} lines; Copy and Stage buttons export 100% complete HTML] --&gt;</span>\n`);
    }

    return { html: parts.join(''), lines };
  };

  // ---- The surface -------------------------------------------------------

  const P = 'var(--wt-p)';
  const mix = (c, pct) => `color-mix(in oklch, ${c} ${pct}%, transparent)`;
  const host = document.createElement('div');
  host.id = ID;
  const root = host.attachShadow({ mode: 'open' });

  const sheet = new CSSStyleSheet();
  sheet.replaceSync(`
    :host {
      all: initial;
      --wt-p: oklch(56.86% .255 257.57);
      --wt-b100: oklch(100% 0 0);
      --wt-b200: oklch(97.466% .011 259.822);
      --wt-b300: oklch(93.268% .016 262.751);
      --wt-bc: oklch(41.886% .053 255.824);
    }
    button, a { font: inherit; color: inherit; }
    /* ONE MEASURED ROOT, and the reason is iOS. position:fixed resolves
       against the LAYOUT viewport, which on a page carrying an unclamped table,
       a wide ad slot or a pinch-zoom is wider than the screen; a panel anchored
       to its right edge then hangs off the side, and vw units measure the same
       wrong thing so max-width does not save it. visualViewport is the API that
       reports what is actually on screen, so the root is sized and offset from
       it and everything inside is positioned against that. Chromium anchors
       fixed to the visual viewport already, so this changes nothing on a
       desktop and is only observable where it matters. */
    .vp { position: fixed; top: 0; left: 0; width: 100vw; height: 100dvh;
          pointer-events: none; z-index: 2147483647; }
    .wrap { position: absolute; z-index: 2; pointer-events: auto;
            font: 400 14px/1.4 ui-sans-serif, -apple-system, system-ui, sans-serif;
            color: var(--wt-bc); }
    .btn { width: 3.5rem; height: 3.5rem; border-radius: 1rem;
           border: 1px solid ${mix(P, 20)}; background: ${mix(P, 10)};
           display: flex; align-items: center; justify-content: center;
           cursor: grab; touch-action: none; position: relative;
           -webkit-user-select: none; user-select: none; transition: all .3s, opacity .2s; }
    .btn:active { cursor: grabbing; }
    .btn.on { background: ${mix(P, 30)}; border-color: ${mix(P, 50)}; }
    .btn svg { width: 1.5rem; height: 1.5rem; color: ${mix(P, 40)}; transition: color .3s; }
    .btn.on svg { color: var(--wt-p); }

    .menu { position: absolute; bottom: 100%; right: 0; margin-bottom: .5rem;
            width: 15rem; border-radius: 1rem; border: 1px solid var(--wt-b300);
            background: var(--wt-b100); overflow: hidden;
            box-shadow: 0 25px 50px -12px #00000040; }
    .row { display: flex; align-items: center; gap: .625rem;
           padding: .5rem .75rem; width: 100%; background: none; border: 0;
           text-decoration: none; text-align: left; cursor: pointer; }
    .row:hover, .row:active { background: var(--wt-b200); }
    .row svg { width: 17px; height: 17px; color: var(--wt-p); flex: none; }
    .row span { font-size: .875rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .row[hidden] { display: none; }
    .pill-toggle {
      font: 700 10px ui-sans-serif, system-ui, sans-serif;
      padding: .15rem .45rem; border-radius: 9999px;
      margin-left: auto; flex: none;
      transition: all .2s;
    }
    .pill-toggle.on {
      background: ${mix(P, 15)}; color: var(--wt-p); border: 1px solid ${mix(P, 40)};
    }
    .pill-toggle.off {
      background: var(--wt-b200); color: ${mix('var(--wt-bc)', 50)}; border: 1px solid var(--wt-b300);
    }
    .menu-foot {
      padding: .375rem .75rem; border-top: 1px solid var(--wt-b300);
      font-size: 10px; color: ${mix('var(--wt-bc)', 50)}; text-align: right;
      background: var(--wt-b200);
    }

    /* The drawer, in the fab's shape: an absolute panel inside a fixed
       overflow-hidden layer, so the off-screen half is clipped rather than
       widening the host page's layout. */
    .layer { position: absolute; inset: 0; z-index: 1;
             overflow: hidden; pointer-events: none;
             font: 400 14px/1.4 ui-sans-serif, -apple-system, system-ui, sans-serif;
             color: var(--wt-bc); }
    .backdrop {
      position: absolute; inset: 0; background: rgba(0, 0, 0, .28);
      opacity: 0; pointer-events: none; transition: opacity .25s ease-out;
    }
    .layer.open .backdrop { opacity: 1; pointer-events: auto; }

    .panel { position: absolute; inset-block: 0; right: 0; left: auto;
             width: 22rem; max-width: 88vw;
             transform: translateX(100%); transition: transform .3s cubic-bezier(0.16, 1, 0.3, 1);
             display: flex; flex-direction: column;
             background: var(--wt-b100); border-left: 1px solid var(--wt-b300);
             box-shadow: 0 25px 50px -12px #00000040;
             pointer-events: auto; overscroll-behavior: contain; }
    .panel.open { transform: translateX(0); }

    .panel.fullscreen {
      left: 0; right: 0; top: 0; bottom: 0;
      width: 100vw; max-width: 100vw; height: 100dvh;
      border-left: 0; border-radius: 0;
      transform: none !important;
    }
    .panel.fullscreen ~ .backdrop,
    .panel.fullscreen + .backdrop { display: none; }

    .head { padding: .5rem .75rem; border-bottom: 1px solid var(--wt-b300);
            display: flex; flex-direction: column; gap: .25rem; flex: none; background: var(--wt-b100); }
    .head-top { display: flex; align-items: center; gap: .5rem; min-width: 0; }
    .plaque { width: 2.25rem; height: 2.25rem; border-radius: .625rem;
              background: ${mix(P, 12)}; color: var(--wt-p);
              display: flex; align-items: center; justify-content: center; flex: none; }
    .plaque svg { width: 1.25rem; height: 1.25rem; }
    .head-titles { display: flex; flex-direction: column; min-width: 0; flex: 1; justify-content: center; }
    .head-title { margin: 0; font-size: .875rem; font-weight: 600; line-height: 1.25;
                  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--wt-bc); }
    .head-sub { margin: 0; font-size: 11px; color: ${mix('var(--wt-bc)', 60)};
                overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; user-select: none; }
    .head-sub:hover { color: var(--wt-bc); }
    .pill { display: inline-flex; align-items: center; gap: 1px;
            padding: .15rem .45rem; border-radius: 9999px;
            border: 1px solid var(--wt-b300); background: var(--wt-b200);
            font: 600 11px ui-monospace, monospace; color: ${mix('var(--wt-bc)', 70)}; flex: none; }
    .panel:not(.fullscreen) .pill { display: none; }
    .panel.fullscreen .pill { display: inline-flex; }
    .pill-sep { opacity: .4; margin: 0 1px; }
    .head-actions { display: flex; align-items: center; gap: .25rem; flex: none; }
    .icon-btn { width: 1.75rem; height: 1.75rem; border: 0; border-radius: .375rem;
                background: none; cursor: pointer; display: flex;
                align-items: center; justify-content: center; }
    .icon-btn:hover { background: var(--wt-b200); }
    .icon-btn svg { width: 1.05rem; height: 1.05rem; color: ${mix(P, 70)}; }
    .icon-btn[hidden] { display: none; }
    .panel:not(.fullscreen) .copy-btn { display: none !important; }

    .head-intro {
      display: flex; align-items: center; justify-content: space-between;
      gap: .375rem; flex-wrap: wrap;
    }
    .head-intro-left {
      display: flex; align-items: center; gap: .375rem; flex-wrap: wrap;
    }
    .head-intro-right {
      display: flex; align-items: center; gap: .25rem; margin-left: auto;
    }
    .head-btn {
      display: inline-flex; align-items: center; gap: .25rem;
      padding: .15rem .45rem; border-radius: .25rem;
      border: 1px solid var(--wt-b300); background: var(--wt-b200);
      cursor: pointer; font: 600 10.5px ui-sans-serif, system-ui, sans-serif;
      color: ${mix('var(--wt-bc)', 75)}; flex: none; user-select: none;
    }
    .head-btn:hover { background: var(--wt-b300); color: var(--wt-bc); }
    .head-btn.on { background: ${mix(P, 15)}; border-color: ${mix(P, 40)}; color: var(--wt-p); }
    .head-btn svg { width: 11px; height: 11px; color: ${mix(P, 80)}; }
    .head-btn[hidden] { display: none; }
    .head-desc {
      margin: 0; font-size: 11.5px; line-height: 1.4;
      color: ${mix('var(--wt-bc)', 75)};
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
      overflow: hidden; flex: 1; min-width: 0;
    }
    .head-desc[hidden] { display: none; }
    .meta-toggle { display: inline-flex; align-items: center; gap: .25rem;
                   padding: .15rem .375rem; border-radius: .25rem;
                   border: 1px solid var(--wt-b300); background: var(--wt-b200);
                   cursor: pointer; font: 600 10px ui-sans-serif, system-ui, sans-serif;
                   color: ${mix('var(--wt-bc)', 75)}; flex: none; margin-left: auto; }
    .meta-toggle:hover { background: var(--wt-b300); }
    .meta-toggle svg { width: 11px; height: 11px; color: var(--wt-p); }
    .meta-arr { font-size: 8px; transition: transform .2s; }
    .meta-toggle.on .meta-arr { transform: rotate(180deg); }

    .head-frame-banner {
      margin: .25rem 0 0; padding: .375rem .5rem; border-radius: .375rem;
      background: ${mix(P, 10)}; border: 1px solid ${mix(P, 30)};
      display: flex; flex-direction: column; gap: .25rem;
    }
    .head-frame-banner[hidden] { display: none; }
    .frame-bar-top {
      display: flex; align-items: center; justify-content: space-between; gap: .5rem;
    }
    .frame-tag {
      display: inline-flex; align-items: center; gap: .25rem;
      font: 700 10.5px ui-sans-serif, system-ui, sans-serif; color: var(--wt-p);
    }
    .frame-tag svg { width: 11px; height: 11px; }
    .frame-name {
      font-weight: 600; font-size: 11px; color: var(--wt-bc);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 140px;
    }
    .btn-return-main {
      font: 600 10px ui-sans-serif, system-ui, sans-serif;
      padding: .15rem .45rem; border-radius: 9999px;
      cursor: pointer; border: 1px solid ${mix(P, 40)};
      background: var(--wt-b100); color: var(--wt-p);
      transition: all .15s;
    }
    .btn-return-main:hover {
      background: var(--wt-p); color: #fff;
    }

    .sel-slide-content {
      padding: .25rem 0;
      display: flex;
      flex-direction: column;
      gap: .75rem;
    }
    .sel-quote {
      font-size: 13px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
      user-select: text;
    }
    .sel-links-section {
      border-top: 1px solid var(--wt-b300);
      padding-top: .5rem;
    }
    .sel-links-list {
      margin: 0;
      padding-left: 1.25rem;
      font-size: 12px;
      line-height: 1.6;
    }
    .sel-links-list a {
      color: var(--wt-p);
      text-decoration: underline;
    }

    .panel.fullscreen .head-intro,
    .panel.fullscreen .head-desc,
    .panel.fullscreen .head-frame-banner,
    .panel.fullscreen .meta-toggle,
    .panel.fullscreen .page-meta { display: none !important; }
    .page-meta { margin-top: .25rem; padding: .5rem .625rem; border-radius: .5rem;
                 background: var(--wt-b200); border: 1px solid var(--wt-b300);
                 font-size: 11px; max-height: 16rem; overflow-y: auto; }
    .page-meta[hidden] { display: none; }
    .page-meta p { margin: 0 0 .375rem; overflow-wrap: break-word; }
    .page-meta p:last-child { margin-bottom: 0; }
    .page-meta .k { display: block; font: 10px ui-monospace, monospace;
                    color: ${mix('var(--wt-bc)', 55)}; margin-bottom: .125rem; }
    .meta-scope-summary { font-weight: 600; margin-bottom: .375rem; color: var(--wt-bc); }
    .meta-scope-list { display: flex; flex-direction: column; gap: .375rem; margin-top: .25rem; }
    .meta-scope-item {
      display: flex; flex-direction: column; gap: .2rem;
      padding: .375rem .5rem; border-radius: .375rem;
      background: var(--wt-b100); border: 1px solid var(--wt-b300);
      font-size: 10.5px;
    }
    .meta-scope-item.active {
      border-color: ${mix(P, 60)}; background: ${mix(P, 6)};
    }
    .meta-scope-header {
      display: flex; align-items: center; justify-content: space-between; gap: .5rem;
    }
    .meta-scope-name {
      font-weight: 600; display: inline-flex; align-items: center; gap: .25rem;
      color: var(--wt-bc); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .meta-scope-name svg { width: 11px; height: 11px; shrink: 0; color: var(--wt-p); }
    .meta-scope-badge {
      font: 700 9px ui-monospace, monospace; text-transform: uppercase;
      padding: .1rem .35rem; border-radius: 9999px; letter-spacing: .03em; flex: none;
    }
    .meta-scope-badge.readable {
      background: oklch(92% .08 140); color: oklch(45% .15 140);
    }
    .meta-scope-badge.sealed {
      background: oklch(90% .04 30); color: oklch(50% .12 30);
    }
    .meta-scope-badge.main {
      background: ${mix(P, 15)}; color: var(--wt-p);
    }
    .meta-scope-url {
      color: ${mix('var(--wt-bc)', 70)}; font-family: ui-monospace, monospace; font-size: 9.5px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .meta-scope-stats {
      color: ${mix('var(--wt-bc)', 65)}; font-size: 10px; display: flex; align-items: center; justify-content: space-between; gap: .5rem;
    }
    .meta-scope-act {
      font: 600 10px ui-sans-serif, system-ui, sans-serif;
      padding: .1rem .4rem; border-radius: .25rem;
      cursor: pointer; transition: all .15s;
      border: 1px solid ${mix(P, 40)}; background: var(--wt-b100); color: var(--wt-p);
    }
    .meta-scope-act:hover {
      background: var(--wt-p); color: #fff;
    }
    .meta-scope-active-label {
      font: 600 10px ui-monospace, monospace; color: oklch(50% .15 140);
    }
    .meta-pref-row {
      display: flex; align-items: center; justify-content: space-between;
      margin-top: .5rem; padding-top: .375rem;
      border-top: 1px dashed var(--wt-b300);
    }
    .meta-pref-row .k { margin-bottom: 0 !important; }
    .meta-pref-btn {
      font: 700 10px ui-sans-serif, system-ui, sans-serif;
      padding: .15rem .45rem; border-radius: 9999px;
      cursor: pointer; transition: all .2s;
      border: 1px solid var(--wt-b300);
    }
    .meta-pref-btn.on {
      background: ${mix(P, 15)}; color: var(--wt-p); border-color: ${mix(P, 40)};
    }
    .meta-pref-btn.off {
      background: var(--wt-b100); color: ${mix('var(--wt-bc)', 50)};
    }
    .quote { border-left: 2px solid ${mix(P, 40)}; padding-left: .625rem;
             color: ${mix('var(--wt-bc)', 80)}; }
    .none { color: ${mix('var(--wt-bc)', 50)}; font-style: italic; }
    .stale { display: block; margin: .375rem .75rem .25rem; padding: .375rem .625rem;
             font-size: 11px; font-weight: 600; border-radius: .5rem;
             background: ${mix('var(--wt-b200)', 80)}; color: oklch(60% .18 140); }
    .stale[hidden] { display: none; }

    .deck-nav { border-bottom: 1px solid var(--wt-b300); flex: none; background: var(--wt-b100); }
    .deck-bar { display: flex; overflow-x: auto; scrollbar-width: none;
                padding: 0 .375rem; gap: .125rem; }
    .deck-bar::-webkit-scrollbar { display: none; }
    .deck-tab { padding: .4375rem .625rem; background: none; border: 0;
                border-bottom: 2px solid transparent; cursor: pointer;
                font-size: .8125rem; font-weight: 600; color: ${mix('var(--wt-bc)', 55)};
                white-space: nowrap; flex: none; transition: all .15s; }
    .deck-tab:hover { color: var(--wt-bc); }
    .deck-tab.on { color: var(--wt-p); border-bottom-color: var(--wt-p); }
    .panel.fullscreen .deck-nav { display: none; }

    /* Horizontal snap track in both drawer and fullscreen modes */
    .deck-track {
      display: flex; flex: 1; min-height: 0; width: 100%;
      overflow-x: auto; overflow-y: hidden;
      scroll-snap-type: x mandatory; overscroll-behavior-x: contain;
      scrollbar-width: none; scroll-behavior: smooth;
    }
    .deck-track::-webkit-scrollbar { display: none; }
    .deck-slide {
      display: flex; flex-direction: column;
      flex: 0 0 100%; width: 100%; min-width: 100%; max-width: 100%;
      box-sizing: border-box;
      scroll-snap-align: start; scroll-snap-stop: always;
      overflow-y: hidden; overscroll-behavior-y: contain;
      padding: 0;
    }
    .deck-slide[hidden], .deck-tab[hidden], .pager .dot[hidden] {
      display: none !important;
    }

    /* Subtle inline slide controls */
    .slide-tools {
      display: flex; align-items: center; padding: .375rem .75rem 0;
      flex: none; min-height: 1.875rem; box-sizing: border-box; width: 100%;
      background: transparent;
    }
    .slide-tools-inner {
      display: flex; align-items: center; gap: .5rem; width: 100%; min-width: 0;
    }
    .panel.fullscreen .slide-tools { display: none; }

    .tool-btn {
      background: none; border: 1px solid var(--wt-b300); border-radius: .25rem;
      cursor: pointer; padding: .15rem .45rem;
      font: 600 11px ui-sans-serif, system-ui, sans-serif;
      color: ${mix('var(--wt-bc)', 75)}; transition: all .15s;
    }
    .tool-btn:hover { background: var(--wt-b200); color: var(--wt-bc); }
    .tool-btn.on {
      background: var(--wt-b200); color: var(--wt-p); border-color: ${mix(P, 40)};
    }
    .tool-meta {
      margin-left: auto; font: 10.5px ui-monospace, monospace;
      color: ${mix('var(--wt-bc)', 55)}; white-space: nowrap; flex: none;
    }

    .head-tools, .head-scope-tools { display: flex; align-items: center; gap: .375rem; }
    .head-tools[hidden], .head-scope-tools[hidden] { display: none; }

    .copy-btn.copied svg, .store-btn.stored svg, .btn-store.stored svg { color: oklch(65% .2 145); }
    .btn-store { text-decoration: none; }
    .btn-store svg { width: 12px; height: 12px; color: var(--wt-p); }
    .btn-store.stored { border-color: oklch(65% .2 145 / 40%); color: oklch(65% .2 145); }

    .icon-btn.md-view-toggle svg { color: ${mix('var(--wt-bc)', 45)}; transition: color .15s; }
    .icon-btn.md-view-toggle.on svg { color: var(--wt-p); }
    .icon-btn.jina-ext svg { color: ${mix('var(--wt-bc)', 60)}; transition: color .15s; }
    .icon-btn.jina-ext:hover svg { color: var(--wt-p); }

    .seg {
      display: inline-flex; align-items: center; border-radius: .375rem;
      background: var(--wt-b300); padding: 2px; gap: 2px;
    }
    .seg-sm { padding: 1px; gap: 1px; border-radius: .25rem; }
    .seg-sm .seg-btn { padding: .1rem .35rem; font-size: 10px; border-radius: .2rem; }
    .seg-btn {
      border: 0; border-radius: .25rem; background: none; cursor: pointer;
      padding: .2rem .45rem; font: 600 11px ui-sans-serif, system-ui, sans-serif;
      color: ${mix('var(--wt-bc)', 70)}; transition: all .15s;
    }
    .seg-btn:hover { color: var(--wt-bc); }
    .seg-btn.on {
      background: var(--wt-b100); color: var(--wt-p);
      box-shadow: 0 1px 2px rgba(0,0,0,.08);
    }
    .sel-highlight {
      background: ${mix(P, 25)};
      color: inherit;
      border-radius: 2px;
      padding: 0 2px;
      border-bottom: 2px solid var(--wt-p);
    }

    /* Prose typography */
    .md-prose {
      font: 400 13px/1.65 ui-sans-serif, -apple-system, system-ui, sans-serif;
      color: var(--wt-bc); word-break: break-word;
    }
    .md-prose .md-h { color: var(--wt-bc); font-weight: 700; line-height: 1.25; margin: 1rem 0 .375rem; }
    .md-prose .md-h1 { font-size: 1.25rem; margin-top: 0; }
    .md-prose .md-h2 { font-size: 1.1rem; border-bottom: 1px solid var(--wt-b300); padding-bottom: .25rem; }
    .md-prose .md-h3 { font-size: .95rem; }
    .md-prose .md-h4, .md-prose .md-h5, .md-prose .md-h6 { font-size: .85rem; }
    .md-prose .md-p { margin: 0 0 .625rem; line-height: 1.6; }
    .md-prose .md-quote {
      margin: .625rem 0; padding: .375rem .625rem; border-left: 3px solid var(--wt-p);
      background: ${mix(P, 6)}; border-radius: 0 .375rem .375rem 0;
      font-style: italic; color: ${mix('var(--wt-bc)', 85)};
    }
    .md-prose .md-pre {
      margin: .625rem 0; padding: .5rem .625rem; border-radius: .375rem;
      background: var(--wt-b200); border: 1px solid var(--wt-b300);
      overflow-x: auto; font: 11px/1.45 ui-monospace, monospace;
    }
    .md-prose .md-code { font: inherit; }
    .md-prose .md-inline-code {
      font: 11px ui-monospace, monospace; padding: .125rem .25rem; border-radius: .25rem;
      background: var(--wt-b200); border: 1px solid var(--wt-b300);
    }
    .md-prose .md-link {
      color: var(--wt-p); text-decoration: underline; text-underline-offset: 2px;
    }
    .md-prose .md-ul { margin: .375rem 0 .625rem 1.125rem; padding: 0; }
    .md-prose .md-li { margin-bottom: .2rem; }
    .md-prose .md-hr { border: 0; border-top: 1px solid var(--wt-b300); margin: 1rem 0; }

    .slide-body {
      flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior-y: contain;
      padding: .5rem .75rem 1rem; box-sizing: border-box; width: 100%;
    }
    .slide-body-inner {
      width: 100%; min-width: 0;
    }

    /* Fullscreen Deck: centered readable width without card borders */
    .panel.fullscreen .head {
      padding: .625rem 1.25rem;
    }
    .panel.fullscreen .head-top {
      max-width: 52rem; width: 100%; margin-inline: auto;
    }
    .panel.fullscreen .page-meta {
      max-width: 52rem; width: 100%; margin-inline: auto;
    }
    .panel.fullscreen .slide-body {
      padding: 1.25rem 1.5rem 4rem;
    }
    .panel.fullscreen .slide-body-inner {
      max-width: 52rem; margin-inline: auto;
    }

    .bar { display: flex; align-items: center; gap: .5rem; padding: 0 0 .5rem; flex: none; }
    .bar button { background: none; border: 0; cursor: pointer; padding: .25rem 0;
                  font-size: .75rem; font-weight: 600; color: var(--wt-p); }
    .bar button.on { color: var(--wt-p); }
    .bar button.on::before { content: '● '; }
    .bar .count { margin-left: auto; font: 11px ui-monospace, monospace;
                  color: ${mix('var(--wt-bc)', 55)}; }

    .link { display: flex; gap: .5rem; align-items: flex-start; width: 100%;
            padding: .375rem .25rem; background: none; border: 0;
            text-align: left; cursor: pointer; border-radius: .375rem; }
    .link:hover { background: var(--wt-b200); }
    .link .box { flex: none; width: 1rem; height: 1rem; margin-top: .125rem;
                 border: 1px solid ${mix('var(--wt-bc)', 35)}; border-radius: .25rem; }
    .link.on .box { background: var(--wt-p); border-color: var(--wt-p); }
    .link .box svg { width: 100%; height: 100%; color: var(--wt-b100); display: none; }
    .link.on .box svg { display: block; }
    .link i { font-style: normal; display: block; font-size: .8125rem; }
    .link u { display: block; font: 10px ui-monospace, monospace; text-decoration: none;
              color: ${mix('var(--wt-bc)', 50)};
              overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .text { font: 12px/1.5 ui-monospace, monospace; white-space: pre-wrap;
            overflow-wrap: break-word; color: ${mix('var(--wt-bc)', 85)}; }
    .html-code-wrap {
      font: 11.5px/1.55 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      white-space: pre-wrap; word-break: break-word; overflow-wrap: break-word;
      margin: 0; padding: .375rem 0; color: ${mix('var(--wt-bc)', 85)};
    }
    .html-code-wrap[hidden] { display: none; }
    .tok-doc { color: oklch(60% .2 310); font-weight: 600; }
    .tok-tag { color: var(--wt-p); font-weight: 600; }
    .tok-attr { color: oklch(65% .18 195); }
    .tok-val { color: oklch(65% .18 140); }
    .tok-txt { color: var(--wt-bc); }
    .tok-com { color: ${mix('var(--wt-bc)', 50)}; font-style: italic; }
    .tok-inner { color: ${mix('var(--wt-bc)', 75)}; }

    .panel:not(.fullscreen) .foot { display: none !important; }
    .panel.fullscreen .foot {
      position: absolute; bottom: 1.25rem; left: 0; right: 0;
      display: flex; justify-content: center; align-items: center;
      background: none; border-top: 0; min-height: auto;
      padding: 0; pointer-events: none; z-index: 10;
    }
    .panel.fullscreen .foot-inner {
      width: auto; pointer-events: auto;
      background: ${mix('var(--wt-b100)', 85)};
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border: 1px solid var(--wt-b300);
      border-radius: 9999px;
      padding: .25rem .625rem;
      box-shadow: 0 4px 16px rgba(0,0,0,.18);
      gap: 0;
    }
    .panel.fullscreen .foot [data-copy],
    .panel.fullscreen .foot [data-send],
    .panel.fullscreen .foot [data-store],
    .panel.fullscreen .foot .size {
      display: none !important;
    }

    .foot { border-top: 1px solid var(--wt-b300);
            padding: .5rem 5rem .5rem .75rem;
            display: flex; flex: none;
            background: var(--wt-b100); min-height: 3.5rem; box-sizing: border-box; }
    .foot-inner { display: flex; gap: .375rem; align-items: center; width: 100%; }
    .act { padding: .375rem .625rem; border-radius: .375rem; cursor: pointer;
           border: 1px solid ${mix(P, 30)}; background: ${mix(P, 10)};
           color: var(--wt-p); font-size: .75rem; font-weight: 600;
           text-decoration: none; display: inline-flex; align-items: center;
           justify-content: center; flex: none; }
    .act.off { opacity: .4; pointer-events: none; }
    .size { font: 11px ui-monospace, monospace;
            color: ${mix('var(--wt-bc)', 55)}; text-align: right; white-space: nowrap; flex: none;
            margin-left: auto; }

    .pager { display: flex; align-items: center; justify-content: center;
             gap: 2px; flex: none; }
    .dot { width: 18px; height: 18px; padding: 0; background: none; border: 0;
           display: flex; align-items: center; justify-content: center;
           cursor: pointer; border-radius: 9999px; }
    .dot::before { content: ''; display: block; width: 5px; height: 5px;
                   border-radius: 9999px; background: ${mix('var(--wt-bc)', 25)};
                   transition: all .2s; }
    .dot:hover::before { background: ${mix('var(--wt-bc)', 45)}; transform: scale(1.2); }
    .dot.on::before { width: 14px; background: var(--wt-p); }
  `);
  root.adoptedStyleSheets = [sheet];

  const svg = d => `<svg viewBox="0 0 256 256" fill="currentColor"><path d="${d}"/></svg>`;
  const ICON = {
    caretLeft: 'M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z',
    sidebar: 'M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40ZM40,56H80V200H40ZM216,200H96V56H216V200Z',
    cardsThree: 'M208,88H48a16,16,0,0,0-16,16v96a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V104A16,16,0,0,0,208,88Zm0,112H48V104H208v96ZM48,64a8,8,0,0,1,8-8H200a8,8,0,0,1,0,16H56A8,8,0,0,1,48,64ZM64,32a8,8,0,0,1,8-8H184a8,8,0,0,1,0,16H72A8,8,0,0,1,64,32Z',
    copy: 'M216,32H88a8,8,0,0,0-8,8V80H40a8,8,0,0,0-8,8V216a8,8,0,0,0,8,8H168a8,8,0,0,0,8-8V176h40a8,8,0,0,0,8-8V40A8,8,0,0,0,216,32ZM160,208H48V96H160Zm48-48H176V88a8,8,0,0,0-8-8H96V48H208Z',
    note: 'M229.66,58.34l-32-32a8,8,0,0,0-11.32,0l-96,96A8,8,0,0,0,88,128v32a8,8,0,0,0,8,8h32a8,8,0,0,0,5.66-2.34l96-96A8,8,0,0,0,229.66,58.34ZM124.69,152H104V131.31l64-64L188.69,88ZM200,76.69,179.31,56,192,43.31,212.69,64ZM224,128v80a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V48A16,16,0,0,1,48,32h80a8,8,0,0,1,0,16H48V208H208V128a8,8,0,0,1,16,0Z',
    link: 'M240,88.23a54.43,54.43,0,0,1-16,37L189.25,160a54.27,54.27,0,0,1-38.63,16h-.05A54.63,54.63,0,0,1,96,119.84a8,8,0,0,1,16,.45A38.62,38.62,0,0,0,150.58,160h0a38.39,38.39,0,0,0,27.31-11.31l34.75-34.75a38.63,38.63,0,0,0-54.63-54.63l-11,11A8,8,0,0,1,135.7,59l11-11A54.65,54.65,0,0,1,224,48,54.86,54.86,0,0,1,240,88.23ZM109,185.66l-11,11A38.41,38.41,0,0,1,70.6,208h0a38.63,38.63,0,0,1-27.29-65.94L78,107.31A38.63,38.63,0,0,1,144,135.71a8,8,0,0,0,16,.45A54.86,54.86,0,0,0,144,96a54.65,54.65,0,0,0-77.27,0L32,130.75A54.62,54.62,0,0,0,70.56,224h0a54.28,54.28,0,0,0,38.64-16l11-11A8,8,0,0,0,109,185.66Z',
    tree: 'M160,112h48a16,16,0,0,0,16-16V48a16,16,0,0,0-16-16H160a16,16,0,0,0-16,16V64H128a24,24,0,0,0-24,24v32H72v-8A16,16,0,0,0,56,96H24A16,16,0,0,0,8,112v32a16,16,0,0,0,16,16H56a16,16,0,0,0,16-16v-8h32v32a24,24,0,0,0,24,24h16v16a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V160a16,16,0,0,0-16-16H160a16,16,0,0,0-16,16v16H128a8,8,0,0,1-8-8V88a8,8,0,0,1,8-8h16V96A16,16,0,0,0,160,112ZM56,144H24V112H56v32Zm104,16h48v48H160Zm0-112h48V96H160Z',
    out: 'M224,104a8,8,0,0,1-16,0V59.32l-66.33,66.34a8,8,0,0,1-11.32-11.32L196.68,48H152a8,8,0,0,1,0-16h64a8,8,0,0,1,8,8Zm-40,24a8,8,0,0,0-8,8v72H48V80h72a8,8,0,0,0,0-16H48A16,16,0,0,0,32,80V208a16,16,0,0,0,16,16H176a16,16,0,0,0,16-16V136A8,8,0,0,0,184,128Z',
    hide: 'M53.92,34.62A8,8,0,1,0,42.08,45.38L61.32,66.55C25,88.84,9.38,123.2,8.69,124.76a8,8,0,0,0,0,6.5c.35.79,8.82,19.57,27.65,38.4C61.43,194.74,93.12,208,128,208a127.11,127.11,0,0,0,52.07-10.83l22,24.21a8,8,0,1,0,11.84-10.76Zm47.33,75.84,41.67,45.85a32,32,0,0,1-41.67-45.85ZM128,192c-30.78,0-57.67-11.19-79.93-33.25A133.16,133.16,0,0,1,25,128c4.69-8.79,19.66-33.39,47.35-49.38l18,19.75a48,48,0,0,0,63.66,70l14.73,16.2A112,112,0,0,1,128,192Zm6-95.43a8,8,0,0,1,3-15.72,48.16,48.16,0,0,1,38.77,42.64,8,8,0,0,1-7.22,8.71,6.39,6.39,0,0,1-.75,0,8,8,0,0,1-8-7.26A32.09,32.09,0,0,0,134,96.57Zm113.28,34.69c-.42.94-10.55,23.37-33.36,43.8a8,8,0,1,1-10.67-11.92A132.77,132.77,0,0,0,231.05,128a133.15,133.15,0,0,0-23.12-30.77C185.67,75.19,158.78,64,128,64a118.37,118.37,0,0,0-19.36,1.57A8,8,0,1,1,106,49.79,134,134,0,0,1,128,48c34.88,0,66.57,13.26,91.66,38.35,18.83,18.83,27.3,37.62,27.65,38.41A8,8,0,0,1,247.31,131.26Z',
    refresh: 'M224,48V96a8,8,0,0,1-8,8H168a8,8,0,0,1,0-16h28.69L182.06,73.37a79.56,79.56,0,0,0-56.13-23.43h-.45A79.52,79.52,0,0,0,69.59,72.71,8,8,0,0,1,58.41,61.27a96,96,0,0,1,135,.79L208,76.69V48a8,8,0,0,1,16,0ZM186.41,183.29a80,80,0,0,1-112.47-.66L59.31,168H88a8,8,0,0,0,0-16H40a8,8,0,0,0-8,8v48a8,8,0,0,0,16,0V179.31l14.63,14.63A95.43,95.43,0,0,0,130,222.06h.53a95.36,95.36,0,0,0,67.07-27.33,8,8,0,0,0-11.18-11.44Z',
    check: 'M232.49,80.49l-128,128a12,12,0,0,1-17,0l-56-56a12,12,0,1,1,17-17L96,183,215.51,63.51a12,12,0,0,1,17,17Z',
    code: 'M69.66,154.34a8,8,0,0,1-11.32,11.32l-40-40a8,8,0,0,1,0-11.32l40-40a8,8,0,0,1,11.32,11.32L35.31,120Zm152-40a8,8,0,0,0-11.32-11.32l-40,40a8,8,0,0,0,0,11.32l40,40a8,8,0,0,0,11.32-11.32L180.69,120ZM101.44,213.6l56-176a8,8,0,0,0-15.28-4.8l-56,176a8,8,0,1,0,15.28,4.8Z',
    jina: 'M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40ZM192,152H64a8,8,0,0,1,0-16H192a8,8,0,0,1,0,16Zm0-32H64a8,8,0,0,1,0-16H192a8,8,0,0,1,0,16Zm0-32H64a8,8,0,0,1,0-16H192a8,8,0,0,1,0,16Z',
    expand: 'M208,40H160a8,8,0,0,0,0,16h28.69L141.34,103.34a8,8,0,0,0,11.32,11.32L200,67.31V96a8,8,0,0,0,16,0V48A8,8,0,0,0,208,40ZM103.34,141.34,56,188.69V160a8,8,0,0,0-16,0v48a8,8,0,0,0,8,8H96a8,8,0,0,0,0-16H67.31l47.35-47.34a8,8,0,0,0-11.32-11.32Z',
    collapse: 'M205.66,106.34a8,8,0,0,0,2.34-5.66V56a8,8,0,0,0-16,0V84.69L144.66,37.34a8,8,0,0,0-11.32,11.32L180.69,96H152a8,8,0,0,0,0,16h48A8,8,0,0,0,205.66,106.34ZM104,144H56a8,8,0,0,0,0,16H84.69L37.34,207.34a8,8,0,0,0,11.32,11.32L96,171.31V200a8,8,0,0,0,16,0V152A8,8,0,0,0,104,144Z',
    info: 'M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm16-40a8,8,0,0,1-8,8,16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40A8,8,0,0,1,144,176ZM112,84a12,12,0,1,1,12,12A12,12,0,0,1,112,84Z',
    textT: 'M208,56V88a8,8,0,0,1-16,0V64H136V192h20a8,8,0,0,1,0,16H100a8,8,0,0,1,0-16h20V64H64V88a8,8,0,0,1-16,0V56a8,8,0,0,1,8-8H200A8,8,0,0,1,208,56Z',
    eye: 'M247.31,124.76c-.35-.79-8.82-19.58-27.65-38.41C194.57,61.26,162.88,48,128,48S61.43,61.26,36.34,86.35C17.51,105.18,9,124,8.69,124.76a8,8,0,0,0,0,6.5c.35.79,8.82,19.57,27.65,38.4C61.43,194.74,93.12,208,128,208s66.57-13.26,91.66-38.34c18.83-18.83,27.3-37.61,27.65-38.4A8,8,0,0,0,247.31,124.76ZM128,192c-30.78,0-57.67-11.19-79.93-33.25A133.47,133.47,0,0,1,25,128,133.33,133.33,0,0,1,48.07,97.25C70.33,75.19,97.22,64,128,64s57.67,11.19,79.93,33.25A133.46,133.46,0,0,1,231.05,128C223.84,141.46,192.43,192,128,192Zm0-112a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Z',
    cursor: 'M216.42,106.15l-144-80a16,16,0,0,0-23.7,17.47l32,144a16,16,0,0,0,29.74,2.94L134.61,142l48.69,48.69a8,8,0,0,0,11.31-11.31L145.92,130.7l48.58-24.15A16,16,0,0,0,216.42,106.15Z',
    tray: 'M224,128v80a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V128a16,16,0,0,1,16-16H80a8,8,0,0,1,0,16H48v80H208V128H176a8,8,0,0,1,0-16h32A16,16,0,0,1,224,128Zm-90.34,2.34a8,8,0,0,0,11.32,0l32-32a8,8,0,0,0-11.32-11.32L136,112.69V40a8,8,0,0,0-16,0v72.69L90.34,87a8,8,0,0,0-11.32,11.32Z',
  };

  const layer = document.createElement('div');
  layer.className = 'layer';
  layer.innerHTML = `
    <div class="backdrop" hidden></div>
    <div class="panel">
      <div class="head">
        <div class="head-top">
          <button class="icon-btn return-btn" aria-label="Return to Drawer" title="Return to Drawer" hidden>${svg(ICON.caretLeft)}</button>
          <div class="plaque">${svg(ICON.sidebar)}</div>
          <div class="head-titles">
            <h1 class="head-title"><span class="title-text"></span></h1>
            <p class="head-sub" title="Tap to check for updates"><span></span></p>
          </div>
          <div class="head-actions">
            <div class="head-tools" hidden>
              <div class="seg" role="group" aria-label="Markdown engine">
                <button type="button" class="seg-btn on" data-md-engine="local">Local</button>
                <button type="button" class="seg-btn" data-md-engine="jina">Jina</button>
              </div>
              <button type="button" class="icon-btn md-view-toggle on" aria-label="Toggle preview" title="Preview mode (click for raw Markdown)">${svg(ICON.eye)}</button>
              <a class="icon-btn jina-ext" href="https://r.jina.ai/${page.href}" target="_blank" rel="noopener" aria-label="Open in Jina Reader" title="Open in Jina Reader" hidden>${svg(ICON.out)}</a>
            </div>
            <a class="icon-btn store-btn" aria-label="Store current view" title="Store to web-tools-private">${svg(ICON.tray)}</a>
            <button class="icon-btn copy-btn" aria-label="Copy current format" title="Copy">${svg(ICON.copy)}</button>
            <button class="icon-btn expand-btn" aria-label="Full Swipe Deck" title="Full Swipe Deck">${svg(ICON.cardsThree)}</button>
            <button class="icon-btn reread" aria-label="Recapture page content" title="Recapture">${svg(ICON.refresh)}</button>
            <div class="pill font-mono tabular-nums"><span class="cur-slide">1</span><span class="pill-sep">/</span><span class="total-slides">6</span></div>
          </div>
        </div>
        <div class="head-intro">
          <div class="head-intro-left">
            <button type="button" class="head-btn btn-recapture" title="Recapture live page content">${svg(ICON.refresh)}<span>Recapture</span></button>
            <button type="button" class="head-btn btn-merge" title="Toggle append/merge mode (accumulates captures as you scroll or recapture)"><span>+ Merge</span></button>
            <a class="head-btn btn-store" title="Store this view to web-tools-private">${svg(ICON.tray)}<span>Store</span></a>
            <button type="button" class="head-btn btn-clear-merge" title="Clear accumulated captures and reset" hidden><span>Clear</span></button>
          </div>
          <div class="head-intro-right">
            <button type="button" class="meta-toggle" aria-expanded="false" title="Page Details">${svg(ICON.info)}<span>Info</span><span class="meta-arr">▾</span></button>
          </div>
        </div>
        <div class="head-frame-banner" hidden>
          <div class="frame-bar-top">
            <span class="frame-tag">${svg(ICON.cardsThree)}<span>Frame Scope</span><span class="frame-name"></span></span>
            <button type="button" class="btn-return-main" title="Return to Main Document">Return to Main Page ↩</button>
          </div>
        </div>
        <span class="stale" hidden></span>
        <div class="page-meta" hidden>
          <p><span class="k">TITLE</span><span class="meta-title"></span></p>
          <p><span class="k">ADDRESS</span><span class="meta-href"></span></p>
          <p class="meta-desc-wrap" hidden><span class="k">DESCRIPTION</span><span class="meta-desc"></span></p>
          <p><span class="k">SELECTION</span><span class="meta-sel quote"></span></p>
          <p><span class="k">SCOPES &amp; FRAMES</span><span class="meta-scopes"></span></p>
          <p><span class="k">SHADOW DOM</span><span class="meta-shadow"></span></p>
          <div class="meta-pref-row">
            <span class="k">AUTO-CHECK UPDATES</span>
            <button type="button" class="meta-pref-btn on" data-toggle-autocheck>ON</button>
          </div>
        </div>
      </div>
      <div class="deck-nav">
        <div class="deck-bar">
          <button class="deck-tab on" data-slide="0" data-slide-id="md">Markdown</button>
          <button class="deck-tab" data-slide="1" data-slide-id="sel">Selection</button>
          <button class="deck-tab" data-slide="2" data-slide-id="text">Text</button>
          <button class="deck-tab" data-slide="3" data-slide-id="links">Links</button>
          <button class="deck-tab" data-slide="4" data-slide-id="html" data-take-html>HTML</button>
          <button class="deck-tab" data-slide="5" data-slide-id="json">JSON</button>
        </div>
      </div>
      <div class="deck-track" tabindex="0">
        <!-- Slide 0: Markdown -->
        <div class="deck-slide active" data-slide-i="0" data-slide-id="md">
          <div class="slide-tools">
            <div class="slide-tools-inner">
              <div class="seg" role="group" aria-label="Markdown engine">
                <button type="button" class="seg-btn on" data-md-engine="local">Local</button>
                <button type="button" class="seg-btn" data-md-engine="jina">Jina</button>
              </div>
              <button type="button" class="icon-btn md-view-toggle on" aria-label="Toggle preview" title="Preview mode (click for raw Markdown)">${svg(ICON.eye)}</button>
              <a class="icon-btn jina-ext" href="https://r.jina.ai/${page.href}" target="_blank" rel="noopener" aria-label="Open in Jina Reader" title="Open in Jina Reader" hidden>${svg(ICON.out)}</a>
              <span class="tool-meta md-status"></span>
            </div>
          </div>
          <div class="slide-body">
            <div class="slide-body-inner">
              <div class="md-preview-wrap md-prose"></div>
              <pre class="md-raw-wrap text" hidden></pre>
            </div>
          </div>
        </div>
        <!-- Slide 1: Selection -->
        <div class="deck-slide" data-slide-i="1" data-slide-id="sel">
          <div class="slide-tools">
            <div class="slide-tools-inner">
              <span class="tool-meta sel-count"></span>
              <button class="tool-btn copy-sel-quote" title="Copy selection as Markdown quote">Copy Quote</button>
            </div>
          </div>
          <div class="slide-body">
            <div class="slide-body-inner">
              <div class="sel-slide-content">
                <div class="sel-quote quote"></div>
                <div class="sel-links-section" hidden>
                  <h4 style="margin: .75rem 0 .25rem; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: var(--wt-p);">Links in Selection</h4>
                  <ul class="sel-links-list"></ul>
                </div>
              </div>
            </div>
          </div>
        </div>
        <!-- Slide 2: Text -->
        <div class="deck-slide" data-slide-i="2" data-slide-id="text">
          <div class="slide-tools">
            <div class="slide-tools-inner">
              <span class="tool-meta text-count"></span>
            </div>
          </div>
          <div class="slide-body">
            <div class="slide-body-inner">
              <div class="text slide-content text-content"></div>
            </div>
          </div>
        </div>
        <!-- Slide 3: Links -->
        <div class="deck-slide" data-slide-i="3" data-slide-id="links">
          <div class="slide-tools">
            <div class="slide-tools-inner">
              <button class="tool-btn" data-all>All</button>
              <button class="tool-btn" data-none>None</button>
              <span class="tool-meta links-count"></span>
            </div>
          </div>
          <div class="slide-body">
            <div class="slide-body-inner">
              <div data-list class="links-list"></div>
            </div>
          </div>
        </div>
        <!-- Slide 4: HTML -->
        <div class="deck-slide" data-slide-i="4" data-slide-id="html" data-take-html>
          <div class="slide-tools">
            <div class="slide-tools-inner">
              <span class="tool-meta html-meta"></span>
            </div>
          </div>
          <div class="slide-body">
            <div class="slide-body-inner">
              <pre class="html-formatted-wrap html-code-wrap" tabindex="0"></pre>
            </div>
          </div>
        </div>
        <!-- Slide 5: JSON -->
        <div class="deck-slide" data-slide-i="5" data-slide-id="json">
          <div class="slide-body">
            <div class="slide-body-inner">
              <div class="text slide-content json-content"></div>
            </div>
          </div>
        </div>
      </div>
      <div class="foot">
        <div class="foot-inner">
          <button class="act" data-copy hidden>Copy</button>
          <a class="act" data-send hidden>Stage</a>
          <a class="act" data-store hidden>Store</a>
          <div class="pager" aria-label="Deck pagination">
            <button class="dot on" data-go="0" data-slide-id="md" aria-label="Slide 1: Markdown"></button>
            <button class="dot" data-go="1" data-slide-id="sel" aria-label="Slide 2: Selection"></button>
            <button class="dot" data-go="2" data-slide-id="text" aria-label="Slide 3: Text"></button>
            <button class="dot" data-go="3" data-slide-id="links" aria-label="Slide 4: Links"></button>
            <button class="dot" data-go="4" data-slide-id="html" aria-label="Slide 5: HTML"></button>
            <button class="dot" data-go="5" data-slide-id="json" aria-label="Slide 6: JSON"></button>
          </div>
          <span class="size" hidden></span>
        </div>
      </div>
    </div>`;

  const wrap = document.createElement('div');
  wrap.className = 'wrap';
  wrap.innerHTML = `
    <div class="menu" hidden>
      <a class="row" data-capture>${svg(ICON.note)}<span>Capture selection</span></a>
      <a class="row" href="${app}">${svg(ICON.out)}<span>Web Tools</span></a>
      <button class="row update-row" data-menu-update>${svg(ICON.refresh)}<span>Check for updates</span></button>
      <button class="row" data-toggle-autocheck>${svg(ICON.refresh)}<span>Auto-check updates</span><span class="pill-toggle on">ON</span></button>
      <button class="row" data-hide>${svg(ICON.hide)}<span>Hide until reload</span></button>
      <div class="menu-foot font-mono">${BUILD}</div>
    </div>
    <div class="btn" tabindex="0" role="button" aria-label="Web Tools launcher">${svg(ICON.sidebar)}</div>`;

  const vp = document.createElement('div');
  vp.className = 'vp';
  vp.append(layer, wrap);
  root.append(vp);

  // Re-measured whenever the visible area changes: a rotation, a keyboard, a
  // pinch, or the URL bar sliding away. Without the listeners the root is
  // correct once and wrong after the first gesture.
  const fit = () => {
    const v = window.visualViewport;
    if (!v) return;
    vp.style.width = v.width + 'px';
    vp.style.height = v.height + 'px';
    vp.style.transform = `translate(${v.offsetLeft}px, ${v.offsetTop}px)`;
  };
  fit();
  window.visualViewport?.addEventListener('resize', fit);
  window.visualViewport?.addEventListener('scroll', fit);

  // ---- Behaviour ---------------------------------------------------------

  const q = s => root.querySelector(s);
  const qa = s => root.querySelectorAll(s);
  const btn = q('.btn'), menu = q('.menu'), panel = q('.panel');
  const list = q('[data-list]'), sendEl = q('[data-send]'), copyEl = q('[data-copy]');
  const storeEl = q('[data-store]'), storeBtn = q('.store-btn'), btnStore = q('.btn-store');

  const esc = s => String(s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const shortcutUrl = input => {
    let payload;
    if (typeof input === 'object' && input !== null) {
      payload = input;
    } else {
      payload = {
        op: 'capture', name: 'launcher', build: BUILD,
        title: page.title, href: page.href, md: input,
      };
    }
    return 'shortcuts://run-shortcut?name=Log-Repo&input=text&text=' +
      encodeURIComponent(JSON.stringify(payload));
  };

  const buildCapturePayload = (i = state.slide) => {
    const slide = getSlides()[i] || getSlides()[0];
    const text = getSlideText(i);
    const slug = pageSlug();
    const activeFrame = (state.activeFrameIndex >= 0 && state.frames && state.frames[state.activeFrameIndex])
      ? state.frames[state.activeFrameIndex] : null;

    return {
      op: 'capture',
      channel: 'captures',
      name: 'launcher',
      build: BUILD,
      captured_at: new Date().toISOString(),
      url: getActiveDocHref(),
      title: getActiveDocTitle(),
      view: slide.id,
      representation: slide.label,
      content: text,
      source: {
        client: 'userscript',
        build: BUILD,
        scope: activeFrame ? (activeFrame.title || `frame-${activeFrame.index}`) : 'main',
        frame_url: activeFrame ? activeFrame.href : undefined
      },
      meta: {
        length: text.length,
        lines: slide.id === 'html' ? state.htmlLines : undefined,
        description: page.description || undefined,
        slug: `${slug}-${slide.id}`
      }
    };
  };

  const pageSlug = () => (location.hostname + location.pathname)
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'capture';

  const b64url = bytes => {
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };

  const packToStage = async (name, text, dest = '') => {
    try {
      const json = JSON.stringify([{ name, text }]);
      const gz = new Blob([new TextEncoder().encode(json)]).stream()
        .pipeThrough(new CompressionStream('gzip'));
      const payload = b64url(new Uint8Array(await new Response(gz).arrayBuffer()));
      if (!payload || payload.length > GZ_MAX) return null;
      return `${STAGE}#gz=${payload}${dest ? '&dest=' + encodeURIComponent(dest) : ''}`;
    } catch {
      return null;
    }
  };

  const copyText = async (text, el, done = 'Copied') => {
    const prev = el.textContent;
    try {
      await navigator.clipboard.writeText(text);
      el.textContent = done;
    } catch { el.textContent = 'Blocked'; }
    setTimeout(() => { el.textContent = prev; }, 1600);
  };

  const fetchText = async (url, headers = { Accept: 'application/vnd.github.raw' }) => {
    const xhr = (typeof GM !== 'undefined' && GM.xmlHttpRequest) ? GM.xmlHttpRequest.bind(GM)
      : (typeof GM_xmlhttpRequest !== 'undefined' ? GM_xmlhttpRequest : null);
    if (xhr) {
      return new Promise((resolve, reject) => {
        xhr({
          method: 'GET', url, headers,
          onload: r => (r.status >= 200 && r.status < 300) ? resolve(r.responseText) : reject(new Error('HTTP ' + r.status)),
          onerror: reject,
        });
      });
    }
    const res = await fetch(url, { headers, cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.text();
  };

  const getSlideText = (i = state.slide) => {
    const slide = getSlides()[i] || getSlides()[0];
    switch (slide.id) {
      case 'md':
        return state.mdEngine === 'jina' ? (state.jinaMd || '') : (state.localMd || domToMarkdown());
      case 'sel': {
        if (!state.sel) return '> (No text selected)';
        let out = `# ${getActiveDocTitle()}\n\n${getActiveDocHref()}\n\n> ` + state.sel.replace(/\n+/g, '\n> ');
        if (state.selHtml) {
          const div = document.createElement('div');
          div.innerHTML = state.selHtml;
          const links = Array.from(div.querySelectorAll('a[href]')).map(a => ({
            href: a.href,
            text: clean(a.innerText) || a.href,
          })).filter(l => /^https?:/.test(l.href));
          if (links.length) {
            out += '\n\n### Links in Selection\n' + links.map(l => `- [${l.text}](${l.href})`).join('\n');
          }
        }
        return out;
      }
      case 'text':
        return state.blocks.length ? state.blocks.join('\n\n') : (state.text || '');
      case 'links': {
        const target = state.picked.size
          ? state.links.filter(l => state.picked.has(l.href))
          : state.links;
        return target.map(l => `- [${l.text || l.href}](${l.href})`).join('\n');
      }
      case 'html': {
        const targetDoc = getActiveDoc();
        const root = targetDoc.documentElement;
        if (typeof root.getHTML === 'function') {
          try {
            const shadowRoots = Array.from(targetDoc.querySelectorAll('*'))
              .map(el => el.shadowRoot)
              .filter(Boolean);
            const html = root.getHTML({ serializableShadowRoots: true, shadowRoots });
            const cleanHtml = html.replace(/<div id="wt-launcher"[\s\S]*?<\/div>/, '');
            return '<!DOCTYPE html>\n' + cleanHtml;
          } catch {}
        }
        const clone = root.cloneNode(true);
        clone.querySelector('#' + ID)?.remove();
        return '<!DOCTYPE html>\n' + clone.outerHTML;
      }
      case 'json':
        return JSON.stringify({
          scope: state.activeFrameIndex >= 0 ? 'frame' : 'page',
          title: getActiveDocTitle(),
          href: getActiveDocHref(),
          description: page.description,
          selection: state.sel,
          frames: (state.frames || []).map(f => ({
            index: f.index,
            title: f.title,
            href: f.href,
            accessible: f.accessible,
            sealed: !f.accessible,
            textLength: f.textLen,
            reason: f.error || undefined,
          })),
          shadowRoots: (state.shadowRoots || []).map(r => ({ host: r.tag, mode: r.mode })),
          links: state.links,
          text: state.blocks.length ? state.blocks.join('\n\n') : state.text,
          markdown: state.localMd || domToMarkdown(),
        }, null, 2);
      default:
        return '';
    }
  };

  const updateHeader = () => {
    const headTitle = q('.head-title .title-text');
    const headSub = q('.head-sub span');
    const plaque = q('.plaque');
    const curEl = q('.cur-slide');
    const totalEl = q('.total-slides');
    const headTools = q('.head-tools');

    if (state.fullscreen) {
      const slides = getSlides();
      const slide = slides[state.slide] || slides[0];
      if (headTitle) headTitle.textContent = slide.label;
      if (headSub) headSub.textContent = (state.activeFrameIndex >= 0 && state.frames[state.activeFrameIndex]) ? `[Frame: ${state.frames[state.activeFrameIndex].title}]` : page.title;
      if (plaque) plaque.innerHTML = svg(ICON[slide.icon]);
      if (curEl) curEl.textContent = String(state.slide + 1);
      if (totalEl) totalEl.textContent = String(slides.length);
      if (headTools) headTools.hidden = slide.id !== 'md';
    } else {
      if (headTitle) headTitle.textContent = page.title;
      const fLabel = state.activeFrameIndex >= 0 && state.frames[state.activeFrameIndex] ? ` · [${state.frames[state.activeFrameIndex].title}]` : '';
      if (headSub) headSub.textContent = `${location.hostname}${fLabel} · ${BUILD} · built ${age(BUILT)}`;
      if (plaque) plaque.innerHTML = svg(ICON.sidebar);
      if (headTools) headTools.hidden = true;
    }
  };

  const renderPageMeta = () => {
    updateHeader();

    const descEl = q('.head-desc');
    if (descEl) {
      if (page.description) {
        descEl.textContent = page.description;
        descEl.hidden = false;
      } else {
        descEl.hidden = true;
      }
    }

    const frameBanner = q('.head-frame-banner');
    const frameName = q('.frame-name');
    if (frameBanner) {
      if (state.activeFrameIndex >= 0 && state.frames[state.activeFrameIndex]) {
        if (frameName) frameName.textContent = `· ${state.frames[state.activeFrameIndex].title}`;
        frameBanner.hidden = false;
      } else {
        frameBanner.hidden = true;
      }
    }

    const titleEl = q('.meta-title');
    const hrefEl = q('.meta-href');
    const descWrap = q('.meta-desc-wrap');
    const descElMeta = q('.meta-desc');
    const selEl = q('.meta-sel');

    if (titleEl) titleEl.textContent = getActiveDocTitle();
    if (hrefEl) hrefEl.textContent = getActiveDocHref();
    if (descWrap && descElMeta) {
      if (page.description) {
        descElMeta.textContent = page.description;
        descWrap.hidden = false;
      } else {
        descWrap.hidden = true;
      }
    }
    if (selEl) {
      if (state.sel) {
        selEl.textContent = state.sel.slice(0, 600);
        selEl.className = 'meta-sel quote';
      } else {
        selEl.textContent = 'Nothing selected. Select text on the page, then reopen.';
        selEl.className = 'meta-sel none';
      }
    }

    const scopesEl = q('.meta-scopes');
    if (scopesEl) {
      const frames = state.frames || [];
      const roots = state.shadowRoots || [];
      const readable = frames.filter(f => f.accessible);
      const sealed = frames.filter(f => !f.accessible);

      let summary = '1 main document';
      if (frames.length > 0) {
        summary += ` · ${frames.length} frame${frames.length > 1 ? 's' : ''} (${readable.length} readable, ${sealed.length} sealed)`;
      } else {
        summary += ' · 0 frames';
      }
      if (roots.length > 0) {
        summary += ` · ${roots.length} shadow root${roots.length > 1 ? 's' : ''}`;
      }

      let itemsHtml = `<div class="meta-scope-summary">${esc(summary)}</div><div class="meta-scope-list">`;
      const isMain = state.activeFrameIndex === -1;
      itemsHtml += `
        <div class="meta-scope-item${isMain ? ' active' : ''}">
          <div class="meta-scope-header">
            <span class="meta-scope-name">${svg(ICON.sidebar)} Top Window (Main)</span>
            <span class="meta-scope-badge main">MAIN</span>
          </div>
          <div class="meta-scope-url">${esc(location.href)}</div>
          <div class="meta-scope-stats">
            <span>${clean(document.body?.innerText || '').length.toLocaleString()} chars</span>
            ${!isMain ? `<button type="button" class="meta-scope-act" data-pick-frame="-1">Switch to Main</button>` : `<span class="meta-scope-active-label">Active Scope ✓</span>`}
          </div>
        </div>`;

      frames.forEach(f => {
        const isAct = state.activeFrameIndex === f.index;
        itemsHtml += `
          <div class="meta-scope-item${isAct ? ' active' : ''}">
            <div class="meta-scope-header">
              <span class="meta-scope-name">${svg(ICON.cardsThree)} ${esc(f.title)}</span>
              <span class="meta-scope-badge ${f.accessible ? 'readable' : 'sealed'}">${f.accessible ? 'READABLE' : '🔒 SEALED'}</span>
            </div>
            <div class="meta-scope-url">${esc(f.href)}</div>
            <div class="meta-scope-stats">
              ${f.accessible
                ? `<span>${f.textLen.toLocaleString()} chars · ${f.linksCount} links</span>`
                : `<span>Cross-origin · Blocked by Same-Origin Policy</span>`}
              ${f.accessible
                ? (isAct
                    ? `<span class="meta-scope-active-label">Active Scope ✓</span>`
                    : `<button type="button" class="meta-scope-act" data-pick-frame="${f.index}">Switch to Frame</button>`)
                : ''}
            </div>
          </div>`;
      });
      itemsHtml += `</div>`;
      scopesEl.innerHTML = itemsHtml;
    }

    const shadowEl = q('.meta-shadow');
    if (shadowEl) {
      const roots = state.shadowRoots || [];
      if (roots.length > 0) {
        const hostNames = [...new Set(roots.map(r => `<${r.tag}>`))].slice(0, 5).join(', ');
        const more = roots.length > 5 ? ` +${roots.length - 5} more` : '';
        shadowEl.textContent = `${roots.length} shadow root${roots.length > 1 ? 's' : ''} found (${hostNames}${more})`;
        shadowEl.className = 'meta-shadow';
      } else {
        shadowEl.textContent = 'None found on this page';
        shadowEl.className = 'meta-shadow none';
      }
    }
  };

  const toggleMeta = on => {
    state.metaOpen = typeof on === 'boolean' ? on : !state.metaOpen;
    const metaEl = q('.page-meta');
    const toggleBtn = q('.meta-toggle');
    if (metaEl) metaEl.hidden = !state.metaOpen;
    if (toggleBtn) {
      toggleBtn.classList.toggle('on', state.metaOpen);
      toggleBtn.setAttribute('aria-expanded', String(state.metaOpen));
      const arr = toggleBtn.querySelector('.meta-arr');
      if (arr) arr.textContent = state.metaOpen ? '▴' : '▾';
    }
  };

  const toggleFullscreen = on => {
    state.fullscreen = typeof on === 'boolean' ? on : !state.fullscreen;
    panel.classList.toggle('fullscreen', state.fullscreen);
    const expandBtn = q('.expand-btn');
    const returnBtn = q('.return-btn');
    if (expandBtn) expandBtn.hidden = state.fullscreen;
    if (returnBtn) returnBtn.hidden = !state.fullscreen;
    updateHeader();
    requestAnimationFrame(() => {
      const track = q('.deck-track');
      if (track) {
        const w = track.clientWidth || window.innerWidth;
        track.scrollTo({ left: state.slide * w, behavior: 'auto' });
      }
    });
    syncSlideUI(state.slide);
    refresh();
  };

  const loadJina = async () => {
    const statusEl = q('.md-status');
    const rawEl = q('.md-raw-wrap');
    const prevEl = q('.md-preview-wrap');
    if (state.jinaMd) {
      if (rawEl) rawEl.textContent = state.jinaMd;
      if (prevEl) prevEl.innerHTML = renderMarkdownToHtml(state.jinaMd);
      if (statusEl) statusEl.textContent = `${state.jinaMd.length.toLocaleString()} chars`;
      refresh();
      return;
    }
    if (statusEl) statusEl.textContent = 'Reading…';
    if (prevEl) prevEl.innerHTML = '<p class="none">Reading from Jina AI Reader (r.jina.ai)…</p>';
    if (rawEl) rawEl.textContent = 'Reading from Jina AI Reader (r.jina.ai)…';
    try {
      const res = await fetchText('https://r.jina.ai/' + page.href, { Accept: 'text/markdown, text/plain, */*' });
      state.jinaMd = res;
      if (rawEl) rawEl.textContent = res;
      if (prevEl) prevEl.innerHTML = renderMarkdownToHtml(res);
      if (statusEl) statusEl.textContent = `${res.length.toLocaleString()} chars`;
    } catch {
      const msg = 'Direct fetch blocked by page CSP. Tap the external link icon above to read in Jina Reader.';
      if (rawEl) rawEl.textContent = msg;
      if (prevEl) prevEl.innerHTML = `<p class="none">${msg}</p>`;
      if (statusEl) statusEl.textContent = 'Blocked by CSP';
    }
    refresh();
  };

  const renderActiveSlide = (i = state.slide) => {
    const slide = getSlides()[i] || getSlides()[0];
    switch (slide.id) {
      case 'md': {
        const rawEl = q('.md-raw-wrap');
        const prevEl = q('.md-preview-wrap');
        const statusEl = q('.md-status');

        root.querySelectorAll('.jina-ext').forEach(el => {
          el.hidden = state.mdEngine !== 'jina';
        });

        if (state.mdEngine === 'jina') {
          if (state.jinaMd) {
            if (rawEl) rawEl.textContent = state.jinaMd;
            if (prevEl) prevEl.innerHTML = renderMarkdownToHtml(state.jinaMd);
            if (statusEl) statusEl.textContent = `${state.jinaMd.length.toLocaleString()} chars`;
          } else {
            loadJina();
          }
        } else {
          state.localMd = domToMarkdown();
          if (rawEl) rawEl.textContent = state.localMd;
          if (prevEl) prevEl.innerHTML = renderMarkdownToHtml(state.localMd);
          if (statusEl) statusEl.textContent = `${state.localMd.length.toLocaleString()} chars`;
        }
        if (rawEl) rawEl.hidden = state.mdView !== 'raw';
        if (prevEl) prevEl.hidden = state.mdView !== 'preview';
        root.querySelectorAll('.md-view-toggle').forEach(btn => {
          const isPreview = state.mdView === 'preview';
          btn.classList.toggle('on', isPreview);
          btn.setAttribute('aria-pressed', String(isPreview));
          btn.title = isPreview ? 'Preview mode (click for raw Markdown)' : 'Raw mode (click for preview)';
        });
        root.querySelectorAll('[data-md-engine]').forEach(el => {
          el.classList.toggle('on', el.dataset.mdEngine === state.mdEngine);
        });
        break;
      }
      case 'sel': {
        const quoteEl = q('.sel-quote');
        const countEl = q('.sel-count');
        const linksSec = q('.sel-links-section');
        const linksList = q('.sel-links-list');

        if (state.sel) {
          if (quoteEl) {
            quoteEl.textContent = state.sel;
            quoteEl.classList.remove('none');
          }
          const words = state.sel.trim().split(/\s+/).filter(Boolean).length;
          if (countEl) countEl.textContent = `${state.sel.length.toLocaleString()} chars · ${words.toLocaleString()} words`;

          let links = [];
          if (state.selHtml) {
            const div = document.createElement('div');
            div.innerHTML = state.selHtml;
            links = Array.from(div.querySelectorAll('a[href]')).map(a => ({
              href: a.href,
              text: clean(a.innerText) || a.href,
            })).filter(l => /^https?:/.test(l.href));
          }

          if (linksSec && linksList) {
            if (links.length) {
              linksList.innerHTML = links.map(l => `<li><a href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.text)}</a></li>`).join('');
              linksSec.hidden = false;
            } else {
              linksList.innerHTML = '';
              linksSec.hidden = true;
            }
          }
        } else {
          if (quoteEl) {
            quoteEl.textContent = 'No text currently selected on this page. Highlight text on the page and it will appear here.';
            quoteEl.classList.add('none');
          }
          if (countEl) countEl.textContent = '0 chars';
          if (linksSec) linksSec.hidden = true;
        }
        break;
      }
      case 'text': {
        const textContent = q('.text-content');
        if (textContent) {
          const full = state.blocks.length
            ? state.blocks.join('\n\n')
            : (state.appendMode ? 'Nothing collected yet. Scroll the page.' : (state.text || 'No readable text found.'));
          if (state.sel && full.includes(state.sel)) {
            const parts = full.split(state.sel);
            textContent.innerHTML = parts.map(esc).join(`<mark class="sel-highlight">${esc(state.sel)}</mark>`);
          } else {
            textContent.textContent = full;
          }
        }
        break;
      }
      case 'links':
        renderLinks();
        break;
      case 'html': {
        const metaEl = q('.html-meta');
        const formattedWrap = q('.html-formatted-wrap');
        if (!state.formattedHtml) {
          const res = formatAndHighlightDom();
          state.formattedHtml = res.html;
          state.htmlLines = res.lines;
        }
        if (formattedWrap) {
          formattedWrap.innerHTML = state.formattedHtml;
          formattedWrap.hidden = false;
        }
        const sCount = (state.shadowRoots && state.shadowRoots.length) || 0;
        const fCount = (state.frames && state.frames.length) || 0;
        const sInfo = sCount ? ` · ${sCount} shadow root${sCount > 1 ? 's' : ''}` : '';
        const fInfo = fCount ? ` · ${fCount} frame${fCount > 1 ? 's' : ''}` : '';
        const scopeLabel = state.activeFrameIndex >= 0 && state.frames[state.activeFrameIndex]
          ? ` (${state.frames[state.activeFrameIndex].title})` : '';
        if (metaEl) metaEl.textContent = `${state.htmlLines} lines${scopeLabel}${sInfo}${fInfo}`;
        break;
      }
      case 'json':
        q('.json-content').textContent = getSlideText(i);
        break;
    }
    refresh();
  };

  const syncSlideTabsAndDots = i => {
    const slides = getSlides();
    if (i < 0 || i >= slides.length) return;
    state.slide = i;
    updateHeader();

    const visibleTabs = Array.from(root.querySelectorAll('.deck-tab:not([hidden])'));
    visibleTabs.forEach((t, idx) => {
      t.classList.toggle('on', idx === i);
      if (idx === i && !state.fullscreen) {
        const bar = q('.deck-bar');
        if (bar) {
          const tabLeft = t.offsetLeft;
          const tabWidth = t.offsetWidth;
          const barScroll = bar.scrollLeft;
          const barWidth = bar.clientWidth;
          if (tabLeft < barScroll) {
            bar.scrollTo({ left: Math.max(0, tabLeft - 8), behavior: 'smooth' });
          } else if (tabLeft + tabWidth > barScroll + barWidth) {
            bar.scrollTo({ left: tabLeft + tabWidth - barWidth + 8, behavior: 'smooth' });
          }
        }
      }
    });
    const visibleSlides = Array.from(root.querySelectorAll('.deck-slide:not([hidden])'));
    visibleSlides.forEach((s, idx) => {
      s.classList.toggle('active', idx === i);
    });
    const visibleDots = Array.from(root.querySelectorAll('.pager .dot:not([hidden])'));
    visibleDots.forEach((d, idx) => {
      d.classList.toggle('on', idx === i);
    });
  };

  const syncSlideUI = i => {
    syncSlideTabsAndDots(i);
    renderActiveSlide(i);
  };

  const goToSlide = (i, smooth = true) => {
    const slides = getSlides();
    if (i < 0 || i >= slides.length) return;
    const track = q('.deck-track');
    if (track) {
      const w = track.clientWidth || window.innerWidth;
      track.scrollTo({ left: i * w, behavior: smooth ? 'smooth' : 'auto' });
    }
    syncSlideUI(i);
  };

  // The readout is the whole of the size story: what this capture weighs, and
  // whether Stage can carry it. Saying "too big for Stage, use Copy" is the point
  // of measuring at all, since the alternative is a URL that arrives truncated
  // and reads as complete.
  const refresh = () => {
    const slide = getSlides()[state.slide] || getSlides()[0];
    const text = getSlideText(state.slide);
    const slug = pageSlug();
    const filename = `${slug}-${slide.id}.${slide.ext}`;

    packToStage(filename, text).then(url => {
      if (url) {
        sendEl.href = url;
        sendEl.textContent = 'Stage';
        sendEl.classList.remove('off');
        q('.size').textContent = (text.length > 10000)
          ? `${Math.round(text.length / 1024)} KB`
          : `${text.length} chars`;
      } else {
        sendEl.removeAttribute('href');
        sendEl.textContent = 'Stage';
        sendEl.classList.add('off');
        q('.size').textContent = (text.length > 10000)
          ? `${Math.round(text.length / 1024)} KB · Copy only`
          : `${text.length} chars · Copy only`;
      }
    });

    const capturePayload = buildCapturePayload(state.slide);
    const directStoreUrl = shortcutUrl(capturePayload);
    const directOk = directStoreUrl.length <= SEND_MAX;
    const captureFile = `${slug}-${slide.id}.json`;

    packToStage(captureFile, JSON.stringify(capturePayload, null, 2), 'mehrlander/web-tools-private:captures').then(stageUrl => {
      const storeTarget = directOk ? directStoreUrl : (stageUrl || '#');
      const storeTitle = directOk
        ? `Store ${slide.label} to web-tools-private (Log-Repo shortcut)`
        : `Stage ${slide.label} to web-tools-private:captures`;
      const storeLabel = directOk ? 'Store' : 'Stage';

      [storeBtn, btnStore, storeEl].filter(Boolean).forEach(el => {
        el.href = storeTarget;
        el.title = storeTitle;
        if (el === storeEl) el.textContent = storeLabel;
      });
    });

    const linksCount = q('.links-count');
    if (linksCount) linksCount.textContent = `${state.picked.size}/${state.links.length} picked`;
    const textCount = q('.text-count');
    if (textCount) {
      textCount.textContent = state.blocks.length
        ? `${state.blocks.length} blocks · ${state.blockChars} chars`
        : `${state.text.length} chars`;
    }
  };

  const renderLinks = () => {
    list.innerHTML = state.links.map(({ href, text }, i) => `
      <button class="link${state.picked.has(href) ? ' on' : ''}" data-i="${i}">
        <span class="box">${svg(ICON.check)}</span>
        <span><i>${esc(text)}</i><u>${esc(href.replace(/^https?:\/\//, ''))}</u></span>
      </button>`).join('') ||
      '<p class="none">No links on this page.</p>';
  };


  // One read of the page, run on the first open and by the header's refresh.
  // Ticked links survive it: state.picked holds addresses, so a link still on
  // the page comes back ticked and one that has gone simply stops being listed.
  const renderAllSlides = () => {
    renderActiveSlide(state.slide);
  };

  const readPage = () => {
    state.localMd = null;
    state.jinaMd = null;
    state.formattedHtml = null;
    state.shadowRoots = findShadowRoots();
    state.frames = findFrames();
    readLinks();
    if (state.appendMode) {
      collectBlocks();
    } else if (!state.blocks.length) {
      state.text = readText();
    }
    renderPageMeta();
    renderAllSlides();
    refresh();
  };

  const getActiveSelection = () => {
    const s = window.getSelection?.();
    if (s && s.toString().trim()) return s;
    const active = document.activeElement;
    if (active?.shadowRoot?.getSelection) {
      const shadowSel = active.shadowRoot.getSelection();
      if (shadowSel && shadowSel.toString().trim()) return shadowSel;
    }
    if (state.activeFrameIndex >= 0 && state.frames && state.frames[state.activeFrameIndex]?.doc) {
      try {
        const frameWin = state.frames[state.activeFrameIndex].el?.contentWindow;
        const frameSel = frameWin?.getSelection?.();
        if (frameSel && frameSel.toString().trim()) return frameSel;
      } catch {}
    }
    return s || null;
  };

  const highlightOnPage = on => {
    if (typeof Highlight === 'undefined' || !CSS?.highlights) return;
    if (!on) {
      CSS.highlights.delete('wt-selection');
      return;
    }
    const s = getActiveSelection();
    if (s && s.rangeCount > 0 && !s.isCollapsed) {
      try {
        let style = document.getElementById('wt-highlight-style');
        if (!style) {
          style = document.createElement('style');
          style.id = 'wt-highlight-style';
          style.textContent = `::highlight(wt-selection) { background-color: rgba(59, 130, 246, 0.35); color: inherit; }`;
          document.head?.appendChild(style);
        }
        const range = s.getRangeAt(0).cloneRange();
        CSS.highlights.set('wt-selection', new Highlight(range));
      } catch {}
    }
  };

  // Built on the first open rather than at mount, for the reason the fab builds
  // its own body late: the launcher is on every page, the drawer on few.
  let read = false;
  let lastOpenedWithSel = false;
  const syncSelectionVisibility = () => {
    const hasSel = !!(state.sel && state.sel.trim());
    root.querySelectorAll('[data-slide-id="sel"]').forEach(el => {
      el.hidden = !hasSel;
      if (!hasSel) el.classList.remove('on', 'active');
    });
  };

  const openDrawer = () => {
    const selObj = getActiveSelection();
    state.sel = clean(String(selObj || ''));
    state.selHtml = '';
    if (selObj && selObj.rangeCount > 0 && !selObj.isCollapsed) {
      try {
        const range = selObj.getRangeAt(0);
        const div = document.createElement('div');
        div.appendChild(range.cloneContents());
        state.selHtml = div.innerHTML;
      } catch {}
    }
    highlightOnPage(true);
    if (!read) { readPage(); read = true; }
    if (state.autoCheck) checkBuild();

    const hasSel = !!(state.sel && state.sel.trim());
    syncSelectionVisibility();
    const slides = getSlides();
    if (hasSel) {
      state.slide = 1;
      lastOpenedWithSel = true;
    } else if (lastOpenedWithSel) {
      state.slide = 0;
      lastOpenedWithSel = false;
    } else {
      if (state.slide >= slides.length) {
        state.slide = 0;
      }
    }

    renderPageMeta();
    syncSlideUI(state.slide);
    panel.classList.add('open');
    layer.classList.add('open');
    btn.classList.add('on');
    const bd = q('.backdrop');
    if (bd) bd.hidden = false;
    requestAnimationFrame(() => {
      const track = q('.deck-track');
      if (track) {
        const w = track.clientWidth || window.innerWidth;
        track.scrollTo({ left: state.slide * w, behavior: 'auto' });
      }
    });
  };

  const closeDrawer = () => {
    highlightOnPage(false);
    panel.classList.remove('open');
    panel.classList.remove('fullscreen');
    layer.classList.remove('open');
    state.fullscreen = false;
    const expandBtn = q('.expand-btn');
    const returnBtn = q('.return-btn');
    if (expandBtn) expandBtn.hidden = false;
    if (returnBtn) returnBtn.hidden = true;
    updateHeader();
    btn.classList.remove('on');
    const bd = q('.backdrop');
    if (bd) bd.hidden = true;
  };

  const doRecapture = (isManual = true) => {
    const recapBtn = q('.btn-recapture');
    const rereadBtn = q('.reread');
    recapBtn?.querySelector('svg')?.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(360deg)' }], 400);
    rereadBtn?.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(360deg)' }], 400);

    if (!state.appendMode) {
      state.blocks = [];
      state.blockChars = 0;
      state.seen.clear();
      state.seenLinks.clear();
      state.links = [];
      state.localMd = null;
      state.jinaMd = null;
      state.formattedHtml = null;
      readPage();
      if (recapBtn && isManual) {
        const orig = recapBtn.innerHTML;
        recapBtn.innerHTML = `<span>Recaptured ✓</span>`;
        setTimeout(() => { if (recapBtn) recapBtn.innerHTML = orig; }, 1800);
      }
    } else {
      const added = collectBlocks();
      readLinks();
      state.localMd = null;
      state.formattedHtml = null;
      renderAllSlides();
      refresh();
      if (recapBtn && isManual) {
        const orig = recapBtn.innerHTML;
        recapBtn.innerHTML = `<span>+${added || 0} blocks ✓</span>`;
        setTimeout(() => { if (recapBtn) recapBtn.innerHTML = orig; }, 1800);
      }
    }
    updateMergeUI();
  };

  q('.reread').onclick = () => {
    doRecapture(true);
  };

  q('.head-sub')?.addEventListener('click', async () => {
    const headSubSpan = q('.head-sub span');
    if (headSubSpan && headSubSpan.textContent.includes('reload')) {
      location.reload();
      return;
    }
    const origSub = headSubSpan ? headSubSpan.textContent : '';
    if (headSubSpan) headSubSpan.textContent = 'Checking for updates…';
    await checkBuild(true);
    if (headSubSpan && origSub) {
      setTimeout(() => {
        if (headSubSpan.textContent.includes('Checking') || headSubSpan.textContent.includes('current')) {
          headSubSpan.textContent = `${location.hostname} · ${BUILD} · built ${age(BUILT)}`;
        }
      }, 3500);
    }
  });

  // COLLECTING / MERGING: captures new blocks across mutations and scrolling.
  let dirty = false, timer = 0, watcher = null, scrollTimer = 0;
  const onScrollPoll = () => {
    if (!state.appendMode) return;
    if (scrollTimer) return;
    scrollTimer = setTimeout(() => {
      scrollTimer = 0;
      const added = collectBlocks();
      if (added > 0) {
        readLinks();
        renderAllSlides();
        refresh();
        updateMergeUI();
      }
    }, 1200);
  };

  const startCollecting = () => {
    collectBlocks();
    readLinks();
    if (!watcher) {
      watcher = new MutationObserver(() => {
        if (dirty) return;
        dirty = true;
        timer = setTimeout(() => {
          dirty = false;
          const added = collectBlocks();
          if (added > 0) {
            readLinks();
            renderAllSlides();
            refresh();
            updateMergeUI();
          }
        }, 800);
      });
      watcher.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
    window.addEventListener('scroll', onScrollPoll, { passive: true });
    updateMergeUI();
  };

  const stopCollecting = () => {
    watcher?.disconnect();
    watcher = null;
    window.removeEventListener('scroll', onScrollPoll);
    clearTimeout(timer);
    clearTimeout(scrollTimer);
    dirty = false;
    scrollTimer = 0;
    updateMergeUI();
  };

  const setMenu = on => {
    if (on) {
      q('[data-capture]').href = shortcutUrl(
        `# ${page.title}\n\n${page.href}` +
        (clean(String(getSelection() || '')) ? '\n\n> ' + clean(String(getSelection())) : ''));
    }
    menu.hidden = !on;
  };

  list.addEventListener('click', e => {
    const el = e.target.closest('.link');
    if (!el) return;
    const { href } = state.links[+el.dataset.i];
    state.picked.has(href) ? state.picked.delete(href) : state.picked.add(href);
    el.classList.toggle('on', state.picked.has(href));
    state.localMd = null;
    refresh();
    if (state.slide === 0) renderActiveSlide(0);
  });
  q('[data-all]').onclick = () => {
    state.links.forEach(l => state.picked.add(l.href));
    renderLinks();
    state.localMd = null;
    refresh();
    if (state.slide === 0) renderActiveSlide(0);
  };
  q('[data-none]').onclick = () => {
    state.picked.clear();
    renderLinks();
    state.localMd = null;
    refresh();
    if (state.slide === 0) renderActiveSlide(0);
  };

  root.querySelectorAll('[data-md-engine]').forEach(b => {
    b.onclick = () => {
      state.mdEngine = b.dataset.mdEngine;
      root.querySelectorAll('[data-md-engine]').forEach(el => {
        el.classList.toggle('on', el.dataset.mdEngine === state.mdEngine);
      });
      renderActiveSlide(0);
    };
  });

  root.querySelectorAll('.md-view-toggle').forEach(b => {
    b.onclick = () => {
      state.mdView = state.mdView === 'preview' ? 'raw' : 'preview';
      renderActiveSlide(0);
    };
  });

  q('.copy-sel-quote')?.addEventListener('click', async () => {
    const btn = q('.copy-sel-quote');
    if (!state.sel) return;
    const quote = '> ' + state.sel.replace(/\n+/g, '\n> ');
    try {
      await navigator.clipboard.writeText(quote);
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => { if (btn) btn.textContent = orig; }, 1500);
      }
    } catch {}
  });

  const updateMergeUI = () => {
    const mergeBtn = q('.btn-merge');
    const clearBtn = q('.btn-clear-merge');
    if (mergeBtn) {
      mergeBtn.classList.toggle('on', !!state.appendMode);
      mergeBtn.innerHTML = state.appendMode
        ? `<span>Merging (${state.blocks.length})</span>`
        : `<span>+ Merge</span>`;
    }
    if (clearBtn) {
      clearBtn.hidden = (state.blocks.length === 0 && !state.appendMode);
      if (state.blocks.length > 0) {
        clearBtn.innerHTML = `<span>Clear (${state.blocks.length})</span>`;
      }
    }
  };

  q('.btn-recapture')?.addEventListener('click', () => doRecapture(true));

  q('.btn-merge')?.addEventListener('click', () => {
    state.appendMode = !state.appendMode;
    if (state.appendMode) {
      startCollecting();
    } else {
      stopCollecting();
    }
    updateMergeUI();
  });

  q('.btn-clear-merge')?.addEventListener('click', () => {
    state.blocks = [];
    state.blockChars = 0;
    state.seen.clear();
    state.seenLinks.clear();
    state.links = [];
    state.appendMode = false;
    stopCollecting();
    readPage();
    updateMergeUI();
  });

  const selectFrameScope = index => {
    state.activeFrameIndex = index;
    state.localMd = null;
    state.formattedHtml = null;
    state.seenLinks.clear();
    state.links = [];
    state.blocks = [];
    state.blockChars = 0;
    state.seen.clear();
    readPage();
    renderPageMeta();
    syncSlideUI(state.slide);
  };

  q('.head-frame-banner .btn-return-main')?.addEventListener('click', () => {
    selectFrameScope(-1);
  });

  q('.page-meta')?.addEventListener('click', e => {
    const pickBtn = e.target.closest('[data-pick-frame]');
    if (!pickBtn) return;
    const idx = parseInt(pickBtn.getAttribute('data-pick-frame'), 10);
    selectFrameScope(idx);
  });

  // Deck scrolling & pagination: high-performance rAF updates tabs & dots instantly
  const track = q('.deck-track');
  let rAF = 0;
  track.addEventListener('scroll', () => {
    if (rAF) return;
    rAF = requestAnimationFrame(() => {
      rAF = 0;
      const w = track.clientWidth;
      if (!w) return;
      const slides = getSlides();
      const idx = Math.round(track.scrollLeft / w);
      const clamped = Math.max(0, Math.min(slides.length - 1, idx));
      if (clamped !== state.slide) {
        syncSlideTabsAndDots(clamped);
        renderActiveSlide(clamped);
      }
    });
  }, { passive: true });

  root.querySelectorAll('.deck-tab').forEach(tab => {
    tab.onclick = () => {
      const visibleTabs = Array.from(root.querySelectorAll('.deck-tab:not([hidden])'));
      const i = visibleTabs.indexOf(tab);
      if (i >= 0) goToSlide(i);
    };
  });

  root.querySelectorAll('.pager .dot').forEach(dot => {
    dot.onclick = () => {
      const visibleDots = Array.from(root.querySelectorAll('.pager .dot:not([hidden])'));
      const i = visibleDots.indexOf(dot);
      if (i >= 0) goToSlide(i);
    };
  });

  q('.meta-toggle').onclick = () => toggleMeta();
  const expandBtn = q('.expand-btn');
  if (expandBtn) expandBtn.onclick = () => toggleFullscreen(true);
  const returnBtn = q('.return-btn');
  if (returnBtn) returnBtn.onclick = () => toggleFullscreen(false);
  q('.backdrop').onclick = closeDrawer;

  const copyBtn = q('.copy-btn');
  if (copyBtn) {
    copyBtn.onclick = async () => {
      const text = getSlideText(state.slide);
      try {
        await navigator.clipboard.writeText(text);
        copyBtn.innerHTML = svg(ICON.check);
        copyBtn.classList.add('copied');
        copyBtn.title = 'Copied!';
      } catch {
        copyBtn.title = 'Copy blocked';
      }
      setTimeout(() => {
        copyBtn.innerHTML = svg(ICON.copy);
        copyBtn.classList.remove('copied');
        copyBtn.title = 'Copy';
      }, 1500);
    };
  }

  // The clipboard is the route with no ceiling, and it needs the user gesture
  // it is already inside. A refusal is reported on the button rather than
  // thrown away, since a Copy that silently did nothing is the worst outcome.
  if (copyEl) {
    copyEl.onclick = () => {
      copyText(getSlideText(state.slide), copyEl);
    };
  }
  if (sendEl) sendEl.addEventListener('click', () => setTimeout(closeDrawer, 300));

  const handleStoreGesture = async (e, el) => {
    const payload = buildCapturePayload(state.slide);
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    } catch {}
    if (el) {
      const orig = el.innerHTML;
      el.classList.add('stored');
      const span = el.querySelector('span');
      if (span) span.textContent = 'Stored ✓';
      setTimeout(() => {
        el.classList.remove('stored');
        el.innerHTML = orig;
      }, 1500);
    }
  };

  if (storeBtn) storeBtn.addEventListener('click', e => handleStoreGesture(e, storeBtn));
  if (btnStore) btnStore.addEventListener('click', e => handleStoreGesture(e, btnStore));
  if (storeEl) storeEl.addEventListener('click', e => {
    handleStoreGesture(e, storeEl);
    setTimeout(closeDrawer, 300);
  });


  const updateAutoCheckUI = () => {
    const on = !!state.autoCheck;
    qa('[data-toggle-autocheck]').forEach(el => {
      const pill = el.classList.contains('meta-pref-btn') ? el : el.querySelector('.pill-toggle');
      if (pill) {
        pill.textContent = on ? 'ON' : 'OFF';
        pill.classList.toggle('on', on);
        pill.classList.toggle('off', !on);
      }
    });
  };
  updateAutoCheckUI();

  qa('[data-toggle-autocheck]').forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();
      state.autoCheck = !state.autoCheck;
      setPref('autocheck_updates', state.autoCheck);
      updateAutoCheckUI();
    };
  });

  const menuUpdate = q('[data-menu-update]');
  if (menuUpdate) {
    menuUpdate.onclick = async e => {
      e.stopPropagation();
      const origHtml = `${svg(ICON.refresh)}<span>Check for updates</span>`;
      menuUpdate.disabled = true;
      menuUpdate.innerHTML = `${svg(ICON.refresh)}<span>Checking…</span>`;
      const s = menuUpdate.querySelector('svg');
      let anim = null;
      if (s) anim = s.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(360deg)' }], { duration: 600, iterations: Infinity });

      const res = await checkBuild(true);
      if (anim) anim.cancel();
      menuUpdate.disabled = false;

      if (res?.type === 'downloaded') {
        menuUpdate.innerHTML = `<span style="color:var(--wt-p);font-weight:600">Build ${res.build} downloaded · Tap to reload ↺</span>`;
        menuUpdate.onclick = ev => { ev.stopPropagation(); location.reload(); };
      } else if (res?.type === 'available') {
        menuUpdate.innerHTML = `<a href="${res.url}" target="_blank" rel="noopener" style="color:inherit">Build ${res.build} available ↗</a>`;
      } else if (res?.type === 'current') {
        menuUpdate.innerHTML = `<span style="color:oklch(65% .18 140)">✓ Build ${BUILD} is current</span>`;
        setTimeout(() => { if (menuUpdate && !menuUpdate.textContent.includes('downloaded')) menuUpdate.innerHTML = origHtml; }, 3500);
      } else {
        menuUpdate.innerHTML = `<span style="color:oklch(65% .18 30)">Check failed (${res?.error || 'network error'})</span>`;
        setTimeout(() => { if (menuUpdate && !menuUpdate.textContent.includes('downloaded')) menuUpdate.innerHTML = origHtml; }, 3500);
      }
    };
  }

  q('[data-hide]').onclick = () => { stopCollecting(); host.remove(); };
  menu.addEventListener('click', e => { if (e.target.closest('.row')) setMenu(false); });
  addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!menu.hidden) setMenu(false); else closeDrawer();
  });

  // ---- The launcher's three gestures, in the fab's order ------------------
  //
  // Tap opens the drawer, a held finger opens the short menu, a drag moves it.
  // Past 6px the pointer sequence is a drag and the tap is spent; a fired long
  // press spends it too, so the pointerup behind the menu cannot toggle the
  // drawer as well. Position is per-origin and survives reloads: a launcher
  // that lands on the reader's content and cannot be moved off it is worse
  // than none.
  const POS = 'wt-launcher-pos';
  let pos = { right: 24, bottom: 24 };
  try { Object.assign(pos, JSON.parse(localStorage.getItem(POS) || '{}')); } catch {}
  const place = () => { wrap.style.right = pos.right + 'px'; wrap.style.bottom = pos.bottom + 'px'; };
  place();

  let drag = null, held = 0;
  btn.addEventListener('pointerdown', e => {
    drag = { x: e.clientX, y: e.clientY, right: pos.right, bottom: pos.bottom, moved: false, spent: false };
    btn.setPointerCapture(e.pointerId);
    held = setTimeout(() => {
      if (!drag || drag.moved) return;
      drag.spent = true;
      closeDrawer();
      setMenu(true);
    }, 500);
  });
  btn.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = drag.x - e.clientX, dy = drag.y - e.clientY;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    drag.moved = true;
    clearTimeout(held);
    const w = window.visualViewport?.width || innerWidth;
    const h = window.visualViewport?.height || innerHeight;
    pos.right = Math.max(4, Math.min(w - 60, drag.right + dx));
    pos.bottom = Math.max(4, Math.min(h - 60, drag.bottom + dy));
    place();
  });
  btn.addEventListener('pointerup', () => {
    if (!drag) return;
    clearTimeout(held);
    if (drag.moved) { try { localStorage.setItem(POS, JSON.stringify(pos)); } catch {} }
    else if (!drag.spent) {
      if (!menu.hidden) setMenu(false);
      else panel.classList.contains('open') ? closeDrawer() : openDrawer();
    }
    drag = null;
  });
  // A right-click raises the SAME menu and does only that, spending the gesture
  // the way a fired long press does.
  btn.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (drag) drag.spent = true;
    closeDrawer();
    setMenu(true);
  });

  const headTitle = q('.head-title .title-text');
  if (headTitle) headTitle.textContent = page.title;
  const headSub = q('.head-sub span');
  if (headSub) headSub.textContent = `${location.hostname} · ${BUILD} · built ${age(BUILT)}`;

  // Asked on drawer open (if autoCheck) and on refresh, and never allowed to fail loudly.
  let lastBuildCheck = 0;
  const CHECK_COOLDOWN = 30 * 1000;
  const checkBuild = async (force = false) => {
    const now = Date.now();
    if (!force && (now - lastBuildCheck < CHECK_COOLDOWN)) return { type: 'cooldown' };
    lastBuildCheck = now;
    const el = q('.stale');
    const headSubSpan = q('.head-sub span');
    try {
      const raw = await fetchText(MANIFEST + '?_=' + Date.now(), { Accept: 'application/json, */*' });
      const current = JSON.parse(raw)?.launcher?.build;
      if (!current || current === BUILD) {
        if (el) {
          if (force) {
            const sCount = (state.shadowRoots && state.shadowRoots.length) || 0;
            const fCount = (state.frames && state.frames.length) || 0;
            const sMsg = sCount ? `${sCount} shadow root${sCount > 1 ? 's' : ''}` : 'no shadow DOM';
            const fMsg = fCount ? ` · ${fCount} frame${fCount > 1 ? 's' : ''}` : '';
            el.textContent = `Build ${BUILD} is current · ${sMsg}${fMsg} on page`;
            el.style.color = 'oklch(60% .18 140)';
            el.hidden = false;
            setTimeout(() => { if (el.textContent.includes('is current')) el.hidden = true; }, 3500);
          } else {
            el.hidden = true;
          }
        }
        if (force && headSubSpan) {
          headSubSpan.textContent = `✓ Build ${BUILD} is current`;
        }
        return { type: 'current', build: BUILD };
      }

      const setVal = (typeof GM !== 'undefined' && GM.setValue) ? GM.setValue.bind(GM)
        : (typeof GM_setValue !== 'undefined' ? (k, v) => Promise.resolve(GM_setValue(k, v)) : null);

      if (setVal) {
        if (el) {
          el.textContent = `Downloading build ${current}…`;
          el.style.color = 'var(--wt-p)';
          el.hidden = false;
        }
        if (headSubSpan) headSubSpan.textContent = `Downloading build ${current}…`;
        try {
          const freshCode = await fetchText(`https://raw.githubusercontent.com/mehrlander/web-tools/${REF}/userscripts/lib/launcher.js?_=${Date.now()}`);
          if (freshCode && freshCode.includes('window.wtLauncher')) {
            await setVal('wt_launcher_code', freshCode);
            await setVal('wt_launcher_build', current);
            if (el) {
              el.innerHTML = `Build ${current} downloaded · <a href="#" style="color:inherit;text-decoration:underline">Reload page to apply ↺</a>`;
              el.style.color = 'oklch(60% .18 140)';
              el.querySelector('a')?.addEventListener('click', e => { e.preventDefault(); location.reload(); });
            }
            if (headSubSpan) headSubSpan.textContent = `Build ${current} ready · Tap to reload ↺`;
            return { type: 'downloaded', build: current };
          }
        } catch { /* if background fetch fails, fall through to link */ }
      }

      const updateUrl = `https://raw.githubusercontent.com/mehrlander/web-tools/${REF}/userscripts/launcher.user.js?_=${Date.now()}`;
      if (el) {
        el.innerHTML = `<a href="${updateUrl}" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">Build ${current} available · Tap to update ↗</a>`;
        el.style.color = '';
        el.hidden = false;
      }
      if (headSubSpan) headSubSpan.textContent = `Build ${current} available ↗`;
      return { type: 'available', build: current, url: updateUrl };
    } catch (err) {
      if (force) {
        if (el) {
          el.textContent = `Check failed: ${err.message || 'network error'}`;
          el.style.color = 'oklch(60% .18 30)';
          el.hidden = false;
          setTimeout(() => { if (el.textContent.includes('Check failed')) el.hidden = true; }, 3500);
        }
        if (headSubSpan) {
          headSubSpan.textContent = `Check failed (${err.message || 'offline'})`;
        }
      }
      return { type: 'error', error: err.message };
    }
  };
  document.documentElement.append(host);
  window.__wtLauncherMounted = true;
  window.__wtLauncherMounting = false;

  // The second half of the yield rule. A web-tools page boots its loader and
  // mounts the real fab after document-end, so the synchronous check above can
  // miss it; watching until it appears is what keeps the two from standing side
  // by side. Ten seconds is a boot that has plainly not happened.
  const watch = new MutationObserver(() => {
    if (!realFab() && !hasWebToolsScript()) return;
    stopCollecting();
    host.remove();
    watch.disconnect();
    window.__wtLauncherMounted = false;
  });
  watch.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => watch.disconnect(), 10000);
};
